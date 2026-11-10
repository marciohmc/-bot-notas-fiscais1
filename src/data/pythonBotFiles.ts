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
    token_origem: '9d41a2b1',
  },
];

export const SHEETS_SERVICE_CODE = `import os
import json
import re
import base64
import logging
import gspread
from google.oauth2.service_account import Credentials

logger = logging.getLogger("FinBotOCR")

CABECALHOS_PADRAO = [
    "Date",
    "Establishment",
    "Doc Type",
    "Category",
    "Payment",
    "Value",
    "Responsible",
    "Receipt Link",
    "Obs"
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


def extrair_aba_mes_ano(data_str: str) -> str:
    """
    Extrai o mês e ano da data do recibo (Formato esperado: DD/MM/AAAA)
    retornando no padrão MM-AAAA (ex: '11-2026').
    """
    if data_str:
        match = re.search(r"\\b(\\d{2})/(\\d{2})/(\\d{2,4})\\b", str(data_str))
        if match:
            mes = match.group(2)
            ano = match.group(3)
            if len(ano) == 2:
                ano = f"20{ano}"
            return f"{mes}-{ano}"

    partes = str(data_str).split("/")
    if len(partes) == 3:
        ano = partes[2] if len(partes[2]) == 4 else f"20{partes[2]}"
        return f"{partes[1]}-{ano}"

    return "Geral"


def salvar_na_planilha(
    dados_extracao: dict,
    sender_name: str,
    caption: str,
    file_url: str
) -> dict:
    """
    Insere os dados extraídos na aba correspondente ao mês/ano da despesa (ex: 11-2026),
    adicionando o link oficial do Telegram formatado como hiperlink clicável na planilha
    e verificando duplicidade antes de inserir.
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

        # Extrai o mês e ano da data do recibo (Ex: 11-2026)
        data_str = dados_extracao.get("data", "")
        mes_ano = extrair_aba_mes_ano(data_str)

        # Abre ou cria a aba do mês correspondente
        try:
            worksheet = spreadsheet.worksheet(mes_ano)
        except gspread.exceptions.WorksheetNotFound:
            worksheet = spreadsheet.add_worksheet(title=mes_ano, rows=1000, cols=10)
            worksheet.append_row(CABECALHOS_PADRAO, value_input_option="USER_ENTERED")

        # Formata o link do Telegram utilizando a fórmula oficial do Google Sheets
        # Isso transforma o texto da célula em um botão clicável "Ver Comprovante"
        formula_hyperlink = (
            f'=HYPERLINK("{file_url}"; "Ver Comprovante")'
            if file_url
            else "Sem link"
        )

        # Prepara a linha a ser inserida (9 colunas)
        row_data = [
            dados_extracao.get("data", ""),
            dados_extracao.get("estabelecimento", ""),
            dados_extracao.get("tipo_documento", "Recibo"),
            dados_extracao.get("categoria", ""),
            dados_extracao.get("pagamento", "Outros"),
            dados_extracao.get("valor", 0.0),
            sender_name,
            formula_hyperlink,  # <--- Insere a fórmula do link clicável aqui
            caption or ""
        ]

        # Verifica duplicidade simples (mesma Data, Estabelecimento e Valor)
        try:
            registros_existentes = worksheet.get_all_records()
            for reg in registros_existentes:
                if (
                    str(reg.get("Date", "")).strip() == str(row_data[0]).strip()
                    and str(reg.get("Establishment", "")).strip() == str(row_data[1]).strip()
                    and str(reg.get("Value", "")).replace("R$", "").strip() == str(row_data[5]).strip()
                ):
                    return {
                        "sucesso": False,
                        "duplicado": True,
                        "aba": mes_ano,
                        "erro": "Este comprovante já foi registrado anteriormente nesta aba."
                    }
        except Exception as dup_err:
            logger.warning(f"Aviso ao verificar duplicidade: {dup_err}")

        # IMPORTANTE: value_input_option='USER_ENTERED' faz o Google Planilhas interpretar a fórmula =HYPERLINK
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

from sheets_service import salvar_na_planilha, extrair_aba_mes_ano

app = FastAPI(title="Meu Bot de Finanças — Telegram + OCR.space + Google Sheets")

# Armazenamento temporário em memória para dados de recibos aguardando categoria
DADOS_TEMPORARIOS = {}


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

    match_data = re.search(r"\\b\\d{2}/\\d{2}/\\d{2,4}\\b", texto)
    data = match_data.group(0) if match_data else datetime.now().strftime("%d/%m/%Y")

    valores = re.findall(r"\\b(?:\\d{1,3}(?:\\.\\d{3})*|\\d+)[\\.,]\\d{2}\\b", texto)
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

                resultado = salvar_na_planilha(
                    dados_extracao=dados,
                    sender_name=sender_name,
                    caption=caption,
                    file_url=file_url
                )

                if resultado.get("sucesso"):
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
                    responder_callback_query(callback_id, "Comprovante duplicado!")
                    enviar_mensagem_telegram(
                        chat_id,
                        f"⚠️ *Registro Duplicado:* Este comprovante já consta na aba *{resultado.get('aba')}*."
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
