export interface ReceiptSample {
  id: string;
  title: string;
  type: 'image/jpeg' | 'application/pdf';
  sizeKb: number;
  caption: string;
  ocrEngine: '2' | '3';
  filePathTelegram: string;
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
  aba_mes: string;
  estabelecimento: string;
  tipo_documento: string;
  valor: string;
  categoria: CategoriaGasto;
  forma_pagamento: string;
  observacoes: string;
  responsavel: string;
  file_url: string;
  formula_hyperlink: string;
  texto_ocr: string;
  token_origem: string;
}

export const RECEIPT_SAMPLES: ReceiptSample[] = [
  {
    id: 'posto-shell',
    title: 'Cupom Fiscal — Posto Avenida (Aba 11-2026)',
    type: 'image/jpeg',
    sizeKb: 384,
    caption: 'Abastecimento frota caminhão placa ABC-1234',
    ocrEngine: '2',
    filePathTelegram: 'photos/file_84920_posto_avenida.jpg',
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
    title: 'Cupom SAT — Casa das Ferramentas (Aba 10-2026)',
    type: 'image/jpeg',
    sizeKb: 612,
    caption: 'Compra de discos de corte e jogo de chaves obra Sul',
    ocrEngine: '2',
    filePathTelegram: 'photos/file_84921_ferramentas_forte.jpg',
    rawText: `COMERCIAL DE FERRAMENTAS FORTE S/A
CNPJ: 61.092.441/0003-11
RUA DO GASOMETRO, 412 - BRAS
----------------------------------------
CUPOM FISCAL ELETRONICO - SAT
EMISSAO: 24/10/2026 15:18:04
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
    title: 'Nota Fiscal PDF — Oficina Diesel Center (Aba 11-2026)',
    type: 'application/pdf',
    sizeKb: 845,
    caption: 'Troca de óleo, filtros e alinhamento revisão 40.000km',
    ocrEngine: '3',
    filePathTelegram: 'documents/file_84922_nfse_diesel_center.pdf',
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
    id: 'duplicado-madeireira',
    title: 'Teste de Duplicidade — Madeireira São Jorge (Já consta na Aba 11-2026)',
    type: 'image/jpeg',
    sizeKb: 410,
    caption: 'Reenvio acidental da nota de cimento galpão B',
    ocrEngine: '2',
    filePathTelegram: 'photos/file_84101_madeireira.jpg',
    rawText: `MADEIREIRA E MATERIAIS SAO JORGE
CNPJ: 45.118.902/0001-10
DATA DE EMISSAO: 07/11/2026
----------------------------------------
NOTA FISCAL ELETRONICA
ITEM 01 SACOS DE CIMENTO CP-II   R$ 890,00
----------------------------------------
VALOR TOTAL R$ 890,00
FORMA DE PAGAMENTO: PIX`,
  },
  {
    id: 'arquivo-grande-erro',
    title: 'Teste de Limite (> 1 MB) — PDF Alta Resolução',
    type: 'application/pdf',
    sizeKb: 1420,
    caption: 'Nota fiscal escaneada em 600 DPI sem compressão',
    ocrEngine: '2',
    filePathTelegram: 'documents/file_84999_oversize.pdf',
    rawText: `ARQUIVO EXCEDE 1024 KB`,
  },
];

export const INITIAL_SHEET_ROWS: SheetRow[] = [
  {
    id: 'row-1',
    data: '07/11/2026',
    aba_mes: '11-2026',
    estabelecimento: 'MADEIREIRA E MATERIAIS SAO JORGE',
    tipo_documento: 'Nota Fiscal',
    valor: '890,00',
    categoria: 'Material',
    forma_pagamento: 'PIX',
    observacoes: 'Cimento e vergalhões obra galpão B',
    responsavel: 'Carlos Mendes (@carlos_obras)',
    file_url: 'https://api.telegram.org/file/bot<TOKEN>/photos/file_84101_madeireira.jpg',
    formula_hyperlink:
      '=HYPERLINK("https://api.telegram.org/file/bot<TOKEN>/photos/file_84101_madeireira.jpg"; "Ver Comprovante")',
    texto_ocr: `MADEIREIRA E MATERIAIS SAO JORGE\nCNPJ: 45.118.902/0001-10\nDATA DE EMISSAO: 07/11/2026\nNOTA FISCAL ELETRONICA\nITEM 01 SACOS DE CIMENTO CP-II R$ 890,00\nVALOR TOTAL R$ 890,00\nFORMA DE PAGAMENTO: PIX`,
    token_origem: 'f82a91c0',
  },
  {
    id: 'row-2',
    data: '08/11/2026',
    aba_mes: '11-2026',
    estabelecimento: 'RESTAURANTE ESTRADA REAL LTDA',
    tipo_documento: 'Cupom Fiscal',
    valor: '148,50',
    categoria: 'Despesa',
    forma_pagamento: 'Cartão de Débito',
    observacoes: 'Almoço equipe técnica viagem Campinas',
    responsavel: 'Marcos Silva (@marcos_eng)',
    file_url: 'https://api.telegram.org/file/bot<TOKEN>/photos/file_84102_restaurante.jpg',
    formula_hyperlink:
      '=HYPERLINK("https://api.telegram.org/file/bot<TOKEN>/photos/file_84102_restaurante.jpg"; "Ver Comprovante")',
    texto_ocr: `RESTAURANTE ESTRADA REAL LTDA\nCNPJ: 19.442.810/0001-04\nCUPOM FISCAL ELETRONICO - SAT\nDATA: 08/11/2026 12:41:09\n03 REFEICAO EXECUTIVAKG R$ 148,50\nTOTAL R$ 148,50 - CARTAO DE DEBITO`,
    token_origem: '3b19e7a4',
  },
  {
    id: 'row-3',
    data: '22/10/2026',
    aba_mes: '10-2026',
    estabelecimento: 'LOCADORA DE EQUIPAMENTOS CENTRAL',
    tipo_documento: 'Nota Fiscal',
    valor: '650,00',
    categoria: 'Ferramentas',
    forma_pagamento: 'Boleto',
    observacoes: 'Locação martelete rompedor 15kg',
    responsavel: 'Carlos Mendes (@carlos_obras)',
    file_url: 'https://api.telegram.org/file/bot<TOKEN>/documents/file_83990_locadora.pdf',
    formula_hyperlink:
      '=HYPERLINK("https://api.telegram.org/file/bot<TOKEN>/documents/file_83990_locadora.pdf"; "Ver Comprovante")',
    texto_ocr: `LOCADORA DE EQUIPAMENTOS CENTRAL\nNOTA FISCAL DE LOCACAO DE BENS MOVEIS\nDATA: 22/10/2026\nLOCACAO MARTELETE ROMPEDOR 15KG - R$ 650,00\nVALOR LIQUIDO DA NOTA: R$ 650,00`,
    token_origem: '9d41a2b1',
  },
];

export const SHEETS_SERVICE_CODE = `import os
import json
import re
import base64
import unicodedata
import logging
import gspread
from google.oauth2.service_account import Credentials

logger = logging.getLogger("FinBotOCR.SheetsService")

CABECALHOS_PADRAO = [
    "Date",
    "Establishment",
    "Doc Type",
    "Category",
    "Payment",
    "Value",
    "Responsible",
    "Receipt Link",
    "Obs",
    "OCR Text"
]


def get_sheets_client():
    """
    Autentica no Google Cloud via Service Account a partir da variável
    GOOGLE_CREDENTIALS_JSON (suporta JSON puro, aspas extras, Base64 ou Secret File).
    """
    creds_raw = (
        os.environ.get("GOOGLE_CREDENTIALS_JSON")
        or os.environ.get("GOOGLE_CREDENTIALS")
        or ""
    ).strip()

    if not creds_raw:
        raise RuntimeError(
            "A variável de ambiente GOOGLE_CREDENTIALS_JSON está vazia ou não foi configurada no Render."
        )

    if (creds_raw.startswith("'") and creds_raw.endswith("'")) or (
        creds_raw.startswith('"') and creds_raw.endswith('"')
    ):
        creds_raw = creds_raw[1:-1].strip()

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
    ]

    if os.path.isfile(creds_raw):
        creds = Credentials.from_service_account_file(creds_raw, scopes=scopes)
    else:
        if not creds_raw.startswith("{"):
            try:
                creds_raw = base64.b64decode(creds_raw).decode("utf-8").strip()
            except Exception:
                pass

        creds_dict = json.loads(creds_raw)
        if "private_key" in creds_dict and "\\\\n" in creds_dict["private_key"]:
            creds_dict["private_key"] = creds_dict["private_key"].replace("\\\\n", "\\n")

        creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)

    return gspread.authorize(creds)


