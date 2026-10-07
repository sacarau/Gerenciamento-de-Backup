const views = document.querySelectorAll(".view");
const navigationButtons = document.querySelectorAll(".nav-button");
const form = document.querySelector("#process-form");
const testButton = document.querySelector("#test-connection");
const startButton = document.querySelector("#start-process");
const togglePasswordButton = document.querySelector("#toggle-password");
const passwordInput = document.querySelector("#senha");
const connectionBadge = document.querySelector("#connection-badge");
const inlineStatus = document.querySelector("#inline-status");
const connectionMessage = document.querySelector("#connection-message");
const historyMessage = document.querySelector("#history-message");
const refreshHistoryButton = document.querySelector("#refresh-history");
const processBadge = document.querySelector("#process-badge");
const progressMessage = document.querySelector("#progress-message");
const progressValue = document.querySelector("#progress-value");
const progressBar = document.querySelector("#progress-bar");
const processProgressNative = document.querySelector("#process-progress-native");
const processLog = document.querySelector("#process-log");
const databaseTablesBody = document.querySelector("#database-tables-body");
const historyBody = document.querySelector("#history-body");
const encryptCheckbox = document.querySelector("#criptografar");
const encryptionKeyInput = document.querySelector("#chave-criptografia");
const compressCheckbox = document.querySelector("#compactar");
const zipPasswordInput = document.querySelector("#senha-zip");
const restoreForm = document.querySelector("#restore-form");
const startRestoreButton = document.querySelector("#start-restore");
const restoreMessage = document.querySelector("#restore-message");
const restoreBadge = document.querySelector("#restore-badge");
const restoreProgressMessage = document.querySelector("#restore-progress-message");
const restoreProgressValue = document.querySelector("#restore-progress-value");
const restoreProgressBar = document.querySelector("#restore-progress-bar");
const restoreProgressNative = document.querySelector("#restore-progress-native");
const restoreLog = document.querySelector("#restore-log");
const restoreTablesBody = document.querySelector("#restore-tables-body");
const historyLogPanel = document.querySelector("#history-log-panel");
const historyLogDetails = document.querySelector("#history-log-details");
const historyLogContent = document.querySelector("#history-log-content");
const closeHistoryLogButton = document.querySelector("#close-history-log");

const metrics = {
  banco: document.querySelector("#metric-banco"),
  versao: document.querySelector("#metric-versao"),
  tabelas: document.querySelector("#metric-tabelas"),
  registros: document.querySelector("#metric-registros"),
};

const resultElements = {
  mode: document.querySelector("#result-mode"),
  days: document.querySelector("#result-days"),
  action: document.querySelector("#result-action"),
  file: document.querySelector("#result-file"),
  encryption: document.querySelector("#result-encryption"),
  compression: document.querySelector("#result-compression"),
  copy: document.querySelector("#result-copy"),
  log: document.querySelector("#result-log"),
  email: document.querySelector("#result-email"),
};

const restoreResultElements = {
  database: document.querySelector("#restore-result-database"),
  created: document.querySelector("#restore-result-created"),
  tables: document.querySelector("#restore-result-tables"),
  records: document.querySelector("#restore-result-records"),
};

const connectionFieldIds = new Set(["host", "porta", "banco", "usuario", "senha"]);
let connectionValidated = false;
let currentProcessId = null;
let pollTimer = null;
let currentRestoreId = null;
let restorePollTimer = null;

function showView(viewId) {
  views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  navigationButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewId);
  });
  window.location.hash = viewId;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setMessage(element, type, title, details) {
  const safeDetails = details || [];
  element.className = "message " + type;
  element.replaceChildren();

  const strong = document.createElement("strong");
  strong.textContent = title;
  element.append(strong);

  if (safeDetails.length > 0) {
    const list = document.createElement("ul");
    safeDetails.forEach((detail) => {
      const item = document.createElement("li");
      item.textContent = detail;
      list.append(item);
    });
    element.append(list);
  }
}

