/**
 * /api/vendas
 *   GET  /vendas               → todas, da mais recente para a mais antiga (com os itens)
 *   GET  /vendas?clienteId=<id> → vendas do cliente
 *   GET  /vendas/:id
 *   POST /vendas               → { clienteId, itens: [{ produtoId, quantidade, precoUnitario }], desconto }
 */
import { Router } from "express";
import { pool, transacao } from "../db.js";
import { HttpError, idDaRota } from "../erros.js";
import { centavos } from "../validacao.js";

const router = Router();

const QTD_MAX = 999;

/** Busca as vendas (filtro opcional) e anexa os itens de cada uma em `produtos`. */
async function buscarVendas(where = "", params = [], db = pool) {
  const [vendas] = await db.query(
    `SELECT id, LPAD(id, 6, '0') AS numero, cliente_id AS clienteId, data,
            subtotal, desconto, total, status
       FROM vendas ${where}
      ORDER BY data DESC, id DESC`,
    params
  );
  if (!vendas.length) return [];

  const [itens] = await db.query(
    `SELECT venda_id AS vendaId, produto_id AS produtoId, nome_produto AS nome, quantidade,
            preco_padrao AS precoPadrao, preco_unitario AS precoUnitario, subtotal
       FROM venda_itens
      WHERE venda_id IN (?)
      ORDER BY id`,
    [vendas.map((v) => v.id)]
  );

  const porVenda = new Map(vendas.map((v) => [v.id, (v.produtos = [])]));
  for (const { vendaId, ...item } of itens) porVenda.get(vendaId).push(item);
  return vendas;
}

router.get("/", async (req, res) => {
  if (req.query.clienteId === undefined) return res.json(await buscarVendas());
  const clienteId = Number(req.query.clienteId);
  if (!Number.isSafeInteger(clienteId)) return res.json([]);
  res.json(await buscarVendas("WHERE cliente_id = ?", [clienteId]));
});

router.get("/:id", async (req, res) => {
  const id = idDaRota(req.params.id, "Venda não encontrada.");
  const [venda] = await buscarVendas("WHERE id = ?", [id]);
  if (!venda) throw new HttpError(404, "Venda não encontrada.");
  res.json(venda);
});

router.post("/", async (req, res) => {
  const { clienteId, itens, desconto = 0 } = req.body ?? {};

  if (!Array.isArray(itens) || !itens.length) throw new HttpError(400, "Adicione pelo menos um produto.");
  for (const item of itens) {
    if (!Number.isInteger(item?.quantidade) || item.quantidade < 1 || item.quantidade > QTD_MAX) {
      throw new HttpError(400, `Quantidade inválida (use um número inteiro entre 1 e ${QTD_MAX}).`);
    }
    if (!(Number(item.precoUnitario) > 0)) throw new HttpError(400, "Preço unitário inválido.");
  }
  if (!(Number(desconto) >= 0)) throw new HttpError(400, "Desconto inválido.");

  const venda = await transacao(async (db) => {
    const [clientes] = await db.query("SELECT id FROM clientes WHERE id = ?", [clienteId]);
    if (!clientes.length) throw new HttpError(404, "Cliente não encontrado.");

    // Nome e preço padrão vêm do banco, nunca do navegador
    const ids = [...new Set(itens.map((i) => i.produtoId))];
    const [produtos] = await db.query("SELECT id, nome, preco_padrao FROM produtos WHERE ativo AND id IN (?)", [ids]);
    const produtoPorId = new Map(produtos.map((p) => [String(p.id), p]));

    const linhas = itens.map((item) => {
      const produto = produtoPorId.get(String(item.produtoId));
      if (!produto) throw new HttpError(400, "Produto não encontrado ou inativo.");
      const precoUnitario = centavos(item.precoUnitario);
      return { produto, quantidade: item.quantidade, precoUnitario, subtotal: centavos(item.quantidade * precoUnitario) };
    });

    const subtotal = centavos(linhas.reduce((acc, l) => acc + l.subtotal, 0));
    const descontoAplicado = centavos(desconto);
    if (descontoAplicado > subtotal) throw new HttpError(400, "O desconto não pode ser maior que o subtotal da venda.");

    const [resultado] = await db.query(
      "INSERT INTO vendas (cliente_id, data, subtotal, desconto, status) VALUES (?, ?, ?, ?, 'concluido')",
      [clientes[0].id, new Date(), subtotal, descontoAplicado]
    );
    const vendaId = resultado.insertId;

    await db.query(
      `INSERT INTO venda_itens (venda_id, produto_id, nome_produto, quantidade, preco_padrao, preco_unitario) VALUES ?`,
      [linhas.map((l) => [vendaId, l.produto.id, l.produto.nome, l.quantidade, l.produto.preco_padrao, l.precoUnitario])]
    );

    const [criada] = await buscarVendas("WHERE id = ?", [vendaId], db);
    return criada;
  });

  res.status(201).json(venda);
});

export default router;
