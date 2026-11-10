"""
Bot de Automação Financeira no Telegram com OCR.space e Google Sheets
Hospedagem: Render (FastAPI + Uvicorn)
Autor: Arquitetura de Software Sênior
"""

import os
import re
import json
import uuid
import base64
import logging
from datetime import datetime
from typing import Dict, Any, Optional

import httpx
import gspread
from google.oauth2.service_account import Credentials
from fastapi import FastAPI, Request, BackgroundTasks, HTTPException

# =====================================================================
# 1. CONFIGURAÇÃO DE LOGS E VARIÁVEIS DE AMBIENTE
# =====================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("FinBotOCR")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
OCR_SPACE_API_KEY = os.getenv("OCR_SPACE_API_KEY", "")
GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID", "")
GOOGLE_CREDENTIALS_JSON = os.getenv("GOOGLE_CREDENTIALS_JSON", "")
OCR_ENGINE_DEFAULT = os.getenv("OCR_ENGINE_DEFAULT", "2")  # "2" ou "3"

TELEGRAM_API_BASE = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"
TELEGRAM_FILE_BASE = f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}"
OCR_SPACE_ENDPOINT = "https://api.ocr.space/parse/image"

# Categorias solicitadas para o teclado inline
CATEGORIAS_GASTO = [
    "Despesa",
    "Adiantamento",
    "Manutenção",
    "Combustível",
    "Material",
    "Ferramentas",
    "Outros"
]

# =====================================================================
# 2. GERENCIAMENTO DE ESTADO ASSÍNCRONO EM MEMÓRIA
# =====================================================================
# Como o webhook do Telegram é assíncrono e o callback_data tem limite rígido
# de 64 bytes, armazenamos os dados extraídos do recibo em DADOS_TEMPORARIOS
# indexados por um token curto (8 caracteres) ou file_unique_id.
DADOS_TEMPORARIOS: Dict[str, Dict[str, Any]] = {}

app = FastAPI(
    title="Telegram Financial OCR Bot",
    description="Processamento de recibos via OCR.space e persistência no Google Sheets",
    version="1.0.0"
)


# =====================================================================
# 3. CONEXÃO COM GOOGLE SHEETS (GSPREAD)
# =====================================================================
def obter_planilha_google():
    """
    Autentica no Google Cloud via Service Account (JSON em variável de ambiente
    ou arquivo local) e retorna a primeira aba da planilha configurada.
    """
    try:
        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive"
        ]
        if GOOGLE_CREDENTIALS_JSON.strip().startswith("{"):
            cred_dict = json.loads(GOOGLE_CREDENTIALS_JSON)
            creds = Credentials.from_service_account_info(cred_dict, scopes=scopes)
        else:
            creds = Credentials.from_service_account_file(
                GOOGLE_CREDENTIALS_JSON or "service_account.json",
                scopes=scopes
            )
        client = gspread.authorize(creds)
        sheet = client.open_by_key(GOOGLE_SHEET_ID).sheet1
        return sheet
    except Exception as exc:
        logger.error(f"Erro ao autenticar ou abrir planilha no Google Sheets: {exc}")
        raise


def salvar_linha_planilha(dados: Dict[str, Any]) -> bool:
    """
    Insere uma nova linha na planilha com as colunas:
    [Data, Estabelecimento, Valor, Categoria, Forma de Pagamento, Observações]
    """
    try:
        sheet = obter_planilha_google()
        nova_linha = [
            dados.get("data", datetime.now().strftime("%d/%m/%Y")),
            dados.get("estabelecimento", "Não identificado"),
            dados.get("valor", "0,00"),
            dados.get("categoria", "Outros"),
            dados.get("forma_pagamento", "Não informada"),
            dados.get("observacoes", "")
        ]
        sheet.append_row(nova_linha, value_input_option="USER_ENTERED")
        logger.info(f"Registro salvo no Google Sheets com sucesso: {nova_linha}")
        return True
    except Exception as exc:
        logger.error(f"Falha ao gravar registro no Google Sheets: {exc}")
        return False


