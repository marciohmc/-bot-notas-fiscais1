export interface ReceiptSample {
  id: string;
  title: string;
  type: 'image/jpeg' | 'application/pdf';
  sizeKb: number;
  caption: string;
  ocrEngine: '2' | '3';
  rawText: string;
}

export const CATEGORIAS_GASTO = [
  'Despesa',
  'Adiantamento',
  'Manutenção',
  'Combustível',
  'Material',
  'Ferramentas',
  'Outros',
] as const;

export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number];

export interface SheetRow {
  id: string;
  data: string;
  estabelecimento: string;
  valor: string;
  categoria: CategoriaGasto;
  forma_pagamento: string;
  observacoes: string;
  token_origem: string;
}

export const RECEIPT_SAMPLES: ReceiptSample[] = [
  {
    id: 'posto-shell',
    title: 'Cupom Fiscal — Posto Avenida (Combustível)',
    type: 'image/jpeg',
    sizeKb: 384,
    caption: 'Abastecimento frota caminhão placa ABC-1234',
    ocrEngine: '2',
    rawText: `AUTO POSTO AVENIDA LTDA
CNPJ: 14.289.102/0001-90
AV. PAULISTA, 1840 - SAO PAULO - SP
----------------------------------------
DOCUMENTO AUXILIAR DA NOTA FISCAL
DE CONSUMIDOR ELETRONICA
DATA: 10/11/2026  HORA: 09:42:18
----------------------------------------
ITEM  DESCRICAO        QTD    UN   VL.TOTAL
001   DIESEL S10       74,50  L    461,90
----------------------------------------
VALOR TOTAL R$ 461,90
FORMA DE PAGAMENTO: CARTAO DE DEBITO
OBRIGADO E VOLTE SEMPRE!`,
  },
  {
    id: 'leroy-merlin',
    title: 'Nota Fiscal — Casa das Ferramentas & Materiais',
    type: 'image/jpeg',
    sizeKb: 612,
    caption: 'Compra de discos de corte e jogo de chaves obra Sul',
    ocrEngine: '2',
    rawText: `COMERCIAL DE FERRAMENTAS FORTE S/A
CNPJ: 61.092.441/0003-11
RUA DO GASOMETRO, 412 - BRAS
----------------------------------------
CUPOM FISCAL ELETRONICO - SAT
EMISSAO: 09/11/2026 15:18:04
----------------------------------------
01 DISCO CORTE INOX 4.1/2     R$  84,00
02 JOGO CHAVE COMBINADA 12PC  R$ 245,50
03 LUVA SEGURANCA NITRILICA   R$  39,90
----------------------------------------
TOTAL A PAGAR R$ 369,40
PAGAMENTO: PIX QR CODE CONCLUIDO`,
  },
  {
    id: 'oficina-mecanica',
    title: 'Ordem de Serviço PDF — Oficina Diesel Center',
    type: 'application/pdf',
    sizeKb: 845,
    caption: 'Troca de óleo, filtros e alinhamento revisão 40.000km',
    ocrEngine: '3',
    rawText: `DIESEL CENTER MANUTENCAO AUTOMOTIVA LTDA
NOTA FISCAL DE SERVICOS ELETRONICA
DATA DE EMISSAO: 08/11/2026
----------------------------------------
SERVICOS EXECUTADOS           VALOR (R$)
TROCA DE OLEO MOTOR 15W40        380,00
KIT FILTROS AR/COMBUSTIVEL       290,00
MAO DE OBRA REVISAO FREIOS       450,00
----------------------------------------
VALOR TOTAL: 1.120,00
CONDICAO DE PAGAMENTO: CARTAO DE CREDITO 2X`,
  },
  {
    id: 'arquivo-grande-erro',
    title: 'Teste de Limite (> 1 MB) — PDF Alta Resolução',
    type: 'application/pdf',
    sizeKb: 1420,
    caption: 'Nota fiscal escaneada em 600 DPI sem compressão',
    ocrEngine: '2',
    rawText: `ARQUIVO EXCEDE 1024 KB`,
  },
];

export const INITIAL_SHEET_ROWS: SheetRow[] = [
  {
    id: 'row-1',
    data: '07/11/2026',
    estabelecimento: 'MADEIREIRA E MATERIAIS SAO JORGE',
    valor: '890,00',
    categoria: 'Material',
    forma_pagamento: 'PIX',
    observacoes: 'Cimento e vergalhões obra galpão B',
    token_origem: 'f82a91c0',
  },
  {
    id: 'row-2',
    data: '08/11/2026',
    estabelecimento: 'RESTAURANTE ESTRADA REAL LTDA',
    valor: '148,50',
    categoria: 'Despesa',
    forma_pagamento: 'Cartão de Débito',
    observacoes: 'Almoço equipe técnica viagem Campinas',
    token_origem: '3b19e7a4',
  },
];

