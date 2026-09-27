/**
 * /api/produtos
 *   GET  /produtos         → produtos ativos, por nome (lista da tela de venda)
 *   GET  /produtos?todos=1 → todos, inclusive inativos (tela de produtos)
 *   GET  /produtos/:id     → qualquer produto, inclusive inativo (histórico)
 *   POST /produtos
 *   PUT  /produtos/:id
 *   DELETE /produtos/:id  → só se o produto nunca foi vendido (senão 409)
 */
import { Router } from "express";
import { pool } from "../db.js";
import { HttpError, idDaRota } from "../erros.js";
import { validarProduto } from "../validacao.js";

const router = Router();

const CAMPOS = "id, nome, preco_padrao AS precoPadrao, ativo IS TRUE AS ativo, foto, criado_em AS criadoEm, atualizado_em AS atualizadoEm";

/** O MySQL devolve BOOLEAN como 0/1; o site espera true/false. */
const comAtivo = (p) => ({ ...p, ativo: Boolean(p.ativo) });

async function buscarPorId(id) {
  const [linhas] = await pool.query(`SELECT ${CAMPOS} FROM produtos WHERE id = ?`, [id]);
  if (!linhas.length) throw new HttpError(404, "Produto não encontrado.");
  return comAtivo(linhas[0]);
}

/** Traduz o erro de nome repetido (UNIQUE) do MySQL para 409. */
function tratarDuplicado(err) {
  if (err.code === "ER_DUP_ENTRY") throw new HttpError(409, "Já existe um produto cadastrado com este nome.");
  throw err;
}

router.get("/", async (req, res) => {
  const where = req.query.todos ? "" : "WHERE ativo";
  const [linhas] = await pool.query(`SELECT ${CAMPOS} FROM produtos ${where} ORDER BY nome`);
  res.json(linhas.map(comAtivo));
});

router.get("/:id", async (req, res) => {
  res.json(await buscarPorId(idDaRota(req.params.id, "Produto não encontrado.")));
});

router.post("/", async (req, res) => {
  const { erro, dados } = validarProduto(req.body);
  if (erro) throw new HttpError(400, erro);

  const [resultado] = await pool.query("INSERT INTO produtos SET ?", [dados]).catch(tratarDuplicado);
  res.status(201).json(await buscarPorId(resultado.insertId));
});

router.put("/:id", async (req, res) => {
  const id = idDaRota(req.params.id, "Produto não encontrado.");
  const { erro, dados } = validarProduto(req.body);
  if (erro) throw new HttpError(400, erro);

  const [resultado] = await pool.query("UPDATE produtos SET ? WHERE id = ?", [dados, id]).catch(tratarDuplicado);
  if (!resultado.affectedRows) throw new HttpError(404, "Produto não encontrado.");
  res.json(await buscarPorId(id));
});

router.delete("/:id", async (req, res) => {
  const id = idDaRota(req.params.id, "Produto não encontrado.");
  // venda_itens → produtos é ON DELETE RESTRICT: produto já vendido não pode ser apagado
  const [resultado] = await pool.query("DELETE FROM produtos WHERE id = ?", [id]).catch((err) => {
    if (err.code === "ER_ROW_IS_REFERENCED_2" || err.code === "ER_ROW_IS_REFERENCED") {
      throw new HttpError(409, "Este produto já foi usado em vendas e não pode ser excluído. Inative-o para tirá-lo da venda.");
    }
    throw err;
  });
  if (!resultado.affectedRows) throw new HttpError(404, "Produto não encontrado.");
  res.sendStatus(204);
});

export default router;
