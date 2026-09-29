/**
 * Tela de login.
 * - Modo "api":   POST /auth/login → o back-end confere a senha (hash) e devolve um token.
 * - Modo "local": confere os usuários de demonstração de mock-data.js (sem segurança real).
 */
(function () {
  "use strict";

  const { auth, api, modoApi, usuarios } = window.MGK;
  const $ = (id) => document.getElementById(id);

  // Já está logado: vai direto para a tela inicial
  if (auth.usuarioLogado() && auth.paginaInicial() !== "login.html") {
    location.replace(auth.paginaInicial());
    return;
  }

  if ($("avisoDemo")) $("avisoDemo").hidden = modoApi;

  // Usuários de mock-data.js e os criados na tela de usuários (veja MGK.usuarios em app.js)
  const entrarLocal = async (login, senha) => ({ usuario: await usuarios.autenticar(login, senha), token: null });

  const entrarNaApi = (login, senha) => api.post("/auth/login", { login, senha });

  function mostrarErro(mensagem) {
    $("erroLoginTexto").textContent = mensagem;
    $("erroLogin").hidden = !mensagem;
  }

  $("formLogin").addEventListener("submit", async (event) => {
    event.preventDefault();
    const login = $("login").value.trim();
    const senha = $("senha").value;
    if (!login || !senha) {
      mostrarErro("Informe o usuário e a senha.");
      return;
    }

    mostrarErro("");
    $("btnEntrar").disabled = true;
    try {
      const { usuario, token } = modoApi ? await entrarNaApi(login, senha) : await entrarLocal(login, senha);
      auth.iniciarSessao(usuario, token);
      location.replace(auth.paginaInicial());
    } catch (err) {
      mostrarErro(err.message || "Não foi possível entrar.");
      $("senha").value = "";
      $("senha").focus();
      $("btnEntrar").disabled = false;
    }
  });

  $("btnVerSenha").addEventListener("click", () => {
    const campo = $("senha");
    const mostrar = campo.type === "password";
    campo.type = mostrar ? "text" : "password";
    $("btnVerSenha").innerHTML = `<i class="bi ${mostrar ? "bi-eye-slash" : "bi-eye"}"></i>`;
    $("btnVerSenha").setAttribute("aria-label", mostrar ? "Esconder senha" : "Mostrar senha");
  });
})();
