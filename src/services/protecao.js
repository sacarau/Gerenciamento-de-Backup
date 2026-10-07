const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { pipeline } = require("node:stream/promises");
const { promisify } = require("node:util");
const { path7za } = require("7zip-bin");

const scrypt = promisify(crypto.scrypt);
const ASSINATURA_AES = Buffer.from("GBKAES01", "ascii");
const TAMANHO_SAL = 16;
const TAMANHO_IV = 12;
const TAMANHO_TAG = 16;
const TAMANHO_CABECALHO = ASSINATURA_AES.length + TAMANHO_SAL + TAMANHO_IV;

function erroPublico(mensagem, causa) {
  const error = new Error(mensagem, { cause: causa });
  error.mensagemPublica = mensagem;
  return error;
}

async function derivarChave(senha, sal) {
  return scrypt(senha, sal, 32);
}

function caminhoCriptografado(arquivo) {
  return arquivo + ".aes";
}

function caminhoCompactado(arquivo) {
  if (arquivo.endsWith(".backup.aes")) {
    return arquivo.slice(0, -".backup.aes".length) + ".zip";
  }
  if (arquivo.endsWith(".backup")) {
    return arquivo.slice(0, -".backup".length) + ".zip";
  }
  return arquivo + ".zip";
}

async function criptografarArquivo(arquivoOrigem, senha) {
  const arquivoDestino = caminhoCriptografado(arquivoOrigem);
  const sal = crypto.randomBytes(TAMANHO_SAL);
  const iv = crypto.randomBytes(TAMANHO_IV);
  const chave = await derivarChave(senha, sal);
  const cipher = crypto.createCipheriv("aes-256-gcm", chave, iv);
  const cabecalho = Buffer.concat([ASSINATURA_AES, sal, iv]);

  try {
    await fsp.writeFile(arquivoDestino, cabecalho, { flag: "wx" });
    await pipeline(
      fs.createReadStream(arquivoOrigem),
      cipher,
      fs.createWriteStream(arquivoDestino, { flags: "a" }),
    );
    await fsp.appendFile(arquivoDestino, cipher.getAuthTag());
    const estado = await fsp.stat(arquivoDestino);
    return { arquivo: arquivoDestino, tamanhoBytes: estado.size, algoritmo: "AES-256-GCM" };
  } catch (error) {
    await fsp.rm(arquivoDestino, { force: true }).catch(() => undefined);
    if (error.code === "EEXIST") {
      throw erroPublico("Já existe um arquivo criptografado com o mesmo nome.", error);
    }
    throw erroPublico("Não foi possível criptografar o backup com AES.", error);
  }
}

async function lerTrecho(fileHandle, tamanho, posicao) {
  const buffer = Buffer.alloc(tamanho);
  const resultado = await fileHandle.read(buffer, 0, tamanho, posicao);
  if (resultado.bytesRead !== tamanho) {
    throw erroPublico("O arquivo criptografado está incompleto ou corrompido.");
  }
  return buffer;
}

async function descriptografarArquivo(arquivoOrigem, senha, arquivoDestino) {
  const destino = arquivoDestino || arquivoOrigem.replace(/\.aes$/i, "");
  const estado = await fsp.stat(arquivoOrigem);
  if (estado.size <= TAMANHO_CABECALHO + TAMANHO_TAG) {
    throw erroPublico("O arquivo criptografado está incompleto ou corrompido.");
  }

  const fileHandle = await fsp.open(arquivoOrigem, "r");
  let cabecalho;
  let tag;
  try {
    cabecalho = await lerTrecho(fileHandle, TAMANHO_CABECALHO, 0);
    tag = await lerTrecho(fileHandle, TAMANHO_TAG, estado.size - TAMANHO_TAG);
  } finally {
    await fileHandle.close();
  }

  const assinatura = cabecalho.subarray(0, ASSINATURA_AES.length);
  if (!assinatura.equals(ASSINATURA_AES)) {
    throw erroPublico("O arquivo não foi gerado pelo módulo AES desta plataforma.");
  }

  const salInicio = ASSINATURA_AES.length;
  const ivInicio = salInicio + TAMANHO_SAL;
  const sal = cabecalho.subarray(salInicio, ivInicio);
  const iv = cabecalho.subarray(ivInicio, TAMANHO_CABECALHO);
  const chave = await derivarChave(senha, sal);
  const decipher = crypto.createDecipheriv("aes-256-gcm", chave, iv);
  decipher.setAuthTag(tag);

  try {
    await pipeline(
      fs.createReadStream(arquivoOrigem, {
        start: TAMANHO_CABECALHO,
        end: estado.size - TAMANHO_TAG - 1,
      }),
      decipher,
      fs.createWriteStream(destino, { flags: "wx" }),
    );
    return destino;
  } catch (error) {
    await fsp.rm(destino, { force: true }).catch(() => undefined);
    if (error.code === "EEXIST") {
      throw erroPublico("Já existe um arquivo temporário com o mesmo nome.", error);
    }
    throw erroPublico("Não foi possível descriptografar o backup. Verifique a chave AES.", error);
  }
}

