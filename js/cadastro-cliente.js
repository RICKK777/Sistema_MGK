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
     Endereço pelo CEP (ViaCEP)
     Com os 8 dígitos digitados, busca o endereço e preenche rua, bairro,
     cidade e estado. Se a busca falhar, o usuário preenche manualmente.
     ------------------------------------------------------------------------ */
  const cepStatus = $("cepStatus");
  let cepBuscado = "";
  let buscaCep = null; // AbortController da busca em andamento

  const statusCep = (texto, classe = "") => {
    cepStatus.textContent = texto;
    cepStatus.className = `form-text ${classe}`;
  };

  const cancelarBuscaCep = () => {
    const anterior = buscaCep;
    buscaCep = null;
    anterior?.abort();
  };

  const buscarEndereco = async (cep) => {
    cancelarBuscaCep();
    const controle = new AbortController();
    buscaCep = controle;
    const limite = setTimeout(() => controle.abort(), 8000);
    statusCep("Buscando endereço...");

    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controle.signal });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const dados = await resposta.json();
      if (buscaCep !== controle) return; // o CEP mudou enquanto a resposta chegava

      if (dados.erro) {
        statusCep("CEP não encontrado. Confira o número ou preencha o endereço manualmente.", "text-danger");
        return;
      }

      // CEPs gerais de cidade vêm sem rua/bairro; nesse caso mantém o que já foi digitado
      const endereco = { rua: dados.logradouro, bairro: dados.bairro, cidade: dados.localidade, estado: dados.uf };
      Object.entries(endereco).forEach(([id, valor]) => {
        if (valor) $(id).value = valor;
      });
      statusCep("Endereço preenchido pelo CEP.", "text-success");
      $(dados.logradouro ? "numero" : "rua").focus();
      if (form.classList.contains("was-validated")) validarCampos();
    } catch (err) {
      if (buscaCep !== controle) return; // cancelada por uma nova busca
      console.warn("[MGK] Falha ao buscar o CEP.", err);
      statusCep("Não foi possível buscar o CEP agora. Preencha o endereço manualmente.", "text-danger");
    } finally {
      clearTimeout(limite);
      if (buscaCep === controle) buscaCep = null;
    }
  };

  $("cep").addEventListener("input", (event) => {
    const cep = onlyDigits(event.target.value);
    if (cep.length !== 8) {
      cepBuscado = "";
      cancelarBuscaCep();
      statusCep("");
      return;
    }
    if (cep === cepBuscado) return;
    cepBuscado = cep;
    buscarEndereco(cep);
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