function hideMessage(element) {
  element.className = "message hidden";
  element.replaceChildren();
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  let result;

  try {
    result = await response.json();
  } catch (_error) {
    result = { mensagem: "O servidor devolveu uma resposta inválida." };
  }

  if (!response.ok) {
    const error = new Error(result.mensagem || "Não foi possível concluir a solicitação.");
    error.details = result.erros || [];
    error.status = response.status;
    throw error;
  }

  return result;
}

function connectionPayload() {
  return {
    host: document.querySelector("#host").value,
    porta: document.querySelector("#porta").value,
    banco: document.querySelector("#banco").value,
    usuario: document.querySelector("#usuario").value,
    senha: passwordInput.value,
  };
}

function processParameters() {
  const selectedMode = document.querySelector('input[name="modoManutencao"]:checked');
  return {
    destino: document.querySelector("#destino").value,
    quantidadeManter: document.querySelector("#quantidade").value,
    destinoAdicional: document.querySelector("#destino-adicional").value,
    caminhoPgDump: document.querySelector("#pg-dump").value,
    modoManutencao: selectedMode ? selectedMode.value : "",
    criptografar: encryptCheckbox.checked,
    chaveCriptografia: encryptionKeyInput.value,
    compactar: compressCheckbox.checked,
    senhaZip: zipPasswordInput.value,
    emailFalha: document.querySelector("#email-falha").value,
    simularFalha: document.querySelector("#simular-falha").checked,
  };
}

function restoreParameters() {
  return {
    arquivoBackup: document.querySelector("#restore-file").value,
    bancoDestino: document.querySelector("#restore-database").value,
    caminhoPgRestore: document.querySelector("#pg-restore").value,
    chaveCriptografia: document.querySelector("#restore-aes-key").value,
    senhaZip: document.querySelector("#restore-zip-password").value,
  };
}

function updateProtectionFields() {
  encryptionKeyInput.disabled = !encryptCheckbox.checked;
  encryptionKeyInput.required = encryptCheckbox.checked;
  zipPasswordInput.disabled = !compressCheckbox.checked;
  zipPasswordInput.required = compressCheckbox.checked;
  if (!encryptCheckbox.checked) {
    encryptionKeyInput.value = "";
  }
  if (!compressCheckbox.checked) {
    zipPasswordInput.value = "";
  }
}

function resetDatabaseSummary() {
  Object.values(metrics).forEach((element) => {
    element.textContent = "—";
  });
  databaseTablesBody.replaceChildren();
  const row = document.createElement("tr");
  row.className = "empty-row";
  const cell = document.createElement("td");
  cell.colSpan = 2;
  cell.textContent = "Teste a conexão para listar as tabelas.";
  row.append(cell);
  databaseTablesBody.append(row);
}

function renderDatabaseSummary(data) {
  metrics.banco.textContent = data.banco;
  metrics.versao.textContent = data.versao_postgresql;
  metrics.tabelas.textContent = Number(data.totalTabelas).toLocaleString("pt-BR");
  metrics.registros.textContent = Number(data.totalRegistros).toLocaleString("pt-BR");
  databaseTablesBody.replaceChildren();

  if (data.tabelas.length === 0) {
    const row = document.createElement("tr");
    row.className = "empty-row";
    const cell = document.createElement("td");
    cell.colSpan = 2;
    cell.textContent = "O banco não possui tabelas no schema public.";
    row.append(cell);
    databaseTablesBody.append(row);
    return;
  }

  data.tabelas.forEach((table) => {
    const row = document.createElement("tr");
    const name = document.createElement("td");
    const count = document.createElement("td");
    name.textContent = table.nome;
    count.textContent = Number(table.registros).toLocaleString("pt-BR");
    row.append(name, count);
    databaseTablesBody.append(row);
  });
}

function invalidateConnection() {
  connectionValidated = false;
  startButton.disabled = true;
  startRestoreButton.disabled = true;
  connectionBadge.className = "status-badge neutral";
  connectionBadge.textContent = "Conexão precisa ser testada";
  inlineStatus.textContent = "Dados alterados";
}