function executar7Zip(argumentos, mensagemErro, opcoes = {}) {
  return new Promise((resolve, reject) => {
    if (process.platform !== "win32") {
      try {
        fs.chmodSync(path7za, 0o755);
      } catch (_error) {
        // O spawn abaixo produzirá uma mensagem pública caso o binário continue inacessível.
      }
    }
    const processo = spawn(path7za, argumentos, {
      cwd: opcoes.cwd,
      shell: false,
      windowsHide: true,
    });
    let saidaTecnica = "";

    const registrar = (chunk) => {
      saidaTecnica += chunk.toString("utf8");
      if (saidaTecnica.length > 12000) {
        saidaTecnica = saidaTecnica.slice(-12000);
      }
    };

    processo.stdout.on("data", registrar);
    processo.stderr.on("data", registrar);
    processo.on("error", (error) => reject(erroPublico(mensagemErro, error)));
    processo.on("close", (codigo) => {
      if (codigo === 0) {
        resolve();
        return;
      }
      const error = erroPublico(mensagemErro);
      error.codigo7Zip = codigo;
      reject(error);
    });
  });
}

async function compactarArquivoProtegido(arquivoOrigem, senha) {
  const arquivoDestino = caminhoCompactado(arquivoOrigem);
  await fsp.rm(arquivoDestino, { force: true });

  try {
    await executar7Zip([
      "a",
      "-tzip",
      "-mx=7",
      "-mem=AES256",
      "-bd",
      "-bso0",
      "-bsp0",
      "-p" + senha,
      arquivoDestino,
      path.basename(arquivoOrigem),
    ], "Não foi possível gerar o ZIP protegido por senha.", {
      cwd: path.dirname(arquivoOrigem),
    });
  } catch (error) {
    await fsp.rm(arquivoDestino, { force: true }).catch(() => undefined);
    throw error;
  }

  const estado = await fsp.stat(arquivoDestino);
  return { arquivo: arquivoDestino, tamanhoBytes: estado.size, protecao: "ZIP AES-256" };
}

async function listarArquivos(diretorio) {
  const encontrados = [];
  const entradas = await fsp.readdir(diretorio, { withFileTypes: true });
  for (const entrada of entradas) {
    const caminho = path.join(diretorio, entrada.name);
    if (entrada.isDirectory()) {
      encontrados.push(...await listarArquivos(caminho));
    } else if (entrada.isFile()) {
      encontrados.push(caminho);
    }
  }
  return encontrados;
}

async function extrairZipProtegido(arquivoZip, senha, diretorioDestino) {
  const destino = diretorioDestino
    || await fsp.mkdtemp(path.join(os.tmpdir(), "gerenciamento-backup-zip-"));
  await fsp.mkdir(destino, { recursive: true });

  try {
    await executar7Zip([
      "x",
      "-y",
      "-bd",
      "-bso0",
      "-bsp0",
      "-p" + senha,
      "-o" + destino,
      path.resolve(arquivoZip),
    ], "Não foi possível abrir o ZIP. Verifique a senha informada.", { cwd: destino });
    const arquivos = await listarArquivos(destino);
    const candidatos = arquivos.filter((arquivo) => /\.(backup|aes)$/i.test(arquivo));
    if (candidatos.length !== 1) {
      throw erroPublico("O ZIP deve conter exatamente um arquivo de backup gerado pela plataforma.");
    }
    return { diretorio: destino, arquivo: candidatos[0] };
  } catch (error) {
    if (!diretorioDestino) {
      await fsp.rm(destino, { recursive: true, force: true }).catch(() => undefined);
    }
    throw error;
  }
}

module.exports = {
  compactarArquivoProtegido,
  criptografarArquivo,
  descriptografarArquivo,
  extrairZipProtegido,
};
