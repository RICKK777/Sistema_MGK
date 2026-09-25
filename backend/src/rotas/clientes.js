/**
 * /api/clientes
 *   GET  /clientes               → todos, por nome
 *   GET  /clientes?busca=termo   → por nome (ignora acentos) ou por CPF/CNPJ
 *   GET  /clientes?documento=... → cliente com o documento exato (aviso de duplicado)
 *   GET  /clientes/:id
 *   POST /clientes
 *   PUT  /clientes/:id
 */
import { Router } from "express";
import { pool } from "../db.js";
import { HttpError, idDaRota } from "../erros.js";
import { onlyDigits, validarCliente } from "../validacao.js";

const router = Router();

// Colunas em snake_case → campos em camelCase, como o site espera
const CAMPOS = `id, nome, documento, telefone, celular, email, cep, rua, numero, complemento,
  bairro, cidade, estado, status, criado_em AS criadoEm, atualizado_em AS atualizadoEm`;

/** Escapa % e _ para que sejam buscados como texto no LIKE. */
const like = (termo) => `%${termo.replace(/[\\%_]/g, "\\$&")}%`;

async function buscarPorId(id) {
  const [linhas] = await pool.query(`SELECT ${CAMPOS} FROM clientes WHERE id = ?`, [id]);
  if (!linhas.length) throw new HttpError(404, "Cliente não encontrado.");
  return linhas[0];
}

/** Traduz o erro de documento repetido (UNIQUE) do MySQL para 409. */
function tratarDuplicado(err) {
  if (err.code === "ER_DUP_ENTRY") throw new HttpError(409, "Já existe um cliente cadastrado com este CPF/CNPJ.");
  throw err;
}

router.get("/", async (req, res) => {
  const documento = onlyDigits(req.query.documento);
  const busca = String(req.query.busca ?? "").trim();
  let where = "";
  let params = [];

  if (req.query.documento !== undefined) {
    where = "WHERE documento = ?";
    params = [documento];
  } else if (busca) {
    const digitos = onlyDigits(busca);
    const porDocumento = digitos.length >= 3 && /^[\d.\-\/\s]+$/.test(busca);
    // A collation utf8mb4_0900_ai_ci faz "joao" encontrar "João"
    where = porDocumento ? "WHERE documento LIKE ?" : "WHERE nome LIKE ?";
    params = [like(porDocumento ? digitos : busca)];
  }

  const [linhas] = await pool.query(`SELECT ${CAMPOS} FROM clientes ${where} ORDER BY nome`, params);
  res.json(linhas);
});

router.get("/:id", async (req, res) => {
  res.json(await buscarPorId(idDaRota(req.params.id, "Cliente não encontrado.")));
});

router.post("/", async (req, res) => {
  const { erro, dados } = validarCliente(req.body);
  if (erro) throw new HttpError(400, erro);

  const [resultado] = await pool.query("INSERT INTO clientes SET ?", [dados]).catch(tratarDuplicado);
  res.status(201).json(await buscarPorId(resultado.insertId));
});

router.put("/:id", async (req, res) => {
  const id = idDaRota(req.params.id, "Cliente não encontrado.");
  const { erro, dados } = validarCliente(req.body);
  if (erro) throw new HttpError(400, erro);

  const [resultado] = await pool.query("UPDATE clientes SET ? WHERE id = ?", [dados, id]).catch(tratarDuplicado);
  if (!resultado.affectedRows) throw new HttpError(404, "Cliente não encontrado.");
  res.json(await buscarPorId(id));
});

export default router;
