const path = require("node:path");

const LIMITE_TEXTO = 255;
const LIMITE_CAMINHO = 1024;
const IDENTIFICADOR_POSTGRES = /^[A-Za-z_][A-Za-z0-9_$]*$/;
const HOST_VALIDO = /^[A-Za-z0-9.-]+$/;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MODOS_MANUTENCAO = new Set([
  "automatico",
  "manual_nenhuma",
  "manual_vacuum",
  "manual_completa",
]);

function texto(value) {
  return typeof value === "string" ? value.trim() : "";
}

function caminhoValido(value) {
  return value.length > 0
    && value.length <= LIMITE_CAMINHO
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function normalizarParaComparacao(value) {
  return path.resolve(value).replace(/[\\/]+$/, "").toLocaleLowerCase("pt-BR");
}

function validarConfiguracaoConexao(entrada = {}) {
  const host = texto(entrada.host);
  const banco = texto(entrada.banco);
  const usuario = texto(entrada.usuario);
  const senha = typeof entrada.senha === "string" ? entrada.senha : "";
  const porta = Number(entrada.porta);
  const erros = [];

  if (!host || host.length > LIMITE_TEXTO || !HOST_VALIDO.test(host)) {
    erros.push("Informe um servidor válido, como localhost ou 192.168.0.10.");
  }

  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
    erros.push("A porta deve ser um número inteiro entre 1 e 65535.");
  }

  if (!banco || banco.length > 63 || !IDENTIFICADOR_POSTGRES.test(banco)) {
    erros.push("Informe um nome de banco PostgreSQL válido.");
  }

  if (!usuario || usuario.length > 63 || !IDENTIFICADOR_POSTGRES.test(usuario)) {
    erros.push("Informe um usuário PostgreSQL válido.");
  }

  if (!senha || senha.length > LIMITE_TEXTO) {
    erros.push("Informe a senha do banco para realizar a operação.");
  }

  return {
    valido: erros.length === 0,
    erros,
    dados: {
      host,
      porta,
      banco,
      usuario,
      senha,
    },
  };
}

function validarParametrosProcesso(entrada = {}) {
  const destino = texto(entrada.destino);
  const destinoAdicional = texto(entrada.destinoAdicional);
  const caminhoPgDump = texto(entrada.caminhoPgDump);
  const modoManutencao = texto(entrada.modoManutencao);
  const quantidadeManter = Number(entrada.quantidadeManter);
  const criptografar = entrada.criptografar === true;
  const chaveCriptografia = typeof entrada.chaveCriptografia === "string"
    ? entrada.chaveCriptografia
    : "";
  const compactar = entrada.compactar === true;
  const senhaZip = typeof entrada.senhaZip === "string" ? entrada.senhaZip : "";
  const simularFalha = entrada.simularFalha === true;
  const emailFalha = texto(entrada.emailFalha) || "equipe@exemplo.com";
  const erros = [];

  if (!caminhoValido(destino)) {
    erros.push("Informe um caminho de destino válido para o backup.");
  }

  if (!Number.isInteger(quantidadeManter) || quantidadeManter < 0 || quantidadeManter > 1000) {
    erros.push("A quantidade a manter deve ser um inteiro entre 0 e 1000.");
  }

  if (destinoAdicional && !caminhoValido(destinoAdicional)) {
    erros.push("Informe um caminho válido para a cópia adicional.");
  }

  if (
    destino
    && destinoAdicional
    && normalizarParaComparacao(destino) === normalizarParaComparacao(destinoAdicional)
  ) {
    erros.push("O destino adicional deve ser diferente do destino principal.");
  }

  if (caminhoPgDump && !caminhoValido(caminhoPgDump)) {
    erros.push("O caminho do pg_dump é inválido.");
  }

  if (!MODOS_MANUTENCAO.has(modoManutencao)) {
    erros.push("Selecione um modo de manutenção válido.");
  }

  if (criptografar && (chaveCriptografia.length < 8 || chaveCriptografia.length > LIMITE_TEXTO)) {
    erros.push("A chave AES deve possuir entre 8 e 255 caracteres.");
  }

  if (compactar && (senhaZip.length < 8 || senhaZip.length > LIMITE_TEXTO)) {
    erros.push("A senha do ZIP deve possuir entre 8 e 255 caracteres.");
  }

  if (!EMAIL_VALIDO.test(emailFalha) || emailFalha.length > LIMITE_TEXTO) {
    erros.push("Informe um e-mail válido para a simulação do envio do log.");
  }

  return {
    valido: erros.length === 0,
    erros,
    dados: {
      destino,
      destinoAdicional,
      caminhoPgDump,
      modoManutencao,
      quantidadeManter,
      criptografar,
      chaveCriptografia,
      compactar,
      senhaZip,
      simularFalha,
      emailFalha,
    },
  };
}

function validarParametrosRestauracao(entrada = {}, bancoOrigem = "") {
  const arquivoBackup = texto(entrada.arquivoBackup);
  const bancoDestino = texto(entrada.bancoDestino);
  const caminhoPgRestore = texto(entrada.caminhoPgRestore);
  const chaveCriptografia = typeof entrada.chaveCriptografia === "string"
    ? entrada.chaveCriptografia
    : "";
  const senhaZip = typeof entrada.senhaZip === "string" ? entrada.senhaZip : "";
  const erros = [];

  if (!caminhoValido(arquivoBackup) || !/\.(backup|aes|zip)$/i.test(arquivoBackup)) {
    erros.push("Informe um arquivo .backup, .aes ou .zip válido para restaurar.");
  }

  if (!bancoDestino || bancoDestino.length > 63 || !IDENTIFICADOR_POSTGRES.test(bancoDestino)) {
    erros.push("Informe um nome válido para o banco de restauração.");
  }

  if (bancoOrigem && bancoDestino.toLocaleLowerCase("pt-BR") === bancoOrigem.toLocaleLowerCase("pt-BR")) {
    erros.push("O banco de restauração deve ser diferente do banco de origem.");
  }

  if (caminhoPgRestore && !caminhoValido(caminhoPgRestore)) {
    erros.push("O caminho do pg_restore é inválido.");
  }

  if (/\.aes$/i.test(arquivoBackup) && chaveCriptografia.length < 8) {
    erros.push("Informe a chave AES utilizada para proteger este backup.");
  }

  if (/\.zip$/i.test(arquivoBackup) && senhaZip.length < 8) {
    erros.push("Informe a senha utilizada para proteger o ZIP.");
  }

  if (chaveCriptografia.length > LIMITE_TEXTO || senhaZip.length > LIMITE_TEXTO) {
    erros.push("As credenciais de proteção devem possuir no máximo 255 caracteres.");
  }

  return {
    valido: erros.length === 0,
    erros,
    dados: {
      arquivoBackup,
      bancoDestino,
      caminhoPgRestore,
      chaveCriptografia,
      senhaZip,
    },
  };
}

module.exports = {
  MODOS_MANUTENCAO,
  validarConfiguracaoConexao,
  validarParametrosProcesso,
  validarParametrosRestauracao,
};
