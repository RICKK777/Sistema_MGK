/**
 * Login e permissões do Sistema MGK (lado do site).
 *
 * Carregado no <head> de todas as telas, ANTES do conteúdo: quem não está logado, ou não tem
 * permissão para a tela (mesmo digitando o endereço), é redirecionado antes de ver qualquer coisa.
 *
 * No HTML:
 *   data-permissao="cadastrar_produto" → o elemento some para quem não tem a permissão
 *   data-usuario-nome / data-usuario-tipo / data-usuario-iniciais → dados do usuário logado
 *   data-sair → botão de sair
 *
 * Isto só organiza a tela. Quem garante a segurança é o back-end, que confere as mesmas
 * permissões em cada operação (backend/src/permissoes.js).
 */
(function () {
  "use strict";

  const SESSAO_KEY = "mgk.sessao";
  const FLASH_KEY = "mgk.flash";

  // Mesma lista de backend/src/permissoes.js: se mudar aqui, mude lá também.
  const PERMISSOES = {
    vendedor: ["consultar_cliente", "cadastrar_cliente", "cadastrar_venda", "registrar_pagamento"],
    chefe: ["consultar_cliente", "cadastrar_cliente", "cadastrar_venda", "registrar_pagamento", "cadastrar_produto"],
    admin: ["todos"],
  };

  const TIPOS = { vendedor: "Vendedor", chefe: "Chefe", admin: "Administrador (TI)" };

  // Permissão exigida por cada tela. A primeira que o usuário puder abrir é a tela inicial dele.
  const PAGINAS = {
    "clientes.html": "consultar_cliente",
    "venda.html": "cadastrar_venda",
    "cadastro-cliente.html": "cadastrar_cliente",
    "produtos.html": "cadastrar_produto",
    "usuarios.html": "gerenciar_usuarios", // não está em nenhum tipo: só o admin (TI)
  };

  /* ---------------------------- Sessão ---------------------------- */
  function lerSessao() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSAO_KEY));
    } catch (_) {
      return null;
    }
  }

  function usuarioLogado() {
    return lerSessao()?.usuario || null;
  }

  function token() {
    return lerSessao()?.token || null;
  }

  /** Guarda o usuário (e o token da API, no modo "api") até fechar a aba ou sair. */
  function iniciarSessao({ id, nome, tipo }, tokenApi = null) {
    sessionStorage.setItem(SESSAO_KEY, JSON.stringify({ usuario: { id, nome, tipo }, token: tokenApi }));
  }

  function encerrarSessao() {
    sessionStorage.removeItem(SESSAO_KEY);
  }

  function avisarNaProximaTela(message, type = "success") {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, type }));
  }

  async function sair() {
    // No modo "api", avisa o servidor para invalidar o token (se falhar, sai do mesmo jeito)
    if (token() && window.MGK?.modoApi) await MGK.api.post("/auth/logout").catch(() => {});
    encerrarSessao();
    avisarNaProximaTela("Você saiu do sistema.");
    location.replace("login.html");
  }

  /* -------------------------- Permissões -------------------------- */
  function temPermissao(permissao) {
    const usuario = usuarioLogado();
    if (!usuario) return false;
    if (usuario.tipo === "admin") return true;
    return (PERMISSOES[usuario.tipo] || []).includes(permissao);
  }

  function paginaInicial() {
    return Object.keys(PAGINAS).find((pagina) => temPermissao(PAGINAS[pagina])) || "login.html";
  }

  /** "produtos.html", "/produtos" e "/" (index) viram o nome do arquivo da tela. */
  function paginaAtual() {
    const nome = location.pathname.split("/").pop() || "index.html";
    return nome.endsWith(".html") ? nome : `${nome}.html`;
  }

  function permissaoDaPagina(pagina) {
    // cadastro-cliente.html?id=... é a edição do cliente
    if (pagina === "cadastro-cliente.html" && new URLSearchParams(location.search).has("id")) return "editar_cliente";
    return PAGINAS[pagina];
  }

  function protegerPagina() {
    const pagina = paginaAtual();
    if (pagina === "login.html") return;

    if (!usuarioLogado()) {
      location.replace("login.html");
      return;
    }
    const permissao = permissaoDaPagina(pagina);
    if (permissao && !temPermissao(permissao)) {
      avisarNaProximaTela("Você não tem permissão para acessar essa tela.", "error");
      location.replace(paginaInicial());
    }
  }

  /* ----------------------------- Tela ----------------------------- */
  function preencher(seletor, texto) {
    document.querySelectorAll(seletor).forEach((el) => (el.textContent = texto));
  }

  function aplicarNaTela() {
    const usuario = usuarioLogado();
    if (!usuario) return;

    document.querySelectorAll("[data-permissao]").forEach((el) => {
      if (!temPermissao(el.dataset.permissao)) el.hidden = true;
    });

    preencher("[data-usuario-nome]", usuario.nome);
    preencher("[data-usuario-tipo]", TIPOS[usuario.tipo] || usuario.tipo);
    preencher("[data-usuario-iniciais]", window.MGK ? MGK.initials(usuario.nome) : "");

    document.querySelectorAll("[data-sair]").forEach((btn) => btn.addEventListener("click", sair));
  }

  window.MGK_AUTH = {
    PERMISSOES,
    TIPOS,
    usuarioLogado,
    token,
    temPermissao,
    iniciarSessao,
    encerrarSessao,
    avisarNaProximaTela,
    sair,
    paginaInicial,
  };

  protegerPagina();
  document.addEventListener("DOMContentLoaded", aplicarNaTela);
})();
