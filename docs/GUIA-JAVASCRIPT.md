# Guia de estudo: o JavaScript do Sistema MGK

Este guia explica **todo** o JavaScript do projeto: como os arquivos se conectam, o que cada função faz, por que foi escrita daquele jeito e quais recursos da linguagem aparecem em cada trecho. No fim há um roteiro para você **reconstruir o sistema do zero** e exercícios para fixar.

> Dica: leia com o código aberto ao lado. Os links do tipo [app.js:23](../js/app.js#L23) levam direto para a linha citada.

> **Atualização (preparação para o back-end):** os repositórios `MGK.clientes`, `MGK.produtos` e `MGK.vendas` agora são **assíncronos**, e as telas os chamam com `await` (ex.: `const lista = await MGK.clientes.buscar(termo)`). Existem duas implementações de cada um, uma para o localStorage e outra para a API, escolhidas em `js/config.js`. Alguns trechos de código citados aqui mostram a versão síncrona anterior; a lógica de cada função continua a mesma. Detalhes em [BANCO-DE-DADOS.md](BANCO-DE-DADOS.md).
>
> **Atualização (produtos e pagamentos):** entraram a tela de **produtos** ([seção 8](#8-produtosjs--cadastro-de-produtos)), o **catálogo que se atualiza sozinho** na venda ([7.7](#77-catálogo-que-se-atualiza-sozinho-linhas-571622)), o **pagamento em partes** ([4.9](#49-repositório-de-vendas-e-pagamentos-linhas-497768), [5.4](#54-detalhes-da-venda-pagamentos-e-troca-de-modais-linhas-304592) e [7.5](#75-pagamento-linhas-349473)) e o **abatimento da conta em aberto** quando o cliente paga mais que a compra do dia. O resumo de tudo que mudou, com o que fazer no banco, está em [ATUALIZACOES.md](ATUALIZACOES.md).

---

## Sumário

1. [Visão geral da arquitetura](#1-visão-geral-da-arquitetura)
2. [Recursos da linguagem usados no projeto](#2-recursos-da-linguagem-usados-no-projeto)
3. [mock-data.js — os dados fictícios](#3-mock-datajs--os-dados-fictícios)
4. [app.js — o núcleo compartilhado](#4-appjs--o-núcleo-compartilhado)
5. [clientes.js — consulta e ficha do cliente](#5-clientesjs--consulta-e-ficha-do-cliente)
6. [cadastro-cliente.js — cadastro e edição](#6-cadastro-clientejs--cadastro-e-edição)
7. [venda.js — cadastro de venda](#7-vendajs--cadastro-de-venda)
8. [produtos.js — cadastro de produtos](#8-produtosjs--cadastro-de-produtos)
9. [Fluxos completos, do clique ao localStorage](#9-fluxos-completos-do-clique-ao-localstorage)
10. [Como replicar: roteiro passo a passo](#10-como-replicar-roteiro-passo-a-passo)
11. [Exercícios](#11-exercícios)
12. [Padrões para levar para outros projetos](#12-padrões-para-levar-para-outros-projetos)

---

## 1. Visão geral da arquitetura

O sistema não tem back-end nem build. São páginas HTML comuns, cada uma carregando **quatro scripts, sempre nesta ordem**, no fim do `<body>`:

```html
<script src="...bootstrap.bundle.min.js"></script> <!-- 1. Bootstrap (modais, toasts, offcanvas) -->
<script src="js/mock-data.js"></script>            <!-- 2. Dados fictícios em variáveis globais -->
<script src="js/app.js"></script>                  <!-- 3. Núcleo: cria window.MGK -->
<script src="js/clientes.js"></script>             <!-- 4. Lógica específica da página -->
```

A ordem importa porque cada arquivo **usa o que o anterior criou**:

```text
bootstrap.bundle.js ──► cria window.bootstrap (Modal, Toast, Offcanvas)
        │
mock-data.js ────────► cria window.MGK_MOCK_CLIENTES / _PRODUTOS / _VENDAS
        │
app.js ──────────────► lê os MOCKs, cria window.MGK = { format, validate, clientes, produtos, vendas, ui, ... }
        │
página (clientes.js / cadastro-cliente.js / venda.js / produtos.js)
                     ► lê window.MGK e liga a tela aos dados
```

Por que os scripts ficam **no fim do `<body>`**? Quando o navegador chega neles, todo o HTML acima já foi montado, então `document.getElementById(...)` encontra os elementos. Se estivessem no `<head>`, os elementos ainda não existiriam (a solução seria `defer` ou esperar o `DOMContentLoaded`).

### Camadas

| Camada | Arquivo | Responsabilidade |
| --- | --- | --- |
| Dados iniciais | `mock-data.js` | Clientes, produtos e vendas de demonstração |
| Utilitários | `app.js` → `format`, `validate`, helpers | Máscaras, validações, formatação de moeda/data |
| Repositórios | `app.js` → `clientes`, `produtos`, `vendas` | **Único lugar** que lê/grava no `localStorage` |
| Interface comum | `app.js` → `ui` | Toasts e mensagens entre páginas |
| Telas | `clientes.js`, `cadastro-cliente.js`, `venda.js`, `produtos.js` | Eventos, renderização de HTML, validação de formulário |

A regra de ouro: **as telas nunca mexem no `localStorage` diretamente**, sempre passam por `MGK.clientes`, `MGK.produtos` ou `MGK.vendas`. Assim, no dia em que houver uma API, só o `app.js` muda.

---

## 2. Recursos da linguagem usados no projeto

Antes de ler os arquivos, vale conhecer os recursos que aparecem o tempo todo.

### 2.1 IIFE — função que executa a si mesma

```js
(function () {
  "use strict";
  // ...código...
})();
```

Todos os arquivos (menos o `mock-data.js`) são envolvidos assim. A função é declarada e **executada imediatamente**. Motivo: as variáveis declaradas lá dentro (`const el`, `const venda`...) ficam **privadas** àquela função e não poluem o escopo global. Duas páginas poderiam ter uma variável `el` sem conflito.

O que precisa ser público é pendurado de propósito em `window`, como em [app.js:451](../js/app.js#L451): `window.MGK = { ... }`.

### 2.2 `"use strict"`

Ativa o modo estrito: erros silenciosos viram exceções (por exemplo, atribuir a uma variável não declarada gera erro em vez de criar uma global sem querer).

### 2.3 `const`, `let` e arrow functions

```js
const onlyDigits = (value) => String(value ?? "").replace(/\D/g, "");
```

- `const`: a variável não pode ser reatribuída (o conteúdo de objetos/arrays ainda pode mudar).
- `let`: pode ser reatribuída (ex.: `let ativa = -1` em [venda.js:49](../js/venda.js#L49)).
- `(x) => expressão`: arrow function; quando o corpo é uma única expressão, o `return` é implícito.

### 2.4 Template literals (crases)

```js
`<strong>${total}</strong> ${total === 1 ? "cliente" : "clientes"}`
```

Strings com várias linhas e `${...}` para inserir valores. O projeto monta **quase todo o HTML dinâmico** assim.

### 2.5 Desestruturação

```js
const { clientes, format, validate, onlyDigits, ui } = window.MGK;
```

Equivale a `const clientes = window.MGK.clientes; const format = window.MGK.format; ...`. Também aparece em parâmetros: `registrar({ clienteId, itens, desconto = 0 })` ([app.js:361](../js/app.js#L361)) e em arrays: `([produtoId, quantidade, precoUnitario]) => ...` ([mock-data.js:221](../js/mock-data.js#L221)).

### 2.6 Spread `...`

```js
{ ...dados, documento: onlyDigits(dados.documento) }   // copia o objeto e sobrescreve um campo
lista.push(...structuredClone(novos));                  // espalha um array como argumentos
```

### 2.7 `??` e `?.`

- `value ?? ""`: se `value` for `null` ou `undefined`, usa `""`. Diferente de `||`, **não** troca `0` nem `""`.
- `primeiroInvalido?.focus()`: só chama `focus()` se `primeiroInvalido` não for `null`/`undefined`.

### 2.8 Métodos de array (o coração do projeto)

| Método | O que faz | Exemplo no projeto |
| --- | --- | --- |
| `map` | Transforma cada item | Cliente → linha `<tr>` ([clientes.js:75](../js/clientes.js#L75)) |
| `filter` | Mantém os que passam no teste | Vendas não canceladas ([app.js:336](../js/app.js#L336)) |
| `find` | Primeiro item que passa no teste | `obter(id)` ([app.js:216](../js/app.js#L216)) |
| `findIndex` | Índice do primeiro que passa | Achar cliente para editar ([app.js:239](../js/app.js#L239)) |
| `some` | Algum passa? (`true`/`false`) | Documento já em uso ([app.js:233](../js/app.js#L233)) |
| `reduce` | Acumula em um valor | Somar totais ([app.js:339](../js/app.js#L339)) |
| `sort` | Ordena (muda o array original) | Ordem alfabética ([app.js:212](../js/app.js#L212)) |
| `join` | Junta em string | `.map(...).join("")` para gerar HTML |
| `slice` | Pedaço do array/string | Limitar a 8 opções ([venda.js:69](../js/venda.js#L69)) |

### 2.9 `localStorage` e `sessionStorage`

Armazenamento **chave → texto** do navegador.

- `localStorage`: persiste mesmo fechando o navegador. Usado para clientes, produtos e vendas.
- `sessionStorage`: some ao fechar a aba. Usado para a mensagem "flash" entre páginas.

Como só guarda texto, os objetos passam por `JSON.stringify` para gravar e `JSON.parse` para ler.

### 2.10 Delegação de eventos

Em vez de colocar um `addEventListener` em cada botão de cada linha da tabela, o projeto coloca **um só** no elemento pai e descobre quem foi clicado com `closest`:

```js
el.tbody.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-action='ver']");
  if (btn) abrirVisualizacao(btn.dataset.id);
});
```

Vantagens: funciona para linhas criadas depois (o `innerHTML` é refeito a cada busca) e gasta menos memória.

### 2.11 `data-*` e `dataset`

No HTML: `data-id="c-0001"`. No JS: `elemento.dataset.id`. É a forma de guardar o id do registro dentro do elemento para recuperar no clique. `data-uid` vira `dataset.uid`, `data-venda` vira `dataset.venda`.

### 2.12 `URLSearchParams`

```js
new URLSearchParams(location.search).get("id")
```

Lê parâmetros da URL. Em `cadastro-cliente.html?id=c-0001`, retorna `"c-0001"`. É como as páginas "conversam": a URL diz o que a página deve abrir.

### 2.13 Expressões regulares (regex)

| Regex | Significado |
| --- | --- |
| `/\D/g` | Qualquer caractere que **não** é dígito, em todo o texto (`g`) |
| `/^(\d{3})(\d)/` | Início (`^`), 3 dígitos (grupo 1), 1 dígito (grupo 2) |
| `/^(\d)\1{10}$/` | Um dígito seguido do **mesmo** dígito 10 vezes (`\1` = repete o grupo 1) |
| `/^[\d.\-\/\s]+$/` | Texto formado só por dígitos, ponto, hífen, barra e espaço |
| `/^0+(?=\d)/` | Zeros à esquerda que tenham um dígito depois (`(?=...)` = "olha à frente") |

No `replace`, `$1`, `$2` inserem o que cada grupo capturou.

---

## 3. mock-data.js — os dados fictícios

Arquivo: [js/mock-data.js](../js/mock-data.js)

É o único arquivo **sem IIFE**, porque o objetivo dele é justamente criar variáveis globais para o `app.js` ler.

### 3.1 `window.MGK_MOCK_CLIENTES` ([linha 6](../js/mock-data.js#L6))

Array de objetos cliente. Formato:

```js
{
  id: "c-0001",
  nome: "Ana Fictícia Moreira",
  documento: "12345678062",   // CPF/CNPJ SÓ COM DÍGITOS
  telefone: "1130000001",     // só dígitos
  celular: "11900000001",
  email: "...",
  cep: "01000000", rua, numero, complemento, bairro, cidade, estado,
  status: "ativo" | "inativo",
  criadoEm: "2026-01-12T10:00:00.000Z" // data ISO 8601
}
```

Decisão importante: **os dados são gravados sem máscara** (só dígitos). A máscara é aplicada apenas na hora de exibir. Isso facilita buscar, comparar e validar.

### 3.2 `window.MGK_MOCK_PRODUTOS` ([linha 200](../js/mock-data.js#L200))

```js
{ id: "p-001", nome: "Shampoo Profissional", precoPadrao: 50.0 }
```

`precoPadrao` é o preço de tabela. Os produtos de demonstração não trazem o campo `ativo`: o repositório trata a ausência como **ativo** (veja [4.8](#48-repositório-de-produtos-linhas-397494)). Produtos novos, cadastrados pela tela, já são gravados com `ativo`, `criadoEm` e `atualizadoEm`.

### 3.3 `window.MGK_MOCK_VENDAS` ([linha 217](../js/mock-data.js#L217))

Aqui há uma IIFE que **retorna** o array. Ela cria uma pequena "fábrica" de vendas para não repetir o mesmo objeto enorme 40 vezes:

```js
const produtos = Object.fromEntries(window.MGK_MOCK_PRODUTOS.map((p) => [p.id, p]));
```

`Object.fromEntries` transforma `[["p-001", {...}], ["p-002", {...}]]` em `{ "p-001": {...}, "p-002": {...} }`, um **dicionário por id**. Assim, `produtos["p-003"]` acha o produto sem percorrer o array.

A função `venda(numero, clienteId, data, itens, desconto, status)` recebe os itens no formato compacto `[produtoId, quantidade, precoUnitario]` e calcula nome, subtotal de cada linha, subtotal geral e total. Exemplo:

```js
venda("000071", "c-0001", "2026-08-18", [["p-001", 2, 50], ["p-004", 1, 45]], 25)
// subtotais: 2×50 = 100 e 1×45 = 45 → subtotal 145 → total 145 − 25 = 120
```

Note que a IIFE depende de `MGK_MOCK_PRODUTOS` já existir, por isso ela vem depois no arquivo.

O último parâmetro, **`pagamentos`**, é opcional e segue o mesmo formato compacto: `[[data, valor, forma], ...]`. Sem ele, a venda sai **paga integralmente no Pix, no dia da venda** (e cancelada sai sem pagamentos). Alguns pedidos da demonstração foram deixados em aberto de propósito, para a tela de pagamentos ter o que mostrar:

```js
// Ana: R$ 250 de compra, R$ 100 no dia + R$ 50 depositados uma semana depois → faltam R$ 100
venda("000123", "c-0001", "2026-09-15", [["p-001", 2, 50], ["p-002", 1, 80], ["p-005", 2, 35]], 0, "concluido",
  [["2026-09-15", 100, "dinheiro"], ["2026-09-22", 50, "transferencia"]]),

// Bruno: nada pago ainda
venda("000131", "c-0002", "2026-09-20", [["p-008", 2, 120], ["p-006", 1, 70]], 0, "andamento", []),
```

| Pedido | Cliente | Total | Pago | Em aberto |
| --- | --- | ---: | ---: | ---: |
| #000123 | Ana Fictícia Moreira | R$ 250,00 | R$ 150,00 | R$ 100,00 |
| #000127 | Salão Exemplo Beleza | R$ 890,00 | R$ 500,00 | R$ 390,00 |
| #000131 | Bruno Teste Carvalho | R$ 310,00 | — | R$ 310,00 |
| #000133 | Studio Hair Fictício | R$ 525,00 | R$ 200,00 | R$ 325,00 |

> Quem já usava o sistema tem as vendas antigas salvas no navegador **sem** pagamentos. Para ver estes exemplos, use "Restaurar dados de demonstração" na tela de Clientes.

---

## 4. app.js — o núcleo compartilhado

Arquivo: [js/app.js](../js/app.js). Tudo o que é usado por mais de uma tela mora aqui.

### 4.1 Constantes de chave ([linhas 21–27](../js/app.js#L21-L27))

```js
const STORAGE_KEY = "mgk.clientes.v1";
const PRODUTOS_KEY = "mgk.produtos.v1";
const VENDAS_KEY  = "mgk.vendas.v1";
const SEED_KEY    = "mgk.seed";
const SEED_VERSION = 2;
const FLASH_KEY   = "mgk.flash";
```

O sufixo `.v1` permite, no futuro, mudar o formato dos dados usando outra chave sem quebrar quem tem dados antigos. O comentário `gitleaks:allow` só avisa a ferramenta de segurança que aquilo não é uma senha.

### 4.2 Helpers ([linhas 32–59](../js/app.js#L32-L59))

**`onlyDigits(value)`** — remove tudo que não é número. `"123.456.789-09"` → `"12345678909"`. O `String(value ?? "")` garante que funciona mesmo com `null`, `undefined` ou número.

**`normalize(value)`** — prepara texto para comparação:
1. `.normalize("NFD")` separa a letra do acento (`"é"` vira `"e"` + `"´"`).
2. `.replace(/[̀-ͯ]/g, "")` remove os acentos soltos (faixa Unicode U+0300 a U+036F; no arquivo os caracteres aparecem literalmente).
3. `.toLowerCase().trim()` → minúsculas e sem espaços nas pontas.

Resultado: `"  João "` → `"joao"`. É isso que permite buscar "joao" e achar "João".

**`escapeHtml(value)`** — troca `& < > " '` pelas entidades HTML. **Essencial para segurança**: todo dado vindo do usuário que entra em `innerHTML` passa por aqui. Sem isso, um cliente chamado `<img src=x onerror=alert(1)>` executaria código na página (ataque XSS).

A técnica: `replace` com uma **função** como segundo argumento; para cada caractere encontrado, devolve a tradução de um objeto-dicionário.

**`initials(name)`** — `"Ana Fictícia Moreira"` → `"AM"` (primeira letra do primeiro e do último nome). `split(/\s+/)` quebra por um ou mais espaços; `filter(Boolean)` remove strings vazias.

### 4.3 `format` — máscaras e formatação ([linhas 64–125](../js/app.js#L64-L125))

Todas recebem texto "sujo" (com ou sem máscara) e devolvem o texto mascarado. Todas começam com `onlyDigits(...)` e um `slice` que limita o tamanho.

**`format.cpf`** — aplica os `replace` em cadeia. Veja como `"12345678909"` evolui:

```text
"12345678909"
 → /^(\d{3})(\d)/              → "123.45678909"
 → /^(\d{3})\.(\d{3})(\d)/     → "123.456.78909"
 → /\.(\d{3})(\d{1,2})$/       → "123.456.789-09"
```

Como cada `replace` só age se houver dígitos suficientes, a máscara funciona **enquanto o usuário digita** (com 4 dígitos já vira `"123.4"`).

**`format.cnpj`** — mesma ideia com o padrão `00.000.000/0000-00`.

**`format.documento`** — decide pela quantidade: mais de 11 dígitos é CNPJ, senão CPF. Por isso o mesmo campo aceita os dois.

**`format.telefone`** — usa `if`s por faixa de tamanho, cobrindo fixo `(11) 3000-0001` (10 dígitos) e celular `(11) 90000-0001` (11 dígitos).

**`format.cep`** — `"01000000"` → `"01000-000"`.

**`format.tipoDocumento`** — devolve `"CPF"` ou `"CNPJ"`.

**`format.data(iso)`** — `new Date(iso).toLocaleDateString("pt-BR")` → `"12/01/2026"`. Retorna `"—"` se não houver data.

**`format.moeda(value)`** — `toLocaleString("pt-BR", { style: "currency", currency: "BRL" })` → `"R$ 1.234,56"`. A API `Intl` do navegador faz todo o trabalho.

**`format.moedaInput(value)`** — máscara de digitação de dinheiro, estilo "caixa eletrônico": os dígitos entram pela direita.

```text
digita 4    → "4"    → 0,04
digita 45   → "45"   → 0,45
digita 4500 → "4500" → 45,00
```

Remove zeros à esquerda, limita a 9 dígitos, divide por 100 e formata com 2 casas.

**`format.parseMoeda(value)`** — o caminho inverso: `"1.234,56"` → pega os dígitos `"123456"` → divide por 100 → `1234.56` (número).

### 4.4 `centavos(value)` ([linha 128](../js/app.js#L128))

```js
const centavos = (value) => Math.round((Number(value) || 0) * 100) / 100;
```

Em JavaScript, `0.1 + 0.2` dá `0.30000000000000004` (limitação do ponto flutuante). Arredondar para centavos depois de cada conta evita esses resíduos nos totais. **Regra prática para dinheiro em JS**: arredonde sempre, ou trabalhe em centavos inteiros.

### 4.5 `validate` — validações ([linhas 133–177](../js/app.js#L133-L177))

Todas devolvem `true`/`false`.

**`validate.cpf`** — algoritmo oficial dos dígitos verificadores:

1. Precisa ter 11 dígitos e **não** pode ser tudo igual (`111.111.111-11` passaria na conta, mas é inválido); daí o regex `/^(\d)\1{10}$/`.
2. O laço `for (let t = 9; t < 11; t++)` calcula os dois dígitos finais:
   - Para o 1º dígito verificador (`t = 9`): multiplica os 9 primeiros dígitos por 10, 9, 8, ..., 2 e soma.
   - Para o 2º (`t = 10`): multiplica os 10 primeiros por 11, 10, ..., 2 e soma.
   - O peso é `t + 1 - i`.
   - `((soma * 10) % 11) % 10` é o dígito esperado (o `% 10` final transforma 10 em 0).
3. Se algum dígito calculado for diferente do digitado, é inválido.

**`validate.cnpj`** — mesma ideia, com os pesos fixos `[5,4,3,2,9,8,7,6,5,4,3,2]` para o 1º dígito e `[6,5,4,...]` para o 2º. Regra: resto da soma por 11; se `< 2`, dígito é 0, senão `11 - resto`. Usa `reduce` para somar.

**`validate.documento`** — 11 dígitos valida como CPF, 14 como CNPJ, qualquer outro tamanho é inválido.

**`validate.telefone`** — 10 ou 11 dígitos. **`validate.email`** — regex simples `algo@algo.algo` (2+ letras no final). **`validate.cep`** — 8 dígitos.

### 4.6 Repositório de clientes ([linhas 248–367](../js/app.js#L248-L367))

**`read()`** — lê os clientes:

```js
const raw = localStorage.getItem(STORAGE_KEY);
if (raw) return atualizarDemonstracao(JSON.parse(raw));
// se não há nada salvo (primeiro acesso) ou deu erro:
const seed = structuredClone(window.MGK_MOCK_CLIENTES || []);
write(seed);
return seed;
```

- O `try/catch` protege contra JSON corrompido ou navegador que bloqueia o storage.
- `structuredClone` faz uma **cópia profunda**. Sem ela, alterar um cliente alteraria o objeto original do mock.

**`write(list)`** — `JSON.stringify` e grava.

**`atualizarDemonstracao(lista)`** — uma "migração": quem abriu a versão 1 do sistema já tinha clientes salvos e não veria os novos clientes fictícios. Na primeira leitura, se a versão gravada em `mgk.seed` for menor que `SEED_VERSION`, adiciona os mocks que ainda não existem (compara por id **e** por documento usando `Set`, que tem busca rápida com `.has`) e grava a versão nova.

**`newId()`** — gera ids como `c-lx3k9a2f1b`:
- `Date.now().toString(36)`: milissegundos atuais em base 36 (letras e números), curto e crescente.
- `randomSuffix()`: 4 caracteres aleatórios usando `crypto.getRandomValues` (gerador criptográfico, melhor que `Math.random`), evitando colisão se dois ids forem criados no mesmo milissegundo.

**Objeto `clientes`** — a "API" pública:

| Método | O que faz |
| --- | --- |
| `listar()` | Todos, em ordem alfabética. `localeCompare(b, "pt-BR")` ordena corretamente com acentos. |
| `obter(id)` | Um cliente ou `null`. |
| `buscar(termo)` | Se o termo parece documento (≥ 3 dígitos e só dígitos/pontuação), compara com `documento`; senão compara nomes normalizados. Termo vazio devolve todos. |
| `documentoEmUso(doc, ignorarId)` | Há outro cliente com esse documento? O `ignorarId` existe para que, ao **editar**, o próprio cliente não conte como duplicado. |
| `salvar(dados)` | Se `dados.id` existe na lista → **atualiza** (mescla com spread e grava `atualizadoEm`). Senão → **cria** (gera id, status `"ativo"`, `criadoEm`). Devolve o registro salvo. |
| `restaurarDemonstracao()` | Sobrescreve com os mocks. |

Detalhe do `salvar`: `{ ...lista[idx], ...registro, atualizadoEm }`. Quem vem depois no spread vence, então os dados novos sobrescrevem os antigos, mas campos que não vieram (ex.: `criadoEm`) são mantidos.

### 4.7 `store(key, seed)` — fábrica de armazenamento ([linhas 372–393](../js/app.js#L372-L393))

Clientes têm um `read/write` próprio (por causa da migração). Para produtos e vendas, em vez de copiar o mesmo código duas vezes, existe uma **função que cria objetos** com `read`, `write` e `reset` para uma chave qualquer:

```js
const produtosStore = store(PRODUTOS_KEY, () => window.MGK_MOCK_PRODUTOS);
const vendasStore   = store(VENDAS_KEY,   () => window.MGK_MOCK_VENDAS);
```

Pontos de estudo:
- **Closure**: os métodos "lembram" de `key` e `seed` mesmo depois que `store` terminou de executar.
- `seed` é uma **função** (e não o array direto) para que o valor seja lido só quando necessário.
- Dentro de `read()`, `this.write(...)` funciona porque `read` é chamado como `produtosStore.read()`, então `this` é `produtosStore`. Por isso esses métodos usam a sintaxe `read() {}` e não arrow function (arrow functions não têm `this` próprio).

### 4.8 Repositório de produtos ([linhas 397–494](../js/app.js#L397-L494))

Produto: `{ id, nome, precoPadrao, ativo, criadoEm, atualizadoEm }`. Como nos clientes, há `produtosLocal` (localStorage) e `produtosApi` (HTTP), com os mesmos métodos:

| Método | O que faz | Na API |
| --- | --- | --- |
| `listar()` | Só os **ativos**, por nome. É o que a tela de venda usa | `GET /produtos` |
| `listarTodos()` | Ativos e inativos (tela de produtos) | `GET /produtos?todos=1` |
| `obter(id)` | Um produto, mesmo inativo (histórico) | `GET /produtos/:id` |
| `salvar(dados)` | Sem `id` cria, com `id` atualiza. Nome repetido → `ErroMGK` **409** | `POST` / `PUT /produtos/:id` |
| `excluir(id)` | Apaga, **só se o produto nunca foi vendido**; senão → 409 | `DELETE /produtos/:id` |
| `aoAlterar(callback)` | Avisa quando os produtos mudam em **outra aba** | *(não faz nada)* |

Pontos de estudo:

- **`comAtivo(p)`** — produtos antigos não têm o campo `ativo`. Em vez de migrar o localStorage, a leitura completa o dado: `{ ...p, ativo: p.ativo !== false }` (ausente conta como ativo). É uma **migração preguiçosa**: o dado é corrigido quando lido, sem script separado.
- **Nome repetido** é comparado com `normalize` (sem acento e sem maiúsculas), então "Óleo" e "oleo" contam como o mesmo nome. Na API quem garante isso é o `UNIQUE` do banco.
- **Por que não deixar excluir produto já vendido?** O histórico da venda aponta para o produto (`produtoId`). Apagar deixaria o pedido "órfão". Para tirar um produto de linha, **inativa-se**: ele some da venda e continua no histórico. No MySQL, a chave estrangeira `ON DELETE RESTRICT` bloqueia a exclusão e a API traduz o erro para 409.
- **`aoAlterar` e o evento `storage`** — o navegador dispara `storage` nas **outras** abas do mesmo site quando o localStorage muda. É assim que a tela de venda fica sabendo, na hora, de um produto cadastrado na aba ao lado:

  ```js
  window.addEventListener("storage", (event) => {
    if (event.key === PRODUTOS_KEY || event.key === null) callback(); // null = localStorage.clear()
  });
  ```

  No modo API não existe esse aviso (o dado está no servidor), então a tela de venda também recarrega o catálogo ao voltar para a aba (veja [7.7](#77-catálogo-que-se-atualiza-sozinho-linhas-571622)).

### 4.9 Repositório de vendas e pagamentos ([linhas 497–768](../js/app.js#L497-L768))

Venda: `{ id, numero, clienteId, data, produtos, subtotal, desconto, total, status, pagamentos }`.
Pagamento: `{ id, data, valor, forma, observacao }`.

O cliente nem sempre paga tudo no pedido: pode pagar uma parte (ou nada) e depositar o resto depois, em quantas vezes quiser. Por isso a venda guarda uma **lista de pagamentos**, e o saldo nunca é gravado: é sempre **calculado** (`total − soma dos pagamentos`). Assim ele nunca fica desatualizado.

`MGK.vendas` junta dois objetos: `vendasRegras` (regras puras, iguais nos dois modos) e `vendasLocal`/`vendasApi` (acesso aos dados):

```js
const vendas = { ...vendasRegras, ...(MODO_API ? vendasApi : vendasLocal) };
```

**Regras (`vendasRegras`):**

**`STATUS`** — dicionário código → texto exibido (`concluido` → `"Concluído"`).

**`FORMAS_PAGAMENTO`** — `dinheiro`, `pix`, `debito`, `credito`, `transferencia`, `boleto`, `outro` → texto exibido. As telas montam os `<option>` a partir dele, então uma forma nova é incluída num lugar só (e no `ENUM` do banco).

**`pagamento(venda)`** — devolve `{ pago, saldo, situacao }`:

| `situacao` | Quando | Texto (`SITUACAO_PAGAMENTO`) |
| --- | --- | --- |
| `pago` | saldo = 0 | Pago |
| `parcial` | pagou algo, mas saldo > 0 | Pago em parte |
| `pendente` | nenhum pagamento | Não pago |
| `cancelado` | venda cancelada (não tem saldo a receber) | — |

**`contaEmAberto(vendasDoCliente)`** — a "conta" do cliente: as vendas com saldo, **da mais antiga para a mais recente**, e a soma dos saldos. Devolve `{ saldo, vendas: [{ venda, saldo }] }`.

**`distribuirPagamento(valor, totalVenda, conta)`** — divide o valor pago no ato de uma venda nova: primeiro quita a venda nova; o que sobrar **abate a conta anterior**, da venda mais antiga para a mais recente. Exemplo com compra de R$ 80, conta anterior de R$ 100 (#000098: R$ 30, #000123: R$ 70) e R$ 130 pagos:

```text
130 → 80 na venda nova             (sobra 50)
    → 30 na #000098 (quitada)      (sobra 20)
    → 20 na #000123 (faltam 50)    (sobra 0)
```

A tela de venda usa essa mesma função para mostrar a prévia ("Abate da conta anterior"), e o repositório a usa para gravar. **Uma regra, um lugar.**

**`resumir(lista)`** — resumo da ficha: `{ quantidade, totalGasto, emAberto, ultimaCompra }`, ignorando canceladas.

**`listar()`** — ordena da mais recente para a mais antiga: `b.data.localeCompare(a.data)`. Datas ISO (`2026-09-15T...`) podem ser comparadas como texto porque o formato vai do maior para o menor (ano, mês, dia). O `|| b.numero.localeCompare(a.numero)` desempata quando a data é igual (comparação dá `0`, que é "falso").

**`porCliente(clienteId)`** — filtra por cliente.

**`resumoCliente(clienteId)`** — busca as vendas do cliente e aplica `resumir`.

**`calcular(itens, desconto)`** — **a regra de negócio dos totais**, usada tanto pela tela (ao vivo) quanto no registro (ao salvar), garantindo que os dois nunca divergem:
1. Subtotal de cada linha = quantidade × preço unitário.
2. Subtotal geral = soma das linhas.
3. Desconto é "prendido" entre 0 e o subtotal: `Math.min(Math.max(desconto, 0), subtotal)` (padrão *clamp*).
4. Total = subtotal − desconto.

**`proximoNumero()`** — maior número existente + 1, com zeros à esquerda: `padStart(6, "0")` → `"000134"`.

**Dados (`vendasLocal`):**

**`comPagamentos(v)` e `lerVendas()`** — vendas gravadas antes do controle de pagamentos não têm o campo `pagamentos`. Elas eram consideradas quitadas, então a leitura as completa com **um pagamento do total, na data da venda, com forma "não informada"** (outra migração preguiçosa, como `comAtivo`). Todo método lê por `lerVendas()`, nunca direto do `vendasStore`.

**`registrar({ clienteId, itens, desconto, pagamento })`** — grava uma venda:
1. **Valida de novo** tudo (cliente existe, há itens, produto existe **e está ativo**, quantidade inteira ≥ 1, preço > 0). Mesmo que a tela já valide, o repositório não confia em quem o chama. Erros são lançados com `throw new ErroMGK(mensagem, status)` e a tela os captura com `try/catch`.
2. Monta cada item com o **nome e o preço padrão copiados do produto naquele momento** (uma "fotografia"). Se o produto mudar de nome ou preço depois, o histórico continua correto.
3. Calcula totais com `calcular` e a **conta em aberto** do cliente com `contaEmAberto`.
4. `validarPagamentoInicial` confere o `pagamento` (o que foi pago **na hora**): pode ser 0 (paga tudo depois) e pode passar do total **até o total + conta em aberto**. Se o valor for maior que zero, a forma é obrigatória.
5. `distribuirPagamento` divide o valor: a parte da venda nova vira o pagamento "Pago na venda"; cada abatimento vira um pagamento na venda antiga, com a observação `Abatido na venda #000140`.
6. Grava tudo de uma vez (`vendasStore.write`) e devolve a venda com um campo extra, **`abatimentos: [{ vendaId, numero, valor }]`**, que a tela usa na mensagem de sucesso.

Detalhe de estudo no passo 5: `contaEmAberto` recebe os **mesmos objetos** que estão em `lista`. Por isso `antiga.pagamentos.push(...)` altera a venda dentro de `lista`, e o `write(lista)` já grava os abatimentos. Objetos em JavaScript são passados por **referência**.

**`registrarPagamento(vendaId, { valor, forma, data, observacao })`** — pagamento posterior (o cliente "depositou mais uma parte"). Regras:
- venda existe e não está cancelada;
- `0 < valor ≤ saldo` (não deixa pagar a mais);
- forma válida;
- `data` não pode ser no futuro, mas **pode ser anterior à venda**: é o que permite lançar pagamentos antigos vindos da planilha do Excel.

Devolve a venda atualizada.

**Na API (`vendasApi`)**: `registrar` faz `POST /vendas` com `{ clienteId, itens, desconto, pagamento }` e `registrarPagamento` faz `POST /vendas/:id/pagamentos`. As mesmas regras são aplicadas de novo no servidor, dentro de uma transação.

### 4.10 `ui` — interface comum ([linhas 773–815](../js/app.js#L773-L815))

**`ui.toast(message, type)`** — notificação no canto da tela:
1. Procura o contêiner `#toastContainer`; se não existir, cria e anexa ao `body`.
2. Cria o elemento do toast com `createElement` e `innerHTML` (a mensagem passa por `escapeHtml`).
3. `new bootstrap.Toast(el, { delay: 3500 })` e `toast.show()`: o Bootstrap cuida da animação e de sumir após 3,5 s.
4. No evento `hidden.bs.toast`, remove o elemento do DOM para não acumular lixo.
5. `role="status"` e `aria-live="polite"` fazem leitores de tela anunciarem a mensagem.

**`ui.flash(message, type)` e `ui.consumeFlash()`** — resolvem um problema clássico: depois de salvar, a página redireciona (`location.href = ...`) e um toast mostrado antes do redirecionamento sumiria. Então:
1. Antes de sair, `flash` grava a mensagem no `sessionStorage`.
2. A nova página, ao carregar, chama `consumeFlash`, que lê, **apaga** (para não repetir num F5) e mostra o toast.

### 4.11 Exportação e inicialização ([linhas 817–845](../js/app.js#L817-L845))

```js
window.MGK = {
  config: CONFIG, modoApi: MODO_API, api, ErroMGK,       // configuração e acesso à API
  onlyDigits, normalize, escapeHtml, initials, mesmoId,  // helpers
  format, validate,                                      // máscaras e validações
  clientes, produtos, vendas,                            // repositórios
  ui,                                                    // toasts e mensagens entre páginas
};
```

`{ onlyDigits }` é atalho de `{ onlyDigits: onlyDigits }`.

No `DOMContentLoaded` (HTML pronto), mostra o flash pendente e faz os links do menu lateral fecharem o menu no celular (`bootstrap.Offcanvas.getInstance(sidebar)?.hide()`; o `?.` evita erro quando o menu não foi aberto como offcanvas).

---

## 5. clientes.js — consulta e ficha do cliente

Arquivo: [js/clientes.js](../js/clientes.js). Tela `clientes.html`.

### 5.1 Referências aos elementos ([linhas 11–27](../js/clientes.js#L11-L27))

O objeto `el` junta, uma vez só, todos os elementos usados. Evita repetir `document.getElementById` e deixa claro de quais partes do HTML o script depende.

`new bootstrap.Modal(...)` cria os controladores das duas janelas modais (ficha do cliente e detalhes da venda).

### 5.2 Renderização da lista ([linhas 29–111](../js/clientes.js#L29-L111))

O padrão de toda a tela é **"dados → string HTML → innerHTML"**:

- `statusBadge(status)` → HTML do selo Ativo/Inativo.
- `linhaCliente(c)` → HTML de um `<tr>`. Repare que **todo** dado do cliente passa por `escapeHtml`, e ids em URLs passam por `encodeURIComponent` (que escapa caracteres especiais para URL).
- `render(lista, termo)`:
  - `el.tbody.innerHTML = lista.map(linhaCliente).join("")` → desenha todas as linhas de uma vez.
  - Alterna tabela × estado vazio com a propriedade `hidden`.
  - Mensagem do estado vazio diferente para "busca sem resultado" e "sem clientes".
  - Contador com singular/plural.
- `buscar()` lê o campo e chama `render(clientes.buscar(termo), termo)`.
- `limpar()` zera o campo, busca de novo e devolve o foco ao campo.

### 5.3 Ficha do cliente ([linhas 113–302](../js/clientes.js#L113-L302))

- `campo(label, valor, col)` → bloco "rótulo + valor" reutilizável, com classe de coluna do Bootstrap.
- `CLASSE_STATUS_VENDA` + `statusVenda(status)` → selo colorido de cada status de venda.
- `CLASSE_SITUACAO_PAGAMENTO` + `situacaoPagamento(venda)` → selo da situação do pagamento (**Pago** verde, **Pago em parte** amarelo, **Não pago** vermelho) e, se falta algo, a linha "Falta R$ X". Usa `vendas.pagamento(venda)`.
- `produtosResumo(venda)` → `"Shampoo Profissional (2x), Leave-in (2x)"`.
- `resumoCompras(compras)` → os quatro cartões (total de compras, total gasto, **em aberto** e última compra), usando `vendas.resumir`. O cartão "Em aberto" fica vermelho quando o cliente deve algo.
- O histórico ganhou a coluna **Pagamento** com o selo de situação de cada pedido.
- `historicoCompras(clienteId, { aberto, destaque })` → o acordeão do Bootstrap com a tabela de compras.
  - Parâmetro com desestruturação e **valores padrão**: `{ aberto = false, destaque = null } = {}`. O `= {}` final permite chamar sem o segundo argumento.
  - A linha com `v.id === destaque` recebe a classe `is-new` (destaque visual da venda recém-criada).
  - As linhas têm `tabindex="0"` e `role="button"` para serem acessíveis por teclado.
- `abrirVisualizacao(id, opcoes)`:
  1. Busca o cliente; se não existe, toast de erro.
  2. Preenche cabeçalho com `textContent` (seguro, não interpreta HTML) e links de editar/nova venda.
  3. Monta o corpo inteiro com um template literal gigante e o insere com `innerHTML`.
  4. `modal.show()`.
  5. Se há venda a destacar, espera o modal terminar de abrir (`shown.bs.modal`) e rola até ela. `{ once: true }` remove o listener sozinho depois da primeira execução.

### 5.4 Detalhes da venda, pagamentos e troca de modais ([linhas 304–592](../js/clientes.js#L304-L592))

O Bootstrap **não empilha modais**. A solução foi alternar:

```js
// Da ficha para a venda: espera a ficha fechar e então abre a venda
el.modal.addEventListener("hidden.bs.modal", () => modalVenda.show(), { once: true });
modal.hide();

// Botão "Voltar para a ficha": o inverso
el.modalVenda.addEventListener("hidden.bs.modal", () => modal.show(), { once: true });
modalVenda.hide();
```

A montagem foi separada em duas funções:

- **`abrirVenda(vendaId)`** busca a venda e o cliente, chama `renderVenda` e faz a troca de modais.
- **`renderVenda(v, c)`** só desenha o conteúdo. Ficou separada para poder **redesenhar o modal sem fechá-lo** depois de registrar um pagamento.

Em `renderVenda`, `alterado` indica se o preço praticado foi diferente do padrão; nesse caso mostra "Preço padrão: R$ ...". Se o cliente da venda não existir mais, mostra "Cliente removido" (programação defensiva).

**Seção Pagamentos (`secaoPagamentos(v)`)** — mostra total, pago e em aberto; a tabela de pagamentos em ordem de data (forma e observação, ex.: "Pago na venda", "Abatido na venda #000140"); e:
- se ainda há saldo, o formulário **Registrar pagamento**, com o valor **já preenchido com o saldo** (o caso mais comum é quitar), forma, data (padrão hoje, `max` = hoje) e observação;
- se está quitada, o aviso "Venda quitada".

**Registrar o pagamento** — o formulário é recriado a cada `renderVenda`, então os eventos usam **delegação** no modal (`el.modalVenda.addEventListener("submit", ...)` e confere `event.target.id === "formPagamento"`). No envio:
1. Valida valor (`0 < valor ≤ saldo`), forma e data (não pode ser futura; **pode** ser anterior à venda, para lançar o histórico da planilha).
2. `dataDoPagamento(dia)` converte o dia do `<input type="date">` em data/hora: hoje vira "agora"; outro dia vira meio-dia daquele dia. Meio-dia evita que a conversão de fuso horário jogue a data para o dia anterior.
3. `vendas.registrarPagamento(...)`, redesenha o modal com a venda atualizada e mostra quanto ainda falta (ou "Venda quitada!").
4. Marca `fichaDesatualizada = true`. Ao clicar em "Voltar para a ficha", em vez de só reabrir a ficha antiga, ela é **recarregada** (`abrirVisualizacao`) para o resumo e o histórico mostrarem o novo saldo.

`diaLocal(data)` monta o `"AAAA-MM-DD"` no fuso do navegador. Não use `toISOString().slice(0, 10)` para isso: `toISOString` é em UTC, e às 22h no Brasil já seria o dia seguinte.

Os cliques e teclas (Enter/Espaço) nas linhas do histórico usam **delegação** no próprio modal (`el.modal`), já que o conteúdo é recriado a cada abertura.

### 5.5 Eventos e inicialização ([linhas 594–637](../js/clientes.js#L594-L637))

- `submit` do formulário de busca com `event.preventDefault()` (impede o recarregamento da página, que é o comportamento padrão de um form).
- Evento `search`: disparado pelo "x" nativo do `<input type="search">`.
- Botão "Restaurar": `confirm()` pede confirmação; se ok, restaura os três repositórios.
- Clique no olho (`data-action='ver'`) abre a ficha.
- **Deep link**: `clientes.html?ver=<id>&venda=<vendaId>` abre a ficha já com o histórico aberto e a venda destacada. É assim que a tela de venda "devolve" o usuário depois de salvar.

---

## 6. cadastro-cliente.js — cadastro e edição

Arquivo: [js/cadastro-cliente.js](../js/cadastro-cliente.js). Uma mesma tela serve para **novo** (`cadastro-cliente.html`) e **edição** (`cadastro-cliente.html?id=...`).

### 6.1 Preparação ([linhas 9–33](../js/cadastro-cliente.js#L9-L33))

- `ESTADOS`: as 27 UFs, transformadas em `<option>` e inseridas com `insertAdjacentHTML("beforeend", ...)` (adiciona ao final sem apagar o que já existe, como a opção "Selecione").
- `CAMPOS`: lista dos ids do formulário que **coincidem** com os nomes das propriedades do cliente. Essa convenção permite preencher e ler o formulário com um simples `forEach`.
- `const $ = (id) => document.getElementById(id)` — atalho (inspirado no jQuery).
- `modoEdicao = Boolean(idEdicao)` — `Boolean(null)` é `false`, `Boolean("c-0001")` é `true`.

### 6.2 Máscaras ao digitar ([linhas 38–49](../js/cadastro-cliente.js#L38-L49))

```js
const mascaras = { documento: format.documento, telefone: format.telefone, celular: format.telefone, cep: format.cep };
Object.entries(mascaras).forEach(([id, mask]) => {
  $(id).addEventListener("input", (event) => { event.target.value = mask(event.target.value); });
});
```

`Object.entries` transforma o objeto em pares `[chave, valor]`. Cada campo ganha um listener que reescreve o valor mascarado a cada tecla. É um padrão **orientado a dados**: para mascarar um campo novo, basta adicionar uma linha no objeto.

### 6.3 Endereço pelo CEP com a API ViaCEP ([linhas 51–118](../js/cadastro-cliente.js#L51-L118))

Quando o CEP fica com 8 dígitos, a tela consulta `https://viacep.com.br/ws/<cep>/json/` e preenche rua, bairro, cidade e estado. É o primeiro trecho do projeto que **conversa com um servidor**, então apresenta três conceitos novos:

**`fetch` + `async/await`.** `fetch(url)` faz a requisição e devolve uma *Promise* (um valor que chega no futuro). Numa função `async`, o `await` "espera" a Promise sem travar a página:

```js
const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`); // 404, 500... não caem no catch sozinhos
const dados = await resposta.json(); // converte o corpo da resposta em objeto
```

A resposta do ViaCEP tem campos com nomes próprios, que o código traduz para os ids do formulário: `logradouro` → `rua`, `localidade` → `cidade`, `uf` → `estado`. Um CEP inexistente não dá erro HTTP: vem `{ "erro": true }`, por isso o `if (dados.erro)`.

**`AbortController` (cancelar a requisição).** Serve para dois casos:
- **Tempo limite**: `setTimeout(() => controle.abort(), 8000)` desiste depois de 8 segundos se a API não responder.
- **Resposta atrasada**: se o usuário apaga o CEP ou digita outro enquanto a primeira busca ainda está em andamento, a busca antiga é cancelada (`cancelarBuscaCep`). A verificação `if (buscaCep !== controle) return` garante que uma resposta velha nunca sobrescreva o endereço do CEP novo. Esse problema tem nome: *race condition* (condição de corrida).

**`try / catch / finally`.** O `catch` pega falhas de rede, tempo esgotado e respostas inválidas, e só mostra a mensagem "preencha manualmente" se aquela ainda for a busca atual. O `finally` roda sempre, dando certo ou errado, e é usado para limpar o `setTimeout`.

Outros detalhes:
- `cepBuscado` evita buscar de novo o mesmo CEP (por exemplo, quando a máscara reescreve o campo).
- Só preenche os campos que vieram com valor (`if (valor)`), porque CEPs gerais de cidade vêm sem rua e bairro. O foco vai para **Número** se veio a rua, ou para **Rua** se não veio.
- A mensagem aparece em `#cepStatus`, que tem `aria-live="polite"` para leitores de tela anunciarem o resultado.
- Os valores são colocados com `.value` (nunca `innerHTML`), então o que vem da API não é interpretado como HTML.
- No modo edição, o `preencher` muda o valor do CEP pelo código, o que **não** dispara o evento `input`. Por isso, abrir um cliente para editar não refaz a busca nem apaga o endereço salvo.

Para testar no console: `fetch("https://viacep.com.br/ws/01001000/json/").then(r => r.json()).then(console.log)`.

### 6.4 Validação com a API nativa do navegador ([linhas 123–161](../js/cadastro-cliente.js#L123-L161))

O projeto usa a **Constraint Validation API** + estilos do Bootstrap:

- `input.setCustomValidity("invalid")` marca o campo como inválido; `setCustomValidity("")` marca como válido.
- `form.checkValidity()` devolve `true` só se todos os campos forem válidos (incluindo `required`, `type="email"` etc. do HTML).
- A classe `was-validated` no `<form>` faz o Bootstrap pintar de vermelho/verde os campos `:invalid`/`:valid` e mostrar as `.invalid-feedback`.

Regras de `validarCampos()`:
- Nome com pelo menos 3 caracteres.
- Documento: mensagem específica conforme o caso (vazio, CPF inválido, CNPJ inválido, tamanho errado) e bloqueio de duplicidade com `documentoEmUso(doc, idEdicao)`.
- Telefone/celular/e-mail: **opcionais**, mas se preenchidos precisam ser válidos (`!input.value || validate...`).
- CEP obrigatório com 8 dígitos.

Experiência do usuário: nada fica vermelho enquanto a pessoa digita pela primeira vez. Só depois da primeira tentativa de salvar (`was-validated`), a validação passa a rodar a cada `input`.

### 6.5 Modo edição ([linhas 166–198](../js/cadastro-cliente.js#L166-L198))

- Se o id não existe: `ui.flash` + `location.replace("clientes.html")` (o `replace` não deixa a página inválida no histórico do botão Voltar) e `return` encerra a IIFE.
- Ajusta títulos, breadcrumb, texto do botão e mostra o interruptor de status.
- `preencher(cliente)` copia cada campo e reaplica as máscaras.

### 6.6 Salvar ([linhas 203–235](../js/cadastro-cliente.js#L203-L235))

1. `preventDefault()` e adiciona `was-validated`.
2. Se inválido: foca e rola até o primeiro campo `:invalid`, mostra toast e para.
3. Monta o objeto `dados` a partir de `CAMPOS`, remove as máscaras (`onlyDigits`) dos campos numéricos.
4. Remove `id` vazio (cadastro novo), para o repositório gerar um.
5. Define o status (novo cliente é sempre ativo).
6. Desabilita o botão (evita duplo clique gerando dois cadastros).
7. `clientes.salvar(dados)` → `ui.flash(...)` → redireciona para a lista, onde o toast aparece.

---

## 7. venda.js — cadastro de venda

Arquivo: [js/venda.js](../js/venda.js). É a tela mais completa, com **estado em memória** e renderização parcial.

### 7.1 Estado da tela ([linhas 34–43](../js/venda.js#L34-L43))

```js
const venda = { cliente: null, itens: [] }; // itens: { uid, produtoId, quantidade, precoUnitario }
let proximoUid = 1;
let contaAnterior = { saldo: 0, vendas: [] }; // compras anteriores do cliente ainda não pagas
```

Este é o conceito mais importante da tela: **o objeto `venda` é a fonte da verdade**. O HTML é só um reflexo dele. Os eventos alteram o objeto e depois atualizam a tela.

Por que `uid` e não `produtoId` para identificar a linha? Porque o usuário pode trocar o produto de uma linha; o `uid` continua o mesmo, então sabemos qual linha é qual.

`catalogo` guarda os produtos ativos (e é recarregado quando muda, veja [7.7](#77-catálogo-que-se-atualiza-sozinho-linhas-571622)); `quantidadeValida` centraliza a regra (inteiro de 1 a 999).

`contaAnterior` guarda a conta em aberto do cliente escolhido (`{ saldo, vendas }`, vindo de `vendas.contaEmAberto`). Começa zerada e é carregada em `selecionarCliente`.

### 7.2 Busca de cliente com autocomplete acessível ([linhas 48–167](../js/venda.js#L48-L167))

Um *combobox* feito à mão:

- `renderOpcoes()` busca até 8 clientes e desenha a lista (ou "nenhum cliente encontrado" com link para cadastrar).
- `marcarAtiva(indice)` destaca a opção navegada pelo teclado, atualiza `aria-selected` / `aria-activedescendant` (para leitores de tela) e rola até ela com `scrollIntoView({ block: "nearest" })`.
- Teclado: `ArrowDown`/`ArrowUp` navegam (com `Math.min`/`Math.max` para não sair dos limites), `Enter` seleciona (a opção ativa, ou a única se só houver uma), `Escape` fecha.
- **Truque do blur**: ao clicar numa opção, o campo perde o foco (`blur`) *antes* do clique. Duas proteções:
  - A lista usa `mousedown` (que acontece antes do `blur`) com `preventDefault()`, que impede o campo de perder o foco.
  - O `blur` fecha a lista com `setTimeout(..., 150)`, dando tempo para o clique ser processado.
- `selecionarCliente(c)` grava em `venda.cliente`, mostra o cartão do cliente, esconde a busca e chama `carregarContaAnterior(c)`. `trocarCliente()` faz o inverso e zera a conta anterior.

### 7.3 Itens da venda ([linhas 169–318](../js/venda.js#L169-L318))

- `opcoesProduto(selecionado, comPreco)` → `<option>`s do catálogo, marcando o selecionado.
- `linhaItem(item)` → `<tr>` com select de produto, campo de quantidade, campo de preço e botão remover. Os `<label class="visually-hidden">` dão nome acessível aos campos sem aparecerem na tela.
- `itemDaLinha(tr)` → acha o item do estado a partir do `data-uid` da linha (atenção ao `Number(...)`: `dataset` sempre devolve string).

**Duas formas de atualizar a tela** (conceito-chave):

| Função | Quando | O que faz |
| --- | --- | --- |
| `renderItens()` | Adicionar, remover, trocar produto | Redesenha **todo** o `tbody` a partir do estado |
| `atualizarLinha(tr)` | Digitar quantidade ou preço | Atualiza **só** subtotal, validação e o aviso "alterado" daquela linha |

Por que não redesenhar tudo sempre? Porque refazer o `innerHTML` enquanto o usuário digita **destrói o `<input>` em que ele está**, fazendo perder o foco e a posição do cursor.

`adicionarProduto()`:
1. Valida produto e quantidade (marcando `is-invalid` e mostrando toast).
2. Se o produto já está na venda, **soma** a quantidade na linha existente (limitada a 999).
3. Senão, adiciona um item novo com o preço padrão do produto.
4. Redesenha e prepara o formulário para o próximo produto.

Eventos delegados no `tbody`:
- `input` em `.item-qtd` → atualiza a quantidade; em `.item-preco` → aplica `moedaInput` e converte com `parseMoeda`.
- `change` em `.item-produto` → troca o produto e **volta ao preço padrão** do novo produto; redesenha e devolve o foco ao select (que foi recriado).
- `click` em `.item-remover` → remove do array com `filter`; em `.item-restaurar` → volta o preço ao padrão.

Detalhe: `format.moedaInput(Math.round(item.precoUnitario * 100))`. Como `moedaInput` espera "dígitos digitados" (centavos), o preço `45.5` vira `4550`, que a máscara exibe como `"45,50"`.

### 7.4 Resumo e total ([linhas 320–347](../js/venda.js#L320-L347))

`calcularVenda()` passa os itens para `vendas.calcular` (a **mesma regra** do repositório), trocando valores inválidos por 0 para que o total parcial nunca vire `NaN`.

`atualizarResumo()` mostra quantidade de itens, subtotal, desconto e total, marca o desconto como inválido se for maior que o subtotal e, no fim, chama `atualizarPagamento(total)`. Devolve `{ ...calculo, descontoInvalido, pagamento }`, que a validação reaproveita.

Curiosidade: `atualizarResumo` é declarada com `function` (e não `const`) porque é chamada por `renderItens`, que aparece **antes** no arquivo. Declarações `function` sofrem *hoisting* (ficam disponíveis em todo o escopo). Com `const`, também funcionaria aqui, porque a chamada só acontece depois que o arquivo inteiro foi lido, mas `function` deixa isso explícito. O mesmo vale para `atualizarPagamento` e `carregarContaAnterior`.

### 7.5 Pagamento ([linhas 349–473](../js/venda.js#L349-L473))

O cliente escolhe entre dois botões (dois `<input type="radio">` com a classe `btn-check` do Bootstrap, que viram um botão alternado):

| Opção | Valor pago agora | Resultado |
| --- | --- | --- |
| **Pago integral** | o total da venda | venda quitada |
| **Outro valor**, menos que o total (ou vazio) | o que for digitado | o resto fica **em aberto** nesta venda |
| **Outro valor**, mais que o total | o que for digitado | a diferença **abate a conta anterior** (limite: total + conta anterior) |

O objeto `pag` reúne os campos da seção. As opções de forma de pagamento vêm de `vendas.FORMAS_PAGAMENTO`.

**`atualizarPagamento(total)`** é a função central, chamada a cada mudança (itens, desconto, opção, valor):
1. Calcula `pago` (o total, se integral; senão o valor digitado) e o `maximo` (`total + contaAnterior.saldo`).
2. `excedeu` = passou do máximo → campo em vermelho, com a mensagem mostrando o máximo.
3. Usa **`vendas.distribuirPagamento`** (a mesma função que o repositório usa para gravar) para prever quanto fica na venda e quanto abate a conta anterior.
4. Esconde a forma de pagamento quando nada é pago agora.
5. Atualiza o resumo: **Pago agora**, **Abate da conta anterior** (verde, só aparece se houver), **Fica em aberto nesta venda** e **Conta anterior restante**.

**`carregarContaAnterior(cliente)`** busca as vendas do cliente (`vendas.porCliente`) e calcula `vendas.contaEmAberto`. Usa um contador (`cargaConta`), a mesma técnica da busca de clientes (`buscaAtual`), para descartar a resposta de um cliente antigo se o usuário trocar de cliente rápido. Se a busca falhar, a venda continua funcionando: quem garante o limite, no fim, é o repositório (ou o servidor).

**`renderContaAnterior(maximo)`** mostra o aviso vermelho "Conta anterior em aberto: R$ X", com os números dos pedidos (até 5, depois "e mais N") e o atalho **"Receber tudo agora"**, que marca "Outro valor" e preenche `total + conta anterior`.

### 7.6 Finalizar ([linhas 475–569](../js/venda.js#L475-L569))

`validarVenda()` devolve **a mensagem de erro** ou `null`. Ordem: cliente → pelo menos um item → quantidades/preços (reaproveita `atualizarLinha` e procura o primeiro `.is-invalid`) → desconto → valor pago (não pode passar do máximo) → forma de pagamento (obrigatória se algo foi pago). Sempre foca o campo problemático.

No `submit`:
1. Valida; se houver erro, toast.
2. `vendas.registrar(...)` dentro de `try/catch`, pois o repositório pode lançar erro. Vai junto `pagamento: { valor, forma }` (ou `{ valor: 0 }` se nada foi pago agora).
3. Envia só os campos necessários (o `uid` é detalhe da tela e não é gravado).
4. `ui.flash(...)` com o que ficou em aberto e o que foi abatido de pedidos anteriores (`registrada.abatimentos`), e redireciona para `clientes.html?ver=...&venda=...`: a ficha abre com a venda nova destacada.

Enter nos campos: por padrão, apertar Enter num `<input>` envia o formulário. Aqui isso é bloqueado; no produto/quantidade, Enter **adiciona o produto**.

"Limpar venda" pede confirmação só se já houver itens, zera tudo (inclusive o pagamento, com `limparPagamento`) e volta à busca de cliente.

### 7.7 Catálogo que se atualiza sozinho ([linhas 571–622](../js/venda.js#L571-L622))

Um produto cadastrado na tela de Produtos tem que aparecer na venda **sem recarregar a página**. `atualizarCatalogo()` busca `produtos.listar()` de novo e é chamada em três situações:

```js
produtos.aoAlterar(atualizarCatalogo);                 // outra aba mudou os produtos (evento "storage")
document.addEventListener("visibilitychange", ...);    // o usuário voltou para esta aba
window.addEventListener("focus", atualizarCatalogo);   // a janela ganhou o foco
```

Para não redesenhar à toa (e não tirar o foco de quem está digitando), compara uma **assinatura** do catálogo (`id`, `nome` e preço de cada produto em JSON) e só segue se mudou.

**`aplicarCatalogo(lista, antes)`** aplica o catálogo novo à venda em andamento:
- item cujo produto foi **inativado ou excluído** sai da venda, com aviso;
- item que estava no **preço padrão antigo** passa para o novo; preço ajustado à mão é mantido;
- refaz o `<select>` mantendo o produto que estava escolhido;
- se entrou produto novo, avisa "Produto disponível para venda: ...".

Na primeira carga (`iniciar`), `antes` é `[]`, então nada disso gera aviso.

A tela também ganhou o link **"Cadastrar produto"** ao lado do seletor, que abre `produtos.html` em outra aba (`target="_blank"`). Ao voltar, o `visibilitychange` traz o produto novo.

### 7.8 Inicialização ([linhas 624–644](../js/venda.js#L624-L644))

Desenha a tabela vazia, carrega o catálogo com `aplicarCatalogo(lista, [])` e, se a URL tiver `?cliente=<id>` válido, já seleciona o cliente (vindo do botão "Nova venda" da ficha).

---

## 8. produtos.js — cadastro de produtos

Arquivo: [js/produtos.js](../js/produtos.js). Tela `produtos.html`. A tela junta **formulário e lista na mesma página**: à esquerda o formulário (cadastrar/editar), à direita a lista com busca.

### 8.1 Lista ([linhas 41–103](../js/produtos.js#L41-L103))

- `lista` guarda **todos** os produtos (`produtos.listarTodos()`), inclusive inativos.
- A busca filtra **em memória** (`normalize(p.nome).includes(texto)`) a cada tecla, sem ir aos dados de novo: a lista de produtos é pequena.
- `linhaProduto(p)` desenha a linha com três ações: **editar** (lápis), **ativar/inativar** e **excluir** (lixeira). Classes na linha:
  - `is-inactive` deixa o texto cinza;
  - `is-new` destaca o último produto salvo;
  - `is-editing` marca o produto aberto no formulário.
- O contador mostra o total e quantos estão ativos.

### 8.2 Formulário ([linhas 105–191](../js/produtos.js#L105-L191))

- O preço usa a mesma máscara da venda (`format.moedaInput` / `format.parseMoeda`).
- `validarCampos()` usa `setCustomValidity` (como no cadastro de cliente): nome com pelo menos 2 caracteres e **sem repetir** outro produto (comparando com `normalize`), e preço maior que zero.
- `modoEdicao(produto)` alterna o formulário entre "Novo produto" e "Editar produto": preenche os campos, mostra o interruptor **Produto ativo** e o botão "Cancelar edição". Chamado com `null`, volta para cadastro.
- No `submit`: valida → `produtos.salvar(dados)` → recarrega a lista, destaca o produto e limpa o formulário. Se o servidor responder **409** (nome repetido, ex.: outro usuário cadastrou antes), guarda o nome em `nomeDuplicado` e marca o campo.

### 8.3 Ações da lista ([linhas 193–237](../js/produtos.js#L193-L237))

Um único listener de `click` no `tbody` (delegação), que decide pelo `data-action`:

| `data-action` | O que faz |
| --- | --- |
| `editar` | `modoEdicao(produto)` e rola até o formulário |
| `alternar` | `produtos.salvar({ ...produto, ativo: !produto.ativo })` |
| `excluir` | `confirm(...)` e `produtos.excluir(id)`. Se o produto já foi vendido, o repositório recusa (409) e a mensagem sugere inativar |

Ao salvar, inativar ou excluir, a tela de venda aberta em outra aba se atualiza sozinha ([7.7](#77-catálogo-que-se-atualiza-sozinho-linhas-571622)).

---

## 9. Fluxos completos, do clique ao localStorage

### 9.1 Cadastrar um cliente

```text
[cadastro-cliente.html] usuário digita
   └─ evento input → máscara (format.cpf/telefone/cep)
usuário clica "Salvar"
   └─ submit → preventDefault → validarCampos()
        ├─ inválido → foca campo + toast de erro (fim)
        └─ válido → monta dados sem máscara
             └─ MGK.clientes.salvar(dados)
                  └─ read() → push/merge → write() → localStorage["mgk.clientes.v1"]
             └─ ui.flash("Cliente X cadastrado") → sessionStorage["mgk.flash"]
             └─ location.href = "clientes.html"
[clientes.html] carrega
   └─ app.js DOMContentLoaded → consumeFlash() → toast de sucesso
   └─ clientes.js → buscar() → render(lista)
```

### 9.2 Registrar uma venda

```text
[clientes.html] botão "Nova venda" → venda.html?cliente=c-0001
[venda.html] init → selecionarCliente(cliente)
     └─ carregarContaAnterior() → vendas.porCliente → contaEmAberto → aviso "Conta anterior"
usuário adiciona produtos → estado venda.itens muda → renderItens()
usuário altera preço/qtd → estado muda → atualizarLinha() + atualizarResumo()
     (ambos usam MGK.vendas.calcular → mesma regra do registro)
usuário escolhe o pagamento → atualizarPagamento()
     (usa MGK.vendas.distribuirPagamento → mesma regra do registro)
"Finalizar" → validarVenda()
     └─ MGK.vendas.registrar({ ..., pagamento }) → revalida → "fotografa" nome/preço → calcula
          → valida pagamento (até total + conta anterior) → distribui → grava venda + abatimentos
     └─ ui.flash(...) → clientes.html?ver=c-0001&venda=v-000134
[clientes.html] abre ficha com histórico aberto e a venda destacada + toast
```

### 9.3 Registrar um pagamento posterior

```text
[clientes.html] ficha → histórico → clique na venda → abrirVenda() → renderVenda()
     └─ secaoPagamentos(): total, pago, em aberto, lista e formulário (valor = saldo)
usuário ajusta valor/forma/data → "Registrar pagamento"
     └─ submit (delegado no modal) → valida → dataDoPagamento(dia)
     └─ MGK.vendas.registrarPagamento(id, { valor, forma, data, observacao })
          └─ revalida (≤ saldo, forma, data não futura) → push em venda.pagamentos → grava
     └─ renderVenda(atualizada) + toast "Ainda falta R$ X" / "Venda quitada!"
     └─ fichaDesatualizada = true
"Voltar para a ficha" → abrirVisualizacao() de novo → resumo e histórico com o novo saldo
```

### 9.4 Cadastrar um produto com a venda aberta em outra aba

```text
[venda.html] link "Cadastrar produto" → abre produtos.html em nova aba
[produtos.html] preenche nome e preço → submit → validarCampos()
     └─ MGK.produtos.salvar(dados) → localStorage["mgk.produtos.v1"]
          └─ o navegador dispara "storage" na aba da venda
[venda.html] produtos.aoAlterar → atualizarCatalogo() → assinatura mudou?
     └─ aplicarCatalogo() → refaz o <select> + toast "Produto disponível para venda"
     (no modo API: ao voltar para a aba, visibilitychange → atualizarCatalogo())
```

---

## 10. Como replicar: roteiro passo a passo

Siga na ordem; cada etapa funciona sozinha e você pode testar no navegador antes de ir para a próxima.

**Etapa 1 — Página estática.** Crie `clientes.html` com Bootstrap via CDN, uma tabela vazia com `<tbody id="tabelaClientes">` e um campo de busca. Sem JavaScript ainda.

**Etapa 2 — Dados fictícios.** Crie `mock-data.js` com `window.MOCK_CLIENTES = [...]` (3 ou 4 clientes). No console do navegador (F12), digite `MOCK_CLIENTES` e confira.

**Etapa 3 — Renderizar.** Em `clientes.js`, dentro de uma IIFE, faça `tbody.innerHTML = MOCK_CLIENTES.map(c => \`<tr><td>${c.nome}</td></tr>\`).join("")`. Depois crie `escapeHtml` e passe todos os valores por ela.

**Etapa 4 — Formatação.** Crie `onlyDigits` e `format.cpf`/`format.telefone`. Teste cada uma no console antes de usar na tabela.

**Etapa 5 — Busca.** Crie `normalize` e uma função `buscar(termo)` que filtra por nome. Ligue ao `submit` do formulário com `preventDefault`. Depois adicione a busca por documento.

**Etapa 6 — Persistência.** Crie o `app.js` com `read()`/`write()` no `localStorage` (usando o mock como carga inicial) e exponha `window.MGK = { clientes }`. Passe a tela a usar `MGK.clientes.listar()`. Verifique em F12 → *Application* → *Local Storage*.

**Etapa 7 — Formulário de cadastro.** Crie `cadastro-cliente.html` e `cadastro-cliente.js`: máscaras no `input`, `validate.cpf`, `setCustomValidity` + `was-validated`, e `clientes.salvar`. Depois adicione o modo edição via `?id=`.

**Etapa 8 — Mensagens entre páginas.** Implemente `ui.toast` e o par `flash`/`consumeFlash`.

**Etapa 9 — Ficha em modal.** Botão com `data-id`, delegação de clique no `tbody`, `bootstrap.Modal` e o corpo montado com template literals.

**Etapa 10 — Produtos e vendas.** Crie a fábrica `store(key, seed)`, os repositórios `produtos` e `vendas` com `calcular` e `registrar`, e o arredondamento `centavos`.

**Etapa 11 — Tela de venda.** Comece pelo **estado** (`venda = { cliente, itens }`), depois `renderItens`, depois os eventos que alteram o estado, depois `atualizarLinha`/`atualizarResumo`, e por último a busca de cliente com teclado.

**Etapa 12 — Histórico.** Na ficha, liste `vendas.porCliente`, o resumo e o modal de detalhes; por fim, o deep link `?ver=&venda=`.

**Etapa 13 — Tela de produtos.** Formulário + lista na mesma página, `salvar` com checagem de nome repetido, ativar/inativar e excluir (só se nunca vendido). Depois, na venda, `produtos.listar()` só com ativos e o evento `storage` para atualizar o catálogo entre abas.

**Etapa 14 — Pagamentos.** Primeiro o dado: `pagamentos: []` em cada venda e a função pura `vendas.pagamento(venda)` (pago, saldo, situação). Teste no console antes de ter tela. Depois:
1. na ficha, o selo de situação e o cartão "Em aberto";
2. nos detalhes da venda, a lista de pagamentos e o formulário `registrarPagamento`;
3. na venda, "Pago integral" × "Outro valor";
4. por último, `contaEmAberto` + `distribuirPagamento` para o valor acima do total abater a conta anterior.

---

## 11. Exercícios

Do mais fácil ao mais difícil. Tente sem olhar a solução no código.

1. No console, rode `MGK.format.cnpj("12345678000195")`, `MGK.validate.cpf("11111111111")` e `MGK.format.moedaInput("123456")`. Explique cada resultado.
2. Adicione um campo "Data de nascimento" ao cadastro de cliente (HTML, `CAMPOS`, exibição na ficha).
3. Na busca de CEP, mostre um ícone girando (`spinner-border spinner-border-sm` do Bootstrap) enquanto a API responde e desabilite os campos de endereço até a resposta chegar.
4. Mostre na tabela de clientes uma coluna "Total gasto" usando `vendas.resumoCliente`.
5. Permita **cancelar** uma venda na tela de detalhes (novo método `vendas.cancelar(id)` no repositório, mudando o `status`).
6. Adicione um filtro "Somente ativos" na consulta de clientes.
7. No console, calcule à mão e depois confira: `MGK.vendas.distribuirPagamento(130, 80, { saldo: 100, vendas: [{ venda: { numero: "1" }, saldo: 30 }, { venda: { numero: "2" }, saldo: 70 }] })`.
8. Na tabela de clientes, mostre um selo vermelho "Deve R$ X" para quem tem conta em aberto (use `vendas.porCliente` + `vendas.contaEmAberto`).
9. Permita **excluir um pagamento lançado errado** nos detalhes da venda (novo `vendas.excluirPagamento(vendaId, pagamentoId)`, com confirmação).
10. Crie a tela **Contas a receber** (menu Pagamentos): todas as vendas com saldo, de todos os clientes, da mais antiga para a mais recente, com o total geral em aberto.
11. Desafio: um campo "Data da venda" na tela de venda, para lançar vendas antigas com a data certa (lembre de validar: não pode ser no futuro).

---

## 12. Padrões para levar para outros projetos

- **Separe dados de tela.** Repositórios (`listar`, `obter`, `salvar`) isolam o armazenamento; trocar `localStorage` por API afeta um arquivo só.
- **Guarde dados crus, formate na exibição.** Documento só com dígitos, valores como número, datas em ISO.
- **Estado primeiro, tela depois.** Altere o objeto de estado e redesenhe a partir dele (padrão que frameworks como React automatizam).
- **Uma regra, um lugar.** `vendas.calcular` e `vendas.distribuirPagamento` são usadas pela tela (prévia) e pelo registro (gravação); `quantidadeValida` centraliza a regra de quantidade.
- **Não grave o que pode ser calculado.** O saldo da venda é sempre `total − pagamentos`; gravar o saldo abriria espaço para ele ficar diferente da soma.
- **Migração preguiçosa.** Dados antigos sem um campo novo (`ativo`, `pagamentos`) são completados na leitura, sem script de migração no navegador.
- **Não apague o que tem histórico.** Produto vendido é inativado, não excluído.
- **Valide nas duas pontas.** A tela valida para a experiência do usuário; o repositório valida para garantir a integridade.
- **Escape tudo que vai para `innerHTML`.** `escapeHtml` para HTML, `encodeURIComponent` para URLs, `textContent` quando não precisar de HTML.
- **Delegação de eventos** para listas que são redesenhadas.
- **Dinheiro:** arredonde para centavos após cada conta.
- **Acessibilidade:** `aria-*`, `role`, labels escondidos visualmente, navegação por teclado e foco no campo com erro.
