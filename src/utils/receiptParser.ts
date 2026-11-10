export interface ParsedReceiptData {
  data: string;
  estabelecimento: string;
  valor: string;
  forma_pagamento: string;
  observacoes: string;
  texto_bruto: string;
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
    estabelecimento,
    valor: valorExtraido,
    forma_pagamento: formaPagamento,
    observacoes: legendaUsuario.trim() || 'Sem observações',
    texto_bruto: textoOcr,
  };
}
