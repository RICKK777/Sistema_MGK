/**
 * Tela: Consulta de Clientes
 * Busca por nome ou CPF/CNPJ, listagem em tabela e ficha do cliente em modal
 * (dados, resumo e histórico de compras, com os detalhes de cada venda).
 */
(function () {
  "use strict";

  const { clientes, produtos, vendas, format, escapeHtml, initials, ui } = window.MGK;

  const el = {
    form: document.getElementById("formBusca"),
    campo: document.getElementById("campoBusca"),
    btnLimpar: document.getElementById("btnLimpar"),
    btnLimparVazio: document.getElementById("btnLimparVazio"),
    btnRestaurar: document.getElementById("btnRestaurar"),
    tbody: document.getElementById("tabelaClientes"),
    tabelaWrapper: document.getElementById("tabelaWrapper"),
    vazio: document.getElementById("estadoVazio"),
    vazioTexto: document.getElementById("estadoVazioTexto"),
    contador: document.getElementById("contadorResultados"),
    modal: document.getElementById("modalCliente"),
    modalVenda: document.getElementById("modalVenda"),
  };

  const modal = new bootstrap.Modal(el.modal);
  const modalVenda = new bootstrap.Modal(el.modalVenda);

  /* ------------------------------------------------------------------------
     Renderização
     ------------------------------------------------------------------------ */
  const statusBadge = (status) =>
    status === "inativo"
      ? '<span class="status-badge status-inativo">Inativo</span>'
      : '<span class="status-badge status-ativo">Ativo</span>';

  const linhaCliente = (c) => `
    <tr>
      <td>
        <div class="client-cell">
          <span class="avatar">${escapeHtml(initials(c.nome))}</span>
          <div>
            <div class="client-name">${escapeHtml(c.nome)}</div>
            <div class="client-email">${escapeHtml(c.email || "—")}</div>
          </div>
        </div>
      </td>
      <td class="text-mono">
        ${escapeHtml(format.documento(c.documento))}
        <span class="doc-type">${format.tipoDocumento(c.documento)}</span>
      </td>
      <td class="text-mono">${escapeHtml(format.telefone(c.celular || c.telefone) || "—")}</td>
      <td>${escapeHtml(c.cidade)}${c.estado ? `<span class="text-secondary"> / ${escapeHtml(c.estado)}</span>` : ""}</td>
      <td>${statusBadge(c.status)}</td>
      <td class="text-end">
        <div class="table-actions">
          <button type="button" class="btn btn-outline-mgk btn-icon" data-action="ver" data-id="${escapeHtml(c.id)}"
                  title="Visualizar" aria-label="Visualizar ${escapeHtml(c.nome)}">
            <i class="bi bi-eye"></i>
          </button>
          <a href="venda.html?cliente=${encodeURIComponent(c.id)}" class="btn btn-outline-mgk btn-icon"
             title="Nova venda" aria-label="Nova venda para ${escapeHtml(c.nome)}">
            <i class="bi bi-cart-plus"></i>
          </a>
          <a href="cadastro-cliente.html?id=${encodeURIComponent(c.id)}" class="btn btn-outline-mgk btn-icon"
             title="Editar" aria-label="Editar ${escapeHtml(c.nome)}">
            <i class="bi bi-pencil"></i>
          </a>
        </div>
      </td>
    </tr>`;

  const render = (lista, termo) => {
    const vazio = lista.length === 0;
    el.tbody.innerHTML = lista.map(linhaCliente).join("");
    el.tabelaWrapper.hidden = vazio;
    el.vazio.hidden = !vazio;

    if (vazio) {
      el.vazioTexto.textContent = termo
        ? `Não encontramos clientes para "${termo}". Verifique o nome ou CPF digitado.`
        : "Ainda não há clientes cadastrados. Comece cadastrando o primeiro cliente.";
      el.btnLimparVazio.hidden = !termo;
    }

    const total = lista.length;
    el.contador.innerHTML = termo
      ? `<strong>${total}</strong> ${total === 1 ? "resultado" : "resultados"} para "${escapeHtml(termo)}"`
      : `<strong>${total}</strong> ${total === 1 ? "cliente" : "clientes"}`;
  };

  const buscar = () => {
    const termo = el.campo.value.trim();
    render(clientes.buscar(termo), termo);
  };

  const limpar = () => {
    el.campo.value = "";
    buscar();
    el.campo.focus();
  };

  /* ------------------------------------------------------------------------
     Visualização (modal)
     ------------------------------------------------------------------------ */
  const campo = (label, valor, col = "col-sm-6") => `
    <div class="${col}">
      <div class="detail-label">${label}</div>
      <div class="detail-value">${escapeHtml(valor || "—")}</div>
    </div>`;

  /* ------------------------------------------------------------------------
     Histórico de compras (vendas registradas em MGK.vendas)
     ------------------------------------------------------------------------ */
  const CLASSE_STATUS_VENDA = {
    concluido: "status-ativo",
    andamento: "status-andamento",
    cancelado: "status-cancelado",
  };

  const statusVenda = (status) =>
    `<span class="status-badge ${CLASSE_STATUS_VENDA[status] || "status-ativo"}">${vendas.STATUS[status] || vendas.STATUS.concluido}</span>`;

  const produtosResumo = (venda) =>
    venda.produtos.map((p) => `${p.nome} (${p.quantidade}x)`).join(", ");

  const resumoCompras = (clienteId) => {
    const r = vendas.resumoCliente(clienteId);
    return `
      <div class="purchase-summary">
        <div class="purchase-stat">
          <div class="detail-label">Total de compras</div>
          <div class="purchase-stat-value">${r.quantidade}</div>
        </div>
        <div class="purchase-stat">
          <div class="detail-label">Total gasto</div>
          <div class="purchase-stat-value">${format.moeda(r.totalGasto)}</div>
        </div>
        <div class="purchase-stat">
          <div class="detail-label">Última compra</div>
          <div class="purchase-stat-value">${r.ultimaCompra ? format.data(r.ultimaCompra) : "—"}</div>
        </div>
      </div>`;
  };

  const historicoCompras = (clienteId, { aberto = false, destaque = null } = {}) => {
    const compras = vendas.porCliente(clienteId);

    const conteudo = compras.length
      ? `
        ${resumoCompras(clienteId)}
        <div class="table-responsive">
          <table class="table table-mgk table-hover align-middle purchase-table">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Pedido</th>
                <th scope="col">Produtos</th>
                <th scope="col" class="text-end">Valor total</th>
                <th scope="col">Status</th>
                <th scope="col"><span class="visually-hidden">Detalhes</span></th>
              </tr>
            </thead>
            <tbody>
              ${compras.map((v) => `
                <tr class="purchase-row${v.id === destaque ? " is-new" : ""}" data-venda="${escapeHtml(v.id)}"
                    tabindex="0" role="button" aria-label="Ver detalhes do pedido #${escapeHtml(v.numero)}">
                  <td class="text-mono">${format.data(v.data)}</td>
                  <td class="text-mono fw-semibold">#${escapeHtml(v.numero)}</td>
                  <td class="purchase-products">${escapeHtml(produtosResumo(v))}</td>
                  <td class="text-mono text-end">${format.moeda(v.total)}</td>
                  <td>${statusVenda(v.status)}</td>
                  <td class="text-end"><i class="bi bi-chevron-right purchase-row-icon"></i></td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
        <div class="purchase-note">Clique em uma compra para ver os detalhes. Pedidos cancelados não são considerados no resumo.</div>`
      : `
        <div class="empty-state py-4">
          <div class="empty-state-icon"><i class="bi bi-bag"></i></div>
          <h3>Nenhuma compra registrada</h3>
          <p>As vendas registradas para este cliente aparecerão aqui.</p>
          <a href="venda.html?cliente=${encodeURIComponent(clienteId)}" class="btn btn-mgk"><i class="bi bi-cart-plus"></i> Registrar primeira venda</a>
        </div>`;

    return `
      <div class="accordion accordion-mgk mt-4" id="historicoAccordion">
        <div class="accordion-item">
          <h3 class="accordion-header">
            <button class="accordion-button${aberto ? "" : " collapsed"}" type="button" data-bs-toggle="collapse"
                    data-bs-target="#historicoCompras" aria-expanded="${aberto}" aria-controls="historicoCompras">
              <i class="bi bi-bag-check"></i>
              <span>Histórico de Compras</span>
              <span class="accordion-count">${compras.length} ${compras.length === 1 ? "pedido" : "pedidos"}</span>
            </button>
          </h3>
          <div id="historicoCompras" class="accordion-collapse collapse${aberto ? " show" : ""}">
            <div class="accordion-body">${conteudo}</div>
          </div>
        </div>
      </div>`;
  };

  /**
   * Abre a ficha do cliente.
   * @param {string} id
   * @param {{aberto?: boolean, destaque?: string}} [opcoes] histórico já aberto e venda a destacar
   */
  const abrirVisualizacao = (id, opcoes = {}) => {
    const c = clientes.obter(id);
    if (!c) {
      ui.toast("Cliente não encontrado.", "error");
      return;
    }

    document.getElementById("modalClienteAvatar").textContent = initials(c.nome);
    document.getElementById("modalClienteNome").textContent = c.nome;
    document.getElementById("modalClienteStatus").innerHTML = statusBadge(c.status);
    document.getElementById("modalClienteEditar").href = `cadastro-cliente.html?id=${encodeURIComponent(c.id)}`;
    document.getElementById("modalClienteVenda").href = `venda.html?cliente=${encodeURIComponent(c.id)}`;

    const enderecoLinha = [c.rua, c.numero].filter(Boolean).join(", ");

    document.getElementById("modalClienteCorpo").innerHTML = `
      <div class="detail-section">
        <div class="detail-section-title">Resumo de compras</div>
        <div class="client-summary">${resumoCompras(c.id)}</div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">Dados pessoais</div>
        <div class="row g-3">
          ${campo("Nome completo", c.nome, "col-12")}
          ${campo(format.tipoDocumento(c.documento), format.documento(c.documento))}
          ${campo("E-mail", c.email)}
          ${campo("Telefone", format.telefone(c.telefone))}
          ${campo("Celular", format.telefone(c.celular))}
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">Endereço</div>
        <div class="row g-3">
          ${campo("Rua / Número", enderecoLinha, "col-sm-8")}
          ${campo("Complemento", c.complemento, "col-sm-4")}
          ${campo("Bairro", c.bairro, "col-sm-4")}
          ${campo("Cidade / UF", [c.cidade, c.estado].filter(Boolean).join(" / "), "col-sm-4")}
          ${campo("CEP", format.cep(c.cep), "col-sm-4")}
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">Registro</div>
        <div class="row g-3">
          ${campo("Cadastrado em", format.data(c.criadoEm))}
          ${campo("Última atualização", format.data(c.atualizadoEm || c.criadoEm))}
        </div>
      </div>
      ${historicoCompras(c.id, opcoes)}`;

    modal.show();

    if (opcoes.destaque) {
      el.modal.addEventListener("shown.bs.modal", () => {
        el.modal.querySelector(".purchase-row.is-new")?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, { once: true });
    }
  };

  /* ------------------------------------------------------------------------
     Detalhes da venda (modal)
     A ficha do cliente é escondida enquanto os detalhes estão abertos e volta
     pelo botão "Voltar para a ficha" (o Bootstrap não empilha modais).
     ------------------------------------------------------------------------ */
  const abrirVenda = (vendaId) => {
    const v = vendas.obter(vendaId);
    if (!v) {
      ui.toast("Venda não encontrada.", "error");
      return;
    }
    const c = clientes.obter(v.clienteId);

    document.getElementById("modalVendaTitulo").textContent = `Pedido #${v.numero}`;
    document.getElementById("modalVendaData").textContent = new Date(v.data).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });

    const linhas = v.produtos.map((p) => {
      const alterado = p.precoPadrao != null && p.precoPadrao !== p.precoUnitario;
      return `
        <tr>
          <td>
            <div class="fw-semibold text-dark">${escapeHtml(p.nome)}</div>
            ${alterado ? `<div class="price-default">Preço padrão: ${format.moeda(p.precoPadrao)}</div>` : ""}
          </td>
          <td class="text-mono text-center">${p.quantidade}</td>
          <td class="text-mono text-end">${format.moeda(p.precoUnitario)}</td>
          <td class="text-mono text-end fw-semibold">${format.moeda(p.subtotal)}</td>
        </tr>`;
    }).join("");

    document.getElementById("modalVendaCorpo").innerHTML = `
      <div class="detail-section">
        <div class="detail-section-title">Informações da venda</div>
        <div class="row g-3">
          ${campo("Número do pedido", `#${v.numero}`, "col-6 col-sm-4")}
          ${campo("Data", format.data(v.data), "col-6 col-sm-4")}
          <div class="col-12 col-sm-4">
            <div class="detail-label">Status</div>
            <div class="detail-value">${statusVenda(v.status)}</div>
          </div>
          ${campo("Cliente", c ? c.nome : "Cliente removido", "col-sm-8")}
          ${campo(c ? format.tipoDocumento(c.documento) : "CPF/CNPJ", c ? format.documento(c.documento) : "", "col-sm-4")}
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">Produtos</div>
        <div class="table-responsive sale-detail-table">
          <table class="table table-mgk align-middle">
            <thead>
              <tr>
                <th scope="col">Produto</th>
                <th scope="col" class="text-center">Qtd.</th>
                <th scope="col" class="text-end">Preço unitário</th>
                <th scope="col" class="text-end">Subtotal</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">Resumo</div>
        <dl class="sale-totals">
          <div><dt>Subtotal</dt><dd>${format.moeda(v.subtotal)}</dd></div>
          <div><dt>Desconto</dt><dd>${v.desconto ? `− ${format.moeda(v.desconto)}` : format.moeda(0)}</dd></div>
          <div class="sale-totals-total"><dt>Total</dt><dd>${format.moeda(v.total)}</dd></div>
        </dl>
      </div>`;

    el.modal.addEventListener("hidden.bs.modal", () => modalVenda.show(), { once: true });
    modal.hide();
  };

  document.getElementById("btnVoltarFicha").addEventListener("click", () => {
    el.modalVenda.addEventListener("hidden.bs.modal", () => modal.show(), { once: true });
    modalVenda.hide();
  });

  el.modal.addEventListener("click", (event) => {
    const linha = event.target.closest(".purchase-row");
    if (linha) abrirVenda(linha.dataset.venda);
  });

  el.modal.addEventListener("keydown", (event) => {
    const linha = event.target.closest(".purchase-row");
    if (linha && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      abrirVenda(linha.dataset.venda);
    }
  });

  /* ------------------------------------------------------------------------
     Eventos
     ------------------------------------------------------------------------ */
  el.form.addEventListener("submit", (event) => {
    event.preventDefault();
    buscar();
  });

  // O "x" nativo do input[type=search] também limpa a busca
  el.campo.addEventListener("search", () => {
    if (!el.campo.value) buscar();
  });

  el.btnLimpar.addEventListener("click", limpar);
  el.btnLimparVazio.addEventListener("click", limpar);

  el.btnRestaurar.addEventListener("click", () => {
    if (!confirm("Restaurar os clientes, produtos e vendas fictícios de demonstração? Os cadastros e vendas feitos neste navegador serão descartados.")) return;
    clientes.restaurarDemonstracao();
    produtos.restaurarDemonstracao();
    vendas.restaurarDemonstracao();
    el.campo.value = "";
    buscar();
    ui.toast("Dados de demonstração restaurados.");
  });

  el.tbody.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action='ver']");
    if (btn) abrirVisualizacao(btn.dataset.id);
  });

  // Permite abrir a ficha diretamente:
  //   clientes.html?ver=<id>                → ficha do cliente
  //   clientes.html?ver=<id>&venda=<vendaId> → ficha com o histórico aberto e a venda destacada
  const params = new URLSearchParams(location.search);
  buscar();
  if (params.get("ver")) {
    const destaque = params.get("venda");
    abrirVisualizacao(params.get("ver"), { aberto: Boolean(destaque), destaque });
  }
})();