async function testConnection() {
  hideMessage(connectionMessage);
  connectionValidated = false;
  startButton.disabled = true;
  startRestoreButton.disabled = true;
  resetDatabaseSummary();
  testButton.disabled = true;
  testButton.textContent = "Testando...";
  inlineStatus.textContent = "Conectando ao PostgreSQL";

  try {
    const result = await requestJson("/api/conexao/testar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(connectionPayload()),
    });
    const data = result.dados;
    connectionValidated = true;
    connectionBadge.className = "status-badge success";
    connectionBadge.textContent = "Conexão validada";
    inlineStatus.textContent = data.banco + " · PostgreSQL " + data.versao_postgresql;
    startButton.disabled = false;
    startRestoreButton.disabled = false;
    renderDatabaseSummary(data);

    if (data.totalTabelas > 0) {
      setMessage(
        connectionMessage,
        "success",
        "Conexão realizada e " + data.totalTabelas + " tabela(s) pública(s) localizada(s).",
      );
    } else {
      setMessage(
        connectionMessage,
        "warning",
        "Conexão realizada, mas o banco ainda não possui tabelas públicas.",
        ["Execute os scripts SQL da massa de dados antes da demonstração."],
      );
    }
  } catch (error) {
    connectionBadge.className = "status-badge danger";
    connectionBadge.textContent = "Falha na conexão";
    inlineStatus.textContent = "Teste não concluído";
    setMessage(connectionMessage, "danger", error.message, error.details);
  } finally {
    testButton.disabled = false;
    testButton.textContent = "Testar conexão";
  }
}

function statusLabel(status) {
  const labels = {
    AGUARDANDO: "Aguardando",
    EM_ANDAMENTO: "Em andamento",
    CONCLUIDA: "Concluída",
    IGNORADA: "Não necessária",
    FALHA: "Falha",
  };
  return labels[status] || status;
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) {
    return "";
  }
  if (bytes < 1024) {
    return bytes + " B";
  }
  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " KB";
  }
  return (bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " MB";
}

function renderProcess(state) {
  const badgeClasses = {
    EM_ANDAMENTO: "status-badge running",
    SUCESSO: "status-badge success",
    FALHA: "status-badge danger",
  };
  const badgeLabels = {
    EM_ANDAMENTO: "Em andamento",
    SUCESSO: "Concluído",
    FALHA: "Falha",
  };
  processBadge.className = badgeClasses[state.status] || "status-badge neutral";
  processBadge.textContent = badgeLabels[state.status] || state.status;
  progressMessage.textContent = state.mensagem;
  progressValue.textContent = state.progresso + "%";
  progressBar.style.width = state.progresso + "%";
  processProgressNative.value = state.progresso;
  processProgressNative.textContent = state.progresso + "%";

  state.etapas.forEach((step) => {
    const item = document.querySelector('[data-process-step="' + step.id + '"]');
    if (!item) {
      return;
    }
    item.className = "step-" + step.status.toLowerCase().replace("_", "-");
    const status = item.querySelector("em");
    status.textContent = statusLabel(step.status);
    status.title = step.detalhe;
  });

  const decision = state.resultado.decisao;
  resultElements.mode.textContent = decision ? decision.origem : "—";
  resultElements.days.textContent = decision
    ? (decision.diasDesdeUltimaManutencao === null
      ? "Sem histórico"
      : decision.diasDesdeUltimaManutencao + " dia(s)")
    : "—";
  resultElements.action.textContent = decision ? decision.acao : "—";

  const backup = state.resultado.backup;
  const finalArtifact = state.resultado.compactacao
    || state.resultado.criptografia
    || backup;
  const finalFile = state.resultado.arquivoFinal || (finalArtifact && finalArtifact.arquivo);
  resultElements.file.textContent = finalArtifact
    ? finalFile + " (" + formatBytes(finalArtifact.tamanhoBytes) + ")"
    : "—";
  resultElements.file.title = finalFile || "";
  resultElements.encryption.textContent = state.resultado.criptografia
    ? state.resultado.criptografia.algoritmo
    : "Não solicitada";
  resultElements.compression.textContent = state.resultado.compactacao
    ? state.resultado.compactacao.protecao
    : "Não solicitada";
  resultElements.copy.textContent = state.resultado.copiaAdicional || "Não solicitada";
  resultElements.copy.title = state.resultado.copiaAdicional || "";
  resultElements.log.textContent = state.resultado.arquivoLog || "Será gravado ao finalizar";
  resultElements.log.title = state.resultado.arquivoLog || "";
  resultElements.email.textContent = state.resultado.emailLogSimulado || "Somente em caso de falha";
  resultElements.email.title = state.resultado.emailLogSimulado || "";

  if (state.logs.length === 0) {
    processLog.textContent = "Preparando a execução...";
  } else {
    processLog.textContent = state.logs.map((entry) => {
      const time = new Date(entry.momento).toLocaleTimeString("pt-BR");
      return "[" + time + "] [" + entry.nivel + "] " + entry.mensagem;
    }).join("\n");
    processLog.scrollTop = processLog.scrollHeight;
  }
}

