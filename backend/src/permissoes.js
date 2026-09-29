/**
 * O que cada tipo de usuário pode fazer. O admin (TI) pode tudo.
 * A mesma lista existe no site (js/auth.js): se mudar aqui, mude lá também.
 */
export const PERMISSOES = {
  vendedor: ["consultar_cliente", "cadastrar_cliente", "cadastrar_venda", "registrar_pagamento"],
  chefe: ["consultar_cliente", "cadastrar_cliente", "cadastrar_venda", "registrar_pagamento", "cadastrar_produto"],
  admin: ["todos"],
};

export const TIPOS = Object.keys(PERMISSOES);

export function temPermissao(usuario, permissao) {
  if (!usuario) return false;
  if (usuario.tipo === "admin") return true;
  return (PERMISSOES[usuario.tipo] || []).includes(permissao);
}
