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

  const { clientes, produtos, vendas, format, escapeHtml, initials, ui } = window.MGK;

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
    qtdNova: $("qtdNova"),
    tbody: $("itensVenda"),
    tabela: document.querySelector(".sale-items"),
    vazio: $("itensVazio"),
    desconto: $("desconto"),
  };

  /** Estado da venda em edição. */
  const venda = {
    clienteId: null,
    itens: [], // { uid, produtoId, quantidade, precoUnitario }
  };
  let proximoUid = 1;

  const catalogo = produtos.listar();
  const produtoPorId = (id) => catalogo.find((p) => p.id === id);

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

  const renderOpcoes = () => {
    opcoes = clientes.buscar(el.busca.value).slice(0, 8);
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

  const selecionarCliente = (id) => {
    const c = clientes.obter(id);
    if (!c) return;
    venda.clienteId = c.id;

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
  };

  const trocarCliente = () => {
    venda.clienteId = null;
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
    if (el.lista.hidden && event.key === "ArrowDown") renderOpcoes();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      marcarAtiva(Math.min(ativa + 1, opcoes.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      marcarAtiva(Math.max(ativa - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const escolhido = opcoes[ativa >= 0 ? ativa : 0];
      if (escolhido && (ativa >= 0 || opcoes.length === 1)) selecionarCliente(escolhido.id);
    } else if (event.key === "Escape") {
      abrirLista(false);
    }
  });

  el.lista.addEventListener("mousedown", (event) => {
    const li = event.target.closest(".client-option");
    if (!li) return;
    event.preventDefault();
    selecionarCliente(li.dataset.id);
  });

  $("btnTrocarCliente").addEventListener("click", trocarCliente);

  /* ------------------------------------------------------------------------
     2. Produtos da venda
     ------------------------------------------------------------------------ */
  // Na linha do item o preço padrão já aparece abaixo do campo de preço, então o select mostra só o nome
  const opcoesProduto = (selecionado, comPreco = true) =>
    catalogo.map((p) => `
      <option value="${escapeHtml(p.id)}"${p.id === selecionado ? " selected" : ""}>
        ${escapeHtml(p.nome)}${comPreco ? ` — ${format.moeda(p.precoPadrao)}` : ""}
      </option>`).join("");

  el.produtoNovo.insertAdjacentHTML("beforeend", opcoesProduto());

  const linhaItem = (item) => {
    const produto = produtoPorId(item.produtoId);
    return `
      <tr data-uid="${item.uid}">
        <td data-label="Produto">
          <label class="visually-hidden" for="produto-${item.uid}">Produto</label>
          <select class="form-select item-produto" id="produto-${item.uid}">${opcoesProduto(item.produtoId, false)}</select>
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
    const existente = venda.itens.find((i) => i.produtoId === produto.id);
    if (existente) {
      existente.quantidade = Math.min((quantidadeValida(existente.quantidade) ? existente.quantidade : 0) + quantidade, QTD_MAX);
      ui.toast(`${produto.nome}: quantidade atualizada para ${existente.quantidade}.`);
    } else {
      venda.itens.push({ uid: proximoUid++, produtoId: produto.id, quantidade, precoUnitario: produto.precoPadrao });
    }

    renderItens();
    el.produtoNovo.value = "";
    el.qtdNova.value = "1";
    el.produtoNovo.focus();
  };

  $("btnAdicionarProduto").addEventListener("click", adicionarProduto);
  el.produtoNovo.addEventListener("change", () => el.produtoNovo.classList.remove("is-invalid"));

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
    return { ...calculo, descontoInvalido };
  }

  el.desconto.addEventListener("input", () => {
    el.desconto.value = format.moedaInput(el.desconto.value);
    atualizarResumo();
  });

  /* ------------------------------------------------------------------------
     4. Finalizar venda
     ------------------------------------------------------------------------ */
  const validarVenda = () => {
    if (!venda.clienteId) {
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

    if (atualizarResumo().descontoInvalido) {
      el.desconto.focus();
      return "O desconto não pode ser maior que o subtotal da venda.";
    }
    return null;
  };

  el.form.addEventListener("submit", (event) => {
    event.preventDefault();

    const erro = validarVenda();
    if (erro) {
      ui.toast(erro, "error");
      return;
    }

    try {
      const registrada = vendas.registrar({
        clienteId: venda.clienteId,
        itens: venda.itens.map(({ produtoId, quantidade, precoUnitario }) => ({ produtoId, quantidade, precoUnitario })),
        desconto: format.parseMoeda(el.desconto.value),
      });
      const cliente = clientes.obter(registrada.clienteId);
      ui.flash(`Venda #${registrada.numero} registrada para ${cliente.nome} (${format.moeda(registrada.total)}).`);
      // Abre a ficha do cliente com o histórico aberto e a nova venda destacada
      location.href = `clientes.html?ver=${encodeURIComponent(registrada.clienteId)}&venda=${encodeURIComponent(registrada.id)}`;
    } catch (err) {
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
    renderItens();
    trocarCliente();
  });

  /* ------------------------------------------------------------------------
     Inicialização
     ------------------------------------------------------------------------ */
  renderItens();
  const clienteInicial = new URLSearchParams(location.search).get("cliente");
  if (clienteInicial && clientes.obter(clienteInicial)) selecionarCliente(clienteInicial);
})();
