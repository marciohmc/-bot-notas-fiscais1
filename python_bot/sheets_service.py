import os
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
        if "private_key" in creds_dict and "\\n" in creds_dict["private_key"]:
            creds_dict["private_key"] = creds_dict["private_key"].replace("\\n", "\n")

        creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)

    return gspread.authorize(creds)


def extrair_aba_mes_ano(data_str: str) -> str:
    """
    Extrai o mês e ano da data do recibo (Formato esperado: DD/MM/AAAA)
    retornando no padrão MM-AAAA (ex: '11-2026').
    """
    if data_str:
        match = re.search(r"\b(\d{2})/(\d{2})/(\d{2,4})\b", str(data_str))
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
        formula_hyperlink = (
            f'=HYPERLINK("{file_url}"; "Ver Comprovante")'
            if file_url
            else "Sem link"
        )

        # Prepara a linha a ser inserida conforme as 9 colunas especificadas
        row_data = [
            dados_extracao.get("data", ""),
            dados_extracao.get("estabelecimento", ""),
            dados_extracao.get("tipo_documento", "Recibo/Cupom"),
            dados_extracao.get("categoria", ""),
            dados_extracao.get("pagamento", "Outros"),
            dados_extracao.get("valor", 0.0),
            sender_name,
            formula_hyperlink,  # <--- Insere a fórmula do link clicável aqui
            caption or ""
        ]

        # Verifica duplicidade simples (mesma Data, Estabelecimento e Valor na aba do mês)
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

        # IMPORTANTE: value_input_option='USER_ENTERED' interpreta a fórmula =HYPERLINK(...)
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
