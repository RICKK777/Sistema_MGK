/**
 * /api/vendas
 *   GET  /vendas                 → todas, da mais recente para a mais antiga (com itens e pagamentos)
 *   GET  /vendas?clienteId=<id>  → vendas do cliente
 *   GET  /vendas/:id
 *   POST /vendas                 → { clienteId, itens: [{ produtoId, quantidade, precoUnitario }], desconto,
 *                                    pagamento: { valor, forma } }   (valor pago NA HORA; 0 = paga depois)
 *                                  Valor acima do total abate a conta em aberto do cliente; a resposta traz
 *                                  `abatimentos: [{ vendaId, numero, valor }]`.
 *   POST /vendas/:id/pagamentos  → { valor, forma, data, observacao }  (cliente pagou mais uma parte)
 * Permissões: GET é livre para quem está logado; cadastrar_venda (POST /vendas),
 *             registrar_pagamento (POST /vendas/:id/pagamentos)
 */
import { Router } from "express";
import { pool, transacao } from "../db.js";
import { HttpError, idDaRota } from "../erros.js";
import { exigirPermissao } from "../auth.js";
import { centavos, validarPagamento } from "../validacao.js";

const router = Router();

const QTD_MAX = 999;

/** Busca as vendas (filtro opcional) e anexa os itens em `produtos` e os pagamentos em `pagamentos`. */
async function buscarVendas(where = "", params = [], db = pool) {
  const [vendas] = await db.query(
    `SELECT id, LPAD(id, 6, '0') AS numero, cliente_id AS clienteId, data,
            subtotal, desconto, total, status
       FROM vendas ${where}
      ORDER BY data DESC, id DESC`,
    params
  );
  if (!vendas.length) return [];
  const ids = vendas.map((v) => v.id);

  const [itens] = await db.query(
    `SELECT venda_id AS vendaId, produto_id AS produtoId, nome_produto AS nome, quantidade,
            preco_padrao AS precoPadrao, preco_unitario AS precoUnitario, subtotal
       FROM venda_itens
      WHERE venda_id IN (?)
      ORDER BY id`,
    [ids]
  );

  const [pagamentos] = await db.query(
    `SELECT id, venda_id AS vendaId, data, valor, forma, observacao
       FROM pagamentos
      WHERE venda_id IN (?)
      ORDER BY data, id`,
    [ids]
  );

  const porVenda = new Map(vendas.map((v) => [v.id, v]));
  vendas.forEach((v) => {
    v.produtos = [];
    v.pagamentos = [];
  });
  for (const { vendaId, ...item } of itens) porVenda.get(vendaId).produtos.push(item);
  for (const { vendaId, ...pagamento } of pagamentos) porVenda.get(vendaId).pagamentos.push(pagamento);
  return vendas;
}

async function buscarPorId(id, db = pool) {
  const [venda] = await buscarVendas("WHERE id = ?", [id], db);
  if (!venda) throw new HttpError(404, "Venda não encontrada.");
  return venda;
}

router.get("/", async (req, res) => {
  if (req.query.clienteId === undefined) return res.json(await buscarVendas());
  const clienteId = Number(req.query.clienteId);
  if (!Number.isSafeInteger(clienteId)) return res.json([]);
  res.json(await buscarVendas("WHERE cliente_id = ?", [clienteId]));
});

router.get("/:id", async (req, res) => {
  res.json(await buscarPorId(idDaRota(req.params.id, "Venda não encontrada.")));
});