# =====================================================================
# 4. INTEGRAÇÃO COM A API DO OCR.SPACE
# =====================================================================
async def processar_ocr_space_base64(
    conteudo_bytes: bytes,
    mime_type: str = "image/jpeg",
    ocr_engine: str = OCR_ENGINE_DEFAULT
) -> Optional[str]:
    """
    Envia a imagem ou PDF codificado em Base64 (com prefixo obrigatório) para
    o endpoint https://api.ocr.space/parse/image respeitando os limites do plano gratuito.
    """
    # Verificação de limite de 1 MB (1.048.576 bytes) do plano gratuito do OCR.space
    tamanho_kb = len(conteudo_bytes) / 1024
    if len(conteudo_bytes) > 1024 * 1024:
        logger.warning(f"Arquivo com {tamanho_kb:.1f} KB excede o limite de 1 MB do OCR.space gratuito.")
        return None

    b64_str = base64.b64encode(conteudo_bytes).decode("utf-8")
    # Prefixo obrigatório exigido pelo OCR.space para Base64
    base64_image_payload = f"data:{mime_type};base64,{b64_str}"

    headers = {
        "apikey": OCR_SPACE_API_KEY
    }

    payload = {
        "base64Image": base64_image_payload,
        "language": "por",
        "OCREngine": ocr_engine,  # "2" ou "3" para recibos e tabelas
        "isTable": "true",
        "scale": "true",
        "detectOrientation": "true"
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                OCR_SPACE_ENDPOINT,
                headers=headers,
                data=payload
            )
            response.raise_for_status()
            resultado = response.json()

            if resultado.get("IsErroredOnProcessing"):
                erros = resultado.get("ErrorMessage", ["Erro desconhecido no OCR.space"])
                logger.error(f"OCR.space retornou erro de processamento: {erros}")
                return None

            parsed_results = resultado.get("ParsedResults", [])
            if not parsed_results:
                logger.warning("OCR.space não retornou blocos de texto (ParsedResults vazio).")
                return ""

            texto_completo = "\n".join(
                bloco.get("ParsedText", "") for bloco in parsed_results
            )
            return texto_completo.strip()

    except httpx.TimeoutException:
        logger.error("Timeout ao aguardar resposta da API do OCR.space.")
        return None
    except httpx.HTTPError as exc:
        logger.error(f"Erro HTTP na chamada ao OCR.space: {exc}")
        return None
    except Exception as exc:
        logger.error(f"Erro inesperado ao consultar OCR.space: {exc}")
        return None