async function pollProcess() {
  if (!currentProcessId) {
    return;
  }

  try {
    const result = await requestJson("/api/processos/" + currentProcessId);
    renderProcess(result.dados);

    if (result.dados.status === "EM_ANDAMENTO") {
      pollTimer = window.setTimeout(pollProcess, 800);
      return;
    }

    currentProcessId = null;
    startButton.disabled = !connectionValidated;
    await loadHistory(false);
  } catch (error) {
    processBadge.className = "status-badge danger";
    processBadge.textContent = "Falha no acompanhamento";
    progressMessage.textContent = error.message;
    currentProcessId = null;
    startButton.disabled = !connectionValidated;
  }
}

async function startProcess() {
  if (!form.reportValidity()) {
    return;
  }

  if (!connectionValidated) {
    setMessage(
      connectionMessage,
      "warning",
      "Teste novamente a conexão antes de iniciar o processo.",
    );
    showView("configuracao");
    return;
  }

  const parametros = processParameters();
  const aviso = parametros.simularFalha
    ? "A falha controlada está habilitada. O backup será interrompido para demonstrar o tratamento de erro. Continuar?"
    : "Iniciar manutenção e backup? Operações como VACUUM FULL podem bloquear tabelas temporariamente.";
  if (!window.confirm(aviso)) {
    return;
  }

  startButton.disabled = true;
  startButton.textContent = "Iniciando...";

  try {
    const result = await requestJson("/api/processos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conexao: connectionPayload(),
        parametros,
      }),
    });

    currentProcessId = result.dados.id;
    renderProcess(result.dados);
    showView("acompanhamento");
    window.clearTimeout(pollTimer);
    pollTimer = window.setTimeout(pollProcess, 200);
  } catch (error) {
    setMessage(connectionMessage, "danger", error.message, error.details);
    showView("configuracao");
    startButton.disabled = !connectionValidated;
  } finally {
    startButton.textContent = "Iniciar fluxo de backup";
  }
}

function renderRestoreTables(tables) {
  restoreTablesBody.replaceChildren();
  if (!tables || tables.length === 0) {
    const row = document.createElement("tr");
    row.className = "empty-row";
    const cell = document.createElement("td");
    cell.colSpan = 2;
    cell.textContent = "A conferência ainda não encontrou tabelas públicas.";
    row.append(cell);
    restoreTablesBody.append(row);
    return;
  }
  tables.forEach((table) => {
    const row = document.createElement("tr");
    appendCell(row, table.nome);
    appendCell(row, Number(table.registros).toLocaleString("pt-BR"));
    restoreTablesBody.append(row);
  });
}

