# Sistema MGK — Back-end (API)

API em **Node.js + Express** que liga o site (a pasta acima, `Sistema_MGK`) ao **MySQL**.

```text
Site (navegador) ──HTTP/JSON──▶ esta API ──SQL──▶ MySQL
```

> **Quer entender ou refazer o back-end sozinho?** Leia o [docs/GUIA-BACKEND.md](docs/GUIA-BACKEND.md): ele explica cada arquivo e traz um roteiro passo a passo e exercícios.

## 1. Criar o banco (MySQL Workbench)

Crie o banco `mgk` e as tabelas `clientes`, `produtos`, `vendas`, `venda_itens`, `pagamentos` e `usuarios`.

> **Login:** a tabela `usuarios` e a criação do primeiro admin (`npm run criar-usuario`) estão em [docs/LOGIN-E-PERMISSOES.md](../docs/LOGIN-E-PERMISSOES.md). Sem ela, ninguém consegue entrar no sistema.

> **Banco criado antes da tabela `pagamentos`?** Não recrie nada: rode só o script de atualização de [docs/ATUALIZACOES.md](../docs/ATUALIZACOES.md#o-que-fazer-no-banco). Sem essa tabela, as rotas de vendas dão erro.

**Os nomes das tabelas e das colunas precisam ser exatamente os de [docs/BANCO-DE-DADOS.md](../docs/BANCO-DE-DADOS.md)** (seção 4). A API usa esses nomes nas consultas. O script pronto está na seção 5 do documento, e os produtos iniciais na seção 6.

Crie também um usuário para a API (não use o `root`):

```sql
CREATE USER 'mgk_app'@'%' IDENTIFIED BY 'sua-senha';
GRANT SELECT, INSERT, UPDATE, DELETE ON mgk.* TO 'mgk_app'@'%';
```

## 2. Configurar o `.env`

O arquivo `.env` desta pasta guarda o endereço e a senha do banco:

| Variável | O que colocar |
| --- | --- |
| `DB_HOST` | **IP do servidor MySQL** (`localhost` se for neste computador) |
| `DB_PORT` | Porta do MySQL (padrão `3306`) |
| `DB_NAME` | `mgk` |
| `DB_USER` / `DB_PASSWORD` | Usuário e senha criados no passo 1 |
| `PORT` | Porta da API (padrão `3000`) |
| `CORS_ORIGIN` | Endereço do site, ou `*` em desenvolvimento |

> O `.env` tem senha: ele está no `.gitignore` e **nunca** deve ir para a pasta do site. Para compartilhar a configuração, use o `.env.example`.

## 3. Rodar

Requer Node.js 20.6 ou superior.

```bash
cd backend
npm install      # só na primeira vez
npm start        # ou "npm run dev" para reiniciar sozinho ao salvar arquivos
```

O terminal mostra se conectou ao MySQL. Para conferir, abra http://localhost:3000/api/saude, que deve mostrar `{"ok":true,"banco":"conectado"}`.

## 4. Ligar o site

Em `Sistema_MGK/js/config.js`:

```js
modo: "api",
apiUrl: "http://localhost:3000/api",
```

## Estrutura

```text
backend/
├── .env                 # IP, usuário e senha do banco (NÃO versionar)
├── .env.example         # modelo do .env
├── package.json
└── src/
    ├── server.js        # inicia a API, CORS e tratamento de erros
    ├── db.js            # conexão com o MySQL (lê o .env) e transações
    ├── erros.js         # HttpError (status + mensagem para o usuário)
    ├── validacao.js     # CPF/CNPJ, telefone, CEP, produto, pagamento (mesmas regras do site)
    ├── permissoes.js    # o que cada tipo de usuário (vendedor, chefe, admin) pode fazer
    ├── auth.js          # hash da senha, sessões, exigirLogin e exigirPermissao
    └── rotas/
        ├── auth.js      # POST /api/auth/login e /api/auth/logout
        ├── clientes.js  # GET/POST/PUT /api/clientes
        ├── produtos.js  # GET/POST/PUT/DELETE /api/produtos
        └── vendas.js    # GET/POST /api/vendas e POST /api/vendas/:id/pagamentos (em transação)
```

As rotas e o formato do JSON estão descritos na seção 7 de [BANCO-DE-DADOS.md](../docs/BANCO-DE-DADOS.md).