def normalizar_texto(texto: str) -> str:
    """
    Remove acentos, espaços extras e converte para maiúsculas para comparação
    confiável de nomes de estabelecimentos.
    """
    if not texto:
        return ""
    sem_acentos = "".join(
        c for c in unicodedata.normalize("NFD", str(texto))
        if unicodedata.category(c) != "Mn"
    )
    limpo = re.sub(r"\\s+", " ", sem_acentos).strip().upper()
    return limpo


def normalizar_data(data_str: str) -> str:
    """
    Padroniza datas como '5/11/2026' ou '05/11/26' para '05/11/2026'.
    """
    if not data_str:
        return ""
    match = re.search(r"\\b(\\d{1,2})/(\\d{1,2})/(\\d{2,4})\\b", str(data_str).strip())
    if match:
        dia = match.group(1).zfill(2)
        mes = match.group(2).zfill(2)
        ano = match.group(3)
        if len(ano) == 2:
            ano = f"20{ano}"
        return f"{dia}/{mes}/{ano}"
    return str(data_str).strip()


def normalizar_valor_float(valor) -> float:
    """
    Converte qualquer formato monetário ('R$ 1.120,50', '461,90', '461.9', 461.9)
    em float arredondado com 2 casas decimais para evitar falhas na checagem de duplicados.
    """
    if isinstance(valor, (int, float)):
        return round(float(valor), 2)

    s = str(valor or "").replace("R$", "").replace(" ", "").strip()
    if not s:
        return 0.0

    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".")

    try:
        return round(float(s), 2)
    except ValueError:
        return 0.0


