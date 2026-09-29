/**
 * /api/usuarios (só o admin/TI: a permissão gerenciar_usuarios não está em nenhum outro tipo)
 *   GET  /usuarios     → todos os usuários, sem o hash da senha
 *   POST /usuarios     → { nome, usuario, email, tipo, senha }; a senha é gravada só como hash scrypt
 *   PUT  /usuarios/:id → mesmos campos; senha vazia mantém a atual. Trocar a senha encerra as
 *                        outras sessões do usuário (quem estava logado com a senha antiga sai).
 */
import { Router } from "express";
import { pool } from "../db.js";
import { HttpError, idDaRota } from "../erros.js";
import { encerrarSessoesDoUsuario, exigirPermissao, gerarHash, tokenDaRequisicao } from "../auth.js";
import { validarUsuario } from "../validacao.js";

const router = Router();

const CAMPOS = "id, nome, usuario, email, tipo, ativo IS TRUE AS ativo, criado_em AS criadoEm";

async function buscarPorId(id) {
  const [linhas] = await pool.query(`SELECT ${CAMPOS} FROM usuarios WHERE id = ?`, [id]);
  if (!linhas.length) throw new HttpError(404, "Usuário não encontrado.");
  return { ...linhas[0], ativo: Boolean(linhas[0].ativo) };
}

/** Traduz o erro de usuário/e-mail repetido (UNIQUE) do MySQL para 409. */
function tratarDuplicado(err) {
  if (err.code !== "ER_DUP_ENTRY") throw err;
  const campo = /email/.test(err.message) ? "este e-mail" : "este nome de acesso";
  throw new HttpError(409, `Já existe um usuário com ${campo}.`);
}

router.use(exigirPermissao("gerenciar_usuarios"));

router.get("/", async (req, res) => {
  const [linhas] = await pool.query(`SELECT ${CAMPOS} FROM usuarios ORDER BY nome`);
  res.json(linhas.map((u) => ({ ...u, ativo: Boolean(u.ativo) })));
});

router.post("/", async (req, res) => {
  const { erro, dados, senha } = validarUsuario(req.body);
  if (erro) throw new HttpError(400, erro);

  const [resultado] = await pool
    .query("INSERT INTO usuarios SET ?", [{ ...dados, senha_hash: await gerarHash(senha) }])
    .catch(tratarDuplicado);
  res.status(201).json(await buscarPorId(resultado.insertId));
});

router.put("/:id", async (req, res) => {
  const id = idDaRota(req.params.id, "Usuário não encontrado.");
  const { erro, dados, senha } = validarUsuario(req.body, { senhaOpcional: true });
  if (erro) throw new HttpError(400, erro);

  // Evita o admin tirar o próprio acesso a esta tela
  if (id === req.usuario.id && dados.tipo !== req.usuario.tipo) {
    throw new HttpError(400, "Você não pode mudar o seu próprio tipo de acesso.");
  }

  const campos = senha ? { ...dados, senha_hash: await gerarHash(senha) } : dados;
  const [resultado] = await pool.query("UPDATE usuarios SET ? WHERE id = ?", [campos, id]).catch(tratarDuplicado);
  if (!resultado.affectedRows) throw new HttpError(404, "Usuário não encontrado.");

  if (senha) encerrarSessoesDoUsuario(id, tokenDaRequisicao(req));
  res.json(await buscarPorId(id));
});

export default router;
