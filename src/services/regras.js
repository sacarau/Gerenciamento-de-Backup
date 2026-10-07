const ACOES = Object.freeze({
  NENHUMA: "NENHUMA",
  VACUUM: "VACUUM",
  COMPLETA: "VACUUM FULL ANALYZE",
});

function decisaoManual(modo) {
  const decisoes = {
    manual_nenhuma: {
      acao: ACOES.NENHUMA,
      regra: "Escolha manual: não executar manutenção antes do backup.",
    },
    manual_vacuum: {
      acao: ACOES.VACUUM,
      regra: "Escolha manual: executar VACUUM antes do backup.",
    },
    manual_completa: {
      acao: ACOES.COMPLETA,
      regra: "Escolha manual: executar VACUUM FULL ANALYZE antes do backup.",
    },
  };

  return decisoes[modo] || null;
}

function decidirManutencao(modo, diasDesdeUltimaManutencao) {
  const manual = decisaoManual(modo);

  if (manual) {
    return {
      ...manual,
      origem: "MANUAL",
      diasDesdeUltimaManutencao,
    };
  }

  if (modo !== "automatico") {
    throw new Error("Modo de manutenção não reconhecido.");
  }

  if (diasDesdeUltimaManutencao === null) {
    return {
      acao: ACOES.COMPLETA,
      origem: "AUTOMATICA",
      diasDesdeUltimaManutencao: null,
      regra: "Não existe histórico de manutenção: executar VACUUM FULL ANALYZE.",
    };
  }

  if (diasDesdeUltimaManutencao < 30) {
    return {
      acao: ACOES.NENHUMA,
      origem: "AUTOMATICA",
      diasDesdeUltimaManutencao,
      regra: "Última manutenção há menos de 30 dias: nenhuma manutenção necessária.",
    };
  }

  if (diasDesdeUltimaManutencao <= 60) {
    return {
      acao: ACOES.VACUUM,
      origem: "AUTOMATICA",
      diasDesdeUltimaManutencao,
      regra: "Última manutenção entre 30 e 60 dias: executar VACUUM.",
    };
  }

  return {
    acao: ACOES.COMPLETA,
    origem: "AUTOMATICA",
    diasDesdeUltimaManutencao,
    regra: "Última manutenção há mais de 60 dias: executar VACUUM FULL ANALYZE.",
  };
}

function modoParaHistorico(modo) {
  const nomes = {
    automatico: "AUTOMATICO",
    manual_nenhuma: "MANUAL_NENHUMA",
    manual_vacuum: "MANUAL_VACUUM",
    manual_completa: "MANUAL_COMPLETA",
  };

  return nomes[modo];
}

module.exports = {
  ACOES,
  decidirManutencao,
  modoParaHistorico,
};
