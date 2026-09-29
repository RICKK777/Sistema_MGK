/**
 * Sistema MGK — núcleo compartilhado entre as telas.
 *
 * - MGK.clientes / MGK.produtos / MGK.vendas / MGK.usuarios: repositórios de dados. Todos os métodos que leem ou
 *   gravam dados são ASSÍNCRONOS (devolvem Promise) e funcionam igual nos dois modos de js/config.js:
 *     "local" → localStorage do navegador;  "api" → back-end HTTP (MySQL), via MGK.api.
 * - MGK.format / MGK.validate: máscaras e validações de CPF/CNPJ, telefone e CEP.
 * - MGK.ui: toast, mensagens entre páginas e utilidades de HTML.
 * - MGK.auth: usuário logado e permissões (js/auth.js).
 */
(function () {
  "use strict";

  const CONFIG = Object.freeze({
    modo: "local",
    apiUrl: "http://localhost:3000/api",
    timeoutMs: 10000,
    ...window.MGK_CONFIG,
  });
  const MODO_API = CONFIG.modo === "api";

  const STORAGE_KEY = "mgk.clientes.v1";
  // Nome da chave no localStorage (não é credencial).
  const PRODUTOS_KEY = "mgk.produtos.v1"; // gitleaks:allow
  const VENDAS_KEY = "mgk.vendas.v1";
  const USUARIOS_KEY = "mgk.usuarios.v1";
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

  /** Compara ids sem depender do tipo: no localStorage são texto ("c-0001"), no MySQL são números (1). */
  const mesmoId = (a, b) => a != null && b != null && String(a) === String(b);

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
     Erros e cliente HTTP (modo "api")
     Contrato da API e tabelas do MySQL: docs/BANCO-DE-DADOS.md
     ------------------------------------------------------------------------ */
  /** Erro de dados com o status HTTP (0 = sem resposta do servidor; 404 = não encontrado; 409 = conflito). */
  class ErroMGK extends Error {
    constructor(message, status = 0, dados = null) {
      super(message);
      this.name = "ErroMGK";
      this.status = status;
      this.dados = dados;
    }
  }

  const api = {
    /**
     * Faz a requisição e devolve o JSON da resposta.
     * Em caso de erro, o back-end deve responder `{ "erro": "mensagem para o usuário" }`.
     */
    async request(metodo, caminho, corpo) {
      const controle = new AbortController();
      const limite = setTimeout(() => controle.abort(), CONFIG.timeoutMs);
      const headers = { Accept: "application/json" };
      if (corpo !== undefined) headers["Content-Type"] = "application/json";
      const token = window.MGK_AUTH?.token();
      if (token) headers.Authorization = `Bearer ${token}`;

      let resposta;
      let dados = null;
      try {
        resposta = await fetch(`${CONFIG.apiUrl}${caminho}`, {
          method: metodo,
          headers,
          body: corpo === undefined ? undefined : JSON.stringify(corpo),
          signal: controle.signal,
        });
        if (resposta.status !== 204) dados = await resposta.json().catch(() => null);
      } catch (err) {
        throw new ErroMGK(
          err.name === "AbortError"
            ? "O servidor demorou para responder. Tente novamente."
            : "Não foi possível conectar ao servidor. Verifique a conexão."
        );
      } finally {
        clearTimeout(limite);
      }

      // Sessão expirada ou inválida: volta para o login (no próprio login, 401 é só senha errada)
      if (resposta.status === 401 && caminho !== "/auth/login" && window.MGK_AUTH) {
        MGK_AUTH.encerrarSessao();
        MGK_AUTH.avisarNaProximaTela(dados?.erro || "Sua sessão expirou. Entre novamente.", "error");
        location.replace("login.html");
      }
      if (!resposta.ok) {
        throw new ErroMGK(dados?.erro || `Erro ${resposta.status} no servidor.`, resposta.status, dados);
      }
      return dados;
    },
    get: (caminho) => api.request("GET", caminho),
    post: (caminho, corpo) => api.request("POST", caminho, corpo),
    put: (caminho, corpo) => api.request("PUT", caminho, corpo),
    delete: (caminho) => api.request("DELETE", caminho),
  };

  /** Transforma um 404 em `null` (para os métodos `obter`). */
  const ouNulo = (promessa) =>
    promessa.catch((err) => {
      if (err.status === 404) return null;
      throw err;
    });

  const rota = (base, id) => `${base}/${encodeURIComponent(id)}`;
  const query = (params) => new URLSearchParams(params).toString();

  const porNome = (lista) => lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  /* ------------------------------------------------------------------------
     Repositório de clientes
     Cliente: { id, nome, documento, telefone, celular, email, cep, rua, numero, complemento,
                bairro, cidade, estado, status, criadoEm, atualizadoEm }
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
  const newId = (prefixo = "c") => `${prefixo}-${Date.now().toString(36)}${randomSuffix()}`;

  const clientesLocal = {
    async listar() {
      return porNome(read());
    },

    async obter(id) {
      return read().find((c) => mesmoId(c.id, id)) || null;
    },

    /** Busca por nome (sem diferenciar acentos/maiúsculas) ou por CPF/CNPJ (com ou sem máscara). */
    async buscar(termo) {
      const todos = porNome(read());
      const texto = normalize(termo);
      if (!texto) return todos;
      const digitos = onlyDigits(termo);
      const buscaPorDocumento = digitos.length >= 3 && /^[\d.\-\/\s]+$/.test(termo.trim());
      return todos.filter((c) =>
        buscaPorDocumento ? c.documento.includes(digitos) : normalize(c.nome).includes(texto)
      );
    },

    async documentoEmUso(documento, ignorarId) {
      const d = onlyDigits(documento);
      return read().some((c) => c.documento === d && !mesmoId(c.id, ignorarId));
    },

    /** Cria (sem id) ou atualiza (com id). Documento repetido gera ErroMGK 409, como na API. */
    async salvar(dados) {
      const lista = read();
      const registro = { ...dados, documento: onlyDigits(dados.documento) };
      if (lista.some((c) => c.documento === registro.documento && !mesmoId(c.id, registro.id))) {
        throw new ErroMGK("Já existe um cliente cadastrado com este documento.", 409);
      }
      const idx = registro.id ? lista.findIndex((c) => mesmoId(c.id, registro.id)) : -1;

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

    async restaurarDemonstracao() {
      write(structuredClone(window.MGK_MOCK_CLIENTES || []));
    },
  };

  const clientesApi = {
    listar: () => api.get("/clientes"),

    obter: (id) => ouNulo(api.get(rota("/clientes", id))),

    /** A regra de busca (nome sem acentos ou CPF/CNPJ) fica no back-end: GET /clientes?busca=... */
    buscar(termo) {
      const texto = String(termo ?? "").trim();
      return texto ? api.get(`/clientes?${query({ busca: texto })}`) : clientesApi.listar();
    },

    async documentoEmUso(documento, ignorarId) {
      const encontrados = await api.get(`/clientes?${query({ documento: onlyDigits(documento) })}`);
      return encontrados.some((c) => !mesmoId(c.id, ignorarId));
    },

    /** POST /clientes (novo) ou PUT /clientes/:id (edição). O servidor define id, status inicial e datas. */
    salvar(dados) {
      const { id, criadoEm, atualizadoEm, ...corpo } = { ...dados, documento: onlyDigits(dados.documento) };
      return id ? api.put(rota("/clientes", id), corpo) : api.post("/clientes", corpo);
    },
  };

  const clientes = MODO_API ? clientesApi : clientesLocal;

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
    /** @returns {boolean} false se não conseguiu gravar (ex.: navegador sem espaço). */
    write(list) {
      try {
        localStorage.setItem(key, JSON.stringify(list));
        return true;
      } catch (err) {
        console.warn("[MGK] Não foi possível salvar \"%s\".", key, err);
        return false;
      }
    },
    reset() {
      this.write(structuredClone(seed() || []));
    },
  });

  /* ------------------------------------------------------------------------
     Repositório de produtos
     Produto: { id, nome, precoPadrao, ativo, foto, criadoEm, atualizadoEm }
       - foto: data URL JPEG (já reduzida pela tela de produtos) ou null.
       - Produto inativo some da tela de venda, mas continua no histórico das vendas.
     ------------------------------------------------------------------------ */
  const produtosStore = store(PRODUTOS_KEY, () => window.MGK_MOCK_PRODUTOS);

  // Produtos gravados antes da tela de produtos não têm o campo `ativo`
  const comAtivo = (p) => ({ ...p, ativo: p.ativo !== false });

  const produtosLocal = {
    /** Produtos ativos (os que podem ser vendidos). */
    async listar() {
      return (await produtosLocal.listarTodos()).filter((p) => p.ativo);
    },

    /** Todos os produtos, inclusive inativos (tela de produtos). */
    async listarTodos() {
      return porNome(produtosStore.read().map(comAtivo));
    },

    async obter(id) {
      const produto = produtosStore.read().find((p) => mesmoId(p.id, id));
      return produto ? comAtivo(produto) : null;
    },

    /** Cria (sem id) ou atualiza (com id). Nome repetido gera ErroMGK 409, como na API. */
    async salvar(dados) {
      const lista = produtosStore.read();
      const registro = {
        ...dados,
        nome: String(dados.nome ?? "").trim(),
        precoPadrao: centavos(dados.precoPadrao),
        ativo: dados.ativo !== false,
        foto: dados.foto || null,
      };
      if (lista.some((p) => normalize(p.nome) === normalize(registro.nome) && !mesmoId(p.id, registro.id))) {
        throw new ErroMGK("Já existe um produto cadastrado com este nome.", 409);
      }
      const idx = registro.id ? lista.findIndex((p) => mesmoId(p.id, registro.id)) : -1;
      if (registro.id && idx < 0) throw new ErroMGK("Produto não encontrado.", 404);

      if (idx >= 0) {
        lista[idx] = { ...lista[idx], ...registro, atualizadoEm: new Date().toISOString() };
      } else {
        registro.id = newId("p");
        registro.criadoEm = new Date().toISOString();
        lista.push(registro);
      }
      if (!produtosStore.write(lista)) {
        throw new ErroMGK("Não há espaço no navegador para salvar. Remova ou troque fotos de outros produtos.", 507);
      }
      return comAtivo(idx >= 0 ? lista[idx] : registro);
    },

    /**
     * Exclui um produto cadastrado por engano. Produto que já aparece em alguma venda não pode
     * ser excluído (o histórico depende dele): gera ErroMGK 409, como na API. Nesse caso, inative.
     */
    async excluir(id) {
      const lista = produtosStore.read();
      if (!lista.some((p) => mesmoId(p.id, id))) throw new ErroMGK("Produto não encontrado.", 404);
      if (vendasStore.read().some((v) => v.produtos.some((item) => mesmoId(item.produtoId, id)))) {
        throw new ErroMGK("Este produto já foi usado em vendas e não pode ser excluído. Inative-o para tirá-lo da venda.", 409);
      }
      produtosStore.write(lista.filter((p) => !mesmoId(p.id, id)));
    },

    /**
     * Avisa quando os produtos forem alterados em outra aba (ex.: tela de produtos aberta ao lado
     * da tela de venda). O evento "storage" só dispara nas OUTRAS abas do mesmo navegador.
     */
    aoAlterar(callback) {
      window.addEventListener("storage", (event) => {
        if (event.key === PRODUTOS_KEY || event.key === null) callback();
      });
    },

    async restaurarDemonstracao() {
      produtosStore.reset();
    },
  };

  const produtosApi = {
    listar: () => api.get("/produtos"),
    listarTodos: () => api.get(`/produtos?${query({ todos: 1 })}`),
    obter: (id) => ouNulo(api.get(rota("/produtos", id))),

    /** POST /produtos (novo) ou PUT /produtos/:id (edição). */
    salvar(dados) {
      const { id, criadoEm, atualizadoEm, ...corpo } = dados;
      return id ? api.put(rota("/produtos", id), corpo) : api.post("/produtos", corpo);
    },

    /** DELETE /produtos/:id → 204; 409 se o produto já foi usado em vendas. */
    excluir: (id) => api.delete(rota("/produtos", id)),

    // Sem aviso entre abas no modo API: a tela de venda recarrega o catálogo ao voltar para a aba
    aoAlterar() {},
  };

  const produtos = MODO_API ? produtosApi : produtosLocal;

  /* ------------------------------------------------------------------------
     Repositório de vendas
     Venda: { id, numero, clienteId, data, produtos, subtotal, desconto, total, status, pagamentos }
     Produto na venda: { produtoId, nome, quantidade, precoPadrao, precoUnitario, subtotal }
       - precoUnitario é o preço PRATICADO nesta venda; precoPadrao é só um registro do preço de
         tabela no momento da venda. Alterar um não altera o outro.
     Pagamento: { id, data, valor, forma, observacao }
       - O cliente pode pagar só uma parte na hora e o restante depois, em quantas vezes quiser.
         O saldo em aberto é total − soma dos pagamentos (veja vendas.pagamento()).
     ------------------------------------------------------------------------ */
  const vendasStore = store(VENDAS_KEY, () => window.MGK_MOCK_VENDAS);

  /** Regras que valem nos dois modos (não acessam dados). */
  const vendasRegras = {
    STATUS: {
      concluido: "Concluído",
      andamento: "Em andamento",
      cancelado: "Cancelado",
    },

    FORMAS_PAGAMENTO: {
      dinheiro: "Dinheiro",
      pix: "Pix",
      debito: "Cartão de débito",
      credito: "Cartão de crédito",
      transferencia: "Transferência / depósito",
      boleto: "Boleto",
      outro: "Outro",
    },

    SITUACAO_PAGAMENTO: {
      pago: "Pago",
      parcial: "Pago em parte",
      pendente: "Não pago",
      cancelado: "—",
    },

    /** Quanto já foi pago e quanto falta. Venda cancelada não tem saldo a receber. */
    pagamento(venda) {
      const pago = centavos((venda.pagamentos || []).reduce((acc, p) => acc + Number(p.valor), 0));
      if (venda.status === "cancelado") return { pago, saldo: 0, situacao: "cancelado" };
      const saldo = centavos(Math.max(Number(venda.total) - pago, 0));
      return { pago, saldo, situacao: saldo === 0 ? "pago" : pago > 0 ? "parcial" : "pendente" };
    },

    /**
     * Conta em aberto do cliente: as vendas com saldo, da MAIS ANTIGA para a mais recente
     * (é nessa ordem que um valor pago a mais é abatido).
     * @returns {{ saldo: number, vendas: {venda: object, saldo: number}[] }}
     */
    contaEmAberto(vendasDoCliente) {
      const abertas = vendasDoCliente
        .map((venda) => ({ venda, saldo: vendasRegras.pagamento(venda).saldo }))
        .filter((a) => a.saldo > 0)
        .sort((a, b) => String(a.venda.data).localeCompare(String(b.venda.data)) || String(a.venda.numero).localeCompare(String(b.venda.numero)));
      return { saldo: centavos(abertas.reduce((acc, a) => acc + a.saldo, 0)), vendas: abertas };
    },

    /**
     * Divide o valor pago no ato de uma venda nova: primeiro quita a venda nova; o que sobrar
     * abate a conta em aberto, da venda mais antiga para a mais recente.
     * @returns {{ naVenda: number, abatimentos: {venda: object, valor: number}[] }}
     */
    distribuirPagamento(valor, totalVenda, conta) {
      const naVenda = centavos(Math.min(valor, totalVenda));
      let sobra = centavos(valor - naVenda);
      const abatimentos = [];
      for (const { venda, saldo } of conta.vendas) {
        if (sobra <= 0) break;
        const parte = centavos(Math.min(sobra, saldo));
        abatimentos.push({ venda, valor: parte });
        sobra = centavos(sobra - parte);
      }
      return { naVenda, abatimentos };
    },

    /** Calcula subtotais e total a partir dos itens (mesma regra usada na tela e no registro). */
    calcular(itens, desconto = 0) {
      const linhas = itens.map((i) => ({ ...i, subtotal: centavos(i.quantidade * i.precoUnitario) }));
      const subtotal = centavos(linhas.reduce((acc, i) => acc + i.subtotal, 0));
      const descontoAplicado = centavos(Math.min(Math.max(desconto, 0), subtotal));
      return { itens: linhas, subtotal, desconto: descontoAplicado, total: centavos(subtotal - descontoAplicado) };
    },

    /** Resumo da ficha a partir das vendas de um cliente. Vendas canceladas não entram na conta. */
    resumir(lista) {
      const validas = lista.filter((v) => v.status !== "cancelado");
      return {
        quantidade: validas.length,
        totalGasto: centavos(validas.reduce((acc, v) => acc + Number(v.total), 0)),
        emAberto: centavos(validas.reduce((acc, v) => acc + vendasRegras.pagamento(v).saldo, 0)),
        ultimaCompra: validas.reduce((ultima, v) => (!ultima || v.data > ultima ? v.data : ultima), null),
      };
    },

    async resumoCliente(clienteId) {
      return vendasRegras.resumir(await vendas.porCliente(clienteId));
    },
  };

  const proximoNumero = () => {
    const maior = vendasStore.read().reduce((max, v) => Math.max(max, Number(v.numero) || 0), 0);
    return String(maior + 1).padStart(6, "0");
  };

  /**
   * Vendas gravadas antes do controle de pagamentos não têm `pagamentos`: eram consideradas
   * quitadas, então viram um pagamento único do total, na data da venda (forma não informada).
   */
  const comPagamentos = (v) => {
    if (Array.isArray(v.pagamentos)) return v;
    const quitada = v.status === "cancelado" ? [] : [{ id: `pg-${v.numero}-1`, data: v.data, valor: v.total, forma: null, observacao: "" }];
    return { ...v, pagamentos: quitada };
  };

  const lerVendas = () => vendasStore.read().map(comPagamentos);

  /**
   * Valida o pagamento feito no ato da venda. Pode ser 0 (o cliente paga tudo depois) e pode passar
   * do total da venda, até o total + a conta em aberto do cliente (a diferença abate a conta).
   */
  const validarPagamentoInicial = ({ valor = 0, forma } = {}, total, contaAnterior = 0) => {
    const maximo = centavos(total + contaAnterior);
    if (!(valor >= 0)) return "Valor recebido inválido.";
    if (valor > maximo) {
      return contaAnterior > 0
        ? `O valor recebido não pode passar de ${format.moeda(maximo)} (total da venda + conta em aberto).`
        : "O valor recebido não pode ser maior que o total da venda (o cliente não tem conta em aberto).";
    }
    if (valor > 0 && !vendasRegras.FORMAS_PAGAMENTO[forma]) return "Selecione a forma de pagamento.";
    return null;
  };

  const vendasLocal = {
    async listar() {
      return lerVendas().sort((a, b) => b.data.localeCompare(a.data) || b.numero.localeCompare(a.numero));
    },

    async obter(id) {
      return lerVendas().find((v) => mesmoId(v.id, id)) || null;
    },

    /** Vendas do cliente, da mais recente para a mais antiga. */
    async porCliente(clienteId) {
      return (await vendasLocal.listar()).filter((v) => mesmoId(v.clienteId, clienteId));
    },

    /**
     * Registra uma venda concluída e a vincula ao cliente.
     * `pagamento` é o que o cliente pagou NA HORA (0 = paga tudo depois); o resto fica em aberto.
     * Se pagar MAIS que o total, a diferença abate a conta em aberto dele (vendas mais antigas primeiro).
     * @param {{clienteId: string, itens: {produtoId: string, quantidade: number, precoUnitario: number}[],
     *          desconto?: number, pagamento?: {valor: number, forma?: string}}} dados
     * @returns a venda, com `abatimentos: [{ vendaId, numero, valor }]` (o que foi abatido de vendas anteriores)
     */
    async registrar({ clienteId, itens, desconto = 0, pagamento = { valor: 0 } }) {
      if (!(await clientesLocal.obter(clienteId))) throw new ErroMGK("Cliente não encontrado.", 404);
      if (!itens || !itens.length) throw new ErroMGK("Adicione pelo menos um produto.", 400);

      const produtosVenda = [];
      for (const item of itens) {
        const produto = await produtosLocal.obter(item.produtoId);
        if (!produto) throw new ErroMGK("Produto não encontrado.", 404);
        if (!produto.ativo) throw new ErroMGK(`O produto ${produto.nome} está inativo e não pode ser vendido.`, 400);
        if (!Number.isInteger(item.quantidade) || item.quantidade < 1) throw new ErroMGK("Quantidade inválida.", 400);
        if (!(item.precoUnitario > 0)) throw new ErroMGK("Preço unitário inválido.", 400);
        produtosVenda.push({
          produtoId: produto.id,
          nome: produto.nome,
          quantidade: item.quantidade,
          precoPadrao: produto.precoPadrao,
          precoUnitario: centavos(item.precoUnitario),
        });
      }

      const lista = lerVendas();
      const conta = vendasRegras.contaEmAberto(lista.filter((v) => mesmoId(v.clienteId, clienteId)));

      const calculo = vendasRegras.calcular(produtosVenda, desconto);
      const valorPago = centavos(pagamento.valor);
      const erroPagamento = validarPagamentoInicial({ ...pagamento, valor: valorPago }, calculo.total, conta.saldo);
      if (erroPagamento) throw new ErroMGK(erroPagamento, 400);

      const numero = proximoNumero();
      const data = new Date().toISOString();
      const { naVenda, abatimentos } = vendasRegras.distribuirPagamento(valorPago, calculo.total, conta);
      const venda = {
        id: `v-${numero}`,
        numero,
        clienteId,
        data,
        produtos: calculo.itens,
        subtotal: calculo.subtotal,
        desconto: calculo.desconto,
        total: calculo.total,
        status: "concluido",
        pagamentos: naVenda > 0
          ? [{ id: newId("pg"), data, valor: naVenda, forma: pagamento.forma, observacao: "Pago na venda" }]
          : [],
      };

      // O que passou do total abate as vendas antigas (os objetos de `conta` são os mesmos de `lista`)
      abatimentos.forEach(({ venda: antiga, valor }) => {
        antiga.pagamentos.push({ id: newId("pg"), data, valor, forma: pagamento.forma, observacao: `Abatido na venda #${numero}` });
      });

      lista.push(venda);
      vendasStore.write(lista);
      return {
        ...venda,
        abatimentos: abatimentos.map(({ venda: antiga, valor }) => ({ vendaId: antiga.id, numero: antiga.numero, valor })),
      };
    },

    /**
     * Registra um pagamento posterior (ex.: o cliente depositou mais uma parte).
     * @param {string} vendaId
     * @param {{valor: number, forma: string, data?: string, observacao?: string}} pagamento
     *        `data` em ISO; sem data = agora.
     * @returns a venda atualizada
     */
    async registrarPagamento(vendaId, { valor, forma, data, observacao = "" }) {
      const lista = lerVendas();
      const venda = lista.find((v) => mesmoId(v.id, vendaId));
      if (!venda) throw new ErroMGK("Venda não encontrada.", 404);
      if (venda.status === "cancelado") throw new ErroMGK("Venda cancelada não recebe pagamentos.", 400);

      const { saldo } = vendasRegras.pagamento(venda);
      const valorPago = centavos(valor);
      const quando = data ? new Date(data) : new Date();
      if (!(valorPago > 0)) throw new ErroMGK("Informe um valor maior que zero.", 400);
      if (valorPago > saldo) throw new ErroMGK(`O valor passa do saldo em aberto (${format.moeda(saldo)}).`, 400);
      if (!vendasRegras.FORMAS_PAGAMENTO[forma]) throw new ErroMGK("Selecione a forma de pagamento.", 400);
      if (Number.isNaN(quando.getTime())) throw new ErroMGK("Data do pagamento inválida.", 400);
      // Pode ser anterior à data da venda: pagamentos antigos (ex.: da planilha do Excel) são lançados depois
      if (quando.getTime() > Date.now() + 5 * 60 * 1000) throw new ErroMGK("A data do pagamento não pode ser no futuro.", 400);

      venda.pagamentos.push({
        id: newId("pg"),
        data: quando.toISOString(),
        valor: valorPago,
        forma,
        observacao: String(observacao).trim().slice(0, 255),
      });
      vendasStore.write(lista);
      return venda;
    },

    async restaurarDemonstracao() {
      vendasStore.reset();
    },
  };

  const vendasApi = {
    listar: () => api.get("/vendas"),

    obter: (id) => ouNulo(api.get(rota("/vendas", id))),

    porCliente: (clienteId) => api.get(`/vendas?${query({ clienteId })}`),

    /**
     * POST /vendas com { clienteId, itens: [{ produtoId, quantidade, precoUnitario }], desconto, pagamento }.
     * O servidor valida, recalcula os totais, gera número e data e devolve a venda completa.
     */
    registrar: ({ clienteId, itens, desconto = 0, pagamento = { valor: 0 } }) =>
      api.post("/vendas", { clienteId, itens, desconto, pagamento }),

    /** POST /vendas/:id/pagamentos com { valor, forma, data, observacao } → venda atualizada. */
    registrarPagamento: (vendaId, { valor, forma, data, observacao = "" }) =>
      api.post(`${rota("/vendas", vendaId)}/pagamentos`, { valor, forma, data, observacao }),
  };

  const vendas = { ...vendasRegras, ...(MODO_API ? vendasApi : vendasLocal) };

  /* ------------------------------------------------------------------------
     Repositório de usuários (tela de usuários, só o admin/TI)
     Usuário: { id, nome, usuario, email, tipo, senhaHash }
       - Local: os de mock-data.js + os criados/editados na tela (guardados no navegador).
         A senha é guardada somente como hash SHA-256 (sem segurança real: é só demonstração).
       - API: o back-end grava o hash scrypt no MySQL.
     A lista devolvida nunca traz a senha nem o hash.
     ------------------------------------------------------------------------ */
  const usuariosStore = store(USUARIOS_KEY, () => []);

  const TIPOS_USUARIO = ["vendedor", "chefe", "admin"];

  async function sha256(texto) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
    return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const semSenha = ({ id, nome, usuario, email, tipo }) => ({ id, nome, usuario, email: email || null, tipo });

  /**
   * Mesmas regras de backend/src/validacao.js (validarUsuario). Devolve a mensagem de erro ou "".
   * Na edição (senhaOpcional), senha vazia = manter a atual.
   */
  function validarUsuario({ nome, usuario, email, tipo, senha }, { senhaOpcional = false } = {}) {
    if (String(nome ?? "").trim().length < 3) return "Informe o nome (mínimo 3 caracteres).";
    if (!/^[\w.\-]{3,60}$/.test(String(usuario ?? "").trim())) return "Usuário inválido (3 a 60 letras, números, ponto, traço ou _).";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) return "E-mail inválido.";
    if (!TIPOS_USUARIO.includes(tipo)) return "Selecione o tipo do usuário.";
    if (!(senhaOpcional && !senha) && String(senha ?? "").length < 6) return "A senha precisa ter pelo menos 6 caracteres.";
    return "";
  }

  // O navegador guarda os usuários criados na tela e as edições dos de mock-data.js (mesmo id)
  const todosUsuariosLocal = () => {
    const salvos = usuariosStore.read();
    const doMock = (window.MGK_MOCK_USUARIOS || []).filter((m) => !salvos.some((s) => mesmoId(s.id, m.id)));
    return [...doMock, ...salvos];
  };

  /** Usuário ou e-mail já usado por OUTRO usuário gera ErroMGK 409, como na API. */
  function conferirRepetido(lista, { id, usuario, email }) {
    const outros = lista.filter((u) => !mesmoId(u.id, id));
    if (outros.some((u) => normalize(u.usuario) === normalize(usuario))) {
      throw new ErroMGK("Já existe um usuário com este nome de acesso.", 409);
    }
    if (email && outros.some((u) => u.email && normalize(u.email) === normalize(email))) {
      throw new ErroMGK("Já existe um usuário com este e-mail.", 409);
    }
  }

  function gravarUsuarioLocal(registro) {
    const salvos = usuariosStore.read();
    const idx = salvos.findIndex((u) => mesmoId(u.id, registro.id));
    if (idx >= 0) salvos[idx] = registro;
    else salvos.push(registro);
    if (!usuariosStore.write(salvos)) throw new ErroMGK("Não há espaço no navegador para salvar.", 507);
    return semSenha(registro);
  }

  const usuariosLocal = {
    listar: async () => todosUsuariosLocal().map(semSenha),

    async criar({ nome, usuario, email, tipo, senha }) {
      const erro = validarUsuario({ nome, usuario, email, tipo, senha });
      if (erro) throw new ErroMGK(erro, 400);
      conferirRepetido(todosUsuariosLocal(), { usuario, email });

      return gravarUsuarioLocal({
        id: `u-${Date.now()}`,
        nome: nome.trim(),
        usuario: usuario.trim(),
        email: email ? email.trim() : null,
        tipo,
        senhaHash: await sha256(senha),
      });
    },

    /** Edita o usuário. Senha vazia mantém a atual; senha nova é guardada só como hash. */
    async atualizar(id, { nome, usuario, email, tipo, senha }) {
      const erro = validarUsuario({ nome, usuario, email, tipo, senha }, { senhaOpcional: true });
      if (erro) throw new ErroMGK(erro, 400);

      const lista = todosUsuariosLocal();
      const atual = lista.find((u) => mesmoId(u.id, id));
      if (!atual) throw new ErroMGK("Usuário não encontrado.", 404);
      conferirRepetido(lista, { id, usuario, email });
      // Evita o admin tirar o próprio acesso a esta tela
      if (mesmoId(id, window.MGK_AUTH?.usuarioLogado()?.id) && tipo !== atual.tipo) {
        throw new ErroMGK("Você não pode mudar o seu próprio tipo de acesso.", 400);
      }

      const { senha: senhaAntiga, senhaHash: hashAntigo } = atual;
      return gravarUsuarioLocal({
        id: atual.id,
        nome: nome.trim(),
        usuario: usuario.trim(),
        email: email ? email.trim() : null,
        tipo,
        ...(senha ? { senhaHash: await sha256(senha) } : hashAntigo ? { senhaHash: hashAntigo } : { senha: senhaAntiga }),
      });
    },

    /** Login do modo local. Aceita "senhaHash" (SHA-256) ou "senha" em texto puro (usuários de teste). */
    async autenticar(login, senha) {
      const hash = await sha256(senha);
      const usuario = todosUsuariosLocal().find(
        (u) =>
          (normalize(u.usuario) === normalize(login) || normalize(u.email) === normalize(login)) &&
          (u.senhaHash ? u.senhaHash === hash : u.senha === senha)
      );
      if (!usuario) throw new ErroMGK("Usuário ou senha inválidos.", 401);
      return semSenha(usuario);
    },
  };

  const usuariosApi = {
    listar: () => api.get("/usuarios"),
    /** POST /usuarios com { nome, usuario, email, tipo, senha } → usuário criado (sem a senha). */
    criar: ({ nome, usuario, email, tipo, senha }) => api.post("/usuarios", { nome, usuario, email, tipo, senha }),
    /** PUT /usuarios/:id com os mesmos campos; senha vazia mantém a atual. */
    atualizar: (id, { nome, usuario, email, tipo, senha }) =>
      api.put(rota("/usuarios", id), { nome, usuario, email, tipo, senha }),
  };

  const usuarios = { TIPOS: TIPOS_USUARIO, validar: validarUsuario, ...(MODO_API ? usuariosApi : usuariosLocal) };

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

  window.MGK = {
    config: CONFIG,
    modoApi: MODO_API,
    api,
    ErroMGK,
    onlyDigits,
    normalize,
    escapeHtml,
    initials,
    mesmoId,
    format,
    validate,
    clientes,
    produtos,
    vendas,
    usuarios,
    ui,
    auth: window.MGK_AUTH,
  };

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
