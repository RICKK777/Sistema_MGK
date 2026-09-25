/**
 * Conexão com o MySQL. Os dados de acesso vêm do arquivo .env (DB_HOST, DB_USER...).
 */
import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || "mgk",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true, // DECIMAL chega como número (50) e não como texto ("50.00")
  timezone: "Z", // datas lidas/gravadas em UTC → JSON no formato ISO "2026-09-15T15:00:00.000Z"
});

// CURRENT_TIMESTAMP (criado_em, atualizado_em) também em UTC, igual às datas gravadas pela API
pool.pool.on("connection", (conexao) => {
  conexao.query("SET time_zone = '+00:00'");
});

/** Executa `trabalho(conexao)` dentro de uma transação: tudo é gravado ou nada é. */
export async function transacao(trabalho) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    const resultado = await trabalho(conexao);
    await conexao.commit();
    return resultado;
  } catch (err) {
    await conexao.rollback();
    throw err;
  } finally {
    conexao.release();
  }
}
