export interface ParsedReceiptData {
  data: string;
  aba_mes: string;
  estabelecimento: string;
  tipo_documento: string;
  valor: string;
  forma_pagamento: string;
  observacoes: string;
  texto_bruto: string;
}

/**
 * Converte a data DD/MM/AAAA para o formato de aba MM-AAAA (ex: '11-2026')
 * conforme implementado no `sheets_service.py`.
 */
export function obterAbaMesTS(dataStr: string): string {
  const match = dataStr.match(/\b(\d{2})\/(\d{2})\/(\d{2,4})\b/);
  if (match) {
    const mes = match[2];
    const ano = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${mes}-${ano}`;
  }
  const partes = dataStr.split('/');
  if (partes.length === 3) {
    const ano = partes[2].length === 4 ? partes[2] : `20${partes[2]}`;
    return `${partes[1]}-${ano}`;
  }
  return 'Geral';
}

/**
 * Replica em TypeScript a exata lógica da função Python `extrair_dados_recibo`
 * para que o simulador processe tanto os exemplos quanto arquivos reais enviados.
 */
export function extrairDadosReciboTS(
  textoOcr: string,
  legendaUsuario: string = ''
): ParsedReceiptData {
  const linhas = textoOcr
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const termosIgnorar = [
    'CUPOM FISCAL',
    'NOTA FISCAL',
    'DANFE',
    'EXTRATO',
    'COMPROVANTE',
    'CNPJ',
    'DOCUMENTO AUXILIAR',
  ];

  let estabelecimento = 'Não identificado';
  for (const linha of linhas.slice(0, 6)) {
    const upper = linha.toUpperCase();
    if (
      linha.length > 3 &&
      !termosIgnorar.some((termo) => upper.includes(termo))
    ) {
      estabelecimento = linha.slice(0, 60);
      break;
    }
  }

  // Data DD/MM/AAAA ou DD/MM/AA
  const padraoData = /\b(\d{2}\/\d{2}\/(?:20\d{2}|\d{2}))\b/;
  const matchData = textoOcr.match(padraoData);
  const hoje = new Date();
  const dataDefault = `${String(hoje.getDate()).padStart(2, '0')}/${String(
    hoje.getMonth() + 1
  ).padStart(2, '0')}/${hoje.getFullYear()}`;
  const dataExtraida = matchData ? matchData[1] : dataDefault;

  // Valor Total
  let valorExtraido = '0,00';
  const padraoTotalEspecifico =
    /(?:TOTAL\s*(?:A\s*PAGAR|R\$|GERAL|LIQUIDO)?|VALOR\s*(?:TOTAL|PAGO)?)\s*[:R$\s]*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/gi;
  const matchesEspecificos = [...textoOcr.matchAll(padraoTotalEspecifico)];

  if (matchesEspecificos.length > 0) {
    valorExtraido = matchesEspecificos[matchesEspecificos.length - 1][1];
  } else {
    const todosValores = [
      ...textoOcr.matchAll(/\b(\d{1,3}(?:\.\d{3})*,\d{2})\b/g),
    ].map((m) => m[1]);
    if (todosValores.length > 0) {
      valorExtraido = todosValores[todosValores.length - 1];
    }
  }

  // Forma de Pagamento
  const upperText = textoOcr.toUpperCase();
  let formaPagamento = 'Outros';
  if (upperText.includes('PIX')) {
    formaPagamento = 'PIX';
  } else if (upperText.includes('CREDITO') || upperText.includes('CRÉDITO')) {
    formaPagamento = 'Cartão de Crédito';
  } else if (upperText.includes('DEBITO') || upperText.includes('DÉBITO')) {
    formaPagamento = 'Cartão de Débito';
  } else if (upperText.includes('DINHEIRO') || upperText.includes('ESPÉCIE')) {
    formaPagamento = 'Dinheiro';
  } else if (upperText.includes('BOLETO')) {
    formaPagamento = 'Boleto';
  }

  // Tipo de Documento (Doc Type)
  let tipoDocumento = 'Recibo';
  if (
    upperText.includes('NOTA FISCAL') ||
    upperText.includes('DANFE') ||
    upperText.includes('NF-E')
  ) {
    tipoDocumento = 'Nota Fiscal';
  } else if (
    upperText.includes('CUPOM') ||
    upperText.includes('SAT') ||
    upperText.includes('NFC-E')
  ) {
    tipoDocumento = 'Cupom Fiscal';
  }

  return {
    data: dataExtraida,
    aba_mes: obterAbaMesTS(dataExtraida),
    estabelecimento,
    tipo_documento: tipoDocumento,
    valor: valorExtraido,
    forma_pagamento: formaPagamento,
    observacoes: legendaUsuario.trim() || '',
    texto_bruto: textoOcr,
  };
}