router.post("/", exigirPermissao("cadastrar_venda"), async (req, res) => {
  const { clienteId, itens, desconto = 0, pagamento = { valor: 0 } } = req.body ?? {};

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

    // Conta em aberto do cliente (vendas antigas com saldo), da mais antiga para a mais recente.
    // FOR UPDATE trava essas vendas até o COMMIT, para ninguém pagar a mesma conta ao mesmo tempo.
    const [anteriores] = await db.query(
      `SELECT id, LPAD(id, 6, '0') AS numero, total
         FROM vendas
        WHERE cliente_id = ? AND status <> 'cancelado'
        ORDER BY data, id
          FOR UPDATE`,
      [clientes[0].id]
    );
    const pagoPorVenda = new Map();
    if (anteriores.length) {
      const [somas] = await db.query(
        "SELECT venda_id AS vendaId, SUM(valor) AS pago FROM pagamentos WHERE venda_id IN (?) GROUP BY venda_id",
        [anteriores.map((v) => v.id)]
      );
      somas.forEach((s) => pagoPorVenda.set(s.vendaId, Number(s.pago)));
    }
    const abertas = anteriores
      .map((v) => ({ ...v, saldo: centavos(Math.max(v.total - (pagoPorVenda.get(v.id) || 0), 0)) }))
      .filter((v) => v.saldo > 0);
    const contaAnterior = centavos(abertas.reduce((acc, v) => acc + v.saldo, 0));

    // O pagamento feito na hora é validado contra o total calculado aqui, não o do navegador.
    // Pode passar do total da venda até o valor da conta anterior: a diferença abate essa conta.
    const total = centavos(subtotal - descontoAplicado);
    const { erro, dados: pago } = validarPagamento(pagamento ?? {}, centavos(total + contaAnterior), { permitirZero: true });
    if (erro) throw new HttpError(400, erro);

    const agora = new Date();
    const [resultado] = await db.query(
      "INSERT INTO vendas (cliente_id, data, subtotal, desconto, status) VALUES (?, ?, ?, ?, 'concluido')",
      [clientes[0].id, agora, subtotal, descontoAplicado]
    );
    const vendaId = resultado.insertId;

    await db.query(
      `INSERT INTO venda_itens (venda_id, produto_id, nome_produto, quantidade, preco_padrao, preco_unitario) VALUES ?`,
      [linhas.map((l) => [vendaId, l.produto.id, l.produto.nome, l.quantidade, l.produto.preco_padrao, l.precoUnitario])]
    );

    // Primeiro quita esta venda; o que sobrar abate as vendas antigas, da mais antiga para a mais recente
    const naVenda = centavos(Math.min(pago.valor, total));
    let sobra = centavos(pago.valor - naVenda);
    const numero = String(vendaId).padStart(6, "0");
    const lancamentos = naVenda > 0 ? [[vendaId, agora, naVenda, pago.forma, "Pago na venda"]] : [];
    const abatimentos = [];
    for (const antiga of abertas) {
      if (sobra <= 0) break;
      const valor = centavos(Math.min(sobra, antiga.saldo));
      lancamentos.push([antiga.id, agora, valor, pago.forma, `Abatido na venda #${numero}`]);
      abatimentos.push({ vendaId: antiga.id, numero: antiga.numero, valor });
      sobra = centavos(sobra - valor);
    }
    if (lancamentos.length) {
      await db.query("INSERT INTO pagamentos (venda_id, data, valor, forma, observacao) VALUES ?", [lancamentos]);
    }

    return { ...(await buscarPorId(vendaId, db)), abatimentos };
  });

  res.status(201).json(venda);
});

router.post("/:id/pagamentos", exigirPermissao("registrar_pagamento"), async (req, res) => {
  const id = idDaRota(req.params.id, "Venda não encontrada.");

  const venda = await transacao(async (db) => {
    // FOR UPDATE: dois pagamentos ao mesmo tempo não conseguem passar do saldo
    const [vendas] = await db.query("SELECT id, data, total, status FROM vendas WHERE id = ? FOR UPDATE", [id]);
    if (!vendas.length) throw new HttpError(404, "Venda não encontrada.");
    const atual = vendas[0];
    if (atual.status === "cancelado") throw new HttpError(400, "Venda cancelada não recebe pagamentos.");

    const [[{ pago }]] = await db.query("SELECT COALESCE(SUM(valor), 0) AS pago FROM pagamentos WHERE venda_id = ?", [id]);
    const saldo = centavos(Math.max(atual.total - pago, 0));
    if (saldo === 0) throw new HttpError(400, "Esta venda já está quitada.");

    const { erro, dados } = validarPagamento(req.body ?? {}, saldo);
    if (erro) throw new HttpError(400, erro);

    const quando = req.body?.data ? new Date(req.body.data) : new Date();
    if (Number.isNaN(quando.getTime())) throw new HttpError(400, "Data do pagamento inválida.");
    // Pode ser anterior à data da venda: pagamentos antigos (ex.: da planilha do Excel) são lançados depois
    if (quando.getTime() > Date.now() + 5 * 60 * 1000) throw new HttpError(400, "A data do pagamento não pode ser no futuro.");

    await db.query(
      "INSERT INTO pagamentos (venda_id, data, valor, forma, observacao) VALUES (?, ?, ?, ?, ?)",
      [id, quando, dados.valor, dados.forma, dados.observacao]
    );
    return buscarPorId(id, db);
  });

  res.status(201).json(venda);
});

export default router;
