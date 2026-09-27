/**
 * Tela: Cadastro de Venda
 * Cliente → produtos → quantidade → preço praticado → total → finalizar.
 * - venda.html               → nova venda
 * - venda.html?cliente=<id>  → nova venda com o cliente já selecionado
 *
 * O preço unitário digitado aqui é o preço PRATICADO nesta venda; o preço padrão do produto
 * (MGK.produtos) não é alterado.
 */
(function () {
  "use strict";

  const { clientes, produtos, vendas, format, escapeHtml, initials, mesmoId, ui } = window.MGK;

  const QTD_MAX = 999;
  const $ = (id) => document.getElementById(id);

  const el = {
    form: $("formVenda"),
    busca: $("buscaCliente"),
    buscaGrupo: $("clienteBuscaGrupo"),
    lista: $("listaClientes"),
    clienteFeedback: $("clienteFeedback"),
    selecionado: $("clienteSelecionado"),
    produtoNovo: $("produtoNovo"),
    produtoNovoFoto: $("produtoNovoFoto"),
    qtdNova: $("qtdNova"),
    tbody: $("itensVenda"),
    tabela: document.querySelector(".sale-items"),
    vazio: $("itensVazio"),
    desconto: $("desconto"),
  };

  /** Estado da venda em edição. */
  const venda = {
    cliente: null,
    itens: [], // { uid, produtoId, quantidade, precoUnitario }
  };
  let proximoUid = 1;

  let catalogo = []; // carregado em iniciar()

  // Compras anteriores do cliente ainda não pagas (MGK.vendas.contaEmAberto), carregadas ao escolher o cliente
  let contaAnterior = { saldo: 0, vendas: [] };
  const produtoPorId = (id) => catalogo.find((p) => mesmoId(p.id, id));

  const quantidadeValida = (q) => Number.isInteger(q) && q >= 1 && q <= QTD_MAX;

  /* ------------------------------------------------------------------------
     1. Cliente (busca por nome ou CPF/CNPJ)
     ------------------------------------------------------------------------ */
  let opcoes = [];
  let ativa = -1;

  const descricaoCliente = (c) => `${format.tipoDocumento(c.documento)}: ${format.documento(c.documento)}`;

  const abrirLista = (aberta) => {
    el.lista.hidden = !aberta;
    el.busca.setAttribute("aria-expanded", String(aberta));
  };

  const marcarAtiva = (indice) => {
    ativa = indice;
    el.lista.querySelectorAll(".client-option").forEach((li, i) => {
      li.classList.toggle("active", i === ativa);
      li.setAttribute("aria-selected", String(i === ativa));
      if (i === ativa) li.scrollIntoView({ block: "nearest" });
    });
    el.busca.setAttribute("aria-activedescendant", ativa >= 0 ? `opcaoCliente${ativa}` : "");
  };

  let buscaAtual = 0; // descarta respostas de buscas antigas que cheguem atrasadas

  const renderOpcoes = async () => {
    const minhaBusca = ++buscaAtual;
    let encontrados;
    try {
      encontrados = await clientes.buscar(el.busca.value);
    } catch (err) {
      if (minhaBusca === buscaAtual) ui.toast(err.message || "Não foi possível buscar os clientes.", "error");
      return;
    }
    if (minhaBusca !== buscaAtual) return;

    opcoes = encontrados.slice(0, 8);
    ativa = -1;
    el.lista.innerHTML = opcoes.length
      ? opcoes.map((c, i) => `
          <li class="client-option" id="opcaoCliente${i}" role="option" aria-selected="false" data-id="${escapeHtml(c.id)}">
            <span class="avatar">${escapeHtml(initials(c.nome))}</span>
            <span class="client-option-text">
              <span class="client-name">${escapeHtml(c.nome)}</span>
              <span class="client-email text-mono">${escapeHtml(descricaoCliente(c))}</span>
            </span>
            ${c.status === "inativo" ? '<span class="status-badge status-inativo">Inativo</span>' : ""}
          </li>`).join("")
      : `<li class="client-option-empty">
           Nenhum cliente encontrado. <a href="cadastro-cliente.html">Cadastrar novo cliente</a>
         </li>`;
    abrirLista(true);
  };

  /** Recebe o cliente já carregado (da lista de opções ou da URL). */
  const selecionarCliente = (c) => {
    if (!c) return;
    venda.cliente = c;

    $("clienteAvatar").textContent = initials(c.nome);
    $("clienteNome").innerHTML = `${escapeHtml(c.nome)}${c.status === "inativo" ? ' <span class="status-badge status-inativo ms-1">Inativo</span>' : ""}`;
    $("clienteMeta").innerHTML = [
      `<span class="text-mono">${escapeHtml(descricaoCliente(c))}</span>`,
      c.celular || c.telefone ? `<span class="text-mono">${escapeHtml(format.telefone(c.celular || c.telefone))}</span>` : "",
      c.email ? `<span>${escapeHtml(c.email)}</span>` : "",
      c.cidade ? `<span>${escapeHtml([c.cidade, c.estado].filter(Boolean).join(" / "))}</span>` : "",
    ].filter(Boolean).join("");

    el.buscaGrupo.hidden = true;
    el.selecionado.hidden = false;
    el.busca.classList.remove("is-invalid");
    el.clienteFeedback.classList.remove("d-block");
    abrirLista(false);
    carregarContaAnterior(c);
  };

  const trocarCliente = () => {
    venda.cliente = null;
    carregarContaAnterior(null);
    el.selecionado.hidden = true;
    el.buscaGrupo.hidden = false;
    el.busca.value = "";
    el.busca.focus();
    renderOpcoes();
  };

  el.busca.addEventListener("input", renderOpcoes);
  el.busca.addEventListener("focus", renderOpcoes);
  // Pequeno atraso para o clique na opção ser processado antes de fechar a lista
  el.busca.addEventListener("blur", () => setTimeout(() => abrirLista(false), 150));

  el.busca.addEventListener("keydown", (event) => {
    if (el.lista.hidden && event.key === "ArrowDown") {
      event.preventDefault();
      renderOpcoes().then(() => marcarAtiva(opcoes.length ? 0 : -1));
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      marcarAtiva(Math.min(ativa + 1, opcoes.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      marcarAtiva(Math.max(ativa - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const escolhido = opcoes[ativa >= 0 ? ativa : 0];
      if (escolhido && (ativa >= 0 || opcoes.length === 1)) selecionarCliente(escolhido);
    } else if (event.key === "Escape") {
      abrirLista(false);
    }
  });

  el.lista.addEventListener("mousedown", (event) => {
    const li = event.target.closest(".client-option");
    if (!li) return;
    event.preventDefault();
    selecionarCliente(opcoes.find((c) => mesmoId(c.id, li.dataset.id)));
  });

  $("btnTrocarCliente").addEventListener("click", trocarCliente);

  /* ------------------------------------------------------------------------
     2. Produtos da venda
     ------------------------------------------------------------------------ */
  // Na linha do item o preço padrão já aparece abaixo do campo de preço, então o select mostra só o nome
  const opcoesProduto = (selecionado, comPreco = true) =>
    catalogo.map((p) => `
      <option value="${escapeHtml(p.id)}"${mesmoId(p.id, selecionado) ? " selected" : ""}>
        ${escapeHtml(p.nome)}${comPreco ? ` — ${format.moeda(p.precoPadrao)}` : ""}
      </option>`).join("");

  /** Miniatura do produto. Com foto, é um botão que abre a foto ampliada. */
  const fotoProduto = (produto) =>
    produto?.foto
      ? `<button type="button" class="product-thumb-btn" data-foto-id="${escapeHtml(produto.id)}"
                 title="Ver foto" aria-label="Ver foto de ${escapeHtml(produto.nome)}">
           <img class="product-thumb" src="${escapeHtml(produto.foto)}" alt="">
         </button>`
      : '<span class="product-thumb product-thumb-empty" aria-hidden="true"><i class="bi bi-image"></i></span>';

  const mostrarFotoNova = () => {
    el.produtoNovoFoto.innerHTML = fotoProduto(produtoPorId(el.produtoNovo.value));
  };

  const modalFoto = $("modalFotoProduto");
  const abrirFoto = (id) => {
    const produto = produtoPorId(id);
    if (!produto?.foto) return;
    $("modalFotoTitulo").textContent = produto.nome;
    $("modalFotoImg").src = produto.foto;
    $("modalFotoImg").alt = `Foto de ${produto.nome}`;
    $("modalFotoPreco").textContent = `Preço padrão: ${format.moeda(produto.precoPadrao)}`;
    bootstrap.Modal.getOrCreateInstance(modalFoto).show();
  };

  document.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-foto-id]");
    if (btn) abrirFoto(btn.dataset.fotoId);
  });

  const linhaItem = (item) => {
    const produto = produtoPorId(item.produtoId);
    return `
      <tr data-uid="${item.uid}">
        <td data-label="Produto">
          <label class="visually-hidden" for="produto-${item.uid}">Produto</label>
          <div class="product-pick">
            ${fotoProduto(produto)}
            <select class="form-select item-produto" id="produto-${item.uid}">${opcoesProduto(item.produtoId, false)}</select>
          </div>
        </td>
        <td data-label="Quantidade" class="col-qtd">
          <label class="visually-hidden" for="qtd-${item.uid}">Quantidade</label>
          <input type="number" class="form-control text-mono item-qtd" id="qtd-${item.uid}"
                 min="1" max="${QTD_MAX}" step="1" inputmode="numeric" value="${item.quantidade}">
        </td>
        <td data-label="Preço unitário" class="col-preco">
          <label class="visually-hidden" for="preco-${item.uid}">Preço unitário praticado</label>
          <div class="input-group">
            <span class="input-group-text">R$</span>
            <input type="text" class="form-control text-mono text-end item-preco" id="preco-${item.uid}"
                   inputmode="numeric" value="${format.moedaInput(Math.round(item.precoUnitario * 100))}">
          </div>
          <div class="price-default">
            Padrão: ${format.moeda(produto.precoPadrao)}
            <span class="price-changed" hidden>
              · <strong>alterado</strong>
              <button type="button" class="btn btn-link item-restaurar">restaurar</button>
            </span>
          </div>
        </td>
        <td data-label="Subtotal" class="text-end text-mono item-subtotal"></td>
        <td class="text-end item-acao">
          <button type="button" class="btn btn-outline-mgk btn-icon item-remover" title="Remover"
                  aria-label="Remover ${escapeHtml(produto.nome)}">
            <i class="bi bi-trash3"></i>
          </button>
        </td>
      </tr>`;
  };

  const itemDaLinha = (tr) => venda.itens.find((i) => i.uid === Number(tr.dataset.uid));

  /** Atualiza subtotal, indicador de preço alterado e validação de uma linha, sem redesenhar os campos. */
  const atualizarLinha = (tr) => {
    const item = itemDaLinha(tr);
    const produto = produtoPorId(item.produtoId);
    const qtdOk = quantidadeValida(item.quantidade);
    const precoOk = item.precoUnitario > 0;

    tr.querySelector(".item-qtd").classList.toggle("is-invalid", !qtdOk);
    tr.querySelector(".item-preco").classList.toggle("is-invalid", !precoOk);
    tr.querySelector(".price-changed").hidden = item.precoUnitario === produto.precoPadrao;
    tr.querySelector(".item-subtotal").textContent =
      qtdOk && precoOk ? format.moeda(item.quantidade * item.precoUnitario) : "—";
  };

  const renderItens = () => {
    el.tbody.innerHTML = venda.itens.map(linhaItem).join("");
    el.tbody.querySelectorAll("tr").forEach(atualizarLinha);
    el.tabela.hidden = venda.itens.length === 0;
    el.vazio.hidden = venda.itens.length > 0;
    atualizarResumo();
  };

  const adicionarProduto = () => {
    const produto = produtoPorId(el.produtoNovo.value);
    const quantidade = Number(el.qtdNova.value);

    el.produtoNovo.classList.toggle("is-invalid", !produto);
    el.qtdNova.classList.toggle("is-invalid", !quantidadeValida(quantidade));
    if (!produto) {
      ui.toast("Selecione um produto para adicionar.", "error");
      el.produtoNovo.focus();
      return;
    }
    if (!quantidadeValida(quantidade)) {
      ui.toast(`Informe uma quantidade entre 1 e ${QTD_MAX}.`, "error");
      el.qtdNova.focus();
      return;
    }

    // Se o produto já está na venda, soma a quantidade na mesma linha
    const existente = venda.itens.find((i) => mesmoId(i.produtoId, produto.id));
    if (existente) {
      existente.quantidade = Math.min((quantidadeValida(existente.quantidade) ? existente.quantidade : 0) + quantidade, QTD_MAX);
      ui.toast(`${produto.nome}: quantidade atualizada para ${existente.quantidade}.`);
    } else {
      venda.itens.push({ uid: proximoUid++, produtoId: produto.id, quantidade, precoUnitario: produto.precoPadrao });
    }

    renderItens();
    el.produtoNovo.value = "";
    mostrarFotoNova();
    el.qtdNova.value = "1";
    el.produtoNovo.focus();
  };

  $("btnAdicionarProduto").addEventListener("click", adicionarProduto);
  el.produtoNovo.addEventListener("change", () => {
    el.produtoNovo.classList.remove("is-invalid");
    mostrarFotoNova();
  });

  el.tbody.addEventListener("input", (event) => {
    const tr = event.target.closest("tr");
    const item = itemDaLinha(tr);

    if (event.target.matches(".item-qtd")) {
      item.quantidade = Number(event.target.value);
    } else if (event.target.matches(".item-preco")) {
      event.target.value = format.moedaInput(event.target.value);
      item.precoUnitario = format.parseMoeda(event.target.value);
    } else {
      return;
    }
    atualizarLinha(tr);
    atualizarResumo();
  });

  el.tbody.addEventListener("change", (event) => {
    if (!event.target.matches(".item-produto")) return;
    const item = itemDaLinha(event.target.closest("tr"));
    const produto = produtoPorId(event.target.value);
    // Ao trocar o produto, o preço volta ao preço padrão do novo produto
    item.produtoId = produto.id;
    item.precoUnitario = produto.precoPadrao;
    renderItens();
    $(`produto-${item.uid}`).focus();
  });

  el.tbody.addEventListener("click", (event) => {
    const tr = event.target.closest("tr");
    if (!tr) return;
    const item = itemDaLinha(tr);

    if (event.target.closest(".item-remover")) {
      venda.itens = venda.itens.filter((i) => i !== item);
      renderItens();
    } else if (event.target.closest(".item-restaurar")) {
      item.precoUnitario = produtoPorId(item.produtoId).precoPadrao;
      tr.querySelector(".item-preco").value = format.moedaInput(Math.round(item.precoUnitario * 100));
      atualizarLinha(tr);
      atualizarResumo();
    }
  });

  /* ------------------------------------------------------------------------
     3. Resumo e total
     ------------------------------------------------------------------------ */
  const calcularVenda = () =>
    vendas.calcular(
      venda.itens.map((i) => ({
        quantidade: quantidadeValida(i.quantidade) ? i.quantidade : 0,
        precoUnitario: i.precoUnitario > 0 ? i.precoUnitario : 0,
      })),
      format.parseMoeda(el.desconto.value)
    );

  function atualizarResumo() {
    const calculo = calcularVenda();
    const descontoDigitado = format.parseMoeda(el.desconto.value);
    const descontoInvalido = descontoDigitado > calculo.subtotal;

    el.desconto.classList.toggle("is-invalid", descontoInvalido);
    $("resumoItens").textContent = venda.itens.reduce((acc, i) => acc + (quantidadeValida(i.quantidade) ? i.quantidade : 0), 0);
    $("resumoSubtotal").textContent = format.moeda(calculo.subtotal);
    $("resumoDesconto").textContent = calculo.desconto ? `− ${format.moeda(calculo.desconto)}` : format.moeda(0);
    $("resumoTotal").textContent = format.moeda(calculo.total);
    return { ...calculo, descontoInvalido, pagamento: atualizarPagamento(calculo.total) };
  }

  el.desconto.addEventListener("input", () => {
    el.desconto.value = format.moedaInput(el.desconto.value);
    atualizarResumo();
  });

  /* ------------------------------------------------------------------------
     4. Pagamento
     "Pago integral": o cliente paga o total agora.
     "Outro valor":
       - menos que o total (ou nada): o restante fica em aberto e é registrado depois, na
         ficha do cliente → detalhes da venda → Registrar pagamento;
       - mais que o total: a diferença abate a conta anterior em aberto do cliente, começando
         pelo pedido mais antigo (limite: total desta venda + conta anterior).
     ------------------------------------------------------------------------ */
  const pag = {
    integral: $("pagIntegral"),
    parcial: $("pagParcial"),
    valor: $("valorPago"),
    grupoValor: $("grupoValorPago"),
    forma: $("formaPagamento"),
    grupoForma: $("grupoFormaPagamento"),
  };

  pag.forma.insertAdjacentHTML(
    "beforeend",
    Object.entries(vendas.FORMAS_PAGAMENTO).map(([valor, nome]) => `<option value="${valor}">${escapeHtml(nome)}</option>`).join("")
  );

  const centavosPositivos = (valor) => Math.max(Math.round(valor * 100) / 100, 0);

  const MAX_PEDIDOS_LISTADOS = 5;

  /** Mostra o aviso de conta anterior em aberto (e o atalho "Receber tudo"). */
  const renderContaAnterior = (maximo) => {
    const { saldo, vendas: abertas } = contaAnterior;
    $("contaAnterior").hidden = saldo === 0;
    if (saldo === 0) return;

    const numeros = abertas.slice(0, MAX_PEDIDOS_LISTADOS).map((a) => `#${a.venda.numero}`).join(", ");
    const resto = abertas.length > MAX_PEDIDOS_LISTADOS ? ` e mais ${abertas.length - MAX_PEDIDOS_LISTADOS}` : "";
    $("contaAnteriorValor").textContent = format.moeda(saldo);
    $("contaAnteriorPedidos").textContent =
      `${abertas.length} ${abertas.length === 1 ? "pedido" : "pedidos"}: ${numeros}${resto}. ` +
      "Pagando mais que o total desta venda, a diferença abate essa conta.";
    $("btnReceberTudo").textContent = `Receber tudo agora (${format.moeda(maximo)})`;
  };

  /** Mostra os campos conforme a opção e calcula quanto é pago agora, quanto abate a conta anterior e quanto fica em aberto. */
  function atualizarPagamento(total) {
    const integral = pag.integral.checked;
    const conta = contaAnterior.saldo;
    const maximo = centavosPositivos(total + conta);
    const pago = integral ? total : format.parseMoeda(pag.valor.value);
    const excedeu = !integral && pago > maximo;
    const { naVenda, abatimentos } = vendas.distribuirPagamento(excedeu ? 0 : pago, total, contaAnterior);
    const abate = centavosPositivos(abatimentos.reduce((acc, a) => acc + a.valor, 0));
    const aberto = centavosPositivos(total - naVenda);
    const contaRestante = centavosPositivos(conta - abate);

    renderContaAnterior(maximo);
    pag.grupoValor.hidden = integral;
    pag.grupoForma.hidden = !integral && !(pago > 0); // nada pago agora → sem forma de pagamento
    pag.valor.classList.toggle("is-invalid", excedeu);
    $("valorPagoFeedback").textContent = conta > 0
      ? `Máximo: ${format.moeda(maximo)} (esta venda + conta anterior).`
      : "O valor pago não pode ser maior que o total (o cliente não tem conta anterior em aberto).";
    $("valorPagoAjuda").textContent = conta > 0
      ? "Menos que o total: o resto fica em aberto. Mais que o total: a diferença abate a conta anterior, do pedido mais antigo para o mais recente."
      : "Deixe em branco se o cliente vai pagar tudo depois.";

    $("resumoPago").textContent = format.moeda(pago);
    $("linhaAbate").hidden = abate === 0;
    $("resumoAbate").textContent = format.moeda(abate);
    $("resumoAberto").textContent = format.moeda(aberto);
    $("linhaAberto").classList.toggle("has-open", aberto > 0);
    $("linhaContaRestante").hidden = conta === 0;
    $("resumoContaRestante").textContent = format.moeda(contaRestante);
    $("linhaContaRestante").classList.toggle("has-open", contaRestante > 0);
    return { pago, excedeu, aberto, abate };
  }

  let cargaConta = 0; // descarta respostas antigas ao trocar de cliente rapidamente

  /** Busca as compras anteriores do cliente e calcula a conta em aberto. */
  async function carregarContaAnterior(cliente) {
    const minhaCarga = ++cargaConta;
    contaAnterior = { saldo: 0, vendas: [] };
    atualizarResumo();
    if (!cliente) return;

    try {
      const compras = await vendas.porCliente(cliente.id);
      if (minhaCarga !== cargaConta) return;
      contaAnterior = vendas.contaEmAberto(compras);
      atualizarResumo();
    } catch (err) {
      // Sem a conta anterior, a venda continua funcionando; o servidor valida o limite ao finalizar
      console.warn("[MGK] Não foi possível carregar a conta em aberto do cliente.", err);
    }
  }

  $("btnReceberTudo").addEventListener("click", () => {
    const { total } = calcularVenda();
    pag.parcial.checked = true;
    pag.valor.value = format.moedaInput(Math.round((total + contaAnterior.saldo) * 100));
    atualizarResumo();
    (pag.forma.value ? pag.valor : pag.forma).focus();
  });

  [pag.integral, pag.parcial].forEach((radio) =>
    radio.addEventListener("change", () => {
      atualizarResumo();
      if (pag.parcial.checked) pag.valor.focus();
    })
  );

  pag.valor.addEventListener("input", () => {
    pag.valor.value = format.moedaInput(pag.valor.value);
    atualizarResumo();
  });

  pag.forma.addEventListener("change", () => pag.forma.classList.remove("is-invalid"));

  const limparPagamento = () => {
    pag.integral.checked = true;
    pag.valor.value = "";
    pag.forma.value = "";
    pag.forma.classList.remove("is-invalid");
  };

  /* ------------------------------------------------------------------------
     5. Finalizar venda
     ------------------------------------------------------------------------ */
  const validarVenda = () => {
    if (!venda.cliente) {
      el.busca.classList.add("is-invalid");
      el.clienteFeedback.classList.add("d-block");
      el.busca.focus();
      return "Selecione o cliente que realizou a compra.";
    }
    if (!venda.itens.length) {
      el.produtoNovo.focus();
      return "Adicione pelo menos um produto à venda.";
    }

    el.tbody.querySelectorAll("tr").forEach(atualizarLinha);
    const invalido = el.tbody.querySelector(".is-invalid");
    if (invalido) {
      invalido.focus();
      return invalido.matches(".item-qtd")
        ? `Informe uma quantidade válida (número inteiro entre 1 e ${QTD_MAX}).`
        : "Informe um preço unitário maior que zero.";
    }

    const resumo = atualizarResumo();
    if (resumo.descontoInvalido) {
      el.desconto.focus();
      return "O desconto não pode ser maior que o subtotal da venda.";
    }
    if (resumo.pagamento.excedeu) {
      pag.valor.focus();
      return contaAnterior.saldo > 0
        ? `O valor pago não pode passar de ${format.moeda(resumo.total + contaAnterior.saldo)} (esta venda + conta anterior).`
        : "O valor pago não pode ser maior que o total da venda.";
    }
    if (resumo.pagamento.pago > 0 && !pag.forma.value) {
      pag.forma.classList.add("is-invalid");
      pag.forma.focus();
      return "Selecione a forma de pagamento.";
    }
    return null;
  };

  el.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const btn = $("btnFinalizar");
    if (btn.disabled) return; // evita registrar a mesma venda duas vezes

    const erro = validarVenda();
    if (erro) {
      ui.toast(erro, "error");
      return;
    }

    btn.disabled = true;
    try {
      const { pago } = atualizarResumo().pagamento;
      const registrada = await vendas.registrar({
        clienteId: venda.cliente.id,
        itens: venda.itens.map(({ produtoId, quantidade, precoUnitario }) => ({ produtoId, quantidade, precoUnitario })),
        desconto: format.parseMoeda(el.desconto.value),
        pagamento: pago > 0 ? { valor: pago, forma: pag.forma.value } : { valor: 0 },
      });
      const { saldo } = vendas.pagamento(registrada);
      const abatimentos = registrada.abatimentos || [];
      const abatido = abatimentos.reduce((acc, a) => acc + Number(a.valor), 0);
      ui.flash(
        `Venda #${registrada.numero} registrada para ${venda.cliente.nome} (${format.moeda(registrada.total)}).` +
          (saldo > 0 ? ` Em aberto: ${format.moeda(saldo)}.` : "") +
          (abatido > 0 ? ` ${format.moeda(abatido)} abatido da conta anterior (${abatimentos.map((a) => `#${a.numero}`).join(", ")}).` : "")
      );
      // Abre a ficha do cliente com o histórico aberto e a nova venda destacada
      location.href = `clientes.html?ver=${encodeURIComponent(registrada.clienteId)}&venda=${encodeURIComponent(registrada.id)}`;
    } catch (err) {
      btn.disabled = false;
      ui.toast(err.message || "Não foi possível registrar a venda.", "error");
    }
  });

  // Enter dentro dos campos não finaliza a venda; na quantidade, adiciona o produto
  el.form.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !event.target.matches("input, select")) return;
    event.preventDefault();
    if (event.target === el.qtdNova || event.target === el.produtoNovo) adicionarProduto();
  });

  $("btnLimparVenda").addEventListener("click", () => {
    if (venda.itens.length && !confirm("Descartar os produtos desta venda?")) return;
    venda.itens = [];
    el.desconto.value = "";
    el.desconto.classList.remove("is-invalid");
    limparPagamento();
    renderItens();
    trocarCliente();
  });

  /* ------------------------------------------------------------------------
     6. Catálogo de produtos
     Recarregado quando um produto é cadastrado/alterado em outra aba e ao voltar para esta aba,
     para que produtos novos apareçam sem precisar recarregar a página.
     ------------------------------------------------------------------------ */
  // Da foto basta o tamanho e o final do texto para notar que ela mudou (sem comparar a foto inteira)
  const assinatura = (lista) =>
    JSON.stringify(lista.map((p) => [p.id, p.nome, p.precoPadrao, (p.foto || "").length, (p.foto || "").slice(-32)]));
  let cargaAtual = 0; // descarta respostas antigas que cheguem atrasadas

  /** Aplica o catálogo novo à venda em andamento. `antes` é o catálogo anterior ([] na primeira carga). */
  const aplicarCatalogo = (lista, antes) => {
    catalogo = lista;
    const anterior = (id) => antes.find((p) => mesmoId(p.id, id));

    // Produto inativado depois de entrar na venda não pode mais ser vendido
    const indisponiveis = venda.itens.filter((i) => !produtoPorId(i.produtoId));
    if (indisponiveis.length) {
      venda.itens = venda.itens.filter((i) => produtoPorId(i.produtoId));
      const nomes = indisponiveis.map((i) => anterior(i.produtoId)?.nome).filter(Boolean).join(", ");
      ui.toast(`Removido da venda (produto inativo ou excluído): ${nomes}.`, "error");
    }

    // Itens com o preço padrão antigo acompanham o novo preço; preços ajustados à mão são mantidos
    venda.itens.forEach((i) => {
      const velho = anterior(i.produtoId);
      if (velho && i.precoUnitario === velho.precoPadrao) i.precoUnitario = produtoPorId(i.produtoId).precoPadrao;
    });

    const selecionado = el.produtoNovo.value;
    el.produtoNovo.innerHTML = `<option value="">${catalogo.length ? "Selecione um produto" : "Nenhum produto ativo cadastrado"}</option>${opcoesProduto(selecionado)}`;
    mostrarFotoNova();
    renderItens();

    if (antes.length) {
      const novos = catalogo.filter((p) => !anterior(p.id));
      if (novos.length) ui.toast(`Produto disponível para venda: ${novos.map((p) => p.nome).join(", ")}.`);
    }
  };

  const atualizarCatalogo = async () => {
    const minhaCarga = ++cargaAtual;
    try {
      const lista = await produtos.listar();
      if (minhaCarga !== cargaAtual || assinatura(lista) === assinatura(catalogo)) return;
      aplicarCatalogo(lista, catalogo);
    } catch (err) {
      console.warn("[MGK] Não foi possível atualizar os produtos.", err);
    }
  };

  produtos.aoAlterar(atualizarCatalogo);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") atualizarCatalogo();
  });
  window.addEventListener("focus", atualizarCatalogo);

  /* ------------------------------------------------------------------------
     Inicialização
     ------------------------------------------------------------------------ */
  const iniciar = async () => {
    renderItens();
    const clienteInicial = new URLSearchParams(location.search).get("cliente");
    const minhaCarga = ++cargaAtual;

    try {
      const [lista, cliente] = await Promise.all([
        produtos.listar(),
        clienteInicial ? clientes.obter(clienteInicial) : null,
      ]);
      if (minhaCarga === cargaAtual) aplicarCatalogo(lista, []);
      selecionarCliente(cliente);
    } catch (err) {
      ui.toast(err.message || "Não foi possível carregar os produtos.", "error");
    }
  };

  iniciar();
})();
