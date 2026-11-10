export interface ParsedReceiptData {
  data: string;
  aba_mes: string;
  estabelecimento: string;
  valor: string;
  forma_pagamento: string;
  observacoes: string;
  texto_bruto: string;
}

const MESES_PT_NOMES: Record<number, string> = {
  1: 'Janeiro',
  2: 'Fevereiro',
  3: 'Março',
  4: 'Abril',
  5: 'Maio',
  6: 'Junho',
  7: 'Julho',
  8: 'Agosto',
  9: 'Setembro',
  10: 'Outubro',
  11: 'Novembro',
  12: 'Dezembro',
};

export function obterAbaMesTS(dataStr: string): string {
  const hoje = new Date();
  let mes = hoje.getMonth() + 1;
  let ano = hoje.getFullYear();

  const match = dataStr.match(/\b(\d{2})\/(\d{2})\/(\d{2,4})\b/);
  if (match) {
    const m = parseInt(match[2], 10);
    let y = parseInt(match[3], 10);
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12) {
      mes = m;
      ano = y;
    }
  }
  return `${MESES_PT_NOMES[mes] || 'Mês'}/${ano}`;
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
  let formaPagamento = 'Não informada';
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

  return {
    data: dataExtraida,
    aba_mes: obterAbaMesTS(dataExtraida),
    estabelecimento,
    valor: valorExtraido,
    forma_pagamento: formaPagamento,
    observacoes: legendaUsuario.trim() || 'Sem observações',
    texto_bruto: textoOcr,
  };
}
