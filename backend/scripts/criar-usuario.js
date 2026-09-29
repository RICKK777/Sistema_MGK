/**
 * Cria um usuário do sistema (use para criar o primeiro admin).
 * Rodar na pasta backend:  npm run criar-usuario
 * A senha é gravada somente como hash (veja src/auth.js).
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { pool } from "../src/db.js";
import { gerarHash } from "../src/auth.js";
import { TIPOS } from "../src/permissoes.js";

const rl = createInterface({ input: stdin, output: stdout });
const perguntar = async (texto) => (await rl.question(texto)).trim();

try {
  const nome = await perguntar("Nome: ");
  const usuario = await perguntar("Usuário (para entrar no sistema): ");
  const email = (await perguntar("E-mail (opcional): ")) || null;
  const tipo = (await perguntar(`Tipo (${TIPOS.join(", ")}): `)).toLowerCase();
  const senha = await perguntar("Senha (mínimo 6 caracteres): ");

  if (nome.length < 3) throw new Error("Informe o nome (mínimo 3 caracteres).");
  if (!/^[\w.\-]{3,60}$/.test(usuario)) throw new Error("Usuário inválido (3 a 60 letras, números, ponto, traço ou _).");
  if (!TIPOS.includes(tipo)) throw new Error(`Tipo inválido. Use: ${TIPOS.join(", ")}.`);
  if (senha.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");

  await pool.query("INSERT INTO usuarios SET ?", [{ nome, usuario, email, tipo, senha_hash: await gerarHash(senha) }]);
  console.log(`\nUsuário "${usuario}" (${tipo}) criado.`);
} catch (err) {
  console.error("\nNão foi possível criar o usuário:", err.code === "ER_DUP_ENTRY" ? "usuário ou e-mail já existe." : err.message);
  process.exitCode = 1;
} finally {
  rl.close();
  await pool.end();
}
