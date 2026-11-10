import os
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
    limpo = re.sub(r"\s+", " ", sem_acentos).strip().upper()
    return limpo


def normalizar_data(data_str: str) -> str:
    """
    Padroniza datas como '5/11/2026' ou '05/11/26' para '05/11/2026'.
    """
    if not data_str:
        return ""
    match = re.search(r"\b(\d{1,2})/(\d{1,2})/(\d{2,4})\b", str(data_str).strip())
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

            if trecho_arquivo and trecho_arquivo in celula_link_formula:
                return {
                    "duplicado": True,
                    "linha": idx + 1,
                    "responsavel_anterior": resp_planilha,
                    "motivo": f"O mesmo arquivo do Telegram já foi registrado na linha {idx + 1} por {resp_planilha}."
                }

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
    file_url: str
) -> dict:
    """
    Insere os dados extraídos na aba correspondente ao mês/ano da despesa (ex: 11-2026),
    adicionando o link oficial do Telegram formatado como hiperlink clicável na planilha
    e bloqueando registros duplicados antes de inserir.
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
        except gspread.exceptions.WorksheetNotFound:
            worksheet = spreadsheet.add_worksheet(title=mes_ano, rows=1000, cols=10)
            worksheet.append_row(CABECALHOS_PADRAO, value_input_option="USER_ENTERED")

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

        row_data = [
            data_formatada,
            estabelecimento,
            dados_extracao.get("tipo_documento", "Recibo/Cupom"),
            dados_extracao.get("categoria", ""),
            dados_extracao.get("pagamento", "Outros"),
            valor_numerico,
            sender_name,
            formula_hyperlink,
            caption or ""
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