# =====================================================================
# 5. PARSER INTELIGENTE DE RECIBOS E NOTAS FISCAIS (REGEX)
# =====================================================================
def extrair_dados_recibo(texto_ocr: str, legenda_usuario: str = "") -> Dict[str, str]:
    """
    Extrai Data, Estabelecimento, Valor Total e Forma de Pagamento a partir do
    texto bruto retornado pelo OCR.space.
    """
    linhas = [linha.strip() for linha in texto_ocr.splitlines() if linha.strip()]

    # 1. Estabelecimento: geralmente primeira linha válida que não seja cabeçalho fiscal genérico
    termos_ignorar = ("CUPOM FISCAL", "NOTA FISCAL", "DANFE", "EXTRATO", "COMPROVANTE", "CNPJ")
    estabelecimento = "Não identificado"
    for linha in linhas[:6]:
        linha_upper = linha.upper()
        if len(linha) > 3 and not any(termo in linha_upper for termo in termos_ignorar):
            estabelecimento = linha[:60]
            break

    # 2. Data: formato DD/MM/AAAA ou DD/MM/AA
    padrao_data = re.compile(r"\b(\d{2}/\d{2}/(?:20\d{2}|\d{2}))\b")
    match_data = padrao_data.search(texto_ocr)
    data_extraida = match_data.group(1) if match_data else datetime.now().strftime("%d/%m/%Y")

    # 3. Valor Total: prioriza linhas com TOTAL, VALOR A PAGAR, R$
    valor_extraido = "0,00"
    padrao_total_especifico = re.compile(
        r"(?:TOTAL\s*(?:A\s*PAGAR|R\$|GERAL|LIQUIDO)?|VALOR\s*(?:TOTAL|PAGO)?)\s*[:R\$\s]*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})",
        re.IGNORECASE
    )
    matches_total = padrao_total_especifico.findall(texto_ocr)
    if matches_total:
        valor_extraido = matches_total[-1]
    else:
        # Fallback: busca o maior valor monetário no padrão brasileiro (00,00)
        todos_valores = re.findall(r"\b(\d{1,3}(?:\.\d{3})*,\d{2})\b", texto_ocr)
        if todos_valores:
            try:
                maior_float = max(
                    float(v.replace(".", "").replace(",", ".")) for v in todos_valores
                )
                valor_extraido = f"{maior_float:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            except ValueError:
                valor_extraido = todos_valores[-1]

    # 4. Forma de Pagamento
    texto_upper = texto_ocr.upper()
    if "PIX" in texto_upper:
        forma_pagamento = "PIX"
    elif "CREDITO" in texto_upper or "CRÉDITO" in texto_upper:
        forma_pagamento = "Cartão de Crédito"
    elif "DEBITO" in texto_upper or "DÉBITO" in texto_upper:
        forma_pagamento = "Cartão de Débito"
    elif "DINHEIRO" in texto_upper or "ESPÉCIE" in texto_upper:
        forma_pagamento = "Dinheiro"
    elif "BOLETO" in texto_upper:
        forma_pagamento = "Boleto"
    else:
        forma_pagamento = "Não informada"

    return {
        "data": data_extraida,
        "estabelecimento": estabelecimento,
        "valor": valor_extraido,
        "forma_pagamento": forma_pagamento,
        "observacoes": legenda_usuario.strip() or "Sem observações",
        "texto_bruto": texto_ocr
    }


