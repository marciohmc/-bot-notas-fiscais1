import os
import re
import base64
from datetime import datetime
from typing import Tuple
from fastapi import FastAPI, Request
import requests

from sheets_service import (
    salvar_na_planilha,
    extrair_aba_mes_ano,
    normalizar_data,
    normalizar_texto,
    normalizar_valor_float,
)

app = FastAPI(title="Meu Bot de Finanças — Telegram + OCR.space + Google Sheets")

# Armazenamento temporário em memória para dados de recibos aguardando categoria
# Chave: estado_id (file_unique_id curto, seguro para o limite de 64 bytes do callback_data do Telegram)
DADOS_TEMPORARIOS = {}

# Cache rápido em memória de comprovantes já salvos para bloquear reenvios imediatos da mesma mídia
COMPROVANTES_PROCESSADOS = set()


# 1. Função para enviar mensagem com botões de seleção de categoria (Inline Keyboard)
def enviar_mensagem_com_botoes(chat_id: int, texto: str, estado_id: str):
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"

    reply_markup = {
        "inline_keyboard": [
            [
                {"text": "Despesa", "callback_data": f"cat|Despesa|{estado_id}"},
                {"text": "Adiantamento", "callback_data": f"cat|Adiantamento|{estado_id}"}
            ],
            [
                {"text": "Manutenção", "callback_data": f"cat|Manutenção|{estado_id}"},
                {"text": "Combustível", "callback_data": f"cat|Combustível|{estado_id}"}
            ],
            [
                {"text": "Material", "callback_data": f"cat|Material|{estado_id}"},
                {"text": "Ferramentas", "callback_data": f"cat|Ferramentas|{estado_id}"}
            ],
            [
                {"text": "Outros", "callback_data": f"cat|Outros|{estado_id}"}
            ]
        ]
    }

    payload = {
        "chat_id": chat_id,
        "text": texto,
        "parse_mode": "Markdown",
        "reply_markup": reply_markup
    }
    try:
        res = requests.post(url, json=payload, timeout=15)
        res.raise_for_status()
    except Exception as e:
        print(f"Erro ao enviar mensagem com botões ao Telegram: {e}")


# 2. Função para enviar mensagens de texto simples
def enviar_mensagem_telegram(chat_id: int, texto: str):
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    try:
        requests.post(
            url,
            json={"chat_id": chat_id, "text": texto, "parse_mode": "Markdown"},
            timeout=15
        )
    except Exception as e:
        print(f"Erro ao enviar mensagem simples ao Telegram: {e}")


# 3. Função para responder à interatividade do botão (callback query)
def responder_callback_query(callback_query_id: str, texto: str):
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    url = f"https://api.telegram.org/bot{bot_token}/answerCallbackQuery"
    try:
        requests.post(
            url,
            json={"callback_query_id": callback_query_id, "text": texto},
            timeout=10
        )
    except Exception as e:
        print(f"Erro ao responder callback_query: {e}")


# 4. Passo 2 e 3: Consultar getFile no Telegram, montar a URL Oficial e baixar os bytes
def baixar_arquivo_telegram(file_id: str) -> Tuple[bytes, str]:
    """
    Consulta https://api.telegram.org/bot<TOKEN>/getFile?file_id=<ID>,
    monta o link oficial permanente https://api.telegram.org/file/bot<TOKEN>/<file_path>
    e retorna (conteudo_bytes, file_url).
    """
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    try:
        res_info = requests.get(
            f"https://api.telegram.org/bot{bot_token}/getFile",
            params={"file_id": file_id},
            timeout=15
        )
        res_info.raise_for_status()
        dados_json = res_info.json()
        if not dados_json.get("ok"):
            raise ValueError(f"Erro no getFile do Telegram: {dados_json}")

        file_path = dados_json["result"]["file_path"]
        file_url = f"https://api.telegram.org/file/bot{bot_token}/{file_path}"

        response = requests.get(file_url, timeout=30)
        response.raise_for_status()
        return response.content, file_url
    except Exception as e:
        raise RuntimeError(f"Falha no download do arquivo no Telegram: {str(e)}")


