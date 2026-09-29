/**
 * /api/auth
 *   POST /auth/login   → { login, senha } (login = usuário ou e-mail)
 *                        responde { token, usuario: { id, nome, tipo } }
 *   POST /auth/logout  → encerra a sessão do token enviado
 */
import { Router } from "express";
import { pool } from "../db.js";
import { HttpError } from "../erros.js";
import { conferirSenha, criarSessao, encerrarSessao, tokenDaRequisicao } from "../auth.js";

const router = Router();

router.post("/login", async (req, res) => {
  const login = String(req.body?.login ?? "").trim();
  const senha = String(req.body?.senha ?? "");
  if (!login || !senha) throw new HttpError(400, "Informe o usuário e a senha.");

  const [linhas] = await pool.query(
    "SELECT id, nome, tipo, senha_hash FROM usuarios WHERE (usuario = ? OR email = ?) AND ativo",
    [login, login]
  );
  const usuario = linhas[0];
  // Mesma mensagem para usuário inexistente e senha errada: não revela quem existe
  if (!usuario || !(await conferirSenha(senha, usuario.senha_hash))) {
    throw new HttpError(401, "Usuário ou senha inválidos.");
  }

  res.json({
    token: criarSessao(usuario.id),
    usuario: { id: usuario.id, nome: usuario.nome, tipo: usuario.tipo },
  });
});

router.post("/logout", (req, res) => {
  encerrarSessao(tokenDaRequisicao(req));
  res.sendStatus(204);
});

export default router;
