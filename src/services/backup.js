const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");

function erroPublico(mensagem, causa) {
  const error = new Error(mensagem, { cause: causa });
  error.mensagemPublica = mensagem;
  return error;
}

function doisDigitos(value) {
  return String(value).padStart(2, "0");
}

function tresDigitos(value) {
  return String(value).padStart(3, "0");
}

function sufixoData(date = new Date()) {
  return String(date.getFullYear())
    + doisDigitos(date.getMonth() + 1)
    + doisDigitos(date.getDate())
    + "_"
    + doisDigitos(date.getHours())
    + doisDigitos(date.getMinutes())
    + doisDigitos(date.getSeconds())
    + "_"
    + tresDigitos(date.getMilliseconds());
}

function nomeArquivoBackup(banco, date = new Date()) {
  const nomeSeguro = banco.replace(/[^A-Za-z0-9_-]/g, "_");
  return nomeSeguro + "_" + sufixoData(date) + ".backup";
}

async function garantirDiretorio(caminho) {
  const caminhoAbsoluto = path.resolve(caminho);

  try {
    await fsp.mkdir(caminhoAbsoluto, { recursive: true });
    const estado = await fsp.stat(caminhoAbsoluto);

    if (!estado.isDirectory()) {
      throw erroPublico("O destino informado não é uma pasta.");
    }

    await fsp.access(caminhoAbsoluto, fs.constants.W_OK);
    return caminhoAbsoluto;
  } catch (error) {
    if (error.mensagemPublica) {
      throw error;
    }

    throw erroPublico("Não foi possível criar ou escrever na pasta de destino.", error);
  }
}

async function caminhoExecutavel(candidato, nomeExecutavel = "pg_dump") {
  if (!candidato) {
    return null;
  }

  try {
    const resolvido = path.resolve(candidato);
    const estado = await fsp.stat(resolvido);

    if (estado.isDirectory()) {
      const nome = process.platform === "win32" ? nomeExecutavel + ".exe" : nomeExecutavel;
      const dentroDaPasta = path.join(resolvido, nome);
      await fsp.access(dentroDaPasta, fs.constants.F_OK);
      return dentroDaPasta;
    }

    await fsp.access(resolvido, fs.constants.F_OK);
    return resolvido;
  } catch (_error) {
    return null;
  }
}

async function resolverExecutavelPostgres(nomeExecutavel, caminhoInformado, variavelAmbiente) {
  if (caminhoInformado) {
    const encontrado = await caminhoExecutavel(caminhoInformado, nomeExecutavel);
    if (!encontrado) {
      throw erroPublico("O executável " + nomeExecutavel + " não foi encontrado no caminho informado.");
    }
    return encontrado;
  }

  const configurados = [
    process.env[variavelAmbiente],
    process.env.PGHOME && path.join(process.env.PGHOME, "bin"),
  ];

  for (const candidato of configurados) {
    const encontrado = await caminhoExecutavel(candidato, nomeExecutavel);
    if (encontrado) {
      return encontrado;
    }
  }

  if (process.platform === "win32") {
    const bases = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean);

    for (const base of bases) {
      for (let versao = 20; versao >= 10; versao -= 1) {
        const candidato = path.join(
          base,
          "PostgreSQL",
          String(versao),
          "bin",
          nomeExecutavel + ".exe",
        );
        const encontrado = await caminhoExecutavel(candidato, nomeExecutavel);
        if (encontrado) {
          return encontrado;
        }
      }
    }
  }

  return process.platform === "win32" ? nomeExecutavel + ".exe" : nomeExecutavel;
}

function resolverPgDump(caminhoInformado) {
  return resolverExecutavelPostgres("pg_dump", caminhoInformado, "PG_DUMP_PATH");
}

function resolverPgRestore(caminhoInformado) {
  return resolverExecutavelPostgres("pg_restore", caminhoInformado, "PG_RESTORE_PATH");
}

function executarPgDump(executavel, argumentos, ambiente) {
  return new Promise((resolve, reject) => {
    const processo = spawn(executavel, argumentos, {
      env: ambiente,
      shell: false,
      windowsHide: true,
    });
    let stderr = "";

    processo.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 16000) {
        stderr = stderr.slice(-16000);
      }
    });

    processo.on("error", (error) => {
      if (error.code === "ENOENT") {
        reject(erroPublico(
          "O pg_dump não foi localizado. Informe o caminho do executável nas configurações.",
          error,
        ));
        return;
      }

      reject(erroPublico("Não foi possível iniciar o pg_dump.", error));
    });

    processo.on("close", (codigo) => {
      if (codigo === 0) {
        resolve();
        return;
      }

      const detalhe = stderr.trim().replace(/\s+/g, " ").slice(-1200);
      const complemento = detalhe ? " Detalhe: " + detalhe : "";
      reject(erroPublico("O pg_dump terminou com código " + codigo + "." + complemento));
    });
  });
}

async function gerarBackup(configuracao, parametros, registrarLog = () => undefined) {
  const destino = await garantirDiretorio(parametros.destino);
  const arquivo = path.join(destino, nomeArquivoBackup(configuracao.banco));
  const executavel = await resolverPgDump(parametros.caminhoPgDump);
  const argumentos = [
    "--host", configuracao.host,
    "--port", String(configuracao.porta),
    "--username", configuracao.usuario,
    "--format=custom",
    "--no-password",
    "--file", arquivo,
    configuracao.banco,
  ];

  registrarLog("Executando pg_dump no formato customizado.");

  try {
    await executarPgDump(executavel, argumentos, {
      ...process.env,
      PGPASSWORD: configuracao.senha,
    });
    const estado = await fsp.stat(arquivo);

    if (estado.size === 0) {
      throw erroPublico("O pg_dump produziu um arquivo vazio.");
    }

    return {
      arquivo,
      tamanhoBytes: estado.size,
    };
  } catch (error) {
    await fsp.rm(arquivo, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function aplicarRetencao(destino, banco, quantidadeManter) {
  if (quantidadeManter === 0) {
    return [];
  }

  const nomeSeguro = banco.replace(/[^A-Za-z0-9_-]/g, "_");
  const entradas = await fsp.readdir(destino, { withFileTypes: true });
  const candidatos = [];

  for (const entrada of entradas) {
    if (!entrada.isFile()
      || !entrada.name.startsWith(nomeSeguro + "_")
      || !/\.(backup|backup\.aes|zip)$/i.test(entrada.name)) {
      continue;
    }

    const arquivo = path.join(destino, entrada.name);
    const estado = await fsp.stat(arquivo);
    candidatos.push({ arquivo, momento: estado.mtimeMs });
  }

  candidatos.sort((a, b) => b.momento - a.momento);
  const removidos = candidatos.slice(quantidadeManter);

  for (const item of removidos) {
    await fsp.unlink(item.arquivo);
  }

  return removidos.map((item) => item.arquivo);
}

async function copiarBackup(arquivo, destinoAdicional) {
  if (!destinoAdicional) {
    return null;
  }

  const destino = await garantirDiretorio(destinoAdicional);
  const copia = path.join(destino, path.basename(arquivo));
  await fsp.copyFile(arquivo, copia);
  return copia;
}

module.exports = {
  aplicarRetencao,
  copiarBackup,
  gerarBackup,
  nomeArquivoBackup,
  resolverPgDump,
  resolverPgRestore,
};