# 5. Função para realizar OCR via OCR.space API (Seguindo especificações rigorosas)
def processar_ocr_space(
    arquivo_bytes: bytes,
    mime_type: str = "image/jpeg",
    usar_base64: bool = True,
    ocr_engine: str = "2"
) -> str:
    api_key = os.environ.get("OCR_SPACE_API_KEY", "")
    if not api_key:
        raise ValueError("Variável de ambiente OCR_SPACE_API_KEY não configurada.")

    # Validação do limite de 1 MB (1.024 KB) do plano gratuito do OCR.space
    if len(arquivo_bytes) > 1024 * 1024:
        tamanho_kb = len(arquivo_bytes) / 1024
        raise ValueError(
            f"O arquivo ({tamanho_kb:.0f} KB) excede o limite de 1 MB (1024 KB) do plano gratuito do OCR.space."
        )

    headers = {
        "apikey": api_key
    }

    payload = {
        "language": "por",
        "OCREngine": ocr_engine,
        "isTable": "true",
        "scale": "true"
    }

    try:
        if usar_base64:
            b64_str = base64.b64encode(arquivo_bytes).decode("utf-8")
            payload["base64Image"] = f"data:{mime_type};base64,{b64_str}"
            response = requests.post(
                "https://api.ocr.space/parse/image",
                headers=headers,
                data=payload,
                timeout=45
            )
        else:
            extensao = "pdf" if "pdf" in mime_type else "jpg"
            files = {
                "file": (f"receipt.{extensao}", arquivo_bytes, mime_type)
            }
            response = requests.post(
                "https://api.ocr.space/parse/image",
                headers=headers,
                data=payload,
                files=files,
                timeout=45
            )

        response.raise_for_status()
        result = response.json()

        if result.get("IsErroredOnProcessing"):
            mensagens_erro = result.get("ErrorMessage", ["Erro desconhecido no OCR.space"])
            raise RuntimeError(
                mensagens_erro[0] if isinstance(mensagens_erro, list) else str(mensagens_erro)
            )

        parsed_results = result.get("ParsedResults", [])
        if not parsed_results:
            return ""

        return "\n".join(p.get("ParsedText", "") for p in parsed_results)

    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Erro de conexão com a API do OCR.space: {str(e)}")