function renderRestore(state) {
  const badgeClasses = {
    EM_ANDAMENTO: "status-badge running",
    SUCESSO: "status-badge success",
    FALHA: "status-badge danger",
  };
  const badgeLabels = {
    EM_ANDAMENTO: "Em andamento",
    SUCESSO: "Concluída",
    FALHA: "Falha",
  };
  restoreBadge.className = badgeClasses[state.status] || "status-badge neutral";
  restoreBadge.textContent = badgeLabels[state.status] || state.status;
  restoreProgressMessage.textContent = state.mensagem;
  restoreProgressValue.textContent = state.progresso + "%";
  restoreProgressBar.style.width = state.progresso + "%";
  restoreProgressNative.value = state.progresso;
  restoreProgressNative.textContent = state.progresso + "%";

  state.etapas.forEach((step) => {
    const item = document.querySelector('[data-restore-step="' + step.id + '"]');
    if (!item) {
      return;
    }
    item.className = "step-" + step.status.toLowerCase().replace("_", "-");
    const status = item.querySelector("em");
    status.textContent = statusLabel(step.status);
    status.title = step.detalhe;
  });

  restoreResultElements.database.textContent = state.resultado.bancoDestino || "—";
  restoreResultElements.created.textContent = state.resultado.bancoCriado ? "Sim" : "Não ou ainda não";
  restoreResultElements.tables.textContent = state.resultado.totalTabelas === null
    ? "—"
    : Number(state.resultado.totalTabelas).toLocaleString("pt-BR");
  restoreResultElements.records.textContent = state.resultado.totalRegistros === null
    ? "—"
    : Number(state.resultado.totalRegistros).toLocaleString("pt-BR");
  renderRestoreTables(state.resultado.tabelas);

  restoreLog.textContent = state.logs.length === 0
    ? "Preparando a restauração..."
    : state.logs.map((entry) => {
      const time = new Date(entry.momento).toLocaleTimeString("pt-BR");
      return "[" + time + "] [" + entry.nivel + "] " + entry.mensagem;
    }).join("\n");
  restoreLog.scrollTop = restoreLog.scrollHeight;
}

async function pollRestore() {
  if (!currentRestoreId) {
    return;
  }
  try {
    const result = await requestJson("/api/restauracao/" + currentRestoreId);
    renderRestore(result.dados);
    if (result.dados.status === "EM_ANDAMENTO") {
      restorePollTimer = window.setTimeout(pollRestore, 800);
      return;
    }
    currentRestoreId = null;
    startRestoreButton.disabled = !connectionValidated;
  } catch (error) {
    restoreBadge.className = "status-badge danger";
    restoreBadge.textContent = "Falha no acompanhamento";
    restoreProgressMessage.textContent = error.message;
    currentRestoreId = null;
    startRestoreButton.disabled = !connectionValidated;
  }
}

async function startRestore() {
  hideMessage(restoreMessage);
  if (!restoreForm.reportValidity()) {
    return;
  }
  if (!connectionValidated) {
    setMessage(
      restoreMessage,
      "warning",
      "Teste a conexão na tela Configuração antes de restaurar.",
    );
    return;
  }
  const parametros = restoreParameters();
  if (!window.confirm(
    "Restaurar no banco \"" + parametros.bancoDestino
      + "\"? Se ele já existir, objetos presentes no backup poderão ser substituídos.",
  )) {
    return;
  }

  startRestoreButton.disabled = true;
  startRestoreButton.textContent = "Iniciando...";
  try {
    const result = await requestJson("/api/restauracao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conexao: connectionPayload(),
        parametros,
      }),
    });
    currentRestoreId = result.dados.id;
    renderRestore(result.dados);
    showView("restauracao");
    window.clearTimeout(restorePollTimer);
    restorePollTimer = window.setTimeout(pollRestore, 200);
  } catch (error) {
    setMessage(restoreMessage, "danger", error.message, error.details);
    startRestoreButton.disabled = !connectionValidated;
  } finally {
    startRestoreButton.textContent = "Restaurar e conferir";
  }
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) {
    return "Em andamento";
  }
  if (seconds < 60) {
    return seconds + " s";
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes + " min " + rest + " s";
}

function appendCell(row, value, className) {
  const cell = document.createElement("td");
  cell.textContent = value;
  if (className) {
    cell.className = className;
  }
  row.append(cell);
  return cell;
}

