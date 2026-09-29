# Login e níveis de acesso

O sistema agora exige login. Cada usuário tem um **tipo** que define o que ele pode fazer.

## Tipos de usuário

| Permissão | O que libera | Vendedor | Chefe | Admin (TI) |
| --- | --- | :-: | :-: | :-: |
| `consultar_cliente` | Tela Clientes, ficha do cliente | ✔ | ✔ | ✔ |
| `cadastrar_cliente` | Tela Cadastrar Cliente | ✔ | ✔ | ✔ |
| `cadastrar_venda` | Tela Cadastrar Venda | ✔ | ✔ | ✔ |
| `registrar_pagamento` | Lançar pagamento posterior na ficha do cliente | ✔ | ✔ | ✔ |
| `cadastrar_produto` | Tela Produtos (cadastrar) | | ✔ | ✔ |
| `editar_cliente` | Editar cliente (`cadastro-cliente.html?id=...`) | | | ✔ |
| `editar_produto` | Editar, ativar e inativar produto | | | ✔ |
| `excluir_produto` | Excluir produto | | | ✔ |

O admin tem a permissão `todos`, que libera tudo.

A lista fica em **dois lugares, que precisam ser iguais**:

- `js/auth.js`: esconde menus/botões e bloqueia telas no navegador;
- `backend/src/permissoes.js`: bloqueia as operações na API (a segurança de verdade).

## Como funciona

```text
login.html ──POST /api/auth/login──▶ API confere a senha (hash scrypt) ──▶ { token, usuario }
     │
     └─ guarda { usuario: {id, nome, tipo}, token } no sessionStorage ("mgk.sessao")

Cada tela carrega js/auth.js no <head>:
  sem login              → login.html
  sem permissão da tela  → volta para a tela inicial com o aviso "Você não tem permissão..."
  [data-permissao="..."] → elemento escondido para quem não tem a permissão

Cada chamada à API envia "Authorization: Bearer <token>":
  sem token / token vencido → 401 → o site volta para o login
  sem permissão             → 403 "Você não tem permissão para esta operação."
```

- A sessão dura até fechar a aba, clicar em **Sair** ou passar 8 horas (token da API).
- As sessões ficam na memória da API: se a API reiniciar, é só entrar de novo.
- A API busca o usuário no banco a cada pedido: desativar um usuário (`ativo = 0`) ou mudar o tipo vale na hora.

## O que fazer no banco (modo "api")

### 1. Criar a tabela `usuarios`

```sql
USE mgk;

CREATE TABLE usuarios (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome        VARCHAR(120) NOT NULL,
  usuario     VARCHAR(60)  NOT NULL,              -- nome usado para entrar
  email       VARCHAR(120) NULL,                  -- também pode ser usado para entrar
  senha_hash  VARCHAR(255) NOT NULL,              -- hash scrypt, NUNCA a senha em texto
  tipo        ENUM('vendedor','chefe','admin') NOT NULL DEFAULT 'vendedor',
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uk_usuarios_usuario (usuario),
  UNIQUE KEY uk_usuarios_email (email)
) ENGINE=InnoDB;
```

As outras tabelas não mudam.

### 2. Criar o primeiro admin

A senha precisa ser gravada como hash, então não use `INSERT` direto. Na pasta `backend`:

```bash
npm run criar-usuario
```

O script pergunta nome, usuário, e-mail, tipo e senha, e grava o hash. Use o mesmo comando para criar os vendedores e chefes.

Para desativar alguém: `UPDATE usuarios SET ativo = FALSE WHERE usuario = 'fulano';`

### 3. Reiniciar a API e entrar

`npm start` e abra `login.html`.

## Modo "local" (demonstração, sem back-end)

O login funciona com os usuários de `js/mock-data.js` (`MGK_MOCK_USUARIOS`):

| Usuário | Senha | Tipo |
| --- | --- | --- |
| `admin` | `admin123` | admin |
| `chefe` | `chefe123` | chefe |
| `vendedor` | `vendedor123` | vendedor |

> Sem back-end **não existe segurança real**: tudo roda no navegador e pode ser alterado pelo F12. Use o modo local só para demonstração.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `login.html` + `js/login.js` | Tela de login |
| `js/auth.js` | Sessão, `temPermissao()`, proteção das telas, menus e botão Sair |
| `js/app.js` | Envia o token em cada chamada à API; em 401 volta para o login |
| `backend/src/permissoes.js` | Permissões de cada tipo e `temPermissao()` |
| `backend/src/auth.js` | Hash da senha, sessões, `exigirLogin` e `exigirPermissao` |
| `backend/src/rotas/auth.js` | `POST /api/auth/login` e `POST /api/auth/logout` |
| `backend/scripts/criar-usuario.js` | Cria usuários pelo terminal (`npm run criar-usuario`) |

## Para mostrar/esconder algo novo por permissão

- No HTML: `<a href="..." data-permissao="cadastrar_produto">...</a>`
- No JavaScript: `if (MGK.auth.temPermissao("editar_cliente")) { ... }`
- Na API: `router.post("/", exigirPermissao("cadastrar_produto"), async (req, res) => { ... })`
- Nova tela: inclua `<script src="js/auth.js"></script>` no `<head>` e adicione a tela em `PAGINAS` no `js/auth.js`.