def sanitizar_texto_ocr_planilha(texto_ocr: str) -> str:
    """
    Prepara o texto bruto retornado pelo OCR.space para ser salvo com segurança em uma
    célula do Google Sheets usando value_input_option='USER_ENTERED':
    - Remove quebras de linha excessivas mantendo a leitura limpa
    - Adiciona apóstrofo inicial caso comece com '=', '+' ou '-' (evita erro #ERROR! de fórmula)
    """
    if not texto_ocr:
        return ""
    linhas = [linha.strip() for linha in str(texto_ocr).splitlines() if linha.strip()]
    texto_limpo = "\\n".join(linhas).strip()

    if texto_limpo.startswith(("=", "+", "-")):
        texto_limpo = f"'{texto_limpo}"

    return texto_limpo[:49000]


def extrair_aba_mes_ano(data_str: str) -> str:
    """
    Extrai o mês e ano da data do recibo (Formato esperado: DD/MM/AAAA)
    retornando no padrão MM-AAAA (ex: '11-2026').
    """
    data_norm = normalizar_data(data_str)
    partes = data_norm.split("/")
    if len(partes) == 3:
        return f"{partes[1]}-{partes[2]}"
    return "Geral"


def verificar_duplicidade_na_aba(
    worksheet,
    data_alvo: str,
    estabelecimento_alvo: str,
    valor_alvo: float,
    file_url_alvo: str = ""
) -> dict:
    """
    Verifica na aba do Google Sheets se o comprovante já foi lançado anteriormente.
    Compara:
      1) Se o mesmo link de arquivo do Telegram (file_url) já foi gravado na coluna Receipt Link; OU
      2) Se já existe registro com mesma Data + mesmo Estabelecimento + mesmo Valor (em centavos).
    Retorna {"duplicado": bool, "linha": int, "responsavel_anterior": str, "motivo": str}.
    """
    try:
        linhas_valores = worksheet.get_all_values()
        if len(linhas_valores) <= 1:
            return {"duplicado": False}

        try:
            linhas_formulas = worksheet.get_all_values(value_render_option="FORMULA")
        except Exception:
            linhas_formulas = linhas_valores

        data_norm_alvo = normalizar_data(data_alvo)
        estab_norm_alvo = normalizar_texto(estabelecimento_alvo)
        valor_float_alvo = normalizar_valor_float(valor_alvo)

        trecho_arquivo = ""
        if file_url_alvo and "/" in file_url_alvo:
            partes_url = file_url_alvo.split("/")
            trecho_arquivo = "/".join(partes_url[-2:]) if len(partes_url) >= 2 else partes_url[-1]

        for idx in range(1, len(linhas_valores)):
            linha = linhas_valores[idx]
            linha_form = linhas_formulas[idx] if idx < len(linhas_formulas) else linha

            data_planilha = normalizar_data(linha[0] if len(linha) > 0 else "")
            estab_planilha = normalizar_texto(linha[1] if len(linha) > 1 else "")
            valor_planilha = normalizar_valor_float(linha[5] if len(linha) > 5 else 0.0)
            resp_planilha = (linha[6] if len(linha) > 6 else "Outro usuário").strip()
            celula_link_formula = str(linha_form[7] if len(linha_form) > 7 else "")

            # Critério 1: Mesmo link/arquivo do Telegram na coluna Receipt Link
            if trecho_arquivo and trecho_arquivo in celula_link_formula:
                return {
                    "duplicado": True,
                    "linha": idx + 1,
                    "responsavel_anterior": resp_planilha,
                    "motivo": f"O mesmo arquivo do Telegram já foi registrado na linha {idx + 1} por {resp_planilha}."
                }

            # Critério 2: Mesma Data + Mesmo Estabelecimento + Mesmo Valor (diferença < R$ 0,01)
            if (
                data_planilha == data_norm_alvo
                and estab_planilha == estab_norm_alvo
                and abs(valor_planilha - valor_float_alvo) < 0.01
            ):
                return {
                    "duplicado": True,
                    "linha": idx + 1,
                    "responsavel_anterior": resp_planilha,
                    "motivo": (
                        f"Comprovante idêntico (Data: {data_norm_alvo}, Local: {estabelecimento_alvo}, "
                        f"Valor: R$ {valor_float_alvo:.2f}) já consta na linha {idx + 1} "
                        f"(enviado por {resp_planilha})."
                    )
                }

        return {"duplicado": False}

    except Exception as e:
        logger.warning(f"Aviso ao verificar duplicidade na planilha: {e}")
        return {"duplicado": False}