function renderHistory(records) {
  historyBody.replaceChildren();

  if (records.length === 0) {
    const row = document.createElement("tr");
    row.className = "empty-row";
    const cell = document.createElement("td");
    cell.colSpan = 10;
    cell.textContent = "Nenhuma execução foi registrada neste banco.";
    row.append(cell);
    historyBody.append(row);
    return;
  }

  records.forEach((record) => {
    const row = document.createElement("tr");
    appendCell(row, "#" + record.id);
    appendCell(row, new Date(record.inicio).toLocaleString("pt-BR"));
    appendCell(row, formatDuration(record.duracao_segundos));
    appendCell(row, String(record.modo).replaceAll("_", " "));
    appendCell(
      row,
      record.dias_desde_ultima_manutencao === null
        ? "Sem histórico"
        : record.dias_desde_ultima_manutencao + " dia(s)",
    );
    appendCell(row, record.acao_manutencao);
    const protection = [
      record.criptografado ? "AES" : null,
      record.compactado ? "ZIP" : null,
    ].filter(Boolean).join(" + ") || "Simples";
    appendCell(row, protection);

    const resultCell = document.createElement("td");
    const result = document.createElement("span");
    result.className = "result-pill result-" + String(record.resultado).toLowerCase();
    result.textContent = record.resultado;
    resultCell.append(result);
    row.append(resultCell);

    const fileCell = appendCell(row, record.arquivo_backup || "—", "path-cell");
    fileCell.title = record.arquivo_backup || record.mensagem || "";

    const logCell = document.createElement("td");
    const logButton = document.createElement("button");
    logButton.type = "button";
    logButton.className = "button secondary compact";
    logButton.textContent = record.arquivo_log ? "Ver log" : "Indisponível";
    logButton.disabled = !record.arquivo_log;
    logButton.addEventListener("click", () => loadHistoryLog(record.id));
    logCell.append(logButton);
    row.append(logCell);
    row.title = record.regra || "";
    historyBody.append(row);
  });
}

async function loadHistoryLog(id) {
  try {
    const result = await requestJson("/api/historico/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conexao: connectionPayload(), id }),
    });
    historyLogDetails.textContent = "Execução #" + id
      + " · " + result.dados.resultado
      + (result.dados.email_log_simulado ? " · envio por e-mail simulado" : "");
    historyLogContent.textContent = result.dados.log_execucao || "Log sem conteúdo.";
    historyLogPanel.hidden = false;
    historyLogPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setMessage(historyMessage, "danger", error.message, error.details);
  }
}

async function loadHistory(showFeedback) {
  const shouldShowFeedback = showFeedback !== false;
  hideMessage(historyMessage);
  refreshHistoryButton.disabled = true;
  refreshHistoryButton.textContent = "Atualizando...";

  try {
    const result = await requestJson("/api/historico/listar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conexao: connectionPayload(),
        limite: 50,
      }),
    });
    renderHistory(result.dados);
    if (shouldShowFeedback) {
      setMessage(historyMessage, "success", result.mensagem);
    }
  } catch (error) {
    setMessage(historyMessage, "danger", error.message, error.details);
  } finally {
    refreshHistoryButton.disabled = false;
    refreshHistoryButton.textContent = "Atualizar histórico";
  }
}

navigationButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showView(button.dataset.view);
    if (button.dataset.view === "historico" && connectionValidated) {
      loadHistory(false);
    }
  });
});

togglePasswordButton.addEventListener("click", () => {
  const showing = passwordInput.type === "text";
  passwordInput.type = showing ? "password" : "text";
  togglePasswordButton.textContent = showing ? "Mostrar" : "Ocultar";
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  testConnection();
});

form.addEventListener("input", (event) => {
  if (connectionFieldIds.has(event.target.id) && connectionValidated) {
    invalidateConnection();
  }
});

restoreForm.addEventListener("submit", (event) => {
  event.preventDefault();
  startRestore();
});

encryptCheckbox.addEventListener("change", updateProtectionFields);
compressCheckbox.addEventListener("change", updateProtectionFields);

startButton.addEventListener("click", startProcess);
refreshHistoryButton.addEventListener("click", () => loadHistory(true));
closeHistoryLogButton.addEventListener("click", () => {
  historyLogPanel.hidden = true;
});

const initialView = window.location.hash.slice(1);
if (["configuracao", "acompanhamento", "restauracao", "historico"].includes(initialView)) {
  showView(initialView);
}

updateProtectionFields();
