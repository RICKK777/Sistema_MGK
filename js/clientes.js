/**
 * Tela: Consulta de Clientes
 * Busca por nome ou CPF/CNPJ, listagem em tabela e ficha do cliente em modal
 * (dados, resumo e histórico de compras, com os detalhes de cada venda).
 */
(function () {
  "use strict";

  const { clientes, produtos, vendas, format, escapeHtml, initials, mesmoId, modoApi, ui, auth } = window.MGK;
  const podeEditar = auth.temPermissao("editar_cliente");

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
          ${podeEditar ? `<a href="cadastro-cliente.html?id=${encodeURIComponent(c.id)}" class="btn btn-outline-mgk btn-icon"
             title="Editar" aria-label="Editar ${escapeHtml(c.nome)}">
            <i class="bi bi-pencil"></i>
          </a>` : ""}
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

  let buscaAtual = 0; // descarta respostas de buscas antigas que cheguem atrasadas

  const buscar = async () => {
    const termo = el.campo.value.trim();
    const minhaBusca = ++buscaAtual;
    try {
      const lista = await clientes.buscar(termo);
      if (minhaBusca === buscaAtual) render(lista, termo);
    } catch (err) {
      if (minhaBusca !== buscaAtual) return;
      el.contador.textContent = "Não foi possível carregar os clientes.";
      ui.toast(err.message || "Não foi possível carregar os clientes.", "error");
    }
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

  const CLASSE_SITUACAO_PAGAMENTO = {
    pago: "status-ativo",
    parcial: "status-andamento",
    pendente: "status-cancelado",
  };

  /** Situação do pagamento (Pago / Pago em parte / Não pago) e, se houver, quanto falta. */
  const situacaoPagamento = (venda, { comSaldo = true } = {}) => {
    const { saldo, situacao } = vendas.pagamento(venda);
    if (situacao === "cancelado") return '<span class="text-secondary">—</span>';
    return `
      <span class="status-badge ${CLASSE_SITUACAO_PAGAMENTO[situacao]}">${vendas.SITUACAO_PAGAMENTO[situacao]}</span>
      ${comSaldo && saldo > 0 ? `<div class="payment-due">Falta ${format.moeda(saldo)}</div>` : ""}`;
  };

  const produtosResumo = (venda) =>
    venda.produtos.map((p) => `${p.nome} (${p.quantidade}x)`).join(", ");

  const resumoCompras = (compras) => {
    const r = vendas.resumir(compras);
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
        <div class="purchase-stat${r.emAberto > 0 ? " is-due" : ""}">
          <div class="detail-label">Em aberto</div>
          <div class="purchase-stat-value">${format.moeda(r.emAberto)}</div>
        </div>
        <div class="purchase-stat">
          <div class="detail-label">Última compra</div>
          <div class="purchase-stat-value">${r.ultimaCompra ? format.data(r.ultimaCompra) : "—"}</div>
        </div>
      </div>`;
  };

  const historicoCompras = (clienteId, compras, { aberto = false, destaque = null } = {}) => {
    const conteudo = compras.length
      ? `
        ${resumoCompras(compras)}
        <div class="table-responsive">
          <table class="table table-mgk table-hover align-middle purchase-table">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Pedido</th>
                <th scope="col">Produtos</th>
                <th scope="col" class="text-end">Valor total</th>
                <th scope="col">Status</th>
                <th scope="col">Pagamento</th>
                <th scope="col"><span class="visually-hidden">Detalhes</span></th>
              </tr>
            </thead>
            <tbody>
              ${compras.map((v) => `
                <tr class="purchase-row${mesmoId(v.id, destaque) ? " is-new" : ""}" data-venda="${escapeHtml(v.id)}"
                    tabindex="0" role="button" aria-label="Ver detalhes do pedido #${escapeHtml(v.numero)}">
                  <td class="text-mono">${format.data(v.data)}</td>
                  <td class="text-mono fw-semibold">#${escapeHtml(v.numero)}</td>
                  <td class="purchase-products">${escapeHtml(produtosResumo(v))}</td>
                  <td class="text-mono text-end">${format.moeda(v.total)}</td>
                  <td>${statusVenda(v.status)}</td>
                  <td>${situacaoPagamento(v)}</td>
                  <td class="text-end"><i class="bi bi-chevron-right purchase-row-icon"></i></td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
        <div class="purchase-note">Clique em uma compra para ver os detalhes e registrar pagamentos. Pedidos cancelados não são considerados no resumo.</div>`
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
  const abrirVisualizacao = async (id, opcoes = {}) => {
    let c;
    let compras;
    try {
      [c, compras] = await Promise.all([clientes.obter(id), vendas.porCliente(id)]);
    } catch (err) {
      ui.toast(err.message || "Não foi possível abrir a ficha do cliente.", "error");
      return;
    }
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
        <div class="client-summary">${resumoCompras(compras)}</div>
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
      ${historicoCompras(c.id, compras, opcoes)}`;

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
  let vendaAberta = null; // { venda, cliente } exibidos no modal de detalhes
  let fichaDesatualizada = false; // um pagamento foi registrado: a ficha precisa ser recarregada

  /** "AAAA-MM-DD" no fuso do navegador (valor do input type=date). */
  const diaLocal = (data) => {
    const d = new Date(data);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  /**
   * Converte o dia escolhido no formulário em data/hora ISO. Hoje = agora; outro dia = meio-dia.
   * Qualquer dia até hoje é aceito, inclusive antes da venda (lançamento de pagamentos antigos).
   */
  const dataDoPagamento = (dia) => {
    if (dia === diaLocal(new Date())) return new Date().toISOString();
    return new Date(`${dia}T12:00:00`).toISOString();
  };

  const formaPagamento = (forma) => vendas.FORMAS_PAGAMENTO[forma] || "Não informada";

  const secaoPagamentos = (v) => {
    const { pago, saldo, situacao } = vendas.pagamento(v);
    const pagamentos = [...(v.pagamentos || [])].sort((a, b) => a.data.localeCompare(b.data));

    const lista = pagamentos.length
      ? `
        <div class="table-responsive sale-detail-table">
          <table class="table table-mgk align-middle">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Forma</th>
                <th scope="col">Observação</th>
                <th scope="col" class="text-end">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${pagamentos.map((p) => `
                <tr>
                  <td class="text-mono">${format.data(p.data)}</td>
                  <td>${escapeHtml(formaPagamento(p.forma))}</td>
                  <td class="text-secondary">${escapeHtml(p.observacao || "—")}</td>
                  <td class="text-mono text-end fw-semibold">${format.moeda(p.valor)}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>`
      : '<p class="text-secondary mb-3">Nenhum pagamento registrado ainda.</p>';

    const opcoesForma = Object.entries(vendas.FORMAS_PAGAMENTO)
      .map(([valor, nome]) => `<option value="${valor}">${escapeHtml(nome)}</option>`).join("");

    const formulario = saldo > 0
      ? `
        <form class="payment-form" id="formPagamento" novalidate autocomplete="off">
          <div class="payment-form-title"><i class="bi bi-cash-coin"></i> Registrar pagamento</div>
          <div class="row g-3">
            <div class="col-sm-4">
              <label for="pagValor" class="form-label">Valor<span class="req">*</span></label>
              <div class="input-group has-validation">
                <span class="input-group-text">R$</span>
                <input type="text" class="form-control text-mono text-end" id="pagValor" inputmode="numeric"
                       value="${format.moedaInput(Math.round(saldo * 100))}">
                <div class="invalid-feedback" id="pagValorFeedback">Informe um valor.</div>
              </div>
            </div>
            <div class="col-sm-4">
              <label for="pagForma" class="form-label">Forma<span class="req">*</span></label>
              <select class="form-select" id="pagForma">
                <option value="">Selecione</option>
                ${opcoesForma}
              </select>
              <div class="invalid-feedback">Selecione a forma.</div>
            </div>
            <div class="col-sm-4">
              <label for="pagData" class="form-label">Data<span class="req">*</span></label>
              <input type="date" class="form-control text-mono" id="pagData"
                     value="${diaLocal(new Date())}" max="${diaLocal(new Date())}">
              <div class="invalid-feedback">A data não pode ser no futuro.</div>
            </div>
            <div class="col-12">
              <label for="pagObs" class="form-label">Observação</label>
              <input type="text" class="form-control" id="pagObs" maxlength="255" placeholder="Ex.: depósito na conta, 2ª parcela...">
            </div>
          </div>
          <div class="payment-form-actions">
            <span class="text-secondary small">O valor já vem preenchido com o saldo; altere se o cliente pagou só uma parte.</span>
            <button type="submit" class="btn btn-mgk" id="btnRegistrarPagamento">
              <i class="bi bi-check-lg"></i> Registrar pagamento
            </button>
          </div>
        </form>`
      : situacao === "pago"
        ? '<div class="payment-paid"><i class="bi bi-check-circle-fill"></i> Venda quitada.</div>'
        : "";

    return `
      <div class="detail-section">
        <div class="detail-section-title">Pagamentos</div>
        <dl class="sale-totals payment-totals">
          <div><dt>Total da venda</dt><dd>${format.moeda(v.total)}</dd></div>
          <div><dt>Pago</dt><dd>${format.moeda(pago)}</dd></div>
          <div class="sale-totals-open${saldo > 0 ? " has-open" : ""}"><dt>Em aberto</dt><dd>${format.moeda(saldo)}</dd></div>
        </dl>
        ${lista}
        ${formulario}
      </div>`;
  };

  const renderVenda = (v, c) => {
    vendaAberta = { venda: v, cliente: c };
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
          <div class="col-6 col-sm-4">
            <div class="detail-label">Status</div>
            <div class="detail-value">${statusVenda(v.status)}</div>
          </div>
          <div class="col-6 col-sm-4">
            <div class="detail-label">Pagamento</div>
            <div class="detail-value">${situacaoPagamento(v, { comSaldo: false })}</div>
          </div>
          ${campo("Cliente", c ? c.nome : "Cliente removido", "col-sm-4")}
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
      </div>
      ${secaoPagamentos(v)}`;
  };

  const abrirVenda = async (vendaId) => {
    let v;
    let c;
    try {
      v = await vendas.obter(vendaId);
      if (v) c = await clientes.obter(v.clienteId);
    } catch (err) {
      ui.toast(err.message || "Não foi possível abrir a venda.", "error");
      return;
    }
    if (!v) {
      ui.toast("Venda não encontrada.", "error");
      return;
    }

    fichaDesatualizada = false;
    renderVenda(v, c);
    el.modal.addEventListener("hidden.bs.modal", () => modalVenda.show(), { once: true });
    modal.hide();
  };

  /* ------------------------------------------------------------------------
     Registrar pagamento (cliente pagou mais uma parte da venda)
     ------------------------------------------------------------------------ */
  el.modalVenda.addEventListener("input", (event) => {
    if (event.target.id === "pagValor") event.target.value = format.moedaInput(event.target.value);
    if (event.target.matches(".is-invalid")) event.target.classList.remove("is-invalid");
  });

  el.modalVenda.addEventListener("change", (event) => {
    if (event.target.matches(".is-invalid")) event.target.classList.remove("is-invalid");
  });

  el.modalVenda.addEventListener("submit", async (event) => {
    if (event.target.id !== "formPagamento") return;
    event.preventDefault();
    const { venda, cliente } = vendaAberta;
    const btn = document.getElementById("btnRegistrarPagamento");
    if (btn.disabled) return;

    const campoValor = document.getElementById("pagValor");
    const campoForma = document.getElementById("pagForma");
    const campoData = document.getElementById("pagData");
    const valor = format.parseMoeda(campoValor.value);
    const { saldo } = vendas.pagamento(venda);
    const hoje = diaLocal(new Date());

    const invalidos = [];
    if (!(valor > 0) || valor > saldo) {
      document.getElementById("pagValorFeedback").textContent =
        valor > saldo ? `Máximo: ${format.moeda(saldo)} (saldo em aberto).` : "Informe um valor.";
      invalidos.push(campoValor);
    }
    if (!campoForma.value) invalidos.push(campoForma);
    if (!campoData.value || campoData.value > hoje) invalidos.push(campoData);
    invalidos.forEach((campo) => campo.classList.add("is-invalid"));
    if (invalidos.length) {
      invalidos[0].focus();
      ui.toast("Revise os dados do pagamento.", "error");
      return;
    }

    btn.disabled = true;
    try {
      const atualizada = await vendas.registrarPagamento(venda.id, {
        valor,
        forma: campoForma.value,
        data: dataDoPagamento(campoData.value),
        observacao: document.getElementById("pagObs").value,
      });
      fichaDesatualizada = true;
      renderVenda(atualizada, cliente);
      const restante = vendas.pagamento(atualizada).saldo;
      ui.toast(
        restante > 0
          ? `Pagamento de ${format.moeda(valor)} registrado. Ainda falta ${format.moeda(restante)}.`
          : `Pagamento de ${format.moeda(valor)} registrado. Venda quitada!`
      );
    } catch (err) {
      btn.disabled = false;
      ui.toast(err.message || "Não foi possível registrar o pagamento.", "error");
    }
  });

  document.getElementById("btnVoltarFicha").addEventListener("click", () => {
    el.modalVenda.addEventListener("hidden.bs.modal", () => {
      // Depois de um pagamento, recarrega a ficha para o resumo e o histórico mostrarem o novo saldo
      if (fichaDesatualizada && vendaAberta) {
        abrirVisualizacao(vendaAberta.venda.clienteId, { aberto: true, destaque: vendaAberta.venda.id });
      } else {
        modal.show();
      }
    }, { once: true });
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

  // Com o back-end ligado os dados são reais: a restauração da demonstração só existe no modo local
  el.btnRestaurar.hidden = modoApi;
  el.btnRestaurar.addEventListener("click", async () => {
    if (!confirm("Restaurar os clientes, produtos e vendas fictícios de demonstração? Os cadastros e vendas feitos neste navegador serão descartados.")) return;
    await Promise.all([
      clientes.restaurarDemonstracao(),
      produtos.restaurarDemonstracao(),
      vendas.restaurarDemonstracao(),
    ]);
    el.campo.value = "";
    await buscar();
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