export const PYTHON_MAIN_CODE = `"""
Bot de Automação Financeira no Telegram com OCR.space e Google Sheets
Hospedagem: Render (FastAPI + Uvicorn)
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
# indexados por um token curto (8 caracteres).
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
    if len(conteudo_bytes) > 1024 * 1024:
        logger.warning("Arquivo excede o limite de 1 MB do OCR.space gratuito.")
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
                return ""

            texto_completo = "\\n".join(
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
    linhas = [linha.strip() for linha in texto_ocr.splitlines() if linha.strip()]

    termos_ignorar = ("CUPOM FISCAL", "NOTA FISCAL", "DANFE", "EXTRATO", "COMPROVANTE", "CNPJ")
    estabelecimento = "Não identificado"
    for linha in linhas[:6]:
        linha_upper = linha.upper()
        if len(linha) > 3 and not any(termo in linha_upper for termo in termos_ignorar):
            estabelecimento = linha[:60]
            break

    padrao_data = re.compile(r"\\b(\\d{2}/\\d{2}/(?:20\\d{2}|\\d{2}))\\b")
    match_data = padrao_data.search(texto_ocr)
    data_extraida = match_data.group(1) if match_data else datetime.now().strftime("%d/%m/%Y")

    valor_extraido = "0,00"
    padrao_total_especifico = re.compile(
        r"(?:TOTAL\\s*(?:A\\s*PAGAR|R\\$|GERAL|LIQUIDO)?|VALOR\\s*(?:TOTAL|PAGO)?)\\s*[:R\\$\\s]*(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})",
        re.IGNORECASE
    )
    matches_total = padrao_total_especifico.findall(texto_ocr)
    if matches_total:
        valor_extraido = matches_total[-1]
    else:
        todos_valores = re.findall(r"\\b(\\d{1,3}(?:\\.\\d{3})*,\\d{2})\\b", texto_ocr)
        if todos_valores:
            valor_extraido = todos_valores[-1]

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
# 6. AUXILIARES DO TELEGRAM E ROTAS DE WEBHOOK
# =====================================================================
def montar_teclado_categorias(token_estado: str) -> Dict[str, Any]:
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

    botoes.append([{"text": "Cancelar Registro", "callback_data": f"cancel|{token_estado}"}])
    return {"inline_keyboard": botoes}

@app.post("/webhook")
async def telegram_webhook(request: Request, background_tasks: BackgroundTasks):
    try:
        update = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Payload JSON inválido")

    if "callback_query" in update:
        cb = update["callback_query"]
        cb_id = cb["id"]
        data_str = cb.get("data", "")
        msg = cb.get("message", {})
        chat_id = msg.get("chat", {}).get("id")
        message_id = msg.get("message_id")

        if data_str.startswith("cat|"):
            _, token_estado, categoria_escolhida = data_str.split("|", 2)
            dados_pendentes = DADOS_TEMPORARIOS.pop(token_estado, None)
            if dados_pendentes:
                dados_pendentes["categoria"] = categoria_escolhida
                salvar_linha_planilha(dados_pendentes)
        return {"ok": True}

    return {"ok": True}
`;

export const REQUIREMENTS_CODE = `fastapi==0.115.6
uvicorn[standard]==0.34.0
httpx==0.28.1
gspread==6.1.4
google-auth==2.37.0
python-multipart==0.0.20
pydantic==2.10.4`;

export const PROCFILE_CODE = `web: uvicorn main:app --host 0.0.0.0 --port \${PORT:-10000} --workers 1`;

export const ENV_EXAMPLE_CODE = `# Token gerado pelo @BotFather no Telegram
TELEGRAM_BOT_TOKEN="1234567890:AAH_seu_token_do_botfather_aqui"

# Chave da API OCR.space (enviada no header apikey)
OCR_SPACE_API_KEY="K8123456788957"

# Engine OCR.space: "2" (recibos/caracteres especiais) ou "3" (tabelas densas)
OCR_ENGINE_DEFAULT="2"

# ID da planilha extraído da URL do Google Sheets:
# https://docs.google.com/spreadsheets/d/SEU_GOOGLE_SHEET_ID/edit
GOOGLE_SHEET_ID="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"

# Conteúdo completo do JSON da Service Account em uma única linha
# Importante: compartilhe a planilha com o client_email desta conta como Editor!
GOOGLE_CREDENTIALS_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"bot-financeiro@projeto.iam.gserviceaccount.com"}'`;
