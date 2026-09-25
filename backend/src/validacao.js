/**
 * Validações do back-end. São as mesmas regras de MGK.validate (site/js/app.js):
 * o site valida para ajudar o usuário; a API valida de novo porque qualquer um pode chamá-la direto.
 */
export const onlyDigits = (value) => String(value ?? "").replace(/\D/g, "");

const ESTADOS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

export function cpfValido(value) {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (let t = 9; t < 11; t++) {
    let sum = 0;
    for (let i = 0; i < t; i++) sum += Number(d[i]) * (t + 1 - i);
    if (((sum * 10) % 11) % 10 !== Number(d[t])) return false;
  }
  return true;
}

export function cnpjValido(value) {
  const d = onlyDigits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const rest = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0) % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

const texto = (value) => String(value ?? "").trim();
const opcional = (value) => texto(value) || null;

/**
 * Valida o corpo de POST/PUT /clientes e devolve os dados prontos para o banco.
 * @returns {{ erro: string } | { dados: object }}
 */
export function validarCliente(corpo = {}) {
  const dados = {
    nome: texto(corpo.nome),
    documento: onlyDigits(corpo.documento),
    telefone: opcional(onlyDigits(corpo.telefone)),
    celular: opcional(onlyDigits(corpo.celular)),
    email: opcional(corpo.email),
    cep: onlyDigits(corpo.cep),
    rua: texto(corpo.rua),
    numero: texto(corpo.numero),
    complemento: opcional(corpo.complemento),
    bairro: texto(corpo.bairro),
    cidade: texto(corpo.cidade),
    estado: texto(corpo.estado).toUpperCase(),
    status: corpo.status === "inativo" ? "inativo" : "ativo",
  };

  const tamanhos = { nome: 120, email: 120, rua: 120, numero: 10, complemento: 60, bairro: 80, cidade: 80 };
  const telefoneOk = (t) => !t || t.length === 10 || t.length === 11;

  let erro = null;
  if (dados.nome.length < 3) erro = "Informe o nome completo (mínimo 3 caracteres).";
  else if (dados.documento.length === 11 ? !cpfValido(dados.documento) : dados.documento.length === 14 ? !cnpjValido(dados.documento) : true)
    erro = "CPF ou CNPJ inválido.";
  else if (!telefoneOk(dados.telefone) || !telefoneOk(dados.celular)) erro = "Telefone inválido.";
  else if (dados.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(dados.email)) erro = "E-mail inválido.";
  else if (dados.cep.length !== 8) erro = "CEP inválido.";
  else if (!dados.rua || !dados.numero || !dados.bairro || !dados.cidade) erro = "Preencha o endereço completo.";
  else if (!ESTADOS.has(dados.estado)) erro = "Estado (UF) inválido.";
  else {
    const excedido = Object.entries(tamanhos).find(([campo, max]) => (dados[campo] || "").length > max);
    if (excedido) erro = `O campo ${excedido[0]} passou do limite de ${excedido[1]} caracteres.`;
  }

  return erro ? { erro } : { dados };
}

/** Arredonda para centavos, igual ao site. */
export const centavos = (value) => Math.round((Number(value) || 0) * 100) / 100;
