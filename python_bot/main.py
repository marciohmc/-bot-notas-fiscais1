import os
import json
import re
import base64
from datetime import datetime
from fastapi import FastAPI, Request
import gspread
from google.oauth2.service_account import Credentials
import requests

app = FastAPI(title="Meu Bot de Finanças — Telegram + OCR.space + Google Sheets")

# Armazenamento temporário em memória para dados de recibos aguardando categoria
# Chave: file_unique_id (curto, seguro para o limite de 64 bytes do callback_data do Telegram)
DADOS_TEMPORARIOS = {}


# 1. Configuração do Google Sheets com tratamento de erros e suporte robusto a credenciais
def obter_planilha():
    creds_raw = (
        os.environ.get("GOOGLE_CREDENTIALS_JSON")
        or os.environ.get("GOOGLE_CREDENTIALS")
        or ""
    ).strip()

    if not creds_raw:
        raise RuntimeError(
            "A variável de ambiente GOOGLE_CREDENTIALS_JSON está vazia ou não foi configurada no painel Environment do Render."
        )

    # Remove aspas simples ou duplas externas caso tenham sido coladas acidentalmente no Render
    if (creds_raw.startswith("'") and creds_raw.endswith("'")) or (
        creds_raw.startswith('"') and creds_raw.endswith('"')
    ):
        creds_raw = creds_raw[1:-1].strip()

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
    ]

    try:
        # Caso 1: É um caminho para arquivo JSON (ex: Secret Files no Render ou arquivo local)
        if os.path.isfile(creds_raw):
            creds = Credentials.from_service_account_file(creds_raw, scopes=scopes)
        else:
            # Caso 2: Caso o usuário tenha codificado o JSON em Base64
            if not creds_raw.startswith("{"):
                try:
                    creds_raw = base64.b64decode(creds_raw).decode("utf-8").strip()
                except Exception:
                    pass

            creds_dict = json.loads(creds_raw)
            # Garante que quebras de linha escapadas na private_key funcionem corretamente
            if "private_key" in creds_dict and "\\n" in creds_dict["private_key"]:
                creds_dict["private_key"] = creds_dict["private_key"].replace("\\n", "\n")

            creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)

        client = gspread.authorize(creds)
        sheet_id = (
            os.environ.get("SPREADSHEET_ID")
            or os.environ.get("GOOGLE_SHEET_ID")
            or ""
        ).strip()

        if not sheet_id:
            raise RuntimeError(
                "A variável de ambiente SPREADSHEET_ID não foi configurada no Render."
            )

        return client.open_by_key(sheet_id).sheet1
    except json.JSONDecodeError as je:
        raise RuntimeError(
            f"O conteúdo de GOOGLE_CREDENTIALS_JSON não é um JSON válido (verifique se colou o arquivo inteiro começando com '{{'): {str(je)}"
        )
    except Exception as e:
        raise RuntimeError(f"Falha ao conectar ao Google Sheets: {str(e)}")


# 2. Função para enviar mensagem com botões de seleção de categoria (Inline Keyboard)
def enviar_mensagem_com_botoes(chat_id: int, texto: str, estado_id: str):
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"

    # IMPORTANTE: Usamos `estado_id` (file_unique_id) em vez do `file_id` completo,
    # pois o Telegram impõe limite máximo de 64 bytes no campo `callback_data`.
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


# 3. Função para enviar mensagens de texto simples
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


# 4. Função para responder à interatividade do botão (callback query)
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


# 5. Função para baixar imagem ou PDF recebido no Telegram
def baixar_arquivo_telegram(file_id: str) -> bytes:
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
        return response.content
    except Exception as e:
        raise RuntimeError(f"Falha no download do arquivo no Telegram: {str(e)}")


