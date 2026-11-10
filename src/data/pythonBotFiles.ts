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
  responsavel: string;
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
    responsavel: 'Carlos Mendes (@carlos_obras)',
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
    responsavel: 'Marcos Silva (@marcos_eng)',
    token_origem: '3b19e7a4',
  },
];

export const PYTHON_MAIN_CODE = `import os
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
# Chave: estado_id (file_unique_id curto, seguro para o limite de 64 bytes do callback_data)
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

        client = gspread.authorize(creds)
        sheet_id = (
            os.environ.get("SPREADSHEET_ID")
            or os.environ.get("GOOGLE_SHEET_ID")
            or ""
        ).strip()

        if not sheet_id:
            raise RuntimeError("A variável SPREADSHEET_ID não foi configurada no Render.")

        return client.open_by_key(sheet_id).sheet1
    except json.JSONDecodeError as je:
        raise RuntimeError(
            f"GOOGLE_CREDENTIALS_JSON inválido (cole o JSON completo começando com '{{'): {str(je)}"
        )
    except Exception as e:
        raise RuntimeError(f"Falha ao conectar ao Google Sheets: {str(e)}")

# 2. Função para enviar mensagem com botões de seleção de categoria (Inline Keyboard)
def enviar_mensagem_com_botoes(chat_id: int, texto: str, estado_id: str):
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    
    # IMPORTANTE: Usamos estado_id (file_unique_id) ou file_id[:20] porque o file_id completo
    # do Telegram tem ~85 caracteres e estoura o limite de 64 bytes do callback_data!
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
        res = requests.get(
            f"https://api.telegram.org/bot{bot_token}/getFile",
            params={"file_id": file_id},
            timeout=15
        ).json()
        file_path = res["result"]["file_path"]
        file_url = f"https://api.telegram.org/file/bot{bot_token}/{file_path}"
        response = requests.get(file_url, timeout=30)
        response.raise_for_status()
        return response.content
    except Exception as e:
        raise RuntimeError(f"Falha ao baixar arquivo do Telegram: {str(e)}")

# 6. Função para realizar OCR via OCR.space API (Com chave no Header e Base64/Multipart)
def processar_ocr_space(
    arquivo_bytes: bytes,
    mime_type: str = "image/jpeg",
    usar_base64: bool = True
) -> str:
    api_key = os.environ.get("OCR_SPACE_API_KEY", "")
    
    # Validação do limite de 1 MB (1.024 KB) do plano gratuito do OCR.space
    if len(arquivo_bytes) > 1024 * 1024:
        raise ValueError("O arquivo excede o limite de 1 MB do plano gratuito do OCR.space.")

    # BOA PRÁTICA: Envio da chave de API no header HTTP 'apikey'
    headers = {
        "apikey": api_key
    }
    
    payload = {
        "language": "por",
        "OCREngine": "2",
        "isTable": "true",
        "scale": "true"
    }

    try:
        if usar_base64:
            # Prefixo obrigatório para envio em Base64 (ex: data:image/jpeg;base64,...)
            b64_str = base64.b64encode(arquivo_bytes).decode("utf-8")
            payload["base64Image"] = f"data:{mime_type};base64,{b64_str}"
            response = requests.post(
                "https://api.ocr.space/parse/image",
                headers=headers,
                data=payload,
                timeout=45
            )
        else:
            ext = "pdf" if "pdf" in mime_type else "jpg"
            files = {"file": (f"receipt.{ext}", arquivo_bytes, mime_type)}
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
            erro_msg = result.get("ErrorMessage", ["Erro desconhecido no OCR"])
            raise Exception(erro_msg[0] if isinstance(erro_msg, list) else str(erro_msg))
        
        parsed_results = result.get("ParsedResults", [])
        if not parsed_results:
            return ""
        return "\\n".join(p.get("ParsedText", "") for p in parsed_results)
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Erro na requisição ao OCR.space: {str(e)}")

# 7. Lógica para extrair dados estruturados a partir do texto lido
def extrair_dados_recibo(texto: str):
    linhas = [l.strip() for l in texto.split("\\n") if l.strip()]
    estabelecimento = linhas[0] if linhas else "Desconhecido"
    
    match_data = re.search(r"\\b\\d{2}/\\d{2}/\\d{2,4}\\b", texto)
    data = match_data.group(0) if match_data else datetime.now().strftime("%d/%m/%Y")
    
    # Suporta valores com separador de milhar (ex: 1.120,00 ou 461,90)
    valores = re.findall(r"\\b(?:\\d{1,3}(?:\\.\\d{3})*|\\d+)[\\.,]\\d{2}\\b", texto)
    valor = 0.0
    if valores:
        try:
            ultimo = valores[-1]
            if "," in ultimo and "." in ultimo:
                ultimo = ultimo.replace(".", "").replace(",", ".")
            else:
                ultimo = ultimo.replace(",", ".")
            valor = float(ultimo)
        except ValueError:
            valor = 0.0

    texto_upper = texto.upper()
    if "PIX" in texto_upper:
        pagamento = "PIX"
    elif "CREDITO" in texto_upper or "CRÉDITO" in texto_upper:
        pagamento = "Cartão de Crédito"
    elif "DEBITO" in texto_upper or "DÉBITO" in texto_upper:
        pagamento = "Cartão de Débito"
    elif "DINHEIRO" in texto_upper:
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
    
    # 1. Trata o recebimento de foto ou documento (PDF) no Telegram
    if "message" in data and ("photo" in data["message"] or "document" in data["message"]):
        message = data["message"]
        chat_id = message["chat"]["id"]
        caption = message.get("caption", "")
        
        # Identifica quem enviou o comprovante (Coluna Responsável)
        responsavel = extrair_nome_remetente(message.get("from", {}))
        
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
            arquivo_bytes = baixar_arquivo_telegram(file_id)
            texto_extraido = processar_ocr_space(arquivo_bytes, mime_type=mime_type)
            dados = extrair_dados_recibo(texto_extraido)
            dados["observacoes"] = caption
            dados["responsavel"] = responsavel
            
            # Salva dados extraídos temporariamente usando o estado_id curto (file_unique_id)
            DADOS_TEMPORARIOS[estado_id] = dados
            
            obs_text = f"\\n• *Observação:* {caption}" if caption else ""
            msg_prompt = (
                f"🧾 *Leitura do Recibo Concluída!*\\n\\n"
                f"• *Responsável:* {responsavel}\\n"
                f"• *Local:* {dados.get('estabelecimento')}\\n"
                f"• *Data:* {dados.get('data')}\\n"
                f"• *Valor:* R$ {dados.get('valor'):.2f}\\n"
                f"• *Pagamento:* {dados.get('pagamento')}"
                f"{obs_text}\\n\\n"
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
            
            # Recupera dados temporários
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
                    
                    obs_text = f"\\n• *Observação:* {dados.get('observacoes')}" if dados.get('observacoes') else ""
                    msg_sucesso = (
                        f"✅ *Gasto Registrado no Google Sheets!*\\n\\n"
                        f"• *Responsável:* {dados.get('responsavel')}\\n"
                        f"• *Local:* {dados.get('estabelecimento')}\\n"
                        f"• *Data:* {dados.get('data')}\\n"
                        f"• *Valor:* R$ {dados.get('valor'):.2f}\\n"
                        f"• *Categoria:* {dados.get('categoria')}\\n"
                        f"• *Pagamento:* {dados.get('pagamento')}"
                        f"{obs_text}"
                    )
                    enviar_mensagem_telegram(chat_id, msg_sucesso)
                except Exception as e:
                    # Restaura em memória para permitir nova tentativa se o Google Sheets falhar
                    DADOS_TEMPORARIOS[estado_id] = dados
                    enviar_mensagem_telegram(chat_id, f"⚠️ Erro ao salvar na planilha: {str(e)}")
            else:
                responder_callback_query(callback_id, "Dados expirados ou já processados.")
                enviar_mensagem_telegram(chat_id, "⚠️ Os dados deste recibo expiraram ou já foram salvos.")
                
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
