/**
 * Tela: Produtos (cadastro, edição e lista)
 * - Cadastrar: preencha o formulário e salve.
 * - Editar: botão de lápis na lista (carrega o produto no formulário).
 * - Ativar/Inativar: botão na lista. Produto inativo some da tela de venda, mas fica no histórico.
 * - Excluir: para produto cadastrado por engano. Só é permitido se o produto nunca foi vendido.
 *
 * A tela de venda recarrega o catálogo sozinha, então o produto salvo aqui já aparece lá.
 */
(function () {
  "use strict";

  const { produtos, format, normalize, escapeHtml, mesmoId, modoApi, ui } = window.MGK;

  const $ = (id) => document.getElementById(id);

  const el = {
    form: $("formProduto"),
    id: $("id"),
    nome: $("nome"),
    nomeFeedback: $("nomeFeedback"),
    preco: $("precoPadrao"),
    ativo: $("ativo"),
    grupoAtivo: $("grupoAtivo"),
    btnSalvar: $("btnSalvar"),
    btnCancelar: $("btnCancelar"),
    busca: $("campoBusca"),
    tbody: $("tabelaProdutos"),
    tabelaWrapper: $("tabelaWrapper"),
    vazio: $("estadoVazio"),
    vazioTexto: $("estadoVazioTexto"),
    contador: $("contadorResultados"),
  };

  let lista = []; // todos os produtos, inclusive inativos
  let destaque = null; // id do último produto salvo (linha destacada)
  let nomeDuplicado = ""; // nome recusado pelo servidor (409)

  $("avisoDemo").hidden = modoApi;

  /* ------------------------------------------------------------------------
     Lista
     ------------------------------------------------------------------------ */
  const statusBadge = (ativo) =>
    ativo
      ? '<span class="status-badge status-ativo">Ativo</span>'
      : '<span class="status-badge status-inativo">Inativo</span>';

  const linhaProduto = (p) => `
    <tr class="product-row${p.ativo ? "" : " is-inactive"}${mesmoId(p.id, destaque) ? " is-new" : ""}${mesmoId(p.id, el.id.value) ? " is-editing" : ""}">
      <td class="client-name">${escapeHtml(p.nome)}</td>
      <td class="text-end text-mono">${format.moeda(p.precoPadrao)}</td>
      <td>${statusBadge(p.ativo)}</td>
      <td class="text-end">
        <div class="table-actions">
          <button type="button" class="btn btn-outline-mgk btn-icon" data-action="editar" data-id="${escapeHtml(p.id)}"
                  title="Editar" aria-label="Editar ${escapeHtml(p.nome)}">
            <i class="bi bi-pencil"></i>
          </button>
          <button type="button" class="btn btn-outline-mgk btn-icon" data-action="alternar" data-id="${escapeHtml(p.id)}"
                  title="${p.ativo ? "Inativar" : "Ativar"}" aria-label="${p.ativo ? "Inativar" : "Ativar"} ${escapeHtml(p.nome)}">
            <i class="bi ${p.ativo ? "bi-slash-circle" : "bi-check-circle"}"></i>
          </button>
          <button type="button" class="btn btn-outline-mgk btn-icon btn-icon-danger" data-action="excluir" data-id="${escapeHtml(p.id)}"
                  title="Excluir" aria-label="Excluir ${escapeHtml(p.nome)}">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </td>
    </tr>`;

  const render = () => {
    const termo = el.busca.value.trim();
    const texto = normalize(termo);
    const filtrados = texto ? lista.filter((p) => normalize(p.nome).includes(texto)) : lista;
    const vazio = filtrados.length === 0;

    el.tbody.innerHTML = filtrados.map(linhaProduto).join("");
    el.tabelaWrapper.hidden = vazio;
    el.vazio.hidden = !vazio;
    if (vazio) {
      el.vazioTexto.textContent = termo
        ? `Não encontramos produtos para "${termo}".`
        : "Ainda não há produtos cadastrados. Cadastre o primeiro no formulário ao lado.";
    }

    const ativos = lista.filter((p) => p.ativo).length;
    el.contador.innerHTML = termo
      ? `<strong>${filtrados.length}</strong> ${filtrados.length === 1 ? "resultado" : "resultados"} para "${escapeHtml(termo)}"`
      : `<strong>${lista.length}</strong> ${lista.length === 1 ? "produto" : "produtos"} · ${ativos} ${ativos === 1 ? "ativo" : "ativos"}`;
  };

  const carregar = async () => {
    try {
      lista = await produtos.listarTodos();
      render();
    } catch (err) {
      el.contador.textContent = "Não foi possível carregar os produtos.";
      ui.toast(err.message || "Não foi possível carregar os produtos.", "error");
    }
  };

  el.busca.addEventListener("input", render);

  /* ------------------------------------------------------------------------
     Formulário
     ------------------------------------------------------------------------ */
  el.preco.addEventListener("input", () => {
    el.preco.value = format.moedaInput(el.preco.value);
  });

  const validarCampos = () => {
    const nome = el.nome.value.trim();
    if (nome.length < 2) {
      el.nomeFeedback.textContent = "Informe o nome do produto (mínimo 2 caracteres).";
      el.nome.setCustomValidity("invalid");
    } else if (
      normalize(nome) === nomeDuplicado ||
      lista.some((p) => normalize(p.nome) === normalize(nome) && !mesmoId(p.id, el.id.value))
    ) {
      el.nomeFeedback.textContent = "Já existe um produto cadastrado com este nome.";
      el.nome.setCustomValidity("invalid");
    } else {
      el.nome.setCustomValidity("");
    }
    el.preco.setCustomValidity(format.parseMoeda(el.preco.value) > 0 ? "" : "invalid");
    return el.form.checkValidity();
  };

  el.form.addEventListener("input", () => {
    if (el.form.classList.contains("was-validated")) validarCampos();
  });

  const modoEdicao = (produto) => {
    const editando = Boolean(produto);
    el.form.classList.remove("was-validated");
    nomeDuplicado = "";
    el.id.value = editando ? produto.id : "";
    el.nome.value = editando ? produto.nome : "";
    el.preco.value = editando ? format.moedaInput(Math.round(produto.precoPadrao * 100)) : "";
    el.ativo.checked = editando ? produto.ativo : true;
    el.grupoAtivo.hidden = !editando;
    el.btnCancelar.hidden = !editando;
    $("tituloForm").textContent = editando ? "Editar produto" : "Novo produto";
    $("btnSalvarTexto").textContent = editando ? "Salvar Alterações" : "Cadastrar Produto";
    render();
  };

  el.btnCancelar.addEventListener("click", () => {
    modoEdicao(null);
    el.nome.focus();
  });

  el.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (el.btnSalvar.disabled) return;
    el.form.classList.add("was-validated");
    if (!validarCampos()) {
      el.form.querySelector(":invalid")?.focus();
      ui.toast("Revise os campos destacados.", "error");
      return;
    }

    const editando = Boolean(el.id.value);
    const dados = {
      nome: el.nome.value.trim(),
      precoPadrao: format.parseMoeda(el.preco.value),
      ativo: editando ? el.ativo.checked : true,
    };
    if (editando) dados.id = el.id.value;

    el.btnSalvar.disabled = true;
    try {
      const salvo = await produtos.salvar(dados);
      destaque = salvo.id;
      ui.toast(editando ? `Produto ${salvo.nome} atualizado.` : `Produto ${salvo.nome} cadastrado e disponível na venda.`);
      el.busca.value = "";
      await carregar();
      modoEdicao(null);
      el.nome.focus();
    } catch (err) {
      if (err.status === 409) {
        nomeDuplicado = normalize(dados.nome);
        validarCampos();
        el.nome.focus();
      }
      ui.toast(err.message || "Não foi possível salvar o produto.", "error");
    } finally {
      el.btnSalvar.disabled = false;
    }
  });

  /* ------------------------------------------------------------------------
     Ações da lista
     ------------------------------------------------------------------------ */
  el.tbody.addEventListener("click", async (event) => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const produto = lista.find((p) => mesmoId(p.id, btn.dataset.id));
    if (!produto) return;

    if (btn.dataset.action === "editar") {
      modoEdicao(produto);
      el.form.scrollIntoView({ behavior: "smooth", block: "start" });
      el.nome.focus({ preventScroll: true });
      return;
    }

    if (btn.dataset.action === "excluir") {
      if (!confirm(`Excluir o produto "${produto.nome}"? Esta ação não pode ser desfeita.`)) return;
      btn.disabled = true;
      try {
        await produtos.excluir(produto.id);
        ui.toast(`Produto ${produto.nome} excluído.`);
        if (mesmoId(el.id.value, produto.id)) modoEdicao(null);
        await carregar();
      } catch (err) {
        btn.disabled = false;
        ui.toast(err.message || "Não foi possível excluir o produto.", "error");
      }
      return;
    }

    // Ativar / inativar
    btn.disabled = true;
    try {
      const salvo = await produtos.salvar({ ...produto, ativo: !produto.ativo });
      destaque = salvo.id;
      ui.toast(salvo.ativo ? `${salvo.nome} ativado: já aparece na venda.` : `${salvo.nome} inativado: não aparece mais na venda.`);
      await carregar();
      // Se o produto está aberto no formulário, acompanha o novo status
      if (mesmoId(el.id.value, salvo.id)) el.ativo.checked = salvo.ativo;
    } catch (err) {
      btn.disabled = false;
      ui.toast(err.message || "Não foi possível alterar o produto.", "error");
    }
  });

  carregar();
  el.nome.focus();
})();