# 6. Lógica para extrair dados estruturados a partir do texto lido
def extrair_dados_recibo(texto: str):
    linhas = [l.strip() for l in texto.split("\n") if l.strip()]
    estabelecimento = linhas[0] if linhas else "Desconhecido"

    match_data = re.search(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", texto)
    data = normalizar_data(match_data.group(0)) if match_data else datetime.now().strftime("%d/%m/%Y")

    valores = re.findall(r"\b(?:\d{1,3}(?:\.\d{3})*|\d+)[\.,]\d{2}\b", texto)
    valor = 0.0
    if valores:
        valor = normalizar_valor_float(valores[-1])

    texto_upper = texto.upper()
    if "PIX" in texto_upper:
        pagamento = "PIX"
    elif "CREDITO" in texto_upper or "CRÉDITO" in texto_upper:
        pagamento = "Cartão de Crédito"
    elif "DEBITO" in texto_upper or "DÉBITO" in texto_upper:
        pagamento = "Cartão de Débito"
    elif "DINHEIRO" in texto_upper or "ESPÉCIE" in texto_upper:
        pagamento = "Dinheiro"
    else:
        pagamento = "Outros"

    if "NOTA FISCAL" in texto_upper or "DANFE" in texto_upper or "NF-E" in texto_upper:
        tipo_documento = "Nota Fiscal"
    elif "CUPOM" in texto_upper or "SAT" in texto_upper or "NFC-E" in texto_upper:
        tipo_documento = "Cupom Fiscal"
    else:
        tipo_documento = "Recibo"

    return {
        "data": data,
        "estabelecimento": estabelecimento,
        "tipo_documento": tipo_documento,
        "valor": valor,
        "pagamento": pagamento
    }


def extrair_nome_remetente(usuario: dict) -> str:
    if not usuario:
        return "Não identificado"
    primeiro_nome = usuario.get("first_name", "").strip()
    sobrenome = usuario.get("last_name", "").strip()
    username = usuario.get("username", "").strip()

    nome_completo = f"{primeiro_nome} {sobrenome}".strip()
    if nome_completo and username:
        return f"{nome_completo} (@{username})"
    if nome_completo:
        return nome_completo
    if username:
        return f"@{username}"
    return str(usuario.get("id", "Não identificado"))


@app.get("/")
async def health_check():
    return {"status": "online", "service": "FinBot OCR Telegram Webhook"}


@app.post("/webhook")
async def telegram_webhook(request: Request):
    try:
        data = await request.json()
    except Exception:
        return {"status": "invalid_json"}

    # 1. Passo 1: Recebimento da foto (photo[-1]) ou documento no Telegram
    if "message" in data and ("photo" in data["message"] or "document" in data["message"]):
        message = data["message"]
        chat_id = message["chat"]["id"]
        caption = message.get("caption", "")
        sender_name = extrair_nome_remetente(message.get("from", {}))

        if "photo" in message:
            melhor_foto = message["photo"][-1]
            file_id = melhor_foto["file_id"]
            estado_id = melhor_foto.get("file_unique_id", file_id[:20])
            mime_type = "image/jpeg"
        else:
            doc = message["document"]
            file_id = doc["file_id"]
            estado_id = doc.get("file_unique_id", file_id[:20])
            mime_type = doc.get("mime_type", "application/pdf")

        # Checagem rápida se exatamente a mesma mídia já foi processada na sessão
        if estado_id in COMPROVANTES_PROCESSADOS:
            enviar_mensagem_telegram(
                chat_id,
                "⚠️ *Arquivo Duplicado:* Esta mesma imagem/PDF já foi processada e salva anteriormente na planilha."
            )
            return {"status": "duplicate_file_ignored"}

        try:
            # Passo 2 e 3: Baixa os bytes e obtém o file_url oficial do Telegram
            arquivo_bytes, file_url = baixar_arquivo_telegram(file_id)
            texto_extraido = processar_ocr_space(arquivo_bytes, mime_type=mime_type)
            dados = extrair_dados_recibo(texto_extraido)

            aba_mes_ano = extrair_aba_mes_ano(dados.get("data", ""))
            dados["observacoes"] = caption
            dados["responsavel"] = sender_name
            dados["file_id"] = file_id
            dados["file_url"] = file_url
            dados["aba_mes"] = aba_mes_ano
            dados["texto_ocr"] = texto_extraido

            # Salva dados extraídos temporariamente em memória usando o estado_id curto
            DADOS_TEMPORARIOS[estado_id] = dados

            obs_text = f"\n• *Obs:* {caption}" if caption else ""
            msg_prompt = (
                f"🧾 *Leitura do Recibo Concluída!*\n\n"
                f"• *Responsável:* {sender_name}\n"
                f"• *Local:* {dados.get('estabelecimento')}\n"
                f"• *Tipo Doc:* {dados.get('tipo_documento')}\n"
                f"• *Data:* {dados.get('data')} _(Aba: {aba_mes_ano})_\n"
                f"• *Valor:* R$ {dados.get('valor'):.2f}\n"
                f"• *Pagamento:* {dados.get('pagamento')}\n"
                f"• *Comprovante:* [Abrir Link Oficial]({file_url})"
                f"{obs_text}\n\n"
                f"Por favor, selecione a *categoria* do gasto abaixo:"
            )
            enviar_mensagem_com_botoes(chat_id, msg_prompt, estado_id)

        except Exception as e:
            enviar_mensagem_telegram(chat_id, f"⚠️ Erro ao processar a nota fiscal: {str(e)}")

    # 2. Passo 4: Trata a seleção de botões inline (callback_query) e grava com USER_ENTERED
    elif "callback_query" in data:
        callback = data["callback_query"]
        callback_id = callback["id"]
        chat_id = callback["message"]["chat"]["id"]
        callback_data = callback.get("data", "")

        if callback_data.startswith("cat|"):
            _, categoria, estado_id = callback_data.split("|", 2)

            dados = DADOS_TEMPORARIOS.pop(estado_id, None)

            if dados:
                dados["categoria"] = categoria
                sender_name = dados.get("responsavel") or extrair_nome_remetente(callback.get("from", {}))
                caption = dados.get("observacoes", "")
                file_url = dados.get("file_url", "")
                texto_ocr = dados.get("texto_ocr", "")

                chave_assinatura = (
                    normalizar_data(dados.get("data", "")),
                    normalizar_texto(dados.get("estabelecimento", "")),
                    normalizar_valor_float(dados.get("valor", 0.0))
                )

                resultado = salvar_na_planilha(
                    dados_extracao=dados,
                    sender_name=sender_name,
                    caption=caption,
                    file_url=file_url,
                    texto_ocr=texto_ocr
                )

                if resultado.get("sucesso"):
                    COMPROVANTES_PROCESSADOS.add(estado_id)
                    COMPROVANTES_PROCESSADOS.add(chave_assinatura)
                    aba_salva = resultado.get("aba", "Geral")
                    responder_callback_query(
                        callback_id,
                        f"Salvo na aba '{aba_salva}' ({categoria})!"
                    )

                    obs_text = f"\n• *Obs:* {caption}" if caption else ""
                    msg_sucesso = (
                        f"✅ *Gasto Registrado no Google Sheets!*\n\n"
                        f"• *Aba (Mês-Ano):* {aba_salva}\n"
                        f"• *Responsável:* {sender_name}\n"
                        f"• *Local:* {dados.get('estabelecimento')}\n"
                        f"• *Tipo Doc:* {dados.get('tipo_documento')}\n"
                        f"• *Data:* {dados.get('data')}\n"
                        f"• *Valor:* R$ {dados.get('valor'):.2f}\n"
                        f"• *Categoria:* {categoria}\n"
                        f"• *Pagamento:* {dados.get('pagamento')}\n"
                        f"• *Receipt Link:* [Ver Comprovante]({file_url})"
                        f"{obs_text}"
                    )
                    enviar_mensagem_telegram(chat_id, msg_sucesso)
                elif resultado.get("duplicado"):
                    responder_callback_query(callback_id, "⚠️ Comprovante duplicado bloqueado!")
                    motivo = resultado.get("erro") or "Este comprovante já consta na planilha."
                    enviar_mensagem_telegram(
                        chat_id,
                        f"🚫 *Gravação Bloqueada (Duplicidade Detectada)*\n\n"
                        f"• *Aba Verificada:* {resultado.get('aba')}\n"
                        f"• *Motivo:* {motivo}\n\n"
                        f"_O lançamento não foi duplicado na planilha._"
                    )
                else:
                    # Restaura os dados em memória para não perder a leitura caso o Google Sheets falhe
                    DADOS_TEMPORARIOS[estado_id] = dados
                    responder_callback_query(callback_id, "Erro ao gravar na planilha.")
                    enviar_mensagem_telegram(
                        chat_id,
                        f"⚠️ Erro ao salvar na planilha: {resultado.get('erro')}"
                    )
            else:
                responder_callback_query(callback_id, "Dados expirados ou já processados.")
                enviar_mensagem_telegram(
                    chat_id,
                    "⚠️ Os dados deste recibo expiraram ou já foram salvos."
                )

    return {"status": "ok"}
