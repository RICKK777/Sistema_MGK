/**
 * Tela: Usuários (só o admin/TI)
 * - Criar: preencha o formulário. A senha sai daqui só para virar hash:
 *     modo "local" → SHA-256 no navegador (MGK.usuarios em app.js);
 *     modo "api"   → o back-end grava o hash scrypt (backend/src/rotas/usuarios.js).
 * - Editar: botão de lápis na lista (carrega o usuário no formulário).
 *   Senha em branco mantém a atual; preenchida, troca a senha (também só como hash).
 * - Lista: todos os usuários, sem senha nem hash.
 */
(function () {
  "use strict";

  const { usuarios, normalize, escapeHtml, mesmoId, modoApi, ui, auth } = window.MGK;
  const $ = (id) => document.getElementById(id);

  const el = {
    form: $("formUsuario"),
    tituloForm: $("tituloForm"),
    id: $("id"),
    nome: $("nome"),
    usuario: $("usuario"),
    usuarioFeedback: $("usuarioFeedback"),
    email: $("email"),
    emailFeedback: $("emailFeedback"),
    tipo: $("tipo"),
    tipoAjuda: $("tipoAjuda"),
    senha: $("senha"),
    senhaLabel: $("senhaLabel"),
    senhaReq: $("senhaReq"),
    senhaAjuda: $("senhaAjuda"),
    confirmarSenha: $("confirmarSenha"),
    confirmarReq: $("confirmarReq"),
    btnVerSenha: $("btnVerSenha"),
    btnSalvar: $("btnSalvar"),
    btnSalvarTexto: $("btnSalvarTexto"),
    btnCancelar: $("btnCancelar"),
    busca: $("campoBusca"),
    tbody: $("tabelaUsuarios"),
    tabelaWrapper: $("tabelaWrapper"),
    vazio: $("estadoVazio"),
    vazioTexto: $("estadoVazioTexto"),
    contador: $("contadorResultados"),
  };

  const AJUDA_TIPO = {
    vendedor: "Consulta e cadastra clientes, faz vendas e registra pagamentos.",
    chefe: "Tudo do vendedor e também cadastra produtos.",
    admin: "Acesso total, inclusive a esta tela de usuários.",
  };

  let lista = [];
  let destaque = null; // id do último usuário salvo (linha destacada)

  const editando = () => Boolean(el.id.value);
  const souEu = (id) => mesmoId(id, auth.usuarioLogado()?.id);

  $("avisoDemo").hidden = modoApi;

  /* ------------------------------------------------------------------------
     Lista
     ------------------------------------------------------------------------ */
  const linhaUsuario = (u) => `
    <tr class="product-row${mesmoId(u.id, destaque) ? " is-new" : ""}${mesmoId(u.id, el.id.value) ? " is-editing" : ""}">
      <td class="client-name">${escapeHtml(u.nome)}${souEu(u.id) ? ' <span class="text-secondary fw-normal">(você)</span>' : ""}</td>
      <td class="text-mono">${escapeHtml(u.usuario)}</td>
      <td>${u.email ? escapeHtml(u.email) : '<span class="text-secondary">—</span>'}</td>
      <td>${escapeHtml(auth.TIPOS[u.tipo] || u.tipo)}</td>
      <td class="text-end">
        <div class="table-actions">
          <button type="button" class="btn btn-outline-mgk btn-icon" data-action="editar" data-id="${escapeHtml(u.id)}"
                  title="Editar" aria-label="Editar ${escapeHtml(u.nome)}">
            <i class="bi bi-pencil"></i>
          </button>
        </div>
      </td>
    </tr>`;

  const render = () => {
    const termo = el.busca.value.trim();
    const texto = normalize(termo);
    const filtrados = texto
      ? lista.filter((u) => [u.nome, u.usuario, u.email].some((campo) => normalize(campo).includes(texto)))
      : lista;
    const vazio = filtrados.length === 0;

    el.tbody.innerHTML = filtrados.map(linhaUsuario).join("");
    el.tabelaWrapper.hidden = vazio;
    el.vazio.hidden = !vazio;
    if (vazio) {
      el.vazioTexto.textContent = termo ? `Não encontramos usuários para "${termo}".` : "Ainda não há usuários cadastrados.";
    }

    el.contador.innerHTML = termo
      ? `<strong>${filtrados.length}</strong> ${filtrados.length === 1 ? "resultado" : "resultados"} para "${escapeHtml(termo)}"`
      : `<strong>${lista.length}</strong> ${lista.length === 1 ? "usuário" : "usuários"}`;
  };

  const carregar = async () => {
    try {
      lista = (await usuarios.listar()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      render();
    } catch (err) {
      el.contador.textContent = "Não foi possível carregar os usuários.";
      ui.toast(err.message || "Não foi possível carregar os usuários.", "error");
    }
  };

  el.busca.addEventListener("input", render);

  el.tbody.addEventListener("click", (event) => {
    const botao = event.target.closest('[data-action="editar"]');
    if (!botao) return;
    const usuario = lista.find((u) => mesmoId(u.id, botao.dataset.id));
    if (usuario) iniciarEdicao(usuario);
  });

  /* ------------------------------------------------------------------------
     Formulário
     ------------------------------------------------------------------------ */
  const marcar = (campo, valido) => campo.classList.toggle("is-invalid", !valido);

  const limparMarcas = () =>
    [el.nome, el.usuario, el.email, el.tipo, el.senha, el.confirmarSenha].forEach((campo) => marcar(campo, true));

  const mostrarAjudaTipo = () => (el.tipoAjuda.textContent = AJUDA_TIPO[el.tipo.value] || "");

  /** Troca o formulário entre "novo usuário" e "editando usuário". */
  function modoFormulario(emEdicao, nome = "") {
    el.tituloForm.textContent = emEdicao ? `Editando: ${nome}` : "Novo usuário";
    el.btnSalvarTexto.textContent = emEdicao ? "Salvar Alterações" : "Criar Usuário";
    el.btnCancelar.hidden = !emEdicao;
    el.senhaLabel.textContent = emEdicao ? "Nova senha" : "Senha";
    el.senhaReq.hidden = el.confirmarReq.hidden = emEdicao;
    el.senhaAjuda.hidden = !emEdicao;
  }

  function iniciarEdicao(u) {
    limparMarcas();
    el.id.value = u.id;
    el.nome.value = u.nome;
    el.usuario.value = u.usuario;
    el.email.value = u.email || "";
    el.tipo.value = u.tipo;
    // O admin não pode mudar o próprio tipo (perderia o acesso a esta tela)
    el.tipo.disabled = souEu(u.id);
    el.senha.value = el.confirmarSenha.value = "";
    mostrarAjudaTipo();
    if (el.tipo.disabled) el.tipoAjuda.textContent = "Você não pode mudar o seu próprio tipo de acesso.";
    modoFormulario(true, u.nome);
    render();
    el.form.scrollIntoView({ behavior: "smooth", block: "start" });
    el.nome.focus({ preventScroll: true });
  }

  function limparFormulario() {
    el.form.reset();
    el.id.value = "";
    el.tipo.disabled = false;
    el.tipoAjuda.textContent = "";
    limparMarcas();
    modoFormulario(false);
    render();
  }

  el.btnCancelar.addEventListener("click", limparFormulario);

  const dados = () => ({
    nome: el.nome.value.trim(),
    usuario: el.usuario.value.trim(),
    email: el.email.value.trim() || null,
    tipo: el.tipo.value,
    senha: el.senha.value,
  });

  function validarCampos() {
    const d = dados();
    // Na edição, senha em branco = manter a atual
    const senhaOk = (editando() && !d.senha) || d.senha.length >= 6;
    const checagens = [
      [el.nome, d.nome.length >= 3],
      [el.usuario, /^[\w.\-]{3,60}$/.test(d.usuario)],
      [el.email, !d.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)],
      [el.tipo, usuarios.TIPOS.includes(d.tipo)],
      [el.senha, senhaOk],
      [el.confirmarSenha, el.confirmarSenha.value === d.senha],
    ];
    el.usuarioFeedback.textContent = "De 3 a 60 letras, números, ponto, traço ou _ (sem espaços).";
    el.emailFeedback.textContent = "Informe um e-mail válido.";
    checagens.forEach(([campo, ok]) => marcar(campo, ok));
    const primeiroErro = checagens.find(([, ok]) => !ok);
    if (primeiroErro) primeiroErro[0].focus();
    return !primeiroErro;
  }

  // Tira o vermelho do campo assim que o usuário corrige
  [el.nome, el.usuario, el.email, el.senha, el.confirmarSenha].forEach((campo) =>
    campo.addEventListener("input", () => marcar(campo, true))
  );

  el.tipo.addEventListener("change", () => {
    marcar(el.tipo, true);
    mostrarAjudaTipo();
  });

  el.btnVerSenha.addEventListener("click", () => {
    const mostrar = el.senha.type === "password";
    el.senha.type = el.confirmarSenha.type = mostrar ? "text" : "password";
    el.btnVerSenha.innerHTML = `<i class="bi ${mostrar ? "bi-eye-slash" : "bi-eye"}"></i>`;
    el.btnVerSenha.setAttribute("aria-label", mostrar ? "Esconder senha" : "Mostrar senha");
  });

  el.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validarCampos()) return;

    const id = el.id.value;
    const d = dados();
    el.btnSalvar.disabled = true;
    try {
      const salvo = id ? await usuarios.atualizar(id, d) : await usuarios.criar(d);
      destaque = salvo.id;

      // Editou a si mesmo: atualiza o nome no topo da tela
      if (souEu(salvo.id)) {
        const logado = auth.usuarioLogado();
        auth.iniciarSessao({ ...logado, nome: salvo.nome }, auth.token());
        document.querySelectorAll("[data-usuario-nome]").forEach((e) => (e.textContent = salvo.nome));
      }

      const mensagem = id
        ? `Usuário "${salvo.usuario}" atualizado${d.senha ? " (senha alterada)" : ""}.`
        : `Usuário "${salvo.usuario}" criado.`;
      limparFormulario();
      ui.toast(mensagem);
      await carregar();
    } catch (err) {
      // Usuário ou e-mail repetido: marca o campo certo
      if (err.status === 409) {
        const ehEmail = /e-mail/i.test(err.message);
        (ehEmail ? el.emailFeedback : el.usuarioFeedback).textContent = err.message;
        marcar(ehEmail ? el.email : el.usuario, false);
        (ehEmail ? el.email : el.usuario).focus();
      }
      ui.toast(err.message || "Não foi possível salvar o usuário.", "error");
    } finally {
      el.senha.value = el.confirmarSenha.value = "";
      el.btnSalvar.disabled = false;
    }
  });

  carregar();
})();