# =====================================================================
# 6. AUXILIARES DO TELEGRAM (DOWNLOAD, MENSAGENS E TECLADO INLINE)
# =====================================================================
async def baixar_arquivo_telegram(file_id: str) -> Optional[bytes]:
    """
    Consulta getFile na API do Telegram e faz o download binário da foto ou PDF.
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp_info = await client.get(
                f"{TELEGRAM_API_BASE}/getFile",
                params={"file_id": file_id}
            )
            resp_info.raise_for_status()
            file_path = resp_info.json()["result"]["file_path"]

            resp_file = await client.get(f"{TELEGRAM_FILE_BASE}/{file_path}")
            resp_file.raise_for_status()
            return resp_file.content
    except Exception as exc:
        logger.error(f"Erro ao baixar arquivo ({file_id}) do Telegram: {exc}")
        return None


def montar_teclado_categorias(token_estado: str) -> Dict[str, Any]:
    """
    Monta o InlineKeyboardMarkup com as 7 categorias exigidas:
    Despesa, Adiantamento, Manutenção, Combustível, Material, Ferramentas e Outros.
    """
    botoes = []
    linha_atual = []
    for cat in CATEGORIAS_GASTO:
        callback_str = f"cat|{token_estado}|{cat}"
        linha_atual.append({"text": cat, "callback_data": callback_str})
        if len(linha_atual) == 2:
            botoes.append(linha_atual)
            linha_atual = []
    if linha_atual:
        botoes.append(linha_atual)

    # Botão extra de cancelamento
    botoes.append([{"text": "Cancelar Registro", "callback_data": f"cancel|{token_estado}"}])
    return {"inline_keyboard": botoes}


async def enviar_mensagem_telegram(
    chat_id: int,
    texto: str,
    reply_markup: Optional[Dict[str, Any]] = None,
    reply_to_message_id: Optional[int] = None
):
    payload: Dict[str, Any] = {
        "chat_id": chat_id,
        "text": texto,
        "parse_mode": "HTML"
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    if reply_to_message_id:
        payload["reply_to_message_id"] = reply_to_message_id

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            await client.post(f"{TELEGRAM_API_BASE}/sendMessage", json=payload)
    except Exception as exc:
        logger.error(f"Erro ao enviar mensagem para o chat {chat_id}: {exc}")


async def editar_mensagem_telegram(chat_id: int, message_id: int, novo_texto: str):
    payload = {
        "chat_id": chat_id,
        "message_id": message_id,
        "text": novo_texto,
        "parse_mode": "HTML"
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            await client.post(f"{TELEGRAM_API_BASE}/editMessageText", json=payload)
    except Exception as exc:
        logger.error(f"Erro ao editar mensagem {message_id} no chat {chat_id}: {exc}")


async def responder_callback_query(callback_query_id: str, texto_alerta: str = ""):
    payload = {"callback_query_id": callback_query_id, "text": texto_alerta}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(f"{TELEGRAM_API_BASE}/answerCallbackQuery", json=payload)
    except Exception as exc:
        logger.error(f"Erro ao confirmar answerCallbackQuery: {exc}")


# =====================================================================
# 7. PROCESSAMENTO EM BACKGROUND E ROTAS DO FASTAPI
# =====================================================================
async def FluxoProcessamentoRecibo(
    chat_id: int,
    message_id: int,
    file_id: str,
    mime_type: str,
    legenda: str
):
    """
    Executa em background para liberar o webhook do Telegram rapidamente:
    1. Baixa imagem/PDF do Telegram
    2. Chama OCR.space com Base64 + prefixo correto
    3. Extrai campos e salva em DADOS_TEMPORARIOS
    4. Envia mensagem com botões inline para escolha da categoria
    """
    conteudo = await baixar_arquivo_telegram(file_id)
    if not conteudo:
        await enviar_mensagem_telegram(
            chat_id,
            "⚠️ Não foi possível baixar o arquivo enviado no Telegram.",
            reply_to_message_id=message_id
        )
        return

    if len(conteudo) > 1024 * 1024:
        await enviar_mensagem_telegram(
            chat_id,
            "⚠️ O arquivo excede o limite de <b>1 MB</b> do plano gratuito da API OCR.space. Envie uma foto comprimida.",
            reply_to_message_id=message_id
        )
        return

    texto_ocr = await processar_ocr_space_base64(conteudo, mime_type=mime_type)
    if texto_ocr is None:
        await enviar_mensagem_telegram(
            chat_id,
            "⚠️ Erro ao processar o recibo na API do OCR.space. Verifique a chave de API ou tente novamente.",
            reply_to_message_id=message_id
        )
        return

    dados_extraidos = extrair_dados_recibo(texto_ocr, legenda_usuario=legenda)
    token_estado = uuid.uuid4().hex[:8]

    DADOS_TEMPORARIOS[token_estado] = {
        **dados_extraidos,
        "chat_id": chat_id,
        "message_id": message_id,
        "criado_em": datetime.now().isoformat()
    }

    resumo_html = (
        "<b>🧾 Recibo Processado via OCR.space</b>\n\n"
        f"• <b>Data:</b> {dados_extraidos['data']}\n"
        f"• <b>Estabelecimento:</b> {dados_extraidos['estabelecimento']}\n"
        f"• <b>Valor Extraído:</b> R$ {dados_extraidos['valor']}\n"
        f"• <b>Forma de Pagamento:</b> {dados_extraidos['forma_pagamento']}\n"
        f"• <b>Observações (Legenda):</b> {dados_extraidos['observacoes']}\n\n"
        "👇 <b>Selecione a categoria do gasto abaixo para salvar na planilha:</b>"
    )

    teclado = montar_teclado_categorias(token_estado)
    await enviar_mensagem_telegram(
        chat_id=chat_id,
        texto=resumo_html,
        reply_markup=teclado,
        reply_to_message_id=message_id
    )


@app.get("/")
async def health_check():
    return {
        "status": "online",
        "service": "FinBot OCR Telegram Webhook",
        "pending_states": len(DADOS_TEMPORARIOS)
    }


@app.post("/webhook")
async def telegram_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Endpoint principal que recebe os updates do Telegram (mensagens com foto/PDF
    e cliques nos botões inline via callback_query).
    """
    try:
        update = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Payload JSON inválido")

    # 1. TRATAMENTO DE CLIQUE NOS BOTÕES INLINE (CALLBACK_QUERY)
    if "callback_query" in update:
        cb = update["callback_query"]
        cb_id = cb["id"]
        data_str = cb.get("data", "")
        msg = cb.get("message", {})
        chat_id = msg.get("chat", {}).get("id")
        message_id = msg.get("message_id")

        if data_str.startswith("cancel|"):
            _, token_estado = data_str.split("|", 1)
            DADOS_TEMPORARIOS.pop(token_estado, None)
            await responder_callback_query(cb_id, "Lançamento cancelado.")
            await editar_mensagem_telegram(
                chat_id,
                message_id,
                "❌ <b>Lançamento cancelado pelo usuário.</b> Nenhum dado foi enviado ao Google Sheets."
            )
            return {"ok": True}

        if data_str.startswith("cat|"):
            partes = data_str.split("|", 2)
            if len(partes) == 3:
                _, token_estado, categoria_escolhida = partes
                dados_pendentes = DADOS_TEMPORARIOS.pop(token_estado, None)

                if not dados_pendentes:
                    await responder_callback_query(
                        cb_id,
                        "⚠️ Sessão expirada ou recibo já registrado."
                    )
                    await editar_mensagem_telegram(
                        chat_id,
                        message_id,
                        "⚠️ <b>Sessão expirada.</b> Por favor, reenvie a foto do recibo."
                    )
                    return {"ok": True}

                dados_pendentes["categoria"] = categoria_escolhida
                sucesso = salvar_linha_planilha(dados_pendentes)

                if sucesso:
                    await responder_callback_query(cb_id, f"Categoria '{categoria_escolhida}' salva!")
                    texto_final = (
                        "✅ <b>Gasto Salvo no Google Sheets!</b>\n\n"
                        f"• <b>Data:</b> {dados_pendentes['data']}\n"
                        f"• <b>Estabelecimento:</b> {dados_pendentes['estabelecimento']}\n"
                        f"• <b>Valor:</b> R$ {dados_pendentes['valor']}\n"
                        f"• <b>Categoria:</b> {categoria_escolhida}\n"
                        f"• <b>Forma de Pagamento:</b> {dados_pendentes['forma_pagamento']}\n"
                        f"• <b>Observações:</b> {dados_pendentes['observacoes']}"
                    )
                    await editar_mensagem_telegram(chat_id, message_id, texto_final)
                else:
                    # Restaura no estado temporário caso falhe a escrita na planilha
                    DADOS_TEMPORARIOS[token_estado] = dados_pendentes
                    await responder_callback_query(
                        cb_id,
                        "Erro ao gravar no Google Sheets. Tente novamente."
                    )
        return {"ok": True}

    # 2. TRATAMENTO DE MENSAGENS COM FOTO OU DOCUMENTO (PDF/IMAGEM)
    message = update.get("message") or update.get("edited_message")
    if not message:
        return {"ok": True}

    chat_id = message["chat"]["id"]
    message_id = message["message_id"]
    legenda = message.get("caption", "")

    # Caso seja foto (o Telegram envia array de resoluções; pegamos a última de maior qualidade)
    if "photo" in message and message["photo"]:
        melhor_foto = message["photo"][-1]
        file_id = melhor_foto["file_id"]
        background_tasks.add_task(
            FluxoProcessamentoRecibo,
            chat_id,
            message_id,
            file_id,
            "image/jpeg",
            legenda
        )
        return {"ok": True}

    # Caso seja documento (ex: PDF de Nota Fiscal ou imagem sem compressão)
    if "document" in message:
        doc = message["document"]
        mime_type = doc.get("mime_type", "application/pdf")
        if mime_type in ("application/pdf", "image/jpeg", "image/png"):
            file_id = doc["file_id"]
            background_tasks.add_task(
                FluxoProcessamentoRecibo,
                chat_id,
                message_id,
                file_id,
                mime_type,
                legenda
            )
        else:
            await enviar_mensagem_telegram(
                chat_id,
                "⚠️ Formato não suportado. Envie uma foto (JPG/PNG) ou documento PDF.",
                reply_to_message_id=message_id
            )

    return {"ok": True}
