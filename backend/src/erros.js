/** Erro com status HTTP. A mensagem é mostrada ao usuário no site. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Converte o :id da rota em número; id inválido é tratado como "não encontrado". */
export function idDaRota(valor, mensagem) {
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(404, mensagem);
  return id;
}
