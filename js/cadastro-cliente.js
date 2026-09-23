/**
 * Tela: Cadastro / Edição de Cliente
 * - cadastro-cliente.html         → novo cliente
 * - cadastro-cliente.html?id=<id> → edição do cliente
 */
(function () {
  "use strict";

  const { clientes, format, validate, onlyDigits, ui } = window.MGK;

  const ESTADOS = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
    "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
  ];

  const CAMPOS = [
    "id", "nome", "documento", "telefone", "celular", "email",
    "cep", "rua", "numero", "complemento", "bairro", "cidade", "estado",
  ];

  const form = document.getElementById("formCliente");
  const $ = (id) => document.getElementById(id);

  const idEdicao = new URLSearchParams(location.search).get("id");
  const modoEdicao = Boolean(idEdicao);

  /* ------------------------------------------------------------------------
     Estados (UF)
     ------------------------------------------------------------------------ */
  $("estado").insertAdjacentHTML(
    "beforeend",
    ESTADOS.map((uf) => `<option value="${uf}">${uf}</option>`).join("")
  );

  /* ------------------------------------------------------------------------
     Máscaras
     ------------------------------------------------------------------------ */
  const mascaras = {
    documento: format.documento,
    telefone: format.telefone,
    celular: format.telefone,
    cep: format.cep,
  };

  Object.entries(mascaras).forEach(([id, mask]) => {
    $(id).addEventListener("input", (event) => {
      event.target.value = mask(event.target.value);
    });
  });

  /* ------------------------------------------------------------------------
     Validação
     ------------------------------------------------------------------------ */
  const validarCampos = () => {
    const nome = $("nome");
    nome.setCustomValidity(nome.value.trim().length >= 3 ? "" : "invalid");

    const doc = $("documento");
    const docFeedback = $("documentoFeedback");
    if (!validate.documento(doc.value)) {
      const digitos = onlyDigits(doc.value).length;
      docFeedback.textContent =
        digitos === 0 ? "Informe o CPF ou CNPJ." :
        digitos === 11 ? "CPF inválido. Verifique os números digitados." :
        digitos === 14 ? "CNPJ inválido. Verifique os números digitados." :
        "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).";
      doc.setCustomValidity("invalid");
    } else if (clientes.documentoEmUso(doc.value, idEdicao)) {
      docFeedback.textContent = `Já existe um cliente cadastrado com este ${format.tipoDocumento(doc.value)}.`;
      doc.setCustomValidity("invalid");
    } else {
      doc.setCustomValidity("");
    }

    ["telefone", "celular"].forEach((id) => {
      const input = $(id);
      input.setCustomValidity(!input.value || validate.telefone(input.value) ? "" : "invalid");
    });

    const email = $("email");
    email.setCustomValidity(!email.value || validate.email(email.value) ? "" : "invalid");

    const cep = $("cep");
    cep.setCustomValidity(validate.cep(cep.value) ? "" : "invalid");

    return form.checkValidity();
  };

  // Após a primeira tentativa de salvar, o feedback passa a ser atualizado em tempo real
  form.addEventListener("input", () => {
    if (form.classList.contains("was-validated")) validarCampos();
  });

  /* ------------------------------------------------------------------------
     Modo edição
     ------------------------------------------------------------------------ */
  const preencher = (cliente) => {
    CAMPOS.forEach((campo) => {
      const input = $(campo);
      if (input) input.value = cliente[campo] ?? "";
    });
    $("documento").value = format.documento(cliente.documento);
    $("telefone").value = format.telefone(cliente.telefone);
    $("celular").value = format.telefone(cliente.celular);
    $("cep").value = format.cep(cliente.cep);
    $("status").checked = cliente.status !== "inativo";
  };

  if (modoEdicao) {
    const cliente = clientes.obter(idEdicao);
    if (!cliente) {
      ui.flash("Cliente não encontrado.", "error");
      location.replace("clientes.html");
      return;
    }

    document.title = "Editar Cliente | Sistema MGK";
    $("tituloPagina").textContent = "Editar Cliente";
    $("subtituloPagina").textContent = `Atualize os dados de ${cliente.nome}.`;
    $("breadcrumbAtual").textContent = "Editar";
    $("btnSalvarTexto").textContent = "Salvar Alterações";
    $("grupoStatus").hidden = false;

    const menuCadastrar = $("menuCadastrar");
    menuCadastrar.classList.remove("active");
    menuCadastrar.removeAttribute("aria-current");

    preencher(cliente);
  }

  /* ------------------------------------------------------------------------
     Salvar
     ------------------------------------------------------------------------ */
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    form.classList.add("was-validated");

    if (!validarCampos()) {
      const primeiroInvalido = form.querySelector(":invalid");
      primeiroInvalido?.focus();
      primeiroInvalido?.scrollIntoView({ behavior: "smooth", block: "center" });
      ui.toast("Revise os campos destacados.", "error");
      return;
    }

    const dados = {};
    CAMPOS.forEach((campo) => {
      dados[campo] = $(campo).value.trim();
    });
    ["documento", "telefone", "celular", "cep"].forEach((campo) => {
      dados[campo] = onlyDigits(dados[campo]);
    });
    if (!dados.id) delete dados.id;
    dados.status = modoEdicao && !$("status").checked ? "inativo" : "ativo";

    const btn = $("btnSalvar");
    btn.disabled = true;

    const salvo = clientes.salvar(dados);
    ui.flash(
      modoEdicao
        ? `Dados de ${salvo.nome} atualizados com sucesso.`
        : `Cliente ${salvo.nome} cadastrado com sucesso.`
    );
    location.href = "clientes.html";
  });

  $("nome").focus();
})();