# 6. Função para realizar OCR via OCR.space API (Seguindo especificações rigorosas)
def processar_ocr_space(
    arquivo_bytes: bytes,
    mime_type: str = "image/jpeg",
    usar_base64: bool = True,
    ocr_engine: str = "2"
) -> str:
    """
    Regras aplicadas da API do OCR.space:
    - Chave enviada no header HTTP: {"apikey": OCR_SPACE_API_KEY}
    - Verificação do limite de 1 MB (1.048.576 bytes) do plano gratuito
    - Suporte a envio Base64 com prefixo obrigatório (data:image/jpeg;base64,... ou data:application/pdf;base64,...)
      ou multipart file.
    """
    api_key = os.environ.get("OCR_SPACE_API_KEY", "")
    if not api_key:
        raise ValueError("Variável de ambiente OCR_SPACE_API_KEY não configurada.")

    # Validação do limite de 1 MB do plano gratuito do OCR.space
    if len(arquivo_bytes) > 1024 * 1024:
        tamanho_kb = len(arquivo_bytes) / 1024
        raise ValueError(
            f"O arquivo ({tamanho_kb:.0f} KB) excede o limite de 1 MB (1024 KB) do plano gratuito do OCR.space."
        )

    # Especificação: Enviar a chave de API no header `apikey`
    headers = {
        "apikey": api_key
    }

    payload = {
        "language": "por",
        "OCREngine": ocr_engine,  # "2" para recibos gerais ou "3" para tabelas complexas
        "isTable": "true",
        "scale": "true"
    }

    try:
        if usar_base64:
            # Prefixo obrigatório exigido pelo OCR.space para Base64
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

        # Concatena até 3 páginas (limite do plano gratuito para PDFs)
        return "\n".join(p.get("ParsedText", "") for p in parsed_results)

    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Erro de conexão com a API do OCR.space: {str(e)}")


# 7. Lógica para extrair dados estruturados a partir do texto lido
def extrair_dados_recibo(texto: str):
    linhas = [l.strip() for l in texto.split("\n") if l.strip()]
    estabelecimento = linhas[0] if linhas else "Desconhecido"

    match_data = re.search(r"\b\d{2}/\d{2}/\d{2,4}\b", texto)
    data = match_data.group(0) if match_data else datetime.now().strftime("%d/%m/%Y")

    # Suporta valores com milhar (ex: 1.250,50 ou 461,90)
    valores = re.findall(r"\b(?:\d{1,3}(?:\.\d{3})*|\d+)[\.,]\d{2}\b", texto)
    valor = 0.0
    if valores:
        try:
            ultimo_valor = valores[-1]
            if "," in ultimo_valor and "." in ultimo_valor:
                ultimo_valor = ultimo_valor.replace(".", "").replace(",", ".")
            else:
                ultimo_valor = ultimo_valor.replace(",", ".")
            valor = float(ultimo_valor)
        except ValueError:
            valor = 0.0

    # Identificação automática da forma de pagamento
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

    return {
        "data": data,
        "estabelecimento": estabelecimento,
        "valor": valor,
        "pagamento": pagamento
    }


def extrair_nome_remetente(usuario: dict) -> str:
    """
    Extrai o nome completo ou @username de quem enviou o comprovante no grupo do Telegram.
    """
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