def salvar_na_planilha(
    dados_extracao: dict,
    sender_name: str,
    caption: str,
    file_url: str,
    texto_ocr: str = ""
) -> dict:
    """
    Insere os dados extraídos na aba correspondente ao mês/ano da despesa (ex: 11-2026),
    adicionando o link oficial do Telegram formatado como hiperlink clicável,
    o texto bruto retornado pelo OCR.space (coluna 'OCR Text') e bloqueando duplicados.
    """
    try:
        sheet_id = (
            os.environ.get("SPREADSHEET_ID")
            or os.environ.get("GOOGLE_SHEET_ID")
            or ""
        ).strip()

        if not sheet_id:
            raise RuntimeError("A variável SPREADSHEET_ID não foi configurada no Render.")

        client = get_sheets_client()
        spreadsheet = client.open_by_key(sheet_id)

        data_formatada = normalizar_data(dados_extracao.get("data", ""))
        mes_ano = extrair_aba_mes_ano(data_formatada)
        estabelecimento = dados_extracao.get("estabelecimento", "Desconhecido").strip()
        valor_numerico = normalizar_valor_float(dados_extracao.get("valor", 0.0))

        try:
            worksheet = spreadsheet.worksheet(mes_ano)
            primeira_linha = worksheet.row_values(1)
            if not primeira_linha:
                worksheet.append_row(CABECALHOS_PADRAO, value_input_option="USER_ENTERED")
            elif "OCR Text" not in primeira_linha and len(primeira_linha) == 9:
                worksheet.update_cell(1, 10, "OCR Text")
        except gspread.exceptions.WorksheetNotFound:
            worksheet = spreadsheet.add_worksheet(title=mes_ano, rows=1000, cols=12)
            worksheet.append_row(CABECALHOS_PADRAO, value_input_option="USER_ENTERED")

        # Checagem rigorosa de duplicidade antes de gravar
        checagem = verificar_duplicidade_na_aba(
            worksheet=worksheet,
            data_alvo=data_formatada,
            estabelecimento_alvo=estabelecimento,
            valor_alvo=valor_numerico,
            file_url_alvo=file_url
        )

        if checagem.get("duplicado"):
            return {
                "sucesso": False,
                "duplicado": True,
                "aba": mes_ano,
                "linha_duplicada": checagem.get("linha"),
                "responsavel_anterior": checagem.get("responsavel_anterior"),
                "erro": checagem.get("motivo")
            }

        formula_hyperlink = (
            f'=HYPERLINK("{file_url}"; "Ver Comprovante")'
            if file_url
            else "Sem link"
        )

        ocr_bruto = texto_ocr or dados_extracao.get("texto_ocr") or dados_extracao.get("texto_bruto") or ""
        ocr_sanitizado = sanitizar_texto_ocr_planilha(ocr_bruto)

        row_data = [
            data_formatada,
            estabelecimento,
            dados_extracao.get("tipo_documento", "Recibo/Cupom"),
            dados_extracao.get("categoria", ""),
            dados_extracao.get("pagamento", "Outros"),
            valor_numerico,
            sender_name,
            formula_hyperlink,  # Coluna 8 (H): Receipt Link (=HYPERLINK)
            caption or "",      # Coluna 9 (I): Obs (Legenda do Telegram)
            ocr_sanitizado      # Coluna 10 (J): OCR Text (Retorno textual completo do OCR.space)
        ]

        worksheet.append_row(row_data, value_input_option="USER_ENTERED")
        return {
            "sucesso": True,
            "duplicado": False,
            "aba": mes_ano,
            "formula": formula_hyperlink
        }

    except json.JSONDecodeError as je:
        msg = f"GOOGLE_CREDENTIALS_JSON não é um JSON válido: {str(je)}"
        logger.error(f"❌ {msg}")
        return {"sucesso": False, "duplicado": False, "aba": "", "erro": msg}
    except Exception as e:
        logger.error(f"❌ Erro ao salvar no Google Sheets: {str(e)}")
        return {"sucesso": False, "duplicado": False, "aba": "", "erro": str(e)}
