/**
 * API do Sistema MGK.
 * Iniciar: npm start   (lê as configurações do arquivo .env)
 */
import express from "express";
import { pool } from "./db.js";
import { HttpError } from "./erros.js";
import clientes from "./rotas/clientes.js";
import produtos from "./rotas/produtos.js";
import vendas from "./rotas/vendas.js";

const PORT = Number(process.env.PORT || 3000);
const ORIGENS = String(process.env.CORS_ORIGIN || "*").split(",").map((o) => o.trim());

const app = express();

// CORS: permite que o site (em outro endereço/porta) chame a API
app.use((req, res, next) => {
  const origem = req.headers.origin;
  if (ORIGENS.includes("*")) res.set("Access-Control-Allow-Origin", "*");
  else if (origem && ORIGENS.includes(origem)) res.set({ "Access-Control-Allow-Origin": origem, Vary: "Origin" });
  res.set({ "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Accept" });
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "100kb" }));

/** Teste rápido: abra http://localhost:3000/api/saude no navegador. */
app.get("/api/saude", async (req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true, banco: "conectado" });
});

app.use("/api/clientes", clientes);
app.use("/api/produtos", produtos);
app.use("/api/vendas", vendas);

app.use((req, res) => res.status(404).json({ erro: "Rota não encontrada." }));

// Todos os erros viram { erro: "mensagem" }, que o site mostra ao usuário
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ erro: err.message });
  if (err.type === "entity.parse.failed") return res.status(400).json({ erro: "JSON inválido." });
  if (["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "ER_ACCESS_DENIED_ERROR", "ER_BAD_DB_ERROR"].includes(err.code)) {
    console.error("[MGK] Sem acesso ao banco:", err.code, err.message);
    return res.status(503).json({ erro: "Banco de dados indisponível. Tente novamente em instantes." });
  }
  console.error("[MGK] Erro inesperado:", err);
  res.status(500).json({ erro: "Erro interno no servidor." });
});

app.listen(PORT, async () => {
  console.log(`[MGK] API rodando em http://localhost:${PORT}/api`);
  try {
    await pool.query("SELECT 1");
    console.log(`[MGK] Conectado ao MySQL em ${process.env.DB_HOST}:${process.env.DB_PORT || 3306} (banco "${process.env.DB_NAME}")`);
  } catch (err) {
    console.error(`[MGK] NÃO foi possível conectar ao MySQL (${err.code}). Confira DB_HOST, DB_USER e DB_PASSWORD no .env.`);
  }
});
