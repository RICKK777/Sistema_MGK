/**
 * /api/produtos
 *   GET /produtos     → produtos ativos, por nome (lista da tela de venda)
 *   GET /produtos/:id → qualquer produto, inclusive inativo (histórico)
 */
import { Router } from "express";
import { pool } from "../db.js";
import { HttpError, idDaRota } from "../erros.js";

const router = Router();

const CAMPOS = "id, nome, preco_padrao AS precoPadrao";

router.get("/", async (req, res) => {
  const [linhas] = await pool.query(`SELECT ${CAMPOS} FROM produtos WHERE ativo ORDER BY nome`);
  res.json(linhas);
});

router.get("/:id", async (req, res) => {
  const id = idDaRota(req.params.id, "Produto não encontrado.");
  const [linhas] = await pool.query(`SELECT ${CAMPOS} FROM produtos WHERE id = ?`, [id]);
  if (!linhas.length) throw new HttpError(404, "Produto não encontrado.");
  res.json(linhas[0]);
});

export default router;
