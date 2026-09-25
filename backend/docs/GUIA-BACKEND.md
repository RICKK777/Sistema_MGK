# Guia de estudo: o back-end do Sistema MGK

Este guia explica **todo** o back-end do projeto: o que é uma API, como a requisição sai do site e chega ao MySQL, o que cada arquivo e cada trecho de código faz e por que foi escrito daquele jeito. No fim há um **roteiro para construir tudo do zero, sozinho** e exercícios para fixar.

> Dica: leia com o código aberto ao lado. Links do tipo [server.js:18](../src/server.js#L18) levam direto para a linha citada.

---

## Sumário

0. [Instalação e configuração do ambiente](#0-instalação-e-configuração-do-ambiente)
1. [O que é um back-end](#1-o-que-é-um-back-end)
2. [HTTP em 5 minutos](#2-http-em-5-minutos)
3. [As ferramentas: Node, npm, Express, mysql2 e .env](#3-as-ferramentas-node-npm-express-mysql2-e-env)
4. [Estrutura das pastas e o caminho de uma requisição](#4-estrutura-das-pastas-e-o-caminho-de-uma-requisição)
5. [server.js: o ponto de partida](#5-serverjs-o-ponto-de-partida)
6. [db.js: a conexão com o MySQL](#6-dbjs-a-conexão-com-o-mysql)
7. [erros.js: erros com status HTTP](#7-errosjs-erros-com-status-http)
8. [validacao.js: nunca confie no navegador](#8-validacaojs-nunca-confie-no-navegador)
9. [rotas/produtos.js: a rota mais simples](#9-rotasprodutosjs-a-rota-mais-simples)
10. [rotas/clientes.js: busca, cadastro e edição](#10-rotasclientesjs-busca-cadastro-e-edição)
11. [rotas/vendas.js: transações e itens](#11-rotasvendasjs-transações-e-itens)
12. [Fluxo completo: do botão "Salvar" até o MySQL](#12-fluxo-completo-do-botão-salvar-até-o-mysql)
13. [Testando a API sem o site](#13-testando-a-api-sem-o-site)
14. [Erros comuns e como resolver](#14-erros-comuns-e-como-resolver)
15. [Roteiro: construindo do zero](#15-roteiro-construindo-do-zero)
16. [Exercícios](#16-exercícios)
17. [Glossário](#17-glossário)

---

## 0. Instalação e configuração do ambiente

Passo a passo para deixar o sistema funcionando no **Windows**, do zero: o que baixar, como instalar e como configurar cada peça.

### 0.1 O que você precisa

| Programa | Para que serve | Obrigatório? |
| --- | --- | :-: |
| **Node.js** (versão LTS) | Roda o back-end (`npm start`) | ✔ |
| **MySQL Server** | **O banco de dados em si**, que guarda os dados | ✔ |
| **MySQL Workbench** | Programa visual para criar tabelas e ver os dados do MySQL Server | ✔ |
| **VS Code** | Editor de código | ✔ |
| Extensão **Live Server** (VS Code) | Abre o site em `http://127.0.0.1:5500` | recomendado |
| Extensão **REST Client** (VS Code) | Testa a API sem o site (seção 13) | opcional |
| **Git** | Versionar o código | opcional |

> ⚠️ **Workbench ≠ MySQL Server.** O Workbench é só uma "janela" para o banco, como um controle remoto. Sem o **MySQL Server** instalado e rodando, o Workbench não tem onde se conectar e a API mostra `ECONNREFUSED`. Instale os dois.

A ordem recomendada: **Node.js → MySQL Server → Workbench (conectar e criar o banco) → back-end → site.**

### 0.2 Instalando o Node.js

1. Acesse **https://nodejs.org** e baixe a versão **LTS** (Long Term Support, a mais estável). O projeto precisa da versão **20.6 ou maior**.
2. Execute o instalador (`.msi`) e clique em **Next** em todas as telas, mantendo as opções padrão. A opção **"Add to PATH"** deve ficar marcada, porque é ela que faz o comando `node` funcionar no terminal. A tela "Tools for Native Modules" pode ficar desmarcada.
3. **Feche e abra de novo** o VS Code (ou o terminal). O terminal só "enxerga" programas instalados depois de reaberto.
4. Confira no terminal do VS Code (menu **Terminal → New Terminal**, ou `` Ctrl + ` ``):

   ```bash
   node -v    # deve mostrar v20.6.0 ou maior, ex.: v24.20.0
   npm -v     # deve mostrar um número, ex.: 11.19.0
   ```

**Problemas comuns:**

- **`'node' não é reconhecido como um comando`**: o terminal foi aberto antes da instalação. Feche **todo** o VS Code e abra de novo. Se continuar, reinicie o Windows.
- **`npm.ps1 não pode ser carregado porque a execução de scripts foi desabilitada`**: é uma trava de segurança do PowerShell. Rode **uma vez** no terminal:

  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
  ```

  Responda `S` (Sim). Outra opção é trocar o terminal do VS Code para **Command Prompt**, na setinha ao lado do `+` do terminal.

### 0.3 Instalando o MySQL Server

1. Acesse **https://dev.mysql.com/downloads/** e entre em **MySQL Community Server**.
2. Escolha a versão **8.4 LTS** (ou outra 8.x), sistema **Microsoft Windows**, e baixe o **MSI Installer**. Na página seguinte, clique em **"No thanks, just start my download"**, porque não é preciso criar conta.
   > Se você achar o **MySQL Installer** (o instalador antigo, que instala vários produtos juntos), ele também serve: escolha o tipo **"Server only"**, já que o Workbench você já tem.
3. Execute o instalador, aceite a licença e escolha a instalação **Typical**. No fim, deixe marcada a opção de **abrir o configurador** (*MySQL Configurator*).
4. No configurador, as telas importantes são:

   | Tela | O que escolher |
   | --- | --- |
   | **Type and Networking** | Config Type: **Development Computer**. Port: **3306** (padrão). Marque **"Open Windows Firewall port"** só se o banco for acessado de **outro computador**. |
   | **Authentication** | **Use Strong Password Encryption** (recomendado; a biblioteca `mysql2` suporta). |
   | **Accounts and Roles** | Crie a **senha do usuário `root`** (o administrador). **Anote essa senha**, porque sem ela você não entra no banco. |
   | **Windows Service** | Marque **"Configure MySQL Server as a Windows Service"** e **"Start the MySQL Server at System Startup"**. Assim o MySQL liga sozinho junto com o Windows. |
   | **Server File Permissions / Sample Databases** | Pode deixar o padrão e pular. |

5. Clique em **Execute** e espere todos os itens ficarem com ✔. Depois, **Finish**.

**Conferindo se o MySQL está rodando:** aperte `Win + R`, digite `services.msc` e dê Enter. Procure **MySQL84** (ou MySQL80). O status deve ser **"Em execução"**. Se não estiver, clique com o botão direito → **Iniciar**.

### 0.4 Conectando o Workbench e criando o banco

**Criar a conexão:**

1. Abra o **MySQL Workbench**. Na tela inicial, clique no **⊕** ao lado de **"MySQL Connections"**.
2. Preencha:
   - **Connection Name:** `MGK local` (qualquer nome)
   - **Hostname:** `127.0.0.1` (o seu próprio PC; se o banco estiver em outro computador, use o IP dele)
   - **Port:** `3306`
   - **Username:** `root`
   - **Password:** clique em **"Store in Vault..."** e digite a senha do root
3. Clique em **Test Connection**. Deve aparecer *"Successfully made the MySQL connection"*. Clique em **OK** e depois abra a conexão com dois cliques.

**Criar o banco, as tabelas e os produtos:**

1. Com a conexão aberta, clique no ícone **SQL+** (primeiro da barra, "Create a new SQL tab").
2. Cole o script da **seção 5** de [BANCO-DE-DADOS.md](../../Sistema_MGK/docs/BANCO-DE-DADOS.md#5-script-sql-completo) e clique no **raio ⚡** (executa tudo). Na parte de baixo (*Output*), todas as linhas devem ficar com ✔ verde.
3. Em uma nova aba, cole os produtos da **seção 6** e execute com o ⚡.
4. Na lateral esquerda (**Schemas**), clique em 🔄 (atualizar). O banco `mgk` aparece com as 4 tabelas.

> Os nomes das tabelas e das colunas precisam ser **exatamente** os do documento. Se você criar as tabelas "na mão" pela interface do Workbench, confira cada nome com a seção 4 de `BANCO-DE-DADOS.md`.

**Criar o usuário da API** (a API não deve usar o root). Em uma nova aba SQL, execute:

```sql
CREATE USER 'mgk_app'@'localhost' IDENTIFIED BY 'escolha-uma-senha';
GRANT SELECT, INSERT, UPDATE, DELETE ON mgk.* TO 'mgk_app'@'localhost';
```

- `'localhost'` significa que esse usuário só entra **a partir do mesmo PC** do MySQL. Se a API for rodar em **outro** computador, troque por `'%'` (qualquer IP).
- `GRANT` dá só as permissões necessárias: ler, inserir, alterar e apagar **linhas**. O usuário não consegue apagar tabelas nem mexer em outros bancos.

**Dica:** para ver os dados, clique com o botão direito em uma tabela (ex.: `clientes`) → **Select Rows - Limit 1000**.

### 0.5 Banco em outro computador (opcional)

Se o MySQL ficar em um computador e a API em outro, por exemplo um servidor na loja:

1. **No PC do MySQL**, descubra o IP: no terminal, `ipconfig` → **Endereço IPv4** (ex.: `192.168.0.10`).
2. **Libere a porta 3306 no firewall** desse PC. O configurador faz isso se você marcou "Open Windows Firewall port"; senão, libere em *Windows Defender Firewall → Configurações avançadas → Regras de Entrada → Nova regra → Porta → TCP 3306*.
3. O usuário da API precisa ser criado com `'%'` (veja 0.4).
4. No `.env` da API: `DB_HOST=192.168.0.10`.
5. Teste do PC da API, pelo Workbench, criando uma conexão com esse IP.

> Nunca deixe a porta 3306 aberta para a **internet**, só para a rede local. Se o sistema for acessado de fora da loja, quem fica exposta é a **API**, e nunca o banco.

### 0.6 Configurando e rodando o back-end

1. No VS Code, abra a pasta `SISTAMA_MGK_V01` (**File → Open Folder**).
2. Abra o terminal (`` Ctrl + ` ``) e entre na pasta do back-end:

   ```bash
   cd backend
   ```

3. Instale as dependências. É **só na primeira vez**, ou quando o `package.json` mudar:

   ```bash
   npm install
   ```

   Isso cria a pasta `node_modules/` com o Express e o mysql2.

4. Configure o `.env`. Se ele não existir (por exemplo, se você baixou o projeto do Git), crie a partir do modelo:

   ```bash
   copy .env.example .env
   ```

   Abra o `.env` e preencha:

   ```env
   PORT=3000
   DB_HOST=localhost          # ou o IP do PC do MySQL
   DB_PORT=3306
   DB_NAME=mgk
   DB_USER=mgk_app            # o usuário criado em 0.4
   DB_PASSWORD=escolha-uma-senha
   CORS_ORIGIN=*
   ```

5. Inicie a API:

   ```bash
   npm start
   ```

   Se tudo estiver certo, o terminal mostra:

   ```text
   [MGK] API rodando em http://localhost:3000/api
   [MGK] Conectado ao MySQL em localhost:3306 (banco "mgk")
   ```

   Se aparecer `NÃO foi possível conectar ao MySQL`, veja o código do erro na tabela da [seção 14](#14-erros-comuns-e-como-resolver).

6. Teste no navegador: **http://localhost:3000/api/saude** → `{"ok":true,"banco":"conectado"}` e **http://localhost:3000/api/produtos** → a lista de produtos.

> **Deixe esse terminal aberto.** Fechar o terminal (ou apertar `Ctrl + C`) **desliga** a API. Para desenvolver, use `npm run dev`, que reinicia a API sozinho sempre que você salva um arquivo do `src/`. Mudanças no `.env` só valem depois de reiniciar.

### 0.7 Ligando o site à API

1. No VS Code, instale a extensão **Live Server** (ícone de quadradinhos na lateral → busque "Live Server" → **Install**).
2. Abra `Sistema_MGK/js/config.js` e troque o modo:

   ```js
   window.MGK_CONFIG = {
     modo: "api",
     apiUrl: "http://localhost:3000/api",
     timeoutMs: 10000,
   };
   ```

3. Clique com o botão direito em `Sistema_MGK/index.html` → **Open with Live Server**. O site abre em `http://127.0.0.1:5500`.
4. Cadastre um cliente e confira no Workbench (`SELECT * FROM clientes;`). Se ele apareceu lá, **está tudo ligado**. 🎉

> Os clientes que você cadastrou antes, no modo `"local"`, continuam só no `localStorage` do navegador. Eles **não** vão para o MySQL sozinhos.

### 0.8 Rotina do dia a dia

| Para... | Faça |
| --- | --- |
| **Ligar tudo** | 1) O MySQL já liga com o Windows. 2) Terminal: `cd backend` → `npm start`. 3) Live Server no `index.html`. |
| **Desligar a API** | `Ctrl + C` no terminal dela |
| **Ver os dados** | Workbench → conexão `MGK local` → tabela → *Select Rows* |
| **Voltar ao modo sem banco** | `config.js` → `modo: "local"` |
| **Mudou o `.env`** | `Ctrl + C` e `npm start` de novo |
| **Baixou o projeto em outro PC** | `npm install` + criar o `.env` a partir do `.env.example` |

### 0.9 O `.gitignore` e o que não vai para o Git

O arquivo [.gitignore](../.gitignore) lista o que o **Git deve ignorar**:

```gitignore
node_modules/
.env
```

- **`node_modules/`** tem milhares de arquivos baixados pelo `npm install`. Não precisa ir para o Git, porque qualquer um recria com `npm install` usando o `package.json`.
- **`.env`** tem a **senha do banco**. Se for para o GitHub, qualquer pessoa pode ver. Por isso vai o `.env.example` (sem senha) no lugar dele.

> Hoje só a pasta `Sistema_MGK` é um repositório Git; a pasta `backend` está fora dele. Para versionar o back-end também, rode `git init` dentro de `backend` (repositório separado) ou mova a pasta para dentro do repositório. Nos dois casos, o `.gitignore` já protege o `.env`.
>
> **Se o `.env` já foi enviado sem querer para o GitHub,** apagar o arquivo não basta, porque ele continua no histórico. **Troque a senha do banco** imediatamente.

---

## 1. O que é um back-end

O site (pasta `Sistema_MGK`) roda **no navegador de quem usa**. Tudo que está lá (HTML, CSS, JS) é baixado e pode ser lido por qualquer pessoa pelo F12.

O back-end é um **programa que roda em um servidor** (hoje, no seu PC). O usuário não vê o código dele, só as respostas. É por isso que ele pode guardar segredos, como a senha do banco.

```text
┌───────────────────────┐            ┌─────────────────────────┐           ┌──────────┐
│ NAVEGADOR             │  pedido    │ BACK-END (Node.js)      │   SQL     │  MySQL   │
│ clientes.html         │ ─────────▶ │ - recebe o pedido       │ ────────▶ │          │
│ js/app.js → fetch()   │            │ - valida                │           │ tabelas  │
│                       │ ◀───────── │ - consulta o banco      │ ◀──────── │          │
│ mostra na tela        │  resposta  │ - devolve JSON          │  linhas   │          │
└───────────────────────┘   (JSON)   └─────────────────────────┘           └──────────┘
   qualquer um vê o código             ninguém vê o código,                 só o back-end
                                       guarda a senha no .env               tem acesso
```

**Os três papéis do back-end:**

1. **Porteiro:** decide o que pode entrar. Valida CPF, quantidade, preço... porque qualquer pessoa pode mandar dados falsos direto para a API, sem passar pelas telas.
2. **Tradutor:** o site fala **HTTP + JSON** e o MySQL fala **SQL**. O back-end converte um no outro.
3. **Cofre:** é o único que conhece o IP, o usuário e a senha do banco.

**API** (Application Programming Interface) é o nome dado ao conjunto de "endereços" que o back-end oferece, como `GET /api/clientes` e `POST /api/vendas`. É o "cardápio" do que o site pode pedir.

---

## 2. HTTP em 5 minutos

Toda conversa entre site e back-end é um **pedido** (request) seguido de uma **resposta** (response).

### O pedido

```http
POST /api/clientes HTTP/1.1          ← método + caminho
Host: localhost:3000                  ← para qual servidor
Content-Type: application/json        ← cabeçalho: "o corpo é JSON"

{ "nome": "Ana", "documento": "12345678062", ... }    ← corpo (body)
```

| Parte | Exemplo | No Express |
| --- | --- | --- |
| **Método** | `GET`, `POST`, `PUT` | `router.get(...)`, `router.post(...)` |
| **Caminho** | `/api/clientes/5` | o `5` vira `req.params.id` |
| **Query string** | `/api/clientes?busca=ana` | `req.query.busca` → `"ana"` |
| **Cabeçalhos** | `Content-Type`, `Origin` | `req.headers` |
| **Corpo** | JSON com os dados | `req.body` |

### Os métodos (verbos)

| Método | Significa | Exemplo no MGK |
| --- | --- | --- |
| `GET` | **Ler**, sem alterar nada | `GET /api/clientes` |
| `POST` | **Criar** algo novo | `POST /api/vendas` |
| `PUT` | **Substituir/atualizar** algo existente | `PUT /api/clientes/5` |
| `DELETE` | **Apagar** | *(não usamos ainda, veja os exercícios)* |

### A resposta

```http
HTTP/1.1 201 Created                  ← status
Content-Type: application/json

{ "id": 12, "nome": "Ana", ... }      ← corpo
```

O **status** é um número que diz como foi:

| Faixa | Significa | Os que usamos |
| --- | --- | --- |
| `2xx` | Deu certo | `200` OK · `201` Criado · `204` Sem conteúdo |
| `4xx` | **O pedido** tem problema (culpa de quem pediu) | `400` Dados inválidos · `404` Não encontrado · `409` Conflito (CPF repetido) |
| `5xx` | **O servidor** teve problema | `500` Erro interno · `503` Banco fora do ar |

### JSON

É o formato de texto usado para os dados. Ele tem a mesma cara de um objeto JavaScript, só que com aspas duplas nas chaves:

```json
{ "id": 1, "nome": "Shampoo", "precoPadrao": 50, "ativo": true, "tags": ["cabelo"] }
```

### Porta

Um computador pode ter vários programas "escutando" a rede. A **porta** diz com qual deles falar: o MySQL costuma usar a `3306`, a API usa a `3000` e o Live Server a `5500`. `http://localhost:3000` significa "este computador, programa da porta 3000".

---

## 3. As ferramentas: Node, npm, Express, mysql2 e .env

### Node.js

O JavaScript nasceu para rodar dentro do navegador. O **Node.js** permite rodar JavaScript **fora** dele, direto no computador. Por isso ele consegue abrir portas, ler arquivos e conectar em bancos.

Diferenças importantes em relação ao JS do site:

| No navegador | No Node |
| --- | --- |
| `document`, `window`, `localStorage` existem | **Não existem** (não há página) |
| Não acessa arquivos do PC | Acessa arquivos, rede, variáveis de ambiente |
| `<script src="...">` | `import ... from "..."` |

### npm e o `package.json`

O **npm** instala bibliotecas feitas por outras pessoas. O [package.json](../package.json) é a "carteira de identidade" do projeto:

```json
{
  "type": "module",                               // permite usar import/export
  "scripts": {
    "start": "node --env-file=.env src/server.js",       // npm start
    "dev": "node --watch --env-file=.env src/server.js"  // npm run dev (reinicia ao salvar)
  },
  "dependencies": {
    "express": "^5.2.1",   // bibliotecas que o projeto usa
    "mysql2": "^3.24.4"
  }
}
```

- `npm install` lê as `dependencies` e baixa tudo para a pasta `node_modules/`. Essa pasta é grande e **não vai para o Git**, porque qualquer um consegue recriá-la com `npm install`.
- `npm install express` instala uma biblioteca nova e já a registra no `package.json`.
- O `package-lock.json` guarda as versões exatas instaladas. Ele não é editado à mão.

### `import` / `export` (módulos)

Cada arquivo é um **módulo** isolado. O que ele quer compartilhar, ele exporta. Quem quer usar, importa:

```js
// erros.js
export class HttpError extends Error { ... }        // export "com nome"

// rotas/clientes.js
import { HttpError } from "../erros.js";            // importa pelo nome, entre { }
export default router;                              // export "padrão" (1 por arquivo)

// server.js
import clientes from "./rotas/clientes.js";         // importa o default, sem { }, com o nome que quiser
```

> No Node, o caminho de arquivos seus **precisa** do `.js` no final e de `./` ou `../` no começo. Sem o `./`, o Node procura um pacote na `node_modules` (como faz com `"express"`).

### Express

Criar um servidor HTTP "na mão" com o Node puro dá bastante trabalho. O **Express** simplifica:

```js
import express from "express";
const app = express();

app.get("/api/ola", (req, res) => {       // quando chegar GET /api/ola...
  res.json({ mensagem: "Olá!" });         // ...responda este JSON
});

app.listen(3000);                          // escute na porta 3000
```

Com só isso, abrir `http://localhost:3000/api/ola` no navegador já mostra `{"mensagem":"Olá!"}`.

- `req` (request) é **o pedido**: `req.params`, `req.query`, `req.body`, `req.headers`.
- `res` (response) é **a resposta**: `res.json(...)`, `res.status(404)`, `res.sendStatus(204)`.

### mysql2

É o "driver" que sabe conversar com o MySQL. Você passa um texto SQL e recebe as linhas como objetos JavaScript:

```js
const [linhas] = await pool.query("SELECT id, nome FROM produtos");
// linhas = [ { id: 1, nome: "Shampoo" }, { id: 2, nome: "Máscara" } ]
```

### O arquivo `.env` e `process.env`

Configurações que **mudam de um computador para outro** (IP do banco, senha, porta) não ficam no código. Elas ficam no `.env`:

```env
DB_HOST=localhost
DB_PASSWORD=minha-senha
```

O `--env-file=.env` do script `start` manda o Node ler esse arquivo, e aí o código acessa os valores com `process.env`:

```js
process.env.DB_HOST      // "localhost"   ← sempre texto!
Number(process.env.PORT) // 3000          ← converta quando precisar de número
```

Por que usar um `.env`?

- **Segurança:** a senha não fica no código nem no Git (o `.env` está no `.gitignore`).
- **Flexibilidade:** no seu PC `DB_HOST=localhost`; num servidor de verdade, outro IP. O código é o mesmo.
- O `.env.example` é um modelo **sem senha**, esse sim versionado, para quem baixar o projeto saber quais variáveis preencher.

---

## 4. Estrutura das pastas e o caminho de uma requisição

```text
backend/
├── .env               # configurações e senha (não versionado)
├── .env.example       # modelo do .env
├── package.json       # dependências e scripts
└── src/
    ├── server.js      # 1. liga tudo: cria o app, CORS, JSON, rotas, erros, porta
    ├── db.js          # 2. conexão com o MySQL
    ├── erros.js       # 3. HttpError: erro + status
    ├── validacao.js   # 4. regras dos dados (CPF, CEP...)
    └── rotas/         # 5. um arquivo por "assunto"
        ├── clientes.js
        ├── produtos.js
        └── vendas.js
```

Cada arquivo tem **uma responsabilidade**. Se o problema é de conexão, você olha o `db.js`; se é regra de CPF, o `validacao.js`; se é a rota de vendas, o `rotas/vendas.js`.

### O caminho de um pedido

O Express passa o pedido por uma **fila de funções**, na ordem em que foram registradas com `app.use`/`app.get`. Cada uma pode responder ou passar para a próxima:

```text
pedido: GET /api/clientes?busca=ana
   │
   ▼
[1] CORS ──────────────── adiciona cabeçalhos; se for OPTIONS, já responde 204
   │ next()
   ▼
[2] express.json() ────── se tiver corpo JSON, transforma em req.body
   │
   ▼
[3] /api/saude? ───────── não é esse caminho, pula
   │
   ▼
[4] /api/clientes ─────── É ESTE! entra em rotas/clientes.js
   │                          router.get("/") → consulta o MySQL → res.json(linhas) ✔ fim
   │
   ▼ (só chega aqui se ninguém respondeu)
[5] 404 ───────────────── "Rota não encontrada."

   ✖ se qualquer etapa lançar um erro (throw) ──▶ [6] tratador de erros → { erro: "..." }
```

Essas funções da fila se chamam **middlewares**.

---

## 5. server.js: o ponto de partida

Arquivo: [src/server.js](../src/server.js). É o arquivo que o `npm start` executa.

### 5.1 Imports e configuração ([linha 12](../src/server.js#L12))

```js
const PORT = Number(process.env.PORT || 3000);
const ORIGENS = String(process.env.CORS_ORIGIN || "*").split(",").map((o) => o.trim());
```

- `process.env.PORT || 3000`: usa o valor do `.env` e, se ele não existir, usa `3000`.
- `ORIGENS`: transforma `"http://a.com, http://b.com"` em `["http://a.com", "http://b.com"]`.

### 5.2 CORS ([linha 18](../src/server.js#L18))

**O problema:** por segurança, o navegador **bloqueia** um site de ler respostas de outro endereço. O site em `http://127.0.0.1:5500` e a API em `http://localhost:3000` são "origens" diferentes (a porta conta).

**A solução:** a API responde com um cabeçalho dizendo "eu autorizo essa origem":

```js
app.use((req, res, next) => {
  const origem = req.headers.origin;                    // quem está pedindo
  if (ORIGENS.includes("*")) res.set("Access-Control-Allow-Origin", "*");
  else if (origem && ORIGENS.includes(origem)) res.set({ "Access-Control-Allow-Origin": origem, Vary: "Origin" });
  res.set({ "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Accept" });
  if (req.method === "OPTIONS") return res.sendStatus(204);   // "pré-voo"
  next();                                                      // segue para a próxima etapa
});
```

- **Pré-voo (OPTIONS):** antes de um `POST` com JSON, o navegador manda um `OPTIONS` perguntando "posso?". Respondemos `204` (sim, sem conteúdo) com os cabeçalhos acima.
- **`next()`** é o que passa o pedido adiante na fila. Se você esquecer de chamar, o pedido fica "pendurado" para sempre.

> O CORS é uma regra **do navegador**. Ferramentas como curl ou Postman não ligam para ele. Então "funciona no Postman mas não no site" quase sempre é problema de CORS.

### 5.3 Ler o corpo JSON ([linha 27](../src/server.js#L27))

```js
app.use(express.json({ limit: "100kb" }));
```

O corpo chega como **texto**. Este middleware faz o `JSON.parse` e coloca o resultado em `req.body`. O `limit` recusa corpos gigantes, o que evita que alguém trave o servidor.

### 5.4 Rota de saúde ([linha 30](../src/server.js#L30))

```js
app.get("/api/saude", async (req, res) => {
  await pool.query("SELECT 1");                 // pergunta mais simples possível ao banco
  res.json({ ok: true, banco: "conectado" });
});
```

Serve para testar a conexão pelo navegador. Se o banco estiver fora, o `await` lança um erro e o tratador de erros responde `503`.

### 5.5 Montando as rotas ([linha 35](../src/server.js#L35))

```js
app.use("/api/clientes", clientes);
app.use("/api/produtos", produtos);
app.use("/api/vendas", vendas);
```

Cada arquivo de rotas cuida de um **prefixo**. Dentro de `rotas/clientes.js`, `router.get("/:id")` responde em `/api/clientes/:id`, porque o prefixo é somado.

### 5.6 404 ([linha 39](../src/server.js#L39))

```js
app.use((req, res) => res.status(404).json({ erro: "Rota não encontrada." }));
```

Fica **depois** de todas as rotas, então só roda se nenhuma respondeu. A ordem do `app.use` importa.

### 5.7 Tratador de erros ([linha 42](../src/server.js#L42))

```js
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ erro: err.message });
  if (err.type === "entity.parse.failed") return res.status(400).json({ erro: "JSON inválido." });
  if ([...códigos de banco fora do ar...].includes(err.code)) { ...503... }
  console.error("[MGK] Erro inesperado:", err);
  res.status(500).json({ erro: "Erro interno no servidor." });
});
```

- O Express reconhece um tratador de erros por ter **4 parâmetros** `(err, req, res, next)`. Mesmo sem usar o `next`, ele **precisa** estar ali.
- **Erros esperados** (`HttpError`, como "CPF inválido") viram a mensagem para o usuário com o status certo.
- **Erros inesperados** (bug, SQL errado) viram um `500` genérico. O detalhe vai só para o terminal (`console.error`), **nunca** para o usuário, porque ele poderia revelar nomes de tabelas e caminhos do servidor.

> **Express 5:** se uma função `async` de rota lança um erro (ou um `await` falha), o Express 5 manda automaticamente para este tratador. No Express 4 isso **não** acontecia: era preciso `try/catch` em cada rota. Se um dia você ler tutoriais antigos com `try/catch` em todo lugar, é por isso.

### 5.8 Ligando o servidor ([linha 53](../src/server.js#L53))

```js
app.listen(PORT, async () => {
  console.log(`[MGK] API rodando em http://localhost:${PORT}/api`);
  try {
    await pool.query("SELECT 1");
    console.log("[MGK] Conectado ao MySQL ...");
  } catch (err) {
    console.error("[MGK] NÃO foi possível conectar ao MySQL ...");
  }
});
```

`listen` abre a porta. Logo em seguida testamos o banco, só para você ver no terminal, **na hora**, se o `.env` está certo.

---

## 6. db.js: a conexão com o MySQL

Arquivo: [src/db.js](../src/db.js).

### 6.1 O pool de conexões ([linha 6](../src/db.js#L6))

Abrir uma conexão com o MySQL é lento (tem autenticação e troca de mensagens). Um **pool** abre algumas conexões e as **reutiliza**: cada pedido pega uma emprestada, usa e devolve.

```text
pedido 1 ──▶ ┌── conexão A ──┐
pedido 2 ──▶ │   conexão B   │ ──▶ MySQL
pedido 3 ──▶ └── conexão C ──┘
pedido 11 ─▶ (espera uma liberar, porque connectionLimit: 10)
```

```js
export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",   // ← o IP do banco vem do .env
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || "mgk",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  charset: "utf8mb4",          // acentos e emojis
  waitForConnections: true,    // se todas estiverem ocupadas, espera (em vez de dar erro)
  connectionLimit: 10,
  decimalNumbers: true,        // DECIMAL chega como número
  timezone: "Z",               // datas em UTC
});
```

Duas opções que evitam bugs difíceis:

- **`decimalNumbers: true`:** sem ela, `DECIMAL(10,2)` chega como **texto** (`"50.00"`). No site, `"50.00" + "30.00"` vira `"50.0030.00"` (junta os textos em vez de somar).
- **`timezone: "Z"`:** grava e lê as datas em UTC. O site recebe `"2026-09-15T15:00:00.000Z"` e converte para o horário de Brasília sozinho. Sem isso, as datas "andariam" 3 horas.

### 6.2 Fuso da sessão ([linha 20](../src/db.js#L20))

```js
pool.pool.on("connection", (conexao) => {
  conexao.query("SET time_zone = '+00:00'");
});
```

O `DEFAULT CURRENT_TIMESTAMP` das colunas `criado_em` é calculado **pelo MySQL**, no fuso da sessão. Aqui, toda conexão nova avisa o MySQL: "use UTC". Assim, as datas geradas pelo banco e as enviadas pela API ficam no mesmo fuso.

### 6.3 Como fazer consultas (e o `?`)

```js
const [linhas] = await pool.query("SELECT * FROM clientes WHERE id = ?", [id]);
```

- `pool.query` devolve um **array** `[linhas, campos]`. A desestruturação `const [linhas]` pega só o primeiro item.
- Em um `SELECT`, `linhas` é um array de objetos. Em `INSERT`/`UPDATE`, é um objeto com `insertId` (id gerado) e `affectedRows` (quantas linhas mudaram).

**O `?` é a regra de segurança mais importante do back-end.** Nunca monte SQL juntando textos que vieram do usuário:

```js
// ❌ NUNCA FAÇA ISSO
pool.query(`SELECT * FROM clientes WHERE nome = '${req.query.nome}'`);
// se alguém mandar  nome = ' OR '1'='1   → devolve TODOS os clientes
// se mandar         nome = '; DROP TABLE clientes; --   → pode apagar a tabela
```

Isso se chama **SQL Injection**. Com o `?`, o mysql2 **escapa** o valor (trata como texto puro, nunca como comando):

```js
// ✅ SEMPRE ASSIM
pool.query("SELECT * FROM clientes WHERE nome = ?", [req.query.nome]);
```

O `pool.query` do mysql2 ainda tem dois atalhos que usamos:

| Escrita | Vira | Onde usamos |
| --- | --- | --- |
| `WHERE id IN (?)` com `[[1, 2, 3]]` | `WHERE id IN (1, 2, 3)` | itens de várias vendas |
| `INSERT INTO clientes SET ?` com `[{ nome: "Ana", cep: "01000000" }]` | `SET nome = 'Ana', cep = '01000000'` | cadastro de cliente |
| `VALUES ?` com `[[[1, "a"], [2, "b"]]]` | `VALUES (1, 'a'), (2, 'b')` | vários itens de uma vez |

### 6.4 Transações ([linha 25](../src/db.js#L25))

Uma venda grava em **duas tabelas**: `vendas` (1 linha) e `venda_itens` (várias linhas). E se a luz acabar entre uma e outra? Ficaria uma venda **sem itens**.

A **transação** junta várias operações em um bloco "tudo ou nada":

```js
export async function transacao(trabalho) {
  const conexao = await pool.getConnection();   // pega UMA conexão só para esse bloco
  try {
    await conexao.beginTransaction();           // START TRANSACTION
    const resultado = await trabalho(conexao);  // executa o que você mandou
    await conexao.commit();                     // COMMIT → grava tudo de verdade
    return resultado;
  } catch (err) {
    await conexao.rollback();                   // ROLLBACK → desfaz TUDO do bloco
    throw err;                                  // e repassa o erro
  } finally {
    conexao.release();                          // devolve a conexão ao pool (sempre!)
  }
}
```

Uso:

```js
await transacao(async (db) => {
  await db.query("INSERT INTO vendas ...");
  await db.query("INSERT INTO venda_itens ...");   // se falhar aqui, o INSERT de cima é desfeito
});
```

- Dentro da transação, use o `db` recebido, **não** o `pool`. O pool poderia usar outra conexão, fora da transação.
- O `finally` roda sempre, dando certo ou errado. Se esquecer o `release()`, as conexões acabam e a API trava depois de 10 pedidos.

---

## 7. erros.js: erros com status HTTP

Arquivo: [src/erros.js](../src/erros.js).

```js
export class HttpError extends Error {
  constructor(status, message) {
    super(message);       // guarda a mensagem (como todo Error)
    this.status = status; // e acrescenta o status HTTP
  }
}
```

Com ela, **qualquer lugar** do código pode interromper o pedido com uma resposta de erro, só com `throw`:

```js
if (!cliente) throw new HttpError(404, "Cliente não encontrado.");
```

O `throw` interrompe a função na hora e o erro "sobe" até o tratador de erros do `server.js` (seção 5.7), que responde `404 { "erro": "Cliente não encontrado." }`. Assim, as rotas não precisam repetir `res.status(...).json(...)` em cada `if`.

### `idDaRota` ([linha 10](../src/erros.js#L10))

```js
export function idDaRota(valor, mensagem) {
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(404, mensagem);
  return id;
}
```

`req.params.id` é sempre **texto**. `GET /api/clientes/abc` vira `Number("abc")` → `NaN` → 404, sem nem consultar o banco.

---

## 8. validacao.js: nunca confie no navegador

Arquivo: [src/validacao.js](../src/validacao.js).

O site já valida tudo. Então por que validar de novo? Porque **a API é pública**: qualquer um pode abrir o Console (F12) e digitar:

```js
fetch("http://localhost:3000/api/vendas", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ clienteId: 1, itens: [{ produtoId: 1, quantidade: -50, precoUnitario: 0.01 }] }),
});
```

A validação do site serve para **ajudar** o usuário a preencher certo. A do back-end serve para **proteger** os dados.

### `validarCliente` ([linha 41](../src/validacao.js#L41))

Faz duas coisas: **limpa** os dados e **valida**.

```js
const dados = {
  nome: texto(corpo.nome),                          // tira espaços das pontas
  documento: onlyDigits(corpo.documento),           // "123.456.780-62" → "12345678062"
  telefone: opcional(onlyDigits(corpo.telefone)),   // "" → null
  estado: texto(corpo.estado).toUpperCase(),        // "sp" → "SP"
  status: corpo.status === "inativo" ? "inativo" : "ativo",   // só aceita os 2 valores
  ...
};
```

- **Lista branca:** o objeto `dados` é montado campo a campo, só com os campos conhecidos. Se alguém mandar `{ "id": 999, "criado_em": "1990-01-01" }`, esses campos são ignorados. Isso importa porque o `dados` vai direto para o `INSERT ... SET ?`.
- **`opcional()`:** campo vazio vira `NULL` no banco. `NULL` significa "não informado", o que é diferente de um texto vazio.

Depois, uma sequência de `if/else if` encontra o **primeiro** erro. A função devolve um de dois formatos:

```js
return erro ? { erro } : { dados };
// { erro: "CEP inválido." }       ou       { dados: { nome: "Ana", ... } }
```

E quem chama usa assim:

```js
const { erro, dados } = validarCliente(req.body);
if (erro) throw new HttpError(400, erro);
// daqui para baixo, "dados" está limpo e válido
```

### `centavos` ([linha 79](../src/validacao.js#L79))

```js
export const centavos = (value) => Math.round((Number(value) || 0) * 100) / 100;
```

No JavaScript, `0.1 + 0.2` dá `0.30000000000000004`, porque os números são binários. Arredondar para 2 casas depois de cada conta evita esses resíduos. No banco, o tipo `DECIMAL(10,2)` guarda o valor exato.

---

## 9. rotas/produtos.js: a rota mais simples

Arquivo: [src/rotas/produtos.js](../src/rotas/produtos.js). **Comece a estudar as rotas por aqui.**

```js
import { Router } from "express";
const router = Router();          // um "mini-app" só com as rotas de produtos

const CAMPOS = "id, nome, preco_padrao AS precoPadrao";

router.get("/", async (req, res) => {
  const [linhas] = await pool.query(`SELECT ${CAMPOS} FROM produtos WHERE ativo ORDER BY nome`);
  res.json(linhas);
});

router.get("/:id", async (req, res) => {
  const id = idDaRota(req.params.id, "Produto não encontrado.");
  const [linhas] = await pool.query(`SELECT ${CAMPOS} FROM produtos WHERE id = ?`, [id]);
  if (!linhas.length) throw new HttpError(404, "Produto não encontrado.");
  res.json(linhas[0]);
});

export default router;
```

Pontos para entender:

- **`Router()`** agrupa rotas relacionadas. O `server.js` o monta em `/api/produtos`.
- **`:id`** é um parâmetro: `/api/produtos/7` → `req.params.id === "7"`.
- **`AS precoPadrao`** renomeia a coluna na resposta. O banco usa `snake_case` (padrão do SQL) e o JavaScript usa `camelCase`. O `AS` faz a ponte, e o site recebe exatamente os nomes que espera.
- **`${CAMPOS}`** dentro do SQL é seguro aqui porque `CAMPOS` é um texto **fixo**, escrito por nós. A regra do `?` vale para valores que vêm **do usuário**.
- **`WHERE ativo`** esconde produtos desativados da tela de venda. O `GET /:id` não filtra, porque vendas antigas podem citar um produto que hoje está inativo.
- **`linhas[0]`**: o `SELECT` sempre devolve um array, mesmo buscando por id. Para um item só, pegamos o primeiro.

---

## 10. rotas/clientes.js: busca, cadastro e edição

Arquivo: [src/rotas/clientes.js](../src/rotas/clientes.js).

### 10.1 `buscarPorId` ([linha 24](../src/rotas/clientes.js#L24))

Função reaproveitada por 3 rotas (GET, POST e PUT). Depois de gravar, **relemos do banco** para devolver o registro exatamente como ficou, com `id`, `criadoEm` e `atualizadoEm` gerados pelo MySQL.

### 10.2 Uma rota, três buscas ([linha 36](../src/rotas/clientes.js#L36))

`GET /api/clientes` muda de comportamento conforme a query string:

```js
if (req.query.documento !== undefined) {
  where = "WHERE documento = ?";                    // ?documento=12345678062 → igualdade exata
  params = [documento];
} else if (busca) {
  const porDocumento = digitos.length >= 3 && /^[\d.\-\/\s]+$/.test(busca);
  where = porDocumento ? "WHERE documento LIKE ?" : "WHERE nome LIKE ?";
  params = [like(porDocumento ? digitos : busca)];  // ?busca=ana → contém "ana"
}
// sem nada → todos
const [linhas] = await pool.query(`SELECT ${CAMPOS} FROM clientes ${where} ORDER BY nome`, params);
```

- **`LIKE '%ana%'`** significa "contém ana". O `%` é o curinga "qualquer coisa".
- **A função `like`** ([linha 22](../src/rotas/clientes.js#L22)) escapa `%` e `_` digitados pelo usuário. Sem ela, buscar por `%` traria todos os clientes.
- **Acentos:** a *collation* `utf8mb4_0900_ai_ci` do banco (`ai` = *accent insensitive*, `ci` = *case insensitive*) faz `'joao'` encontrar `'João'`. Não é preciso nenhum código para isso.
- Repare que o `WHERE` é montado com **textos fixos**. Só os **valores** entram pelo `?`.

### 10.3 Cadastrar: `POST /` ([linha 61](../src/rotas/clientes.js#L61))

```js
router.post("/", async (req, res) => {
  const { erro, dados } = validarCliente(req.body);                 // 1. valida
  if (erro) throw new HttpError(400, erro);

  const [resultado] = await pool
    .query("INSERT INTO clientes SET ?", [dados])                   // 2. grava
    .catch(tratarDuplicado);                                        //    CPF repetido → 409
  res.status(201).json(await buscarPorId(resultado.insertId));      // 3. devolve o criado
});
```

**Por que o CPF repetido é tratado pelo banco?** Dá para fazer um `SELECT` antes para ver se o CPF existe, mas há um risco: dois cadastros **ao mesmo tempo** podem passar pelo `SELECT` antes de qualquer um gravar. O `UNIQUE KEY` do banco é a garantia real. Quando ele barra, o MySQL devolve o erro `ER_DUP_ENTRY`, que a gente traduz para `409` ([linha 31](../src/rotas/clientes.js#L31)):

```js
function tratarDuplicado(err) {
  if (err.code === "ER_DUP_ENTRY") throw new HttpError(409, "Já existe um cliente cadastrado com este CPF/CNPJ.");
  throw err;   // qualquer outro erro segue adiante (vira 500)
}
```

### 10.4 Editar: `PUT /:id` ([linha 69](../src/rotas/clientes.js#L69))

Mesma ideia, com `UPDATE`. O detalhe é o `affectedRows`:

```js
const [resultado] = await pool.query("UPDATE clientes SET ? WHERE id = ?", [dados, id]);
if (!resultado.affectedRows) throw new HttpError(404, "Cliente não encontrado.");
```

Se o id não existir, o `UPDATE` não dá erro: ele simplesmente altera **0 linhas**. Por isso conferimos o `affectedRows`.

---

## 11. rotas/vendas.js: transações e itens

Arquivo: [src/rotas/vendas.js](../src/rotas/vendas.js). É o arquivo mais completo. Estude por último.

### 11.1 `buscarVendas`: 2 consultas em vez de N+1 ([linha 18](../src/rotas/vendas.js#L18))

Cada venda precisa vir com seus itens (`venda.produtos`). O jeito ingênuo:

```js
// ❌ 1 consulta para as vendas + 1 para os itens DE CADA venda
for (const venda of vendas) {
  venda.produtos = await pool.query("SELECT ... WHERE venda_id = ?", [venda.id]);
}
// 50 vendas = 51 consultas. Isso se chama "problema N+1".
```

O jeito usado aqui:

```js
// ✅ 1 consulta para as vendas
const [vendas] = await db.query(`SELECT id, LPAD(id, 6, '0') AS numero, ... FROM vendas ${where} ...`);

// ✅ 1 consulta para TODOS os itens dessas vendas
const [itens] = await db.query("SELECT venda_id AS vendaId, ... WHERE venda_id IN (?)", [vendas.map((v) => v.id)]);

// agrupa os itens na venda certa, em JavaScript
const porVenda = new Map(vendas.map((v) => [v.id, (v.produtos = [])]));
for (const { vendaId, ...item } of itens) porVenda.get(vendaId).push(item);
```

A linha do `Map` faz duas coisas ao mesmo tempo: cria `v.produtos = []` em cada venda e guarda no mapa `id → esse array`. Depois, cada item é empurrado no array da sua venda. `{ vendaId, ...item }` separa o `vendaId` (usado só para agrupar) do resto do item (que vai para a resposta).

**`LPAD(id, 6, '0')`** transforma `123` em `"000123"`, o número do pedido que aparece na tela.

O parâmetro `db = pool` permite chamar a função **dentro de uma transação** (passando a conexão da transação) ou fora dela (usando o pool).

### 11.2 Registrar a venda: `POST /` ([linha 56](../src/rotas/vendas.js#L56))

É o fluxo mais importante do sistema. Ele segue estes passos:

```text
1. Validar o formato (sem banco)     itens não vazio? quantidade 1–999? preço > 0? desconto ≥ 0?
                                     ↓ ok
2. ABRIR TRANSAÇÃO ────────────────────────────────────────────────────────────┐
3. O cliente existe?                 SELECT id FROM clientes WHERE id = ?      │
4. Buscar os produtos NO BANCO       SELECT ... FROM produtos WHERE id IN (?)  │
5. Calcular subtotais e total        (com os preços praticados, em centavos)  │  qualquer erro
6. Desconto ≤ subtotal?                                                        │  aqui → ROLLBACK
7. INSERT INTO vendas ...            → pega o insertId                         │  (nada é gravado)
8. INSERT INTO venda_itens VALUES ?  → todos os itens de uma vez               │
9. Reler a venda completa                                                      │
10. COMMIT ────────────────────────────────────────────────────────────────────┘
11. Responder 201 com a venda
```

Detalhes que valem ouro:

- **Passo 1 antes da transação:** se os dados já estão errados no formato, nem gastamos uma conexão.
- **Passo 4, "nunca do navegador":** o site manda só `produtoId`, `quantidade` e `precoUnitario`. O **nome** e o **preço padrão** vêm do banco. Se viessem do site, alguém poderia gravar "Kit Progressiva" com preço padrão de R$ 1,00 no histórico.
- **`new Set(...)`** remove ids repetidos antes do `IN (?)`.
- **`String(p.id)`** no `Map`: o id pode chegar do site como número ou como texto (`1` ou `"1"`). Convertendo tudo para texto, a comparação funciona nos dois casos.
- **Passo 8, `VALUES ?`** com um array de arrays grava todos os itens em **um único** `INSERT`:
  ```js
  [linhas.map((l) => [vendaId, l.produto.id, l.produto.nome, l.quantidade, l.produto.preco_padrao, l.precoUnitario])]
  // → VALUES (15, 1, 'Shampoo', 2, 50, 45), (15, 5, 'Leave-in', 1, 40, 40)
  ```
- **`total` e `subtotal` dos itens não são gravados pela API:** no banco, eles são **colunas geradas** (`AS (subtotal - desconto) STORED`), que o próprio MySQL calcula. Assim, nunca ficam inconsistentes.
- **`throw new HttpError(...)` dentro da transação** faz o `transacao()` dar `ROLLBACK` e repassar o erro, que chega ao tratador e vira a resposta.

---

## 12. Fluxo completo: do botão "Salvar" até o MySQL

Veja o que acontece quando você cadastra a cliente "Ana" com o site em `modo: "api"`:

```text
NAVEGADOR
 1. cadastro-cliente.js  → valida o formulário (ajuda o usuário)
 2. cadastro-cliente.js  → await clientes.salvar(dados)
 3. app.js (clientesApi) → api.post("/clientes", corpo)
 4. app.js (api.request) → fetch("http://localhost:3000/api/clientes", { method: "POST", body: JSON })
        │
        │  (o navegador manda antes um OPTIONS de pré-voo → CORS responde 204)
        ▼
BACK-END
 5. server.js     CORS → express.json() → req.body = { nome: "Ana", ... }
 6. server.js     app.use("/api/clientes") → entra em rotas/clientes.js
 7. clientes.js   router.post("/")
 8. validacao.js  validarCliente(req.body) → { dados } limpo
 9. db.js (pool)  INSERT INTO clientes SET nome='Ana', documento='12345678062', ...
        │
        ▼
MYSQL
10. confere UNIQUE(documento), CHECKs, gera id=12 e criado_em
        │
        ▼
BACK-END
11. clientes.js   buscarPorId(12) → SELECT ... AS criadoEm ...
12. clientes.js   res.status(201).json({ id: 12, nome: "Ana", criadoEm: "2026-...Z", ... })
        │
        ▼
NAVEGADOR
13. app.js        resposta.ok → devolve o JSON
14. cadastro-cliente.js → ui.flash("Cliente Ana cadastrado com sucesso.") → vai para clientes.html
```

E se o CPF já existir? No passo 10, o MySQL recusa (`ER_DUP_ENTRY`). No 11, o `tratarDuplicado` lança `HttpError(409)`. O tratador de erros responde `409 { "erro": "Já existe..." }`. No site, o `app.js` transforma isso em `ErroMGK` com `status 409`, e o `cadastro-cliente.js` marca o campo CPF em vermelho.

---

## 13. Testando a API sem o site

Teste cada rota **sozinha** antes de ligar o site. Quando algo falhar, você sabe se o problema está na API ou na tela.

### Pelo navegador (só GET)

Digite na barra de endereço:

- http://localhost:3000/api/saude
- http://localhost:3000/api/produtos
- http://localhost:3000/api/clientes?busca=ana

### Pelo VS Code: extensão *Thunder Client* ou *REST Client*

Com a extensão **REST Client**, crie um arquivo `testes.http`:

```http
### Listar produtos
GET http://localhost:3000/api/produtos

### Cadastrar cliente
POST http://localhost:3000/api/clientes
Content-Type: application/json

{
  "nome": "Cliente Teste", "documento": "52998224725", "celular": "11999998888",
  "cep": "01001000", "rua": "Praça da Sé", "numero": "1", "bairro": "Sé",
  "cidade": "São Paulo", "estado": "SP"
}

### Registrar venda
POST http://localhost:3000/api/vendas
Content-Type: application/json

{ "clienteId": 1, "itens": [{ "produtoId": 1, "quantidade": 2, "precoUnitario": 45 }], "desconto": 10 }
```

Aparece um link "Send Request" em cima de cada bloco.

### Pelo terminal (curl)

```bash
curl http://localhost:3000/api/produtos
curl -X POST http://localhost:3000/api/vendas -H "Content-Type: application/json" -d "{\"clienteId\":1,\"itens\":[]}"
```

### Conferindo no Workbench

Depois de cada teste, confira no banco:

```sql
SELECT * FROM clientes ORDER BY id DESC LIMIT 5;
SELECT * FROM vendas ORDER BY id DESC LIMIT 5;
SELECT * FROM venda_itens WHERE venda_id = 1;
```

---

## 14. Erros comuns e como resolver

| Mensagem (terminal ou tela) | Causa provável | Solução |
| --- | --- | --- |
| `ECONNREFUSED` | O MySQL não está rodando, ou o IP/porta estão errados | Confira se o serviço MySQL está ligado e o `DB_HOST`/`DB_PORT` no `.env` |
| `ETIMEDOUT` / `ENOTFOUND` | O IP não responde ou o nome não existe | Confira o IP; em outro PC, veja o firewall (porta 3306) |
| `ER_ACCESS_DENIED_ERROR` | Usuário ou senha errados | Confira `DB_USER`/`DB_PASSWORD`; veja se o usuário foi criado para `'%'` ou `'localhost'` |
| `ER_BAD_DB_ERROR` | O banco `mgk` não existe | Crie o banco, ou corrija o `DB_NAME` |
| `ER_NO_SUCH_TABLE` | Nome de tabela diferente do código | As tabelas devem se chamar `clientes`, `produtos`, `vendas`, `venda_itens` |
| `ER_BAD_FIELD_ERROR: Unknown column` | Nome de coluna diferente do código | Compare com a seção 4 do `BANCO-DE-DADOS.md` |
| `EADDRINUSE: :::3000` | Já tem algo usando a porta 3000 (talvez a própria API aberta em outro terminal) | Feche o outro terminal ou mude o `PORT` (e o `apiUrl` no site) |
| `Cannot use import statement outside a module` | Falta `"type": "module"` no `package.json` | Adicione a linha |
| `Cannot find module '.../db'` | Faltou o `.js` no import | Use `"./db.js"` |
| Site: "Não foi possível conectar ao servidor" | API desligada, `apiUrl` errado **ou CORS** | Veja se a API está rodando; abra o F12 → Console: se aparecer "CORS", ajuste o `CORS_ORIGIN` |
| Site: somas estranhas tipo `50.0030.00` | `DECIMAL` chegando como texto | Confira o `decimalNumbers: true` no `db.js` |
| Datas 3 horas adiantadas ou atrasadas | Fuso diferente | Confira o `timezone: "Z"` e o `SET time_zone` no `db.js` |
| Mudei o `.env` e nada mudou | O `.env` só é lido quando a API inicia | Pare (Ctrl+C) e rode `npm start` de novo |

> **Regra de ouro para depurar:** leia o **terminal onde a API está rodando**. Os erros inesperados aparecem ali com a mensagem completa do MySQL.

---

## 15. Roteiro: construindo do zero

Siga as etapas em ordem. **Só avance quando o "✅ Teste" da etapa funcionar.** Faça numa pasta nova (ex.: `backend-treino`) para comparar com o original quando travar.

### Etapa 1: projeto Node vazio

```bash
mkdir backend-treino
cd backend-treino
npm init -y
```

No `package.json` gerado, adicione `"type": "module"`. Crie `src/server.js` com `console.log("oi");`.

✅ Teste: `node src/server.js` mostra `oi`.

### Etapa 2: primeiro servidor Express

```bash
npm install express
```

```js
// src/server.js
import express from "express";
const app = express();
app.get("/api/ola", (req, res) => res.json({ mensagem: "Olá!" }));
app.listen(3000, () => console.log("rodando em http://localhost:3000"));
```

✅ Teste: abrir http://localhost:3000/api/ola mostra o JSON.

### Etapa 3: `.env` e scripts

Crie o `.env` com `PORT=3000`, troque o `3000` do código por `Number(process.env.PORT)` e adicione ao `package.json`:

```json
"scripts": { "start": "node --env-file=.env src/server.js", "dev": "node --watch --env-file=.env src/server.js" }
```

Crie o `.gitignore` com `node_modules/` e `.env`.

✅ Teste: `npm run dev`, mude o `PORT` para `3001`, reinicie e acesse na nova porta.

### Etapa 4: conectar ao MySQL

```bash
npm install mysql2
```

Crie o `src/db.js` só com o `createPool` (seção 6.1) e uma rota de teste:

```js
app.get("/api/saude", async (req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
});
```

✅ Teste: `/api/saude` responde `{"ok":true}`. Coloque uma senha errada no `.env` e veja o erro no terminal.

### Etapa 5: primeira rota com dados reais

Crie `src/rotas/produtos.js` só com o `GET /` (seção 9) e monte-a no server com `app.use("/api/produtos", produtos)`.

✅ Teste: `/api/produtos` lista os produtos que você cadastrou no Workbench.

### Etapa 6: `GET /:id` e o erro 404

Adicione o `express.json()`, crie o `erros.js` com o `HttpError`, o tratador de erros (seção 5.7) e o 404 do final. Faça o `GET /api/produtos/:id`.

✅ Teste: `/api/produtos/1` mostra o produto; `/api/produtos/999` mostra `{"erro":"Produto não encontrado."}` com status 404 (veja no F12 → Network).

### Etapa 7: CORS e ligar o site

Adicione o middleware de CORS (seção 5.2). No site, deixe `modo: "api"`.

✅ Teste: a tela de venda carrega a lista de produtos vinda do MySQL.

### Etapa 8: clientes (leitura)

Crie `rotas/clientes.js` com `GET /` (primeiro só "todos", depois `?busca=` e `?documento=`) e `GET /:id`.

✅ Teste: a tela de clientes lista e busca, e a ficha abre.

### Etapa 9: validação e cadastro

Crie o `validacao.js` (comece com nome e CPF, depois vá completando) e o `POST /`. Depois, o `tratarDuplicado`.

✅ Teste: cadastrar pelo site grava no banco (confira no Workbench); CPF repetido mostra o aviso no campo.

### Etapa 10: edição

Crie o `PUT /:id` com o `affectedRows`.

✅ Teste: editar pelo site muda o registro e preenche o `atualizado_em`.

### Etapa 11: vendas (leitura)

Crie o `buscarVendas` (primeiro só a consulta das vendas, depois os itens com `IN (?)` e o agrupamento). Faça as rotas `GET /`, `GET /?clienteId=` e `GET /:id`. Para testar, insira uma venda e itens à mão no Workbench.

✅ Teste: a ficha do cliente mostra o histórico e os detalhes da venda.

### Etapa 12: registrar a venda (transação)

Crie o `transacao()` no `db.js` e o `POST /` de vendas, seguindo os passos da seção 11.2.

✅ Teste: finalizar uma venda no site grava em `vendas` e `venda_itens`. Para ver o ROLLBACK funcionando, coloque um `throw new Error("teste")` logo depois do `INSERT INTO vendas`: a venda **não** deve aparecer no banco. Depois, remova o `throw`.

🎉 Neste ponto, você reconstruiu o back-end inteiro.

---

## 16. Exercícios

Do mais fácil para o mais difícil.

1. **Contagem:** crie `GET /api/clientes/total` que responde `{ "total": 11 }`. *Dica: `SELECT COUNT(*) AS total`. Cuidado com a ordem: essa rota precisa vir **antes** do `/:id`, senão o Express acha que "total" é um id.*
2. **Produtos por preço:** aceite `GET /api/produtos?ordem=preco` para ordenar por preço. *Cuidado: não coloque o texto do usuário direto no `ORDER BY`; use um `if` escolhendo entre textos fixos.*
3. **Cadastrar produto:** crie `POST /api/produtos` com validação (nome obrigatório, preço > 0) e `409` para nome repetido.
4. **Desativar produto:** crie `DELETE /api/produtos/:id` que **não apaga**, só faz `UPDATE produtos SET ativo = FALSE`. Por que apagar de verdade daria erro? *(Pense na `FOREIGN KEY` de `venda_itens`.)* Adicione `DELETE` no `Access-Control-Allow-Methods`.
5. **Cancelar venda:** crie `PUT /api/vendas/:id/cancelar` que muda o status para `cancelado`. Responda 409 se ela já estiver cancelada.
6. **Paginação:** aceite `?pagina=2&porPagina=20` em `GET /api/clientes`. *Dica: `LIMIT ? OFFSET ?`.*
7. **Relatório:** crie `GET /api/relatorios/mais-vendidos` com os 5 produtos mais vendidos (soma de quantidade), ignorando vendas canceladas. *Dica: `JOIN`, `GROUP BY`, `ORDER BY ... DESC LIMIT 5`.*
8. **Log de pedidos:** crie um middleware que imprime no terminal `GET /api/clientes 200 12ms` para cada pedido. *Dica: guarde `Date.now()` no início e use `res.on("finish", ...)`.*
9. **Desafio: login.** Crie a tabela `usuarios` (seção 9.1 do `BANCO-DE-DADOS.md`) e uma rota `POST /api/login`. Pesquise sobre **bcrypt** (para guardar a senha) e **JWT** (para "lembrar" quem está logado).

---

## 17. Glossário

| Termo | Significado |
| --- | --- |
| **API** | Conjunto de endereços (rotas) que um programa oferece para outros usarem |
| **Endpoint / rota** | Um endereço da API: método + caminho (`POST /api/vendas`) |
| **Request / Response** | Pedido e resposta HTTP |
| **Status HTTP** | Número que diz como foi a resposta (200, 404, 500...) |
| **JSON** | Formato de texto para trocar dados |
| **Middleware** | Função na fila do Express que recebe `(req, res, next)` |
| **CORS** | Regra do navegador sobre qual site pode chamar qual API |
| **Pool** | Grupo de conexões reutilizadas com o banco |
| **Query parametrizada** | SQL com `?` no lugar dos valores, o que protege contra SQL Injection |
| **SQL Injection** | Ataque que insere comandos SQL por meio de campos de texto |
| **Transação** | Bloco de operações "tudo ou nada" (`COMMIT` / `ROLLBACK`) |
| **Collation** | Regra de comparação de texto do banco (ex.: ignorar acentos) |
| **UNIQUE / FOREIGN KEY** | Regras do banco: valor não se repete / valor precisa existir em outra tabela |
| **Variável de ambiente** | Configuração de fora do código (`process.env.X`), vinda do `.env` |
| **snake_case / camelCase** | `preco_padrao` (padrão do SQL) / `precoPadrao` (padrão do JavaScript) |
| **N+1** | Erro de desempenho: fazer uma consulta por item em vez de uma para todos |
