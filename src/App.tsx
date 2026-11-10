import React, { useState, useMemo } from 'react';
import {
  FileCode2,
  Play,
  Table2,
  BookOpen,
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
  FileText,
  Sliders,
} from 'lucide-react';
import {
  RECEIPT_SAMPLES,
  CATEGORIAS_GASTO,
  INITIAL_SHEET_ROWS,
  PYTHON_MAIN_CODE,
  REQUIREMENTS_CODE,
  PROCFILE_CODE,
  ENV_EXAMPLE_CODE,
  CategoriaGasto,
  SheetRow,
} from './data/pythonBotFiles';
import { extrairDadosReciboTS, ParsedReceiptData } from './utils/receiptParser';

type ActiveSection = 'simulador' | 'codigo' | 'planilha' | 'arquitetura';
type CodeTab = 'main.py' | 'requirements.txt' | 'Procfile' | '.env.example';

interface PendingTelegramState extends ParsedReceiptData {
  token: string;
  criadoEm: string;
  mimeType: string;
  sizeKb: number;
  ocrEngine: '2' | '3';
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  timestamp: string;
  title?: string;
  caption?: string;
  fileType?: string;
  sizeKb?: number;
  text: string;
  pendingToken?: string;
  resolvedCategory?: CategoriaGasto;
  cancelled?: boolean;
  isError?: boolean;
}

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('simulador');
  const [activeCodeTab, setActiveCodeTab] = useState<CodeTab>('main.py');
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  // Simulador OCR.space + Telegram State
  const [selectedSampleId, setSelectedSampleId] = useState<string>(RECEIPT_SAMPLES[0].id);
  const [customCaption, setCustomCaption] = useState<string>(RECEIPT_SAMPLES[0].caption);
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
      estabelecimento: 'AUTO POSTO AVENIDA LTDA',
      valor: '461,90',
      forma_pagamento: 'Cartão de Débito',
      observacoes: 'Abastecimento frota caminhão placa ABC-1234',
      texto_bruto: RECEIPT_SAMPLES[0].rawText,
    },
  });

  // Histórico de mensagens do grupo no Telegram
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init-1',
      sender: 'user',
      timestamp: '11:35:10',
      title: 'Cupom Fiscal — Posto Avenida (Combustível)',
      caption: 'Abastecimento frota caminhão placa ABC-1234',
      fileType: 'image/jpeg',
      sizeKb: 384,
      text: 'Enviou um comprovante no grupo Financeiro Obras',
    },
    {
      id: 'msg-init-2',
      sender: 'bot',
      timestamp: '11:35:12',
      text: 'Recibo processado via OCR.space (Engine 2 · isTable=True). Escolha a categoria abaixo para gravar na planilha:',
      pendingToken: 'a94f21c8',
    },
  ]);

  // Linhas salvas no Google Sheets
  const [sheetRows, setSheetRows] = useState<SheetRow[]>(INITIAL_SHEET_ROWS);
  const [sheetFilter, setSheetFilter] = useState<string>('Todas');
  const [sheetSearch, setSheetSearch] = useState<string>('');

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

    const newUserMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      timestamp: timeStr,
      title: sample.title,
      caption: customCaption,
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

      const newState: PendingTelegramState = {
        ...parsed,
        token,
        criadoEm: new Date().toTimeString().slice(0, 8),
        mimeType: sample.type,
        sizeKb: sample.sizeKb,
        ocrEngine: selectedEngine,
      };

      setDadosTemporarios((prev) => ({
        ...prev,
        [token]: newState,
      }));

      const botMsg: ChatMessage = {
        id: `msg-b-${Date.now()}`,
        sender: 'bot',
        timestamp: new Date().toTimeString().slice(0, 8),
        text: `Recibo processado via OCR.space (OCREngine=${selectedEngine}, language="por", isTable=True). Selecione a categoria do gasto:`,
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
        // Simula retorno OCR estruturado para o arquivo enviado caso o usuário não tenha inserido chave real
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

      setDadosTemporarios((prev) => ({
        ...prev,
        [token]: {
          ...parsed,
          token,
          criadoEm: new Date().toTimeString().slice(0, 8),
          mimeType,
          sizeKb,
          ocrEngine: selectedEngine,
        },
      }));

      const botMsg: ChatMessage = {
        id: `msg-b-${Date.now()}`,
        sender: 'bot',
        timestamp: new Date().toTimeString().slice(0, 8),
        text: `Arquivo "${file.name}" processado com prefixo Base64 (${mimeType}). Selecione a categoria abaixo:`,
        pendingToken: token,
      };

      setChatMessages((prev) => [...prev, userMsg, botMsg]);
    };
    reader.readAsDataURL(file);
  };

  // Clique em um botão do Inline Keyboard do Telegram (callback_query: cat|<token>|<categoria>)
  const handleSelectCategory = (messageId: string, token: string, categoria: CategoriaGasto) => {
    const pending = dadosTemporarios[token];
    if (!pending) return;

    const newRow: SheetRow = {
      id: `row-${Date.now()}`,
      data: pending.data,
      estabelecimento: pending.estabelecimento,
      valor: pending.valor,
      categoria,
      forma_pagamento: pending.forma_pagamento,
      observacoes: pending.observacoes,
      token_origem: token,
    };

    setSheetRows((prev) => [newRow, ...prev]);

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
      'Data',
      'Estabelecimento',
      'Valor (R$)',
      'Categoria',
      'Forma de Pagamento',
      'Observacoes',
    ];
    const rows = sheetRows.map((r) => [
      r.data,
      `"${r.estabelecimento.replace(/"/g, '""')}"`,
      `"${r.valor}"`,
      r.categoria,
      r.forma_pagamento,
      `"${r.observacoes.replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    handleDownloadFile('planilha_gastos_telegram_ocr.csv', csvContent, 'text/csv');
  };

  const filteredSheetRows = useMemo(() => {
    return sheetRows.filter((row) => {
      const matchesCat = sheetFilter === 'Todas' || row.categoria === sheetFilter;
      const matchesQuery =
        !sheetSearch.trim() ||
        row.estabelecimento.toLowerCase().includes(sheetSearch.toLowerCase()) ||
        row.observacoes.toLowerCase().includes(sheetSearch.toLowerCase()) ||
        row.forma_pagamento.toLowerCase().includes(sheetSearch.toLowerCase());
      return matchesCat && matchesQuery;
    });
  }, [sheetRows, sheetFilter, sheetSearch]);

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
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'simulador'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Simulador Webhook & OCR
          </button>
          <button
            onClick={() => setActiveSection('codigo')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'codigo'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Código Python (Render)
          </button>
          <button
            onClick={() => setActiveSection('planilha')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'planilha'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Planilha Google Sheets ({sheetRows.length})
          </button>
          <button
            onClick={() => setActiveSection('arquitetura')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'arquitetura'
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Boas Práticas & Erros
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => handleDownloadFile('main.py', PYTHON_MAIN_CODE, 'text/x-python')}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar main.py
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
              FastAPI + Uvicorn · API OCR.space (OCREngine 2/3) · Telegram Inline Keyboard · Google Sheets (gspread)
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
                      1. Entrada de Recibo & Parâmetros OCR.space
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

                {/* Legenda enviada junto com a foto no grupo do Telegram */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Legenda da Mensagem no Telegram (message.caption → Observações)
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
                      Webhook assíncrono (/webhook) · Clique em uma categoria para persistir no Google Sheets
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
                              <span>Você · Grupo Financeiro</span>
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
                                  <span className="text-slate-500">Data:</span>{' '}
                                  <span className="font-semibold text-slate-900 tabular-nums">
                                    {pendingData.data}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Estabelecimento:</span>{' '}
                                  <span className="font-semibold text-slate-900">
                                    {pendingData.estabelecimento}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Valor Total:</span>{' '}
                                  <span className="font-semibold text-emerald-700 tabular-nums">
                                    R$ {pendingData.valor}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Pagamento:</span>{' '}
                                  <span className="font-semibold text-slate-900">
                                    {pendingData.forma_pagamento}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Observações:</span>{' '}
                                  <span className="text-slate-800">{pendingData.observacoes}</span>
                                </div>
                              </div>

                              {/* Teclado Inline do Telegram (InlineKeyboardMarkup) */}
                              <div className="space-y-1.5 pt-1">
                                <p className="text-[11px] font-medium text-slate-500">
                                  Teclado Inline (callback_data = &quot;cat|{pendingData.token}|...&quot;):
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
                          {msg.resolvedCategory && (
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>
                                  Salvo no Google Sheets na categoria{' '}
                                  <strong className="font-bold">{msg.resolvedCategory}</strong>!
                                </span>
                              </div>
                              <span className="font-mono text-[11px] text-emerald-700">
                                Token consumido
                              </span>
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
                      Guarda os campos extraídos até que o usuário clique no botão inline
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

              {/* Últimos Registros Gravados no Google Sheets */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      4. Espelho Google Sheets (sheet.append_row via gspread)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Colunas: Data · Estabelecimento · Valor · Categoria · Forma de Pagamento · Observações
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

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Estabelecimento</th>
                        <th className="py-2.5 px-3 text-right">Valor (R$)</th>
                        <th className="py-2.5 px-3">Categoria</th>
                        <th className="py-2.5 px-3">Pagamento</th>
                        <th className="py-2.5 px-3">Observações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {sheetRows.slice(0, 5).map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                            {row.data}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 max-w-[180px] truncate">
                            {row.estabelecimento}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-slate-900 text-right whitespace-nowrap">
                            {row.valor}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                            {row.categoria}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                            {row.forma_pagamento}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 max-w-[200px] truncate">
                            {row.observacoes}
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
                <div className="flex items-center gap-2">
                  {(['main.py', 'requirements.txt', 'Procfile', '.env.example'] as CodeTab[]).map(
                    (tab) => (
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
                    )
                  )}
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
                    Registros Estruturados no Google Sheets
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Total filtrado: R${' '}
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
                      placeholder="Buscar estabelecimento ou obs..."
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

              {/* Tabela de Alta Densidade */}
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Data</th>
                      <th className="py-3 px-4">Estabelecimento</th>
                      <th className="py-3 px-4 text-right">Valor (R$)</th>
                      <th className="py-3 px-4">Categoria</th>
                      <th className="py-3 px-4">Forma de Pagamento</th>
                      <th className="py-3 px-4">Observações (Legenda)</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {filteredSheetRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          Nenhum lançamento encontrado para este filtro. Simule um novo recibo na aba{' '}
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
                          <td className="py-3 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                            {row.data}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {row.estabelecimento}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums font-bold text-slate-900 text-right whitespace-nowrap">
                            R$ {row.valor}
                          </td>
                          <td className="py-3 px-4 text-slate-800 font-medium whitespace-nowrap">
                            {row.categoria}
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            {row.forma_pagamento}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{row.observacoes}</td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
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
                1. Especificações Rigorosas do OCR.space
              </h3>
              <ul className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                <li>
                  • <strong className="text-slate-900">Header de Autenticação:</strong> A chave{' '}
                  <code className="font-mono text-slate-800">OCR_SPACE_API_KEY</code> é enviada
                  estritamente no cabeçalho HTTP <code className="font-mono">apikey</code>, evitando
                  exposição na query string da URL.
                </li>
                <li>
                  • <strong className="text-slate-900">Prefixo Base64 Obrigatório:</strong> Ao
                  converter os bytes baixados do Telegram, o payload inclui obrigatoriamente{' '}
                  <code className="font-mono text-slate-800">data:image/jpeg;base64,...</code> ou{' '}
                  <code className="font-mono text-slate-800">data:application/pdf;base64,...</code>.
                  Sem esse prefixo, a API retorna erro de formato inválido.
                </li>
                <li>
                  • <strong className="text-slate-900">Parâmetros de Precisão para Recibos:</strong>{' '}
                  Utilizamos <code className="font-mono">language=&quot;por&quot;</code>,{' '}
                  <code className="font-mono">isTable=&quot;true&quot;</code> (preserva a quebra
                  linha a linha dos itens e do valor total) e{' '}
                  <code className="font-mono">OCREngine=&quot;2&quot;</code> (ideal para cupons
                  fiscais com fontes térmicas e caracteres especiais como R$) ou{' '}
                  <code className="font-mono">OCREngine=&quot;3&quot;</code>.
                </li>
                <li>
                  • <strong className="text-slate-900">Limites do Plano Gratuito:</strong> Tamanho
                  máximo de <strong>1 MB (1.024 KB)</strong> por arquivo, até 3 páginas por PDF e
                  cota de 25.000 requisições/mês. O bot valida{' '}
                  <code className="font-mono">len(conteudo_bytes) &gt; 1024 * 1024</code> antes de
                  chamar a API.
                </li>
              </ul>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h3 className="text-base font-bold text-slate-900">
                2. Gerenciamento de Estado Assíncrono no Telegram
              </h3>
              <ul className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                <li>
                  • <strong className="text-slate-900">Restrição de 64 Bytes do Telegram:</strong>{' '}
                  O campo <code className="font-mono">callback_data</code> dos botões inline do
                  Telegram aceita no máximo 64 bytes. Por isso, não é possível embutir todos os
                  dados do recibo dentro do próprio botão.
                </li>
                <li>
                  • <strong className="text-slate-900">Dicionário DADOS_TEMPORARIOS:</strong> Quando
                  o OCR termina em background, geramos um identificador curto de 8 caracteres (
                  <code className="font-mono">token_estado = uuid.uuid4().hex[:8]</code>), salvamos
                  o dicionário completo em <code className="font-mono">DADOS_TEMPORARIOS</code> e
                  enviamos nos botões apenas <code className="font-mono">cat|token|Categoria</code>.
                </li>
                <li>
                  • <strong className="text-slate-900">Worker Único no Render:</strong> No{' '}
                  <code className="font-mono">Procfile</code>, especificamos{' '}
                  <code className="font-mono">--workers 1</code> no Uvicorn para garantir que o
                  webhook da foto e o webhook do clique no botão acessem o mesmo espaço de memória
                  RAM.
                </li>
              </ul>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h3 className="text-base font-bold text-slate-900">
                3. BackgroundTasks e Resiliência de Rede (Try/Except)
              </h3>
              <ul className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                <li>
                  • <strong className="text-slate-900">Evitando Retries Duplicados:</strong> Se o
                  webhook demorar mais de alguns segundos para responder HTTP 200, o Telegram
                  reenvia a mesma foto várias vezes. Por isso, a rota{' '}
                  <code className="font-mono">/webhook</code> delega o download e o OCR para{' '}
                  <code className="font-mono">BackgroundTasks</code> do FastAPI e retorna{' '}
                  <code className="font-mono">{`{"ok": True}`}</code> imediatamente.
                </li>
                <li>
                  • <strong className="text-slate-900">Isolamento de Exceções:</strong> As funções{' '}
                  <code className="font-mono">baixar_arquivo_telegram</code>,{' '}
                  <code className="font-mono">processar_ocr_space_base64</code> e{' '}
                  <code className="font-mono">salvar_linha_planilha</code> possuem blocos{' '}
                  <code className="font-mono">try/except</code> específicos para{' '}
                  <code className="font-mono">httpx.TimeoutException</code> e falhas de API,
                  notificando o usuário no grupo sem derrubar o servidor.
                </li>
              </ul>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h3 className="text-base font-bold text-slate-900">
                4. Integração Google Sheets via Service Account (gspread)
              </h3>
              <ul className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                <li>
                  • <strong className="text-slate-900">Credenciais sem Arquivo Físico no Git:</strong>{' '}
                  No Render, basta colar o conteúdo do JSON da Service Account na variável de
                  ambiente <code className="font-mono">GOOGLE_CREDENTIALS_JSON</code>. O código
                  detecta automaticamente se o valor começa com <code className="font-mono">{`{`}</code> e
                  usa <code className="font-mono">Credentials.from_service_account_info()</code>.
                </li>
                <li>
                  • <strong className="text-slate-900">Permissão de Editor:</strong> Lembre-se de
                  copiar o <code className="font-mono">client_email</code> do JSON da Service
                  Account e compartilhar sua planilha no Google Sheets com esse e-mail como{' '}
                  <strong>Editor</strong>.
                </li>
                <li>
                  • <strong className="text-slate-900">Rollback Automático de Estado:</strong> Se a
                  gravação no Google Sheets falhar momentaneamente quando o usuário clicar na
                  categoria, o código restaura o recibo em{' '}
                  <code className="font-mono">DADOS_TEMPORARIOS[token]</code> para que o clique
                  possa ser repetido sem reenviar a foto.
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
            Arquivos gerados no projeto: /python_bot/main.py · /python_bot/requirements.txt · /python_bot/Procfile
          </span>
        </div>
      </footer>
    </div>
  );
}
