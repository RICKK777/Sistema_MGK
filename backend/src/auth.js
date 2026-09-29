/**
 * Login: hash da senha, sessões e os middlewares que protegem as rotas.
 *   exigirLogin              → só passa quem enviou um token válido (coloca o usuário em req.usuario)
 *   exigirPermissao("nome")  → só passa quem tem a permissão (veja permissoes.js)
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { pool } from "./db.js";
import { HttpError } from "./erros.js";
import { temPermissao } from "./permissoes.js";

const scryptAsync = promisify(scrypt);

/** Gera o hash da senha no formato "salt:hash". A senha em si nunca é gravada. */
export async function gerarHash(senha) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(senha, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}

export async function conferirSenha(senha, senhaHash) {
  const [salt, hash] = String(senhaHash).split(":");
  if (!salt || !hash) return false;
  const esperado = Buffer.from(hash, "hex");
  const calculado = await scryptAsync(senha, salt, 64);
  return esperado.length === calculado.length && timingSafeEqual(esperado, calculado);
}

// Sessões na memória da API: se a API reiniciar, basta entrar de novo.
const sessoes = new Map(); // token → { usuarioId, expira }
const DURACAO_MS = 8 * 60 * 60 * 1000; // 8 horas

export function criarSessao(usuarioId) {
  const agora = Date.now();
  for (const [token, sessao] of sessoes) if (sessao.expira < agora) sessoes.delete(token);

  const token = randomBytes(32).toString("hex");
  sessoes.set(token, { usuarioId, expira: agora + DURACAO_MS });
  return token;
}

export function encerrarSessao(token) {
  sessoes.delete(token);
}

/** Encerra as sessões do usuário (ex.: senha trocada), menos a do token informado. */
export function encerrarSessoesDoUsuario(usuarioId, manterToken = null) {
  for (const [token, sessao] of sessoes) {
    if (sessao.usuarioId === usuarioId && token !== manterToken) sessoes.delete(token);
  }
}

/** Lê o token do cabeçalho "Authorization: Bearer <token>". */
export function tokenDaRequisicao(req) {
  const [tipo, token] = String(req.headers.authorization || "").split(" ");
  return tipo === "Bearer" && token ? token : null;
}

export async function exigirLogin(req, res, next) {
  const token = tokenDaRequisicao(req);
  const sessao = token && sessoes.get(token);
  if (!sessao || sessao.expira < Date.now()) {
    if (token) sessoes.delete(token);
    throw new HttpError(401, "Sua sessão expirou. Entre novamente.");
  }

  // Busca no banco a cada pedido: usuário desativado ou com tipo alterado vale na hora
  const [linhas] = await pool.query("SELECT id, nome, tipo FROM usuarios WHERE id = ? AND ativo", [sessao.usuarioId]);
  if (!linhas.length) {
    sessoes.delete(token);
    throw new HttpError(401, "Usuário sem acesso. Entre novamente.");
  }
  req.usuario = linhas[0];
  next();
}

export const exigirPermissao = (permissao) => (req, res, next) => {
  if (!temPermissao(req.usuario, permissao)) {
    throw new HttpError(403, "Você não tem permissão para esta operação.");
  }
  next();
};
