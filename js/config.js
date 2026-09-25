/**
 * Configuração do Sistema MGK.
 *
 * modo:
 *   "local" → os dados ficam no localStorage do navegador (demonstração, sem back-end).
 *   "api"   → os dados vêm do back-end em `apiUrl` (MySQL). Veja docs/BANCO-DE-DADOS.md.
 *
 * Este é o ÚNICO arquivo que muda para ligar o sistema ao back-end.
 */
window.MGK_CONFIG = {
  modo: "local",
  apiUrl: "http://localhost:3000/api",
  timeoutMs: 10000,
};