@app.post("/webhook")
async def telegram_webhook(request: Request):
    try:
        data = await request.json()
    except Exception:
        return {"status": "invalid_json"}

    # 1. Trata o recebimento de foto ou documento (PDF/Imagem) no Telegram
    if "message" in data and ("photo" in data["message"] or "document" in data["message"]):
        message = data["message"]
        chat_id = message["chat"]["id"]
        caption = message.get("caption", "")

        # Identifica quem enviou o comprovante (Coluna Responsável)
        responsavel = extrair_nome_remetente(message.get("from", {}))

        if "photo" in message:
            melhor_foto = message["photo"][-1]
            file_id = melhor_foto["file_id"]
            # file_unique_id tem ~16 caracteres (evita estourar os 64 bytes do callback_data!)
            estado_id = melhor_foto.get("file_unique_id", file_id[:20])
            mime_type = "image/jpeg"
        else:
            doc = message["document"]
            file_id = doc["file_id"]
            estado_id = doc.get("file_unique_id", file_id[:20])
            mime_type = doc.get("mime_type", "application/pdf")

        try:
            arquivo_bytes = baixar_arquivo_telegram(file_id)
            texto_extraido = processar_ocr_space(arquivo_bytes, mime_type=mime_type)
            dados = extrair_dados_recibo(texto_extraido)
            dados["observacoes"] = caption
            dados["responsavel"] = responsavel
            dados["file_id"] = file_id

            # Salva dados extraídos temporariamente em memória usando o estado_id curto
            DADOS_TEMPORARIOS[estado_id] = dados

            obs_text = f"\n• *Observação:* {caption}" if caption else ""
            msg_prompt = (
                f"🧾 *Leitura do Recibo Concluída!*\n\n"
                f"• *Responsável:* {responsavel}\n"
                f"• *Local:* {dados.get('estabelecimento')}\n"
                f"• *Data:* {dados.get('data')}\n"
                f"• *Valor:* R$ {dados.get('valor'):.2f}\n"
                f"• *Pagamento:* {dados.get('pagamento')}"
                f"{obs_text}\n\n"
                f"Por favor, selecione a *categoria* do gasto abaixo:"
            )
            enviar_mensagem_com_botoes(chat_id, msg_prompt, estado_id)

        except Exception as e:
            enviar_mensagem_telegram(chat_id, f"⚠️ Erro ao processar a nota fiscal: {str(e)}")

    # 2. Trata a seleção de botões inline (callback_query)
    elif "callback_query" in data:
        callback = data["callback_query"]
        callback_id = callback["id"]
        chat_id = callback["message"]["chat"]["id"]
        callback_data = callback.get("data", "")

        if callback_data.startswith("cat|"):
            _, categoria, estado_id = callback_data.split("|", 2)

            # Recupera dados temporários associados ao estado_id
            dados = DADOS_TEMPORARIOS.pop(estado_id, None)

            if dados:
                dados["categoria"] = categoria
                if not dados.get("responsavel"):
                    dados["responsavel"] = extrair_nome_remetente(callback.get("from", {}))

                try:
                    planilha = obter_planilha()
                    # Colunas: [Data, Estabelecimento, Valor, Categoria, Forma de Pagamento, Observações, Responsável]
                    linha = [
                        dados.get("data", ""),
                        dados.get("estabelecimento", ""),
                        dados.get("valor", 0.0),
                        dados.get("categoria", ""),
                        dados.get("pagamento", ""),
                        dados.get("observacoes", ""),
                        dados.get("responsavel", "")
                    ]
                    planilha.append_row(linha, value_input_option="USER_ENTERED")

                    responder_callback_query(callback_id, f"Categoria '{categoria}' selecionada!")

                    obs_text = (
                        f"\n• *Observação:* {dados.get('observacoes')}"
                        if dados.get("observacoes")
                        else ""
                    )
                    msg_sucesso = (
                        f"✅ *Gasto Registrado no Google Sheets!*\n\n"
                        f"• *Responsável:* {dados.get('responsavel')}\n"
                        f"• *Local:* {dados.get('estabelecimento')}\n"
                        f"• *Data:* {dados.get('data')}\n"
                        f"• *Valor:* R$ {dados.get('valor'):.2f}\n"
                        f"• *Categoria:* {dados.get('categoria')}\n"
                        f"• *Pagamento:* {dados.get('pagamento')}"
                        f"{obs_text}"
                    )
                    enviar_mensagem_telegram(chat_id, msg_sucesso)
                except Exception as e:
                    # Restaura os dados em memória para não perder a leitura caso o Google Sheets falhe
                    DADOS_TEMPORARIOS[estado_id] = dados
                    responder_callback_query(callback_id, "Erro ao gravar na planilha.")
                    enviar_mensagem_telegram(chat_id, f"⚠️ Erro ao salvar na planilha: {str(e)}")
            else:
                responder_callback_query(callback_id, "Dados expirados ou já processados.")
                enviar_mensagem_telegram(
                    chat_id,
                    "⚠️ Os dados deste recibo expiraram ou já foram salvos."
                )

    return {"status": "ok"}