`;

export const PYTHON_MAIN_CODE = `import os
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
DADOS_TEMPORARIOS = {}

# Cache rápido em memória de comprovantes já salvos na sessão
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


# 5. Função para realizar OCR via OCR.space API
def processar_ocr_space(
    arquivo_bytes: bytes,
    mime_type: str = "image/jpeg",
    usar_base64: bool = True,
    ocr_engine: str = "2"
) -> str:
    api_key = os.environ.get("OCR_SPACE_API_KEY", "")
    if not api_key:
        raise ValueError("Variável de ambiente OCR_SPACE_API_KEY não configurada.")

    if len(arquivo_bytes) > 1024 * 1024:
        tamanho_kb = len(arquivo_bytes) / 1024
        raise ValueError(
            f"O arquivo ({tamanho_kb:.0f} KB) excede o limite de 1 MB (1024 KB) do plano gratuito do OCR.space."
        )

    headers = {"apikey": api_key}
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
            files = {"file": (f"receipt.{extensao}", arquivo_bytes, mime_type)}
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

        return "\\n".join(p.get("ParsedText", "") for p in parsed_results)

    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Erro de conexão com a API do OCR.space: {str(e)}")


# 6. Lógica para extrair dados estruturados a partir do texto lido
def extrair_dados_recibo(texto: str):
    linhas = [l.strip() for l in texto.split("\\n") if l.strip()]
    estabelecimento = linhas[0] if linhas else "Desconhecido"

    match_data = re.search(r"\\b\\d{1,2}/\\d{1,2}/\\d{2,4}\\b", texto)
    data = normalizar_data(match_data.group(0)) if match_data else datetime.now().strftime("%d/%m/%Y")

    valores = re.findall(r"\\b(?:\\d{1,3}(?:\\.\\d{3})*|\\d+)[\\.,]\\d{2}\\b", texto)
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

        if estado_id in COMPROVANTES_PROCESSADOS:
            enviar_mensagem_telegram(
                chat_id,
                "⚠️ *Arquivo Duplicado:* Esta mesma imagem/PDF já foi processada e salva anteriormente na planilha."
            )
            return {"status": "duplicate_file_ignored"}

        try:
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

            DADOS_TEMPORARIOS[estado_id] = dados

            obs_text = f"\\n• *Obs:* {caption}" if caption else ""
            msg_prompt = (
                f"🧾 *Leitura do Recibo Concluída!*\\n\\n"
                f"• *Responsável:* {sender_name}\\n"
                f"• *Local:* {dados.get('estabelecimento')}\\n"
                f"• *Tipo Doc:* {dados.get('tipo_documento')}\\n"
                f"• *Data:* {dados.get('data')} _(Aba: {aba_mes_ano})_\\n"
                f"• *Valor:* R$ {dados.get('valor'):.2f}\\n"
                f"• *Pagamento:* {dados.get('pagamento')}\\n"
                f"• *Comprovante:* [Abrir Link Oficial]({file_url})"
                f"{obs_text}\\n\\n"
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

                    obs_text = f"\\n• *Obs:* {caption}" if caption else ""
                    msg_sucesso = (
                        f"✅ *Gasto Registrado no Google Sheets!*\\n\\n"
                        f"• *Aba (Mês-Ano):* {aba_salva}\\n"
                        f"• *Responsável:* {sender_name}\\n"
                        f"• *Local:* {dados.get('estabelecimento')}\\n"
                        f"• *Tipo Doc:* {dados.get('tipo_documento')}\\n"
                        f"• *Data:* {dados.get('data')}\\n"
                        f"• *Valor:* R$ {dados.get('valor'):.2f}\\n"
                        f"• *Categoria:* {categoria}\\n"
                        f"• *Pagamento:* {dados.get('pagamento')}\\n"
                        f"• *Receipt Link:* [Ver Comprovante]({file_url})"
                        f"{obs_text}"
                    )
                    enviar_mensagem_telegram(chat_id, msg_sucesso)
                elif resultado.get("duplicado"):
                    responder_callback_query(callback_id, "⚠️ Comprovante duplicado bloqueado!")
                    motivo = resultado.get("erro") or "Este comprovante já consta na planilha."
                    enviar_mensagem_telegram(
                        chat_id,
                        f"🚫 *Gravação Bloqueada (Duplicidade Detectada)*\\n\\n"
                        f"• *Aba Verificada:* {resultado.get('aba')}\\n"
                        f"• *Motivo:* {motivo}\\n\\n"
                        f"_O lançamento não foi duplicado na planilha._"
                    )
                else:
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
`;

export const REQUIREMENTS_CODE = `fastapi
uvicorn
python-telegram-bot
gspread
google-auth
requests`;

export const PROCFILE_CODE = `web: uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1`;

export const ENV_EXAMPLE_CODE = `# Token gerado pelo @BotFather no Telegram
TELEGRAM_BOT_TOKEN="1234567890:AAH_seu_token_do_botfather_aqui"

# Chave da API OCR.space (enviada no header apikey)
OCR_SPACE_API_KEY="K8123456788957"

# ID da planilha extraído da URL do Google Sheets (SPREADSHEET_ID)
SPREADSHEET_ID="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"

# Conteúdo completo do JSON da Service Account em uma única linha
GOOGLE_CREDENTIALS_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"bot-financeiro@projeto.iam.gserviceaccount.com"}'`;
