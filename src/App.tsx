import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  Send,
  Upload,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Terminal,
  Search,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import {
  RECEIPT_SAMPLES,
  CATEGORIAS_GASTO,
  INITIAL_SHEET_ROWS,
  PYTHON_MAIN_CODE,
  SHEETS_SERVICE_CODE,
  REQUIREMENTS_CODE,
  PROCFILE_CODE,
  ENV_EXAMPLE_CODE,
  CategoriaGasto,
  SheetRow,
} from './data/pythonBotFiles';
import { extrairDadosReciboTS, ParsedReceiptData } from './utils/receiptParser';

type ActiveSection = 'simulador' | 'codigo' | 'planilha' | 'arquitetura';
type CodeTab = 'main.py' | 'sheets_service.py' | 'requirements.txt' | 'Procfile' | '.env.example';

interface PendingTelegramState extends ParsedReceiptData {
  token: string;
  criadoEm: string;
  mimeType: string;
  sizeKb: number;
  ocrEngine: '2' | '3';
  responsavel: string;
  file_url: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  timestamp: string;
  title?: string;
  caption?: string;
  responsavel?: string;
  fileType?: string;
  sizeKb?: number;
  text: string;
  pendingToken?: string;
  resolvedCategory?: CategoriaGasto;
  resolvedFormula?: string;
  duplicateWarning?: boolean;
  duplicateDetails?: string;
  cancelled?: boolean;
  isError?: boolean;
}

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('simulador');
  const [activeCodeTab, setActiveCodeTab] = useState<CodeTab>('sheets_service.py');
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  // Simulador OCR.space + Telegram State
  const [selectedSampleId, setSelectedSampleId] = useState<string>(RECEIPT_SAMPLES[0].id);
  const [customCaption, setCustomCaption] = useState<string>(RECEIPT_SAMPLES[0].caption);
  const [customResponsavel, setCustomResponsavel] = useState<string>('João Oliveira (@joao_frota)');
  const [selectedEngine, setSelectedEngine] = useState<'2' | '3'>('2');
  const [realOcrKey, setRealOcrKey] = useState<string>('');
  const [isProcessingOcr, setIsProcessingOcr] = useState<boolean>(false);
  const [base64Preview, setBase64Preview] = useState<string>(
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL...'
  );

  // DADOS_TEMPORARIOS em memória (espelhando o dicionário Python)
  const [dadosTemporarios, setDadosTemporarios] = useState<Record<string, PendingTelegramState>>({
    a94f21c8: {
      token: 'a94f21c8',
      criadoEm: '11:35:12',
      mimeType: 'image/jpeg',
      sizeKb: 384,
      ocrEngine: '2',
      data: '10/11/2026',
      aba_mes: '11-2026',
      estabelecimento: 'AUTO POSTO AVENIDA LTDA',
      tipo_documento: 'Cupom Fiscal',
      valor: '461,90',
      forma_pagamento: 'Cartão de Débito',
      observacoes: 'Abastecimento frota caminhão placa ABC-1234',
      responsavel: 'João Oliveira (@joao_frota)',
      file_url: 'https://api.telegram.org/file/bot<TOKEN>/photos/file_84920_posto_avenida.jpg',
      texto_bruto: RECEIPT_SAMPLES[0].rawText,
    },
  });

  // Histórico de mensagens do grupo no Telegram
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init-1',
      sender: 'user',
      timestamp: '11:35:10',
      title: 'Cupom Fiscal — Posto Avenida (11-2026)',
      caption: 'Abastecimento frota caminhão placa ABC-1234',
      responsavel: 'João Oliveira (@joao_frota)',
      fileType: 'image/jpeg',
      sizeKb: 384,
      text: 'Enviou um comprovante no grupo Financeiro Obras',
    },
    {
      id: 'msg-init-2',
      sender: 'bot',
      timestamp: '11:35:12',
      text: 'Recibo processado via OCR.space (Engine 2 · isTable=True) e URL oficial do Telegram capturada via getFile. Escolha a categoria abaixo para gravar na aba do mês:',
      pendingToken: 'a94f21c8',
    },
  ]);

  // Linhas salvas no Google Sheets (separadas por abas mensais MM-AAAA)
  const [sheetRows, setSheetRows] = useState<SheetRow[]>(INITIAL_SHEET_ROWS);
  const [activeMonthTab, setActiveMonthTab] = useState<string>('Todas as Abas');
  const [sheetFilter, setSheetFilter] = useState<string>('Todas');
  const [sheetSearch, setSheetSearch] = useState<string>('');
  const [inspectedOcrRow, setInspectedOcrRow] = useState<SheetRow | null>(null);

  // Lista dinâmica de abas mensais existentes na planilha
  const availableMonthTabs = useMemo(() => {
    const tabs = Array.from(new Set(sheetRows.map((r) => r.aba_mes)));
    return ['Todas as Abas', ...tabs];
  }, [sheetRows]);

  // Seleção de exemplo de recibo
  const handleSelectSample = (sampleId: string) => {
    setSelectedSampleId(sampleId);
    const found = RECEIPT_SAMPLES.find((s) => s.id === sampleId);
    if (found) {
      setCustomCaption(found.caption);
      setSelectedEngine(found.ocrEngine);
      const prefix =
        found.type === 'application/pdf'
          ? 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nG2P...'
          : 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAx...';
      setBase64Preview(prefix);
    }
  };

  // Disparo da simulação de envio da foto/PDF no grupo do Telegram
  const handleSimulateTelegramUpload = () => {
    const sample = RECEIPT_SAMPLES.find((s) => s.id === selectedSampleId);
    if (!sample) return;

    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);
    const userMsgId = `msg-u-${Date.now()}`;
    const remetente = customResponsavel.trim() || 'Usuário Telegram';

    const newUserMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      timestamp: timeStr,
      title: sample.title,
      caption: customCaption,
      responsavel: remetente,
      fileType: sample.type,
      sizeKb: sample.sizeKb,
      text: `Arquivo enviado (${sample.type})`,
    };

    setIsProcessingOcr(true);

    setTimeout(() => {
      setIsProcessingOcr(false);

      // Validação rigorosa do limite de 1 MB (1024 KB) do OCR.space gratuito
      if (sample.sizeKb > 1024) {
        const errorBotMsg: ChatMessage = {
          id: `msg-b-${Date.now()}`,
          sender: 'bot',
          timestamp: new Date().toTimeString().slice(0, 8),
          text: `⚠️ O arquivo (${sample.sizeKb} KB) excede o limite de 1 MB (1.024 KB) do plano gratuito da API OCR.space. Comprima a imagem ou envie como foto padrão do Telegram.`,
          isError: true,
        };
        setChatMessages((prev) => [...prev, newUserMsg, errorBotMsg]);
        return;
      }

      const parsed = extrairDadosReciboTS(sample.rawText, customCaption);
      const token = Math.random().toString(16).substring(2, 10);
      const ext = sample.type === 'application/pdf' ? 'pdf' : 'jpg';
      const folder = sample.type === 'application/pdf' ? 'documents' : 'photos';
      const fileUrl = `https://api.telegram.org/file/bot<TOKEN>/${folder}/file_${token}_${sample.id}.${ext}`;

      const newState: PendingTelegramState = {
        ...parsed,
        token,
        criadoEm: new Date().toTimeString().slice(0, 8),
        mimeType: sample.type,
        sizeKb: sample.sizeKb,
        ocrEngine: selectedEngine,
        responsavel: remetente,
        file_url: fileUrl,
      };

      setDadosTemporarios((prev) => ({
        ...prev,
        [token]: newState,
      }));

      const botMsg: ChatMessage = {
        id: `msg-b-${Date.now()}`,
        sender: 'bot',
        timestamp: new Date().toTimeString().slice(0, 8),
        text: `Recibo processado via OCR.space (OCREngine=${selectedEngine}, language="por", isTable=True). Aba destino: ${parsed.aba_mes}. Selecione a categoria:`,
        pendingToken: token,
      };

      setChatMessages((prev) => [...prev, newUserMsg, botMsg]);
    }, 350);
  };

  // Upload real de imagem ou PDF para testar a API real do OCR.space ou parser local
  const handleRealFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeKb = Math.round(file.size / 1024);
    const mimeType = file.type || 'image/jpeg';
    const nowStr = new Date().toTimeString().slice(0, 8);
    const remetente = customResponsavel.trim() || 'Usuário Telegram';

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setBase64Preview(dataUrl.slice(0, 140) + '...');

      const userMsg: ChatMessage = {
        id: `msg-u-${Date.now()}`,
        sender: 'user',
        timestamp: nowStr,
        title: file.name,
        caption: customCaption || 'Recibo enviado via upload local',
        responsavel: remetente,
        fileType: mimeType,
        sizeKb,
        text: `Upload de arquivo real: ${file.name}`,
      };

      if (sizeKb > 1024) {
        const errMsg: ChatMessage = {
          id: `msg-b-${Date.now()}`,
          sender: 'bot',
          timestamp: nowStr,
          text: `⚠️ Arquivo "${file.name}" possui ${sizeKb} KB e ultrapassa o limite máximo de 1 MB (1.024 KB) da API gratuita do OCR.space.`,
          isError: true,
        };
        setChatMessages((prev) => [...prev, userMsg, errMsg]);
        return;
      }

      setIsProcessingOcr(true);
      let ocrText = '';

      if (realOcrKey.trim().length > 4) {
        try {
          const formData = new FormData();
          formData.append('base64Image', dataUrl);
          formData.append('language', 'por');
          formData.append('OCREngine', selectedEngine);
          formData.append('isTable', 'true');
          formData.append('scale', 'true');

          const resp = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            headers: {
              apikey: realOcrKey.trim(),
            },
            body: formData,
          });
          const json = await resp.json();
          if (json.IsErroredOnProcessing) {
            throw new Error(json.ErrorMessage?.join(', ') || 'Erro no OCR.space');
          }
          ocrText =
            json.ParsedResults?.map((r: { ParsedText: string }) => r.ParsedText).join('\n') || '';
        } catch (err) {
          setIsProcessingOcr(false);
          const errBot: ChatMessage = {
            id: `msg-b-${Date.now()}`,
            sender: 'bot',
            timestamp: new Date().toTimeString().slice(0, 8),
            text: `⚠️ Falha na chamada real ao OCR.space: ${
              err instanceof Error ? err.message : 'Erro de rede'
            }`,
            isError: true,
          };
          setChatMessages((prev) => [...prev, userMsg, errBot]);
          return;
        }
      } else {
        ocrText = `${file.name.replace(/\.[^/.]+$/, '').toUpperCase()} COMERCIO LTDA\nDATA: ${new Date().toLocaleDateString(
          'pt-BR'
        )}\nVALOR TOTAL R$ 285,00\nPAGAMENTO: PIX`;
      }

      setIsProcessingOcr(false);
      const parsed = extrairDadosReciboTS(
        ocrText,
        customCaption || 'Recibo enviado via upload local'
      );
      const token = Math.random().toString(16).substring(2, 10);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileUrl = `https://api.telegram.org/file/bot<TOKEN>/photos/file_${token}_${safeName}`;

      setDadosTemporarios((prev) => ({
        ...prev,
        [token]: {
          ...parsed,
          token,
          criadoEm: new Date().toTimeString().slice(0, 8),
          mimeType,
          sizeKb,
          ocrEngine: selectedEngine,
          responsavel: remetente,
          file_url: fileUrl,
        },
      }));

      const botMsg: ChatMessage = {
        id: `msg-b-${Date.now()}`,
        sender: 'bot',
        timestamp: new Date().toTimeString().slice(0, 8),
        text: `Arquivo "${file.name}" processado. Aba destino: ${parsed.aba_mes}. Selecione a categoria abaixo:`,
        pendingToken: token,
      };

      setChatMessages((prev) => [...prev, userMsg, botMsg]);
    };
    reader.readAsDataURL(file);
  };

  // Clique em um botão do Inline Keyboard do Telegram (callback_query: cat|<categoria>|<token>)
  const handleSelectCategory = (messageId: string, token: string, categoria: CategoriaGasto) => {
    const pending = dadosTemporarios[token];
    if (!pending) return;

    const formulaHyperlink = `=HYPERLINK("${pending.file_url}"; "Ver Comprovante")`;

    // Funções de normalização idênticas ao sheets_service.py
    const normText = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

    const normFloat = (v: string) => {
      const cleaned = v.replace(/R\$/g, '').replace(/\./g, '').replace(',', '.').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
    };

    const existingDuplicate = sheetRows.find(
      (r) =>
        r.aba_mes === pending.aba_mes &&
        (r.file_url === pending.file_url ||
          (r.data.trim() === pending.data.trim() &&
            normText(r.estabelecimento) === normText(pending.estabelecimento) &&
            Math.abs(normFloat(r.valor) - normFloat(pending.valor)) < 0.01))
    );

    const isDuplicate = Boolean(existingDuplicate);
    const duplicateDetails = existingDuplicate
      ? `Comprovante idêntico (${pending.estabelecimento} · R$ ${pending.valor} em ${pending.data}) já foi lançado na aba [${pending.aba_mes}] por ${existingDuplicate.responsavel}.`
      : undefined;

    if (!isDuplicate) {
      const newRow: SheetRow = {
        id: `row-${Date.now()}`,
        data: pending.data,
        aba_mes: pending.aba_mes,
        estabelecimento: pending.estabelecimento,
        tipo_documento: pending.tipo_documento,
        valor: pending.valor,
        categoria,
        forma_pagamento: pending.forma_pagamento,
        observacoes: pending.observacoes,
        responsavel: pending.responsavel,
        file_url: pending.file_url,
        formula_hyperlink: formulaHyperlink,
        texto_ocr: pending.texto_bruto,
        token_origem: token,
      };

      setSheetRows((prev) => [newRow, ...prev]);
    }

    // Remove do dicionário DADOS_TEMPORARIOS (pop)
    setDadosTemporarios((prev) => {
      const copy = { ...prev };
      delete copy[token];
      return copy;
    });

    // Atualiza a mensagem no Telegram simulando editMessageText
    setChatMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              resolvedCategory: categoria,
              resolvedFormula: formulaHyperlink,
              duplicateWarning: isDuplicate,
              duplicateDetails,
            }
          : m
      )
    );
  };

  const handleCancelCallback = (messageId: string, token: string) => {
    setDadosTemporarios((prev) => {
      const copy = { ...prev };
      delete copy[token];
      return copy;
    });

    setChatMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              cancelled: true,
            }
          : m
      )
    );
  };

  // Cópia de código
  const handleCopyCode = (filename: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedFile(filename);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  // Download de arquivo Python ou CSV
  const handleDownloadFile = (filename: string, content: string, mime = 'text/plain') => {
    const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const headers = [
      'Aba (MM-AAAA)',
      'Date',
      'Establishment',
      'Doc Type',
      'Category',
      'Payment',
      'Value',
      'Responsible',
      'Receipt Link (Formula)',
      'Obs',
      'OCR Text',
    ];
    const rows = filteredSheetRows.map((r) => [
      r.aba_mes,
      r.data,
      `"${r.estabelecimento.replace(/"/g, '""')}"`,
      r.tipo_documento,
      r.categoria,
      r.forma_pagamento,
      `"${r.valor}"`,
      `"${r.responsavel.replace(/"/g, '""')}"`,
      `"${r.formula_hyperlink.replace(/"/g, '""')}"`,
      `"${r.observacoes.replace(/"/g, '""')}"`,
      `"${r.texto_ocr.replace(/\n/g, ' | ').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    handleDownloadFile('planilha_gastos_telegram_ocr.csv', csvContent, 'text/csv');
  };

  const filteredSheetRows = useMemo(() => {
    return sheetRows.filter((row) => {
      const matchesMonth =
        activeMonthTab === 'Todas as Abas' || row.aba_mes === activeMonthTab;
      const matchesCat = sheetFilter === 'Todas' || row.categoria === sheetFilter;
      const matchesQuery =
        !sheetSearch.trim() ||
        row.estabelecimento.toLowerCase().includes(sheetSearch.toLowerCase()) ||
        row.observacoes.toLowerCase().includes(sheetSearch.toLowerCase()) ||
        row.responsavel.toLowerCase().includes(sheetSearch.toLowerCase()) ||
        row.aba_mes.toLowerCase().includes(sheetSearch.toLowerCase()) ||
        row.tipo_documento.toLowerCase().includes(sheetSearch.toLowerCase()) ||
        row.texto_ocr.toLowerCase().includes(sheetSearch.toLowerCase()) ||
        row.forma_pagamento.toLowerCase().includes(sheetSearch.toLowerCase());
      return matchesMonth && matchesCat && matchesQuery;
    });
  }, [sheetRows, activeMonthTab, sheetFilter, sheetSearch]);

  const totalAcumulado = useMemo(() => {
    return filteredSheetRows.reduce((acc, row) => {
      const num = parseFloat(row.valor.replace(/\./g, '').replace(',', '.'));
      return acc + (isNaN(num) ? 0 : num);
    }, 0);
  }, [filteredSheetRows]);

  const currentCodeContent = useMemo(() => {
    switch (activeCodeTab) {
      case 'main.py':
        return PYTHON_MAIN_CODE;
      case 'sheets_service.py':
        return SHEETS_SERVICE_CODE;
      case 'requirements.txt':
        return REQUIREMENTS_CODE;
      case 'Procfile':
        return PROCFILE_CODE;
      case '.env.example':
        return ENV_EXAMPLE_CODE;
    }
  }, [activeCodeTab]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 Zonas Limpas */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-30">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('simulador');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          FinBot OCR · Engenharia FastAPI
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => setActiveSection('simulador')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeSection === 'simulador'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Simulador Webhook &amp; OCR
          </button>
          <button
            onClick={() => setActiveSection('codigo')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeSection === 'codigo'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Código Python (main.py + sheets_service.py)
          </button>
          <button
            onClick={() => setActiveSection('planilha')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeSection === 'planilha'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Planilha Google Sheets ({sheetRows.length})
          </button>
          <button
            onClick={() => setActiveSection('arquitetura')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeSection === 'arquitetura'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Boas Práticas &amp; Erros
          </button>
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() =>
              handleDownloadFile('sheets_service.py', SHEETS_SERVICE_CODE, 'text/x-python')
            }
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            sheets_service.py
          </button>
          <button
            onClick={() => handleDownloadFile('main.py', PYTHON_MAIN_CODE, 'text/x-python')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            main.py
          </button>
        </div>
      </header>

      {/* Barra de Navegação Mobile */}
      <div className="flex md:hidden items-center gap-2 px-4 py-2.5 bg-white border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveSection('simulador')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
            activeSection === 'simulador'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Simulador
        </button>
        <button
          onClick={() => setActiveSection('codigo')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
            activeSection === 'codigo'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Código Python
        </button>
        <button
          onClick={() => setActiveSection('planilha')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
            activeSection === 'planilha'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Google Sheets ({sheetRows.length})
        </button>
        <button
          onClick={() => setActiveSection('arquitetura')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
            activeSection === 'arquitetura'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Boas Práticas
        </button>
      </div>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-[1380px] w-full mx-auto px-6 py-8">
        {/* Cabeçalho Contextual e Métricas Operacionais */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-slate-200">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">
              FastAPI + Uvicorn · API OCR.space (OCREngine 2/3) · Link Direto Telegram (=HYPERLINK) · Google Sheets (Abas MM-AAAA)
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 max-w-3xl">
              Arquitetura e Bancada de Testes para Bot Financeiro no Telegram
            </h1>
          </div>

          <div className="grid grid-cols-3 gap-6 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-200 shrink-0">
            <div>
              <p className="text-xs text-slate-500">Estados Pendentes (Memória)</p>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                {Object.keys(dadosTemporarios).length}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Linhas no Google Sheets</p>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                {sheetRows.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Limite Plano Free OCR</p>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                1.024 KB
              </p>
            </div>
          </div>
        </div>

        {/* =========================================================
            ABA 1: SIMULADOR INTERATIVO (OCR.SPACE + TELEGRAM + MEMÓRIA)
           ========================================================= */}
        {activeSection === 'simulador' && (
          <div className="mt-8 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Coluna Esquerda (5 cols): Configuração do Payload OCR.space & Disparo */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      1. Entrada de Recibo &amp; Parâmetros OCR.space
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      POST https://api.ocr.space/parse/image
                    </p>
                  </div>
                  <Sliders className="w-4 h-4 text-slate-400 shrink-0" />
                </div>

                {/* Escolha de Recibo de Teste */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Cenário de Teste (Cupom Fiscal, PDF ou Arquivo &gt; 1 MB)
                  </label>
                  <select
                    value={selectedSampleId}
                    onChange={(e) => handleSelectSample(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    {RECEIPT_SAMPLES.map((sample) => (
                      <option key={sample.id} value={sample.id}>
                        {sample.title} ({sample.sizeKb} KB)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Remetente no Telegram (Coluna Responsável) */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Quem enviou no Telegram (message.from → Coluna Responsible)
                  </label>
                  <input
                    type="text"
                    value={customResponsavel}
                    onChange={(e) => setCustomResponsavel(e.target.value)}
                    placeholder="Ex: João Oliveira (@joao_frota)"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                {/* Legenda enviada junto com a foto no grupo do Telegram */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Legenda da Mensagem no Telegram (message.caption → Coluna Obs)
                  </label>
                  <input
                    type="text"
                    value={customCaption}
                    onChange={(e) => setCustomCaption(e.target.value)}
                    placeholder="Ex: Compra de peças para manutenção do gerador"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                {/* Seletor de OCREngine */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Motor de Reconhecimento (OCREngine + isTable=True)
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setSelectedEngine('2')}
                      className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedEngine === '2'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      OCREngine = &quot;2&quot; (Recibos)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedEngine('3')}
                      className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedEngine === '3'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      OCREngine = &quot;3&quot; (Tabelas/PDF)
                    </button>
                  </div>
                </div>

                {/* Inspecionar Prefixo Base64 Obrigatório */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      Payload Base64 com Prefixo MIME Obrigatório
                    </span>
                    <span className="text-slate-500 font-mono">language=&quot;por&quot;</span>
                  </div>
                  <div className="p-3 bg-slate-900 text-slate-200 rounded-lg font-mono text-xs break-all leading-relaxed">
                    <span className="text-amber-400">apikey:</span> OCR_SPACE_API_KEY (Header)
                    <br />
                    <span className="text-emerald-400">base64Image:</span> &quot;{base64Preview}&quot;
                  </div>
                </div>

                {/* Botão Primário de Simulação */}
                <div className="pt-2 space-y-3">
                  <button
                    type="button"
                    onClick={handleSimulateTelegramUpload}
                    disabled={isProcessingOcr}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {isProcessingOcr ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Processando no OCR.space...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Simular Envio no Grupo do Telegram
                      </>
                    )}
                  </button>

                  {/* Opção para testar arquivo próprio */}
                  <div className="pt-3 border-t border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600">
                        Ou teste com uma foto/PDF real do seu computador:
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="password"
                        value={realOcrKey}
                        onChange={(e) => setRealOcrKey(e.target.value)}
                        placeholder="Chave OCR.space opcional (apikey)"
                        className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono"
                      />
                      <label className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        Enviar Foto/PDF
                        <input
                          type="file"
                          accept="image/jpeg,image/png,application/pdf"
                          onChange={handleRealFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Coluna Direita (7 cols): Simulador de Grupo do Telegram + Inline Keyboard */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold">
                      2. Grupo do Telegram — Automação Financeira
                    </h2>
                    <p className="text-xs text-slate-400">
                      Webhook assíncrono (/webhook) · Salva link direto =HYPERLINK(&quot;...&quot;; &quot;Ver Comprovante&quot;)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection('planilha')}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Ver Planilha ({sheetRows.length})
                  </button>
                </div>

                {/* Feed de Mensagens */}
                <div className="p-6 space-y-4 max-h-[540px] overflow-y-auto bg-slate-50">
                  {chatMessages.map((msg) => {
                    const pendingData = msg.pendingToken
                      ? dadosTemporarios[msg.pendingToken]
                      : undefined;

                    if (msg.sender === 'user') {
                      return (
                        <div key={msg.id} className="flex justify-end">
                          <div className="max-w-md w-full bg-blue-600 text-white rounded-xl p-4 space-y-2">
                            <div className="flex items-center justify-between text-xs text-blue-100">
                              <span>{msg.responsavel || 'Você'} · Grupo Financeiro</span>
                              <span className="font-mono tabular-nums">{msg.timestamp}</span>
                            </div>
                            <div className="p-2.5 bg-blue-700/80 rounded-lg text-xs font-mono flex items-center justify-between">
                              <span className="truncate">{msg.title}</span>
                              <span className="tabular-nums shrink-0 ml-2">
                                {msg.sizeKb} KB
                              </span>
                            </div>
                            {msg.caption && (
                              <p className="text-xs text-blue-50">
                                <strong className="font-semibold">Legenda:</strong> {msg.caption}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className="flex justify-start">
                        <div
                          className={`max-w-lg w-full bg-white border rounded-xl p-4 space-y-3 ${
                            msg.isError ? 'border-red-300 bg-red-50/40' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span className="font-semibold text-slate-800">
                              FinBot OCR (FastAPI Webhook)
                            </span>
                            <span className="font-mono tabular-nums">{msg.timestamp}</span>
                          </div>

                          <p className="text-xs text-slate-700 leading-relaxed">{msg.text}</p>

                          {/* Dados extraídos ainda aguardando clique no botão inline */}
                          {pendingData && !msg.resolvedCategory && !msg.cancelled && (
                            <>
                              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5 font-mono">
                                <div>
                                  <span className="text-slate-500">Responsible:</span>{' '}
                                  <span className="font-semibold text-blue-700">
                                    {pendingData.responsavel}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Date &amp; Aba (MM-AAAA):</span>{' '}
                                  <span className="font-semibold text-slate-900 tabular-nums">
                                    {pendingData.data} → Aba [{pendingData.aba_mes}]
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Establishment:</span>{' '}
                                  <span className="font-semibold text-slate-900">
                                    {pendingData.estabelecimento}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Doc Type:</span>{' '}
                                  <span className="font-semibold text-slate-800">
                                    {pendingData.tipo_documento}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Value:</span>{' '}
                                  <span className="font-semibold text-emerald-700 tabular-nums">
                                    R$ {pendingData.valor}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Payment:</span>{' '}
                                  <span className="font-semibold text-slate-900">
                                    {pendingData.forma_pagamento}
                                  </span>
                                </div>
                                <div className="truncate">
                                  <span className="text-slate-500">Receipt Link:</span>{' '}
                                  <span className="text-blue-700">
                                    =HYPERLINK(&quot;{pendingData.file_url}&quot;; &quot;Ver Comprovante&quot;)
                                  </span>
                                </div>
                              </div>

                              {/* Teclado Inline do Telegram (InlineKeyboardMarkup) */}
                              <div className="space-y-1.5 pt-1">
                                <p className="text-[11px] font-medium text-slate-500">
                                  Teclado Inline (callback_data = &quot;cat|Categoria|{pendingData.token}&quot;):
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                  {CATEGORIAS_GASTO.map((cat) => (
                                    <button
                                      key={cat}
                                      type="button"
                                      onClick={() =>
                                        handleSelectCategory(msg.id, pendingData.token, cat)
                                      }
                                      className="px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors text-center whitespace-nowrap shrink-0 cursor-pointer"
                                    >
                                      {cat}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCancelCallback(msg.id, pendingData.token)
                                    }
                                    className="px-3 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors text-center whitespace-nowrap shrink-0 cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            </>
                          )}

                          {/* Estado após escolha de categoria (editMessageText) */}
                          {msg.resolvedCategory && !msg.duplicateWarning && (
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>
                                    Salvo via <code className="font-mono">sheets_service.py</code> na
                                    categoria <strong className="font-bold">{msg.resolvedCategory}</strong>!
                                  </span>
                                </div>
                                <span className="font-mono text-[11px] text-emerald-700">
                                  USER_ENTERED
                                </span>
                              </div>
                              {msg.resolvedFormula && (
                                <p className="font-mono text-[11px] text-emerald-800 truncate">
                                  Fórmula gravada: {msg.resolvedFormula}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Estado quando duplicidade é bloqueada por verificar_duplicidade_na_aba */}
                          {msg.resolvedCategory && msg.duplicateWarning && (
                            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-950 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                  <strong className="font-bold">
                                    Gravação Bloqueada (Duplicidade Detectada)
                                  </strong>
                                </div>
                                <span className="font-mono text-[11px] text-amber-800">
                                  DUPLICADO
                                </span>
                              </div>
                              <p className="text-amber-900 leading-relaxed">
                                {msg.duplicateDetails}
                              </p>
                            </div>
                          )}

                          {msg.cancelled && (
                            <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600">
                              Lançamento cancelado pelo usuário. Estado removido da memória.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Painel Inferior: Inspeção de DADOS_TEMPORARIOS em Memória e Planilha em Tempo Real */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Estado Assíncrono DADOS_TEMPORARIOS */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      3. Estado em Memória (DADOS_TEMPORARIOS)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Guarda os campos extraídos e o file_url oficial até o clique no botão inline
                    </p>
                  </div>
                  <Terminal className="w-4 h-4 text-slate-400" />
                </div>

                <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs overflow-x-auto max-h-60 leading-relaxed">
                  {Object.keys(dadosTemporarios).length === 0
                    ? '# DADOS_TEMPORARIOS = {} (Todos os recibos já foram classificados)'
                    : JSON.stringify(dadosTemporarios, null, 2)}
                </pre>
              </div>

              {/* Últimos Registros Gravados no Google Sheets (Separados por Aba MM-AAAA) */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      4. Espelho Google Sheets (Abas MM-AAAA + Coluna Receipt Link)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Fórmula =HYPERLINK(&quot;url&quot;; &quot;Ver Comprovante&quot;) inserida com USER_ENTERED
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exportar CSV
                  </button>
                </div>

                {/* Abas Mensais estilo Planilha Google Sheets */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                  {availableMonthTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveMonthTab(tab)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        activeMonthTab === tab
                          ? 'bg-white text-blue-700 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                        <th className="py-2.5 px-3">Aba</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Establishment</th>
                        <th className="py-2.5 px-3 text-right">Value</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Receipt Link</th>
                        <th className="py-2.5 px-3">OCR Text</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {filteredSheetRows.slice(0, 5).map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                            {row.aba_mes}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                            {row.data}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 max-w-[130px] truncate">
                            {row.estabelecimento}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-slate-900 text-right whitespace-nowrap">
                            R$ {row.valor}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                            {row.categoria}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <a
                              href={row.file_url}
                              target="_blank"
                              rel="noreferrer"
                              title={row.formula_hyperlink}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold underline"
                            >
                              Ver Comprovante
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                          <td className="py-2.5 px-3 max-w-[160px]">
                            <button
                              type="button"
                              onClick={() => setInspectedOcrRow(row)}
                              className="font-mono text-[11px] text-slate-600 hover:text-blue-700 truncate block max-w-[150px] underline decoration-dotted cursor-pointer text-left"
                              title={row.texto_ocr}
                            >
                              {row.texto_ocr.replace(/\n/g, ' · ')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            ABA 2: CÓDIGO DE PRODUÇÃO PYTHON (FASTAPI + RENDER)
           ========================================================= */}
        {activeSection === 'codigo' && (
          <div className="mt-8 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      'sheets_service.py',
                      'main.py',
                      'requirements.txt',
                      'Procfile',
                      '.env.example',
                    ] as CodeTab[]
                  ).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveCodeTab(tab)}
                      className={`px-3.5 py-2 text-xs font-mono font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        activeCodeTab === tab
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-200/70'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyCode(activeCodeTab, currentCodeContent)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {copiedFile === activeCodeTab ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copiar {activeCodeTab}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadFile(activeCodeTab, currentCodeContent)}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar {activeCodeTab}
                  </button>
                </div>
              </div>

              <div className="p-6 bg-slate-950 text-slate-100 overflow-x-auto">
                <pre className="font-mono text-xs leading-relaxed">{currentCodeContent}</pre>
              </div>
            </div>

            {/* Comando de Registro do Webhook no Telegram */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                Como registrar o Webhook do seu serviço Render na API do Telegram
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Assim que o deploy do seu serviço Web no Render estiver ativo (ex:{' '}
                <code className="font-mono text-slate-800">https://seu-bot-ocr.onrender.com</code>
                ), execute o comando abaixo no navegador ou via terminal para apontar o Telegram
                para a rota <code className="font-mono text-slate-800">/webhook</code>:
              </p>
              <pre className="p-4 bg-slate-900 text-emerald-400 rounded-lg font-mono text-xs overflow-x-auto">
                curl -X POST &quot;https://api.telegram.org/botSEU_TELEGRAM_BOT_TOKEN/setWebhook?url=https://seu-bot-ocr.onrender.com/webhook&quot;
              </pre>
            </div>
          </div>
        )}

        {/* =========================================================
            ABA 3: PLANILHA GOOGLE SHEETS COMPLETA & AUDITORIA
           ========================================================= */}
        {activeSection === 'planilha' && (
          <div className="mt-8 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Registros Estruturados no Google Sheets (Abas MM-AAAA + Link Oficial do Telegram)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Aba selecionada: <strong className="text-slate-800">{activeMonthTab}</strong> · Total filtrado: R${' '}
                    <span className="font-mono font-bold tabular-nums text-slate-900">
                      {totalAcumulado.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>{' '}
                    · {filteredSheetRows.length} lançamentos
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={sheetSearch}
                      onChange={(e) => setSheetSearch(e.target.value)}
                      placeholder="Buscar local, responsável ou obs..."
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar Planilha (.CSV)
                  </button>
                </div>
              </div>

              {/* Seletor de Abas Mensais da Planilha (Worksheet Tabs) */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-600">
                  Abas Mensais da Planilha (formato MM-AAAA criado automaticamente por sheets_service.py):
                </span>
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                  {availableMonthTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveMonthTab(tab)}
                      className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        activeMonthTab === tab
                          ? 'bg-white text-blue-700 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtro Interativo por Categoria */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                {(['Todas', ...CATEGORIAS_GASTO] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSheetFilter(cat)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      sheetFilter === cat
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Tabela de Alta Densidade com as 10 colunas de sheets_service.py */}
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-3">Aba</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Establishment</th>
                      <th className="py-3 px-3">Doc Type</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">Payment</th>
                      <th className="py-3 px-3 text-right">Value</th>
                      <th className="py-3 px-3">Responsible</th>
                      <th className="py-3 px-3">Receipt Link</th>
                      <th className="py-3 px-3">Obs</th>
                      <th className="py-3 px-3">OCR Text</th>
                      <th className="py-3 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {filteredSheetRows.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-8 text-center text-slate-500">
                          Nenhum lançamento encontrado para esta aba/filtro. Simule um novo recibo na aba{' '}
                          <button
                            type="button"
                            onClick={() => setActiveSection('simulador')}
                            className="text-blue-600 font-semibold underline cursor-pointer"
                          >
                            Simulador Webhook &amp; OCR
                          </button>
                          .
                        </td>
                      </tr>
                    ) : (
                      filteredSheetRows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                            {row.aba_mes}
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                            {row.data}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-900">
                            {row.estabelecimento}
                          </td>
                          <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                            {row.tipo_documento}
                          </td>
                          <td className="py-3 px-3 text-slate-800 font-medium whitespace-nowrap">
                            {row.categoria}
                          </td>
                          <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                            {row.forma_pagamento}
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums font-bold text-slate-900 text-right whitespace-nowrap">
                            R$ {row.valor}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">
                            {row.responsavel}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="space-y-0.5">
                              <a
                                href={row.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold underline"
                              >
                                Ver Comprovante
                                <ExternalLink className="w-3 h-3" />
                              </a>
                              <p
                                className="font-mono text-[10px] text-slate-400 max-w-[160px] truncate"
                                title={row.formula_hyperlink}
                              >
                                {row.formula_hyperlink}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600 max-w-[160px] truncate">
                            {row.observacoes}
                          </td>
                          <td className="py-3 px-3 max-w-[200px]">
                            <button
                              type="button"
                              onClick={() => setInspectedOcrRow(row)}
                              className="font-mono text-[11px] text-slate-700 hover:text-blue-700 truncate block max-w-[190px] underline decoration-dotted cursor-pointer text-left"
                              title="Clique para inspecionar o texto completo retornado pelo OCR.space"
                            >
                              {row.texto_ocr.replace(/\n/g, ' · ')}
                            </button>
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() =>
                                setSheetRows((prev) => prev.filter((item) => item.id !== row.id))
                              }
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                              title="Remover linha"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Painel de inspeção do texto completo do OCR quando o usuário clica na célula OCR Text */}
              {inspectedOcrRow && (
                <div className="p-4 bg-slate-900 text-slate-100 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      Conteúdo da Coluna 10 (&quot;OCR Text&quot;) — {inspectedOcrRow.estabelecimento} ({inspectedOcrRow.data})
                    </span>
                    <button
                      type="button"
                      onClick={() => setInspectedOcrRow(null)}
                      className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-950 text-emerald-400 rounded-lg font-mono text-xs whitespace-pre-wrap leading-relaxed">
                    {inspectedOcrRow.texto_ocr}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            ABA 4: ARQUITETURA, BOAS PRÁTICAS OCR.SPACE E TRATAMENTO DE ERROS
           ========================================================= */}
        {activeSection === 'arquitetura' && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h3 className="text-base font-bold text-slate-900">
                1. Link Oficial do Telegram + Fórmula =HYPERLINK no Google Sheets
              </h3>
              <ul className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                <li>
                  • <strong className="text-slate-900">Zero Custo de Storage (S3/Cloud):</strong>{' '}
                  Quando o bot chama <code className="font-mono">getFile</code> na API do Telegram,
                  ele obtém o <code className="font-mono">file_path</code> e monta a URL oficial{' '}
                  <code className="font-mono text-slate-800">
                    https://api.telegram.org/file/bot&lt;TOKEN&gt;/&lt;file_path&gt;
                  </code>
                  .
                </li>
                <li>
                  • <strong className="text-slate-900">Fórmula Clicável Limpa:</strong> Em{' '}
                  <code className="font-mono">sheets_service.py</code>, formatamos a célula como{' '}
                  <code className="font-mono text-slate-800">
                    =HYPERLINK(&quot;url&quot;; &quot;Ver Comprovante&quot;)
                  </code>{' '}
                  para que a planilha exiba apenas o botão limpo <strong>Ver Comprovante</strong>.
                </li>
                <li>
                  • <strong className="text-slate-900">Parâmetro USER_ENTERED Obrigatório:</strong>{' '}
                  Na chamada{' '}
                  <code className="font-mono">
                    worksheet.append_row(row_data, value_input_option=&apos;USER_ENTERED&apos;)
                  </code>
                  , o Google Sheets interpreta a fórmula <code className="font-mono">=HYPERLINK</code>{' '}
                  como link ativo em vez de texto puro.
                </li>
              </ul>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h3 className="text-base font-bold text-slate-900">
                2. Especificações Rigorosas do OCR.space
              </h3>
              <ul className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                <li>
                  • <strong className="text-slate-900">Header de Autenticação:</strong> A chave{' '}
                  <code className="font-mono text-slate-800">OCR_SPACE_API_KEY</code> é enviada
                  estritamente no cabeçalho HTTP <code className="font-mono">apikey</code>.
                </li>
                <li>
                  • <strong className="text-slate-900">Prefixo Base64 Obrigatório:</strong> Ao
                  converter os bytes baixados do Telegram, o payload inclui obrigatoriamente{' '}
                  <code className="font-mono text-slate-800">data:image/jpeg;base64,...</code> ou{' '}
                  <code className="font-mono text-slate-800">data:application/pdf;base64,...</code>.
                </li>
                <li>
                  • <strong className="text-slate-900">Limites do Plano Gratuito:</strong> Tamanho
                  máximo de <strong>1 MB (1.024 KB)</strong> por arquivo, até 3 páginas por PDF e
                  parâmetros <code className="font-mono">OCREngine=&quot;2&quot;</code> e{' '}
                  <code className="font-mono">isTable=&quot;true&quot;</code>.
                </li>
              </ul>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h3 className="text-base font-bold text-slate-900">
                3. Gerenciamento de Estado Assíncrono no Telegram
              </h3>
              <ul className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                <li>
                  • <strong className="text-slate-900">Restrição de 64 Bytes do Telegram:</strong>{' '}
                  O campo <code className="font-mono">callback_data</code> dos botões inline aceita
                  no máximo 64 bytes. Por isso, usamos <code className="font-mono">estado_id</code>{' '}
                  curto (<code className="font-mono">file_unique_id</code>) e guardamos a{' '}
                  <code className="font-mono">file_url</code> completa em{' '}
                  <code className="font-mono">DADOS_TEMPORARIOS[estado_id]</code>.
                </li>
                <li>
                  • <strong className="text-slate-900">Prevenção de Duplicidade:</strong> Antes de
                  inserir a linha na aba <code className="font-mono">MM-AAAA</code>,{' '}
                  <code className="font-mono">sheets_service.py</code> consulta{' '}
                  <code className="font-mono">worksheet.get_all_records()</code> e verifica se já
                  existe um lançamento com a mesma Data, Valor e Estabelecimento.
                </li>
              </ul>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h3 className="text-base font-bold text-slate-900">
                4. Integração Google Sheets via Service Account (gspread)
              </h3>
              <ul className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                <li>
                  • <strong className="text-slate-900">Credenciais Seguras no Render:</strong>{' '}
                  Cole o JSON da Service Account na variável de ambiente{' '}
                  <code className="font-mono">GOOGLE_CREDENTIALS_JSON</code>. O módulo{' '}
                  <code className="font-mono">sheets_service.py</code> sanitiza aspas extras e
                  quebras <code className="font-mono">\n</code> automaticamente.
                </li>
                <li>
                  • <strong className="text-slate-900">Criação Automática de Abas MM-AAAA:</strong>{' '}
                  Se a aba do mês (ex: <code className="font-mono">11-2026</code>) ainda não existir
                  na planilha, <code className="font-mono">spreadsheet.add_worksheet()</code> cria a
                  aba e já adiciona os 9 cabeçalhos padrão.
                </li>
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* Rodapé Limpo */}
      <footer className="border-t border-slate-200 bg-white mt-12 py-6 px-6">
        <div className="max-w-[1380px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            Arquitetura Python FastAPI · Integração Oficial OCR.space, Telegram Bot API &amp; Google Sheets
          </span>
          <span>
            Arquivos prontos na raiz: /main.py · /sheets_service.py · /requirements.txt · /Procfile
          </span>
        </div>
      </footer>
    </div>
  );
}

