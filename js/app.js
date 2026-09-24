/**
 * Sistema MGK — núcleo compartilhado entre as telas.
 *
 * - MGK.clientes / MGK.produtos / MGK.vendas: repositórios de dados (hoje em localStorage; futuramente
 *   trocar por chamadas à API mantendo a mesma interface).
 * - MGK.format / MGK.validate: máscaras e validações de CPF/CNPJ, telefone e CEP.
 * - MGK.ui: toast, mensagens entre páginas e utilidades de HTML.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "mgk.clientes.v1";
  // Nome da chave no localStorage (não é credencial).
  const PRODUTOS_KEY = "mgk.produtos.v1"; // gitleaks:allow
  const VENDAS_KEY = "mgk.vendas.v1";
  const SEED_KEY = "mgk.seed";
  const SEED_VERSION = 2;
  const FLASH_KEY = "mgk.flash";

  /* ------------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------------ */
  const onlyDigits = (value) => String(value ?? "").replace(/\D/g, "");

  const normalize = (value) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[ch]);

  const initials = (name) => {
    const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  };

  /* ------------------------------------------------------------------------
     Formatação
     ------------------------------------------------------------------------ */
  const format = {
    cpf(value) {
      const d = onlyDigits(value).slice(0, 11);
      return d
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
    },

    cnpj(value) {
      const d = onlyDigits(value).slice(0, 14);
      return d
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    },

    documento(value) {
      const d = onlyDigits(value);
      return d.length > 11 ? format.cnpj(d) : format.cpf(d);
    },

    telefone(value) {
      const d = onlyDigits(value).slice(0, 11);
      if (d.length <= 2) return d.length ? `(${d}` : "";
      if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    },

    cep(value) {
      const d = onlyDigits(value).slice(0, 8);
      return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
    },

    tipoDocumento(value) {
      return onlyDigits(value).length > 11 ? "CNPJ" : "CPF";
    },

    data(iso) {
      if (!iso) return "—";
      return new Date(iso).toLocaleDateString("pt-BR");
    },

    moeda(value) {
      return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    },

    /** Máscara de digitação de valores: "4500" → "45,00"; "123456" → "1.234,56". */
    moedaInput(value) {
      const d = onlyDigits(value).replace(/^0+(?=\d)/, "").slice(0, 9);
      if (!d) return "";
      return (Number(d) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    /** Converte o texto mascarado ("1.234,56") em número (1234.56). */
    parseMoeda(value) {
      const d = onlyDigits(value);
      return d ? Number(d) / 100 : 0;
    },
  };

  /** Arredonda para centavos, evitando resíduos de ponto flutuante nos cálculos. */
  const centavos = (value) => Math.round((Number(value) || 0) * 100) / 100;

  /* ------------------------------------------------------------------------
     Validação
     ------------------------------------------------------------------------ */
  const validate = {
    cpf(value) {
      const d = onlyDigits(value);
      if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
      for (let t = 9; t < 11; t++) {
        let sum = 0;
        for (let i = 0; i < t; i++) sum += Number(d[i]) * (t + 1 - i);
        const digit = ((sum * 10) % 11) % 10;
        if (digit !== Number(d[t])) return false;
      }
      return true;
    },

    cnpj(value) {
      const d = onlyDigits(value);
      if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
      const calc = (len) => {
        const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
        const rest = sum % 11;
        return rest < 2 ? 0 : 11 - rest;
      };
      return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
    },

    documento(value) {
      const d = onlyDigits(value);
      if (d.length === 11) return validate.cpf(d);
      if (d.length === 14) return validate.cnpj(d);
      return false;
    },

    telefone(value) {
      const d = onlyDigits(value);
      return d.length === 10 || d.length === 11;
    },

    email(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim());
    },

    cep(value) {
      return onlyDigits(value).length === 8;
    },
  };

  /* ------------------------------------------------------------------------
     Repositório de clientes (localStorage)
     ------------------------------------------------------------------------ */
  const read = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return atualizarDemonstracao(JSON.parse(raw));
    } catch (err) {
      console.warn("[MGK] Não foi possível ler os clientes salvos.", err);
    }
    const seed = structuredClone(window.MGK_MOCK_CLIENTES || []);
    write(seed);
    return seed;
  };

  const write = (list) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn("[MGK] Não foi possível salvar os clientes.", err);
    }
  };

  /**
   * Quem já usava a versão anterior tem os clientes salvos no navegador. Na primeira leitura após
   * a atualização, inclui os novos clientes fictícios (sem mexer nos cadastros existentes).
   */
  const atualizarDemonstracao = (lista) => {
    if (Number(localStorage.getItem(SEED_KEY)) >= SEED_VERSION) return lista;
    const ids = new Set(lista.map((c) => c.id));
    const docs = new Set(lista.map((c) => c.documento));
    const novos = (window.MGK_MOCK_CLIENTES || []).filter((c) => !ids.has(c.id) && !docs.has(c.documento));
    if (novos.length) {
      lista.push(...structuredClone(novos));
      write(lista);
    }
    localStorage.setItem(SEED_KEY, String(SEED_VERSION));
    return lista;
  };

  const randomSuffix = () => crypto.getRandomValues(new Uint32Array(1))[0].toString(36).padStart(4, "0").slice(-4);
  const newId = () => `c-${Date.now().toString(36)}${randomSuffix()}`;

  const clientes = {
    listar() {
      return read().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },

    obter(id) {
      return read().find((c) => c.id === id) || null;
    },

    /** Busca por nome (sem diferenciar acentos/maiúsculas) ou por CPF/CNPJ (com ou sem máscara). */
    buscar(termo) {
      const todos = clientes.listar();
      const texto = normalize(termo);
      if (!texto) return todos;
      const digitos = onlyDigits(termo);
      const buscaPorDocumento = digitos.length >= 3 && /^[\d.\-\/\s]+$/.test(termo.trim());
      return todos.filter((c) =>
        buscaPorDocumento ? c.documento.includes(digitos) : normalize(c.nome).includes(texto)
      );
    },

    documentoEmUso(documento, ignorarId) {
      const d = onlyDigits(documento);
      return read().some((c) => c.documento === d && c.id !== ignorarId);
    },

    salvar(dados) {
      const lista = read();
      const registro = { ...dados, documento: onlyDigits(dados.documento) };
      const idx = registro.id ? lista.findIndex((c) => c.id === registro.id) : -1;

      if (idx >= 0) {
        lista[idx] = { ...lista[idx], ...registro, atualizadoEm: new Date().toISOString() };
      } else {
        registro.id = newId();
        registro.status = registro.status || "ativo";
        registro.criadoEm = new Date().toISOString();
        lista.push(registro);
      }
      write(lista);
      return idx >= 0 ? lista[idx] : registro;
    },

    restaurarDemonstracao() {
      write(structuredClone(window.MGK_MOCK_CLIENTES || []));
    },
  };

  /* ------------------------------------------------------------------------
     Armazenamento genérico (produtos e vendas)
     ------------------------------------------------------------------------ */
  const store = (key, seed) => ({
    read() {
      try {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
      } catch (err) {
        console.warn("[MGK] Não foi possível ler \"%s\".", key, err);
      }
      const inicial = structuredClone(seed() || []);
      this.write(inicial);
      return inicial;
    },
    write(list) {
      try {
        localStorage.setItem(key, JSON.stringify(list));
      } catch (err) {
        console.warn("[MGK] Não foi possível salvar \"%s\".", key, err);
      }
    },
    reset() {
      this.write(structuredClone(seed() || []));
    },
  });

  /* ------------------------------------------------------------------------
     Repositório de produtos
     Produto: { id, nome, precoPadrao }
     ------------------------------------------------------------------------ */
  const produtosStore = store(PRODUTOS_KEY, () => window.MGK_MOCK_PRODUTOS);

  const produtos = {
    listar() {
      return produtosStore.read().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },

    obter(id) {
      return produtosStore.read().find((p) => p.id === id) || null;
    },

    restaurarDemonstracao() {
      produtosStore.reset();
    },
  };

  /* ------------------------------------------------------------------------
     Repositório de vendas
     Venda: { id, numero, clienteId, data, produtos, subtotal, desconto, total, status }
     Produto na venda: { produtoId, nome, quantidade, precoPadrao, precoUnitario, subtotal }
       - precoUnitario é o preço PRATICADO nesta venda; precoPadrao é só um registro do preço de
         tabela no momento da venda. Alterar um não altera o outro.
     ------------------------------------------------------------------------ */
  const vendasStore = store(VENDAS_KEY, () => window.MGK_MOCK_VENDAS);

  const vendas = {
    STATUS: {
      concluido: "Concluído",
      andamento: "Em andamento",
      cancelado: "Cancelado",
    },

    listar() {
      return vendasStore.read().sort((a, b) => b.data.localeCompare(a.data) || b.numero.localeCompare(a.numero));
    },

    obter(id) {
      return vendasStore.read().find((v) => v.id === id) || null;
    },

    /** Vendas do cliente, da mais recente para a mais antiga. */
    porCliente(clienteId) {
      return vendas.listar().filter((v) => v.clienteId === clienteId);
    },

    /** Resumo da ficha do cliente. Vendas canceladas não entram na conta. */
    resumoCliente(clienteId) {
      const validas = vendas.porCliente(clienteId).filter((v) => v.status !== "cancelado");
      return {
        quantidade: validas.length,
        totalGasto: centavos(validas.reduce((acc, v) => acc + v.total, 0)),
        ultimaCompra: validas.length ? validas[0].data : null,
      };
    },

    /** Calcula subtotais e total a partir dos itens (mesma regra usada na tela e no registro). */
    calcular(itens, desconto = 0) {
      const linhas = itens.map((i) => ({ ...i, subtotal: centavos(i.quantidade * i.precoUnitario) }));
      const subtotal = centavos(linhas.reduce((acc, i) => acc + i.subtotal, 0));
      const descontoAplicado = centavos(Math.min(Math.max(desconto, 0), subtotal));
      return { itens: linhas, subtotal, desconto: descontoAplicado, total: centavos(subtotal - descontoAplicado) };
    },

    proximoNumero() {
      const maior = vendasStore.read().reduce((max, v) => Math.max(max, Number(v.numero) || 0), 0);
      return String(maior + 1).padStart(6, "0");
    },

    /**
     * Registra uma venda concluída e a vincula ao cliente.
     * @param {{clienteId: string, itens: {produtoId: string, quantidade: number, precoUnitario: number}[], desconto?: number}} dados
     */
    registrar({ clienteId, itens, desconto = 0 }) {
      if (!clientes.obter(clienteId)) throw new Error("Cliente não encontrado.");
      if (!itens || !itens.length) throw new Error("Adicione pelo menos um produto.");

      const produtosVenda = itens.map((item) => {
        const produto = produtos.obter(item.produtoId);
        if (!produto) throw new Error("Produto não encontrado.");
        if (!Number.isInteger(item.quantidade) || item.quantidade < 1) throw new Error("Quantidade inválida.");
        if (!(item.precoUnitario > 0)) throw new Error("Preço unitário inválido.");
        return {
          produtoId: produto.id,
          nome: produto.nome,
          quantidade: item.quantidade,
          precoPadrao: produto.precoPadrao,
          precoUnitario: centavos(item.precoUnitario),
        };
      });

      const calculo = vendas.calcular(produtosVenda, desconto);
      const numero = vendas.proximoNumero();
      const venda = {
        id: `v-${numero}`,
        numero,
        clienteId,
        data: new Date().toISOString(),
        produtos: calculo.itens,
        subtotal: calculo.subtotal,
        desconto: calculo.desconto,
        total: calculo.total,
        status: "concluido",
      };

      const lista = vendasStore.read();
      lista.push(venda);
      vendasStore.write(lista);
      return venda;
    },

    restaurarDemonstracao() {
      vendasStore.reset();
    },
  };

  /* ------------------------------------------------------------------------
     UI
     ------------------------------------------------------------------------ */
  const ui = {
    toast(message, type = "success") {
      let container = document.getElementById("toastContainer");
      if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.className = "toast-container position-fixed bottom-0 end-0 p-3";
        document.body.appendChild(container);
      }
      const icon = type === "error" ? "bi-exclamation-octagon-fill" : "bi-check-circle-fill";
      const el = document.createElement("div");
      el.className = `toast toast-mgk align-items-center ${type === "error" ? "toast-error" : ""}`;
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      el.innerHTML = `
        <div class="d-flex align-items-center gap-2 p-3">
          <i class="bi ${icon}"></i>
          <div class="me-auto">${escapeHtml(message)}</div>
          <button type="button" class="btn-close btn-close-white ms-2" data-bs-dismiss="toast" aria-label="Fechar"></button>
        </div>`;
      container.appendChild(el);
      const toast = new bootstrap.Toast(el, { delay: 3500 });
      el.addEventListener("hidden.bs.toast", () => el.remove());
      toast.show();
    },

    /** Guarda uma mensagem para ser exibida na próxima página carregada. */
    flash(message, type = "success") {
      sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, type }));
    },

    consumeFlash() {
      const raw = sessionStorage.getItem(FLASH_KEY);
      if (!raw) return;
      sessionStorage.removeItem(FLASH_KEY);
      try {
        const { message, type } = JSON.parse(raw);
        ui.toast(message, type);
      } catch (_) {
        /* ignora */
      }
    },
  };

  window.MGK = { onlyDigits, normalize, escapeHtml, initials, format, validate, clientes, produtos, vendas, ui };

  document.addEventListener("DOMContentLoaded", () => {
    ui.consumeFlash();

    // Fecha a sidebar (modo mobile) ao navegar por um link
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
      sidebar.querySelectorAll("a.sidebar-sublink").forEach((link) =>
        link.addEventListener("click", () => bootstrap.Offcanvas.getInstance(sidebar)?.hide())
      );
    }
  });
})();
