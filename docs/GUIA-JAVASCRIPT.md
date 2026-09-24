# Guia de estudo: o JavaScript do Sistema MGK

Este guia explica **todo** o JavaScript do projeto: como os arquivos se conectam, o que cada função faz, por que foi escrita daquele jeito e quais recursos da linguagem aparecem em cada trecho. No fim há um roteiro para você **reconstruir o sistema do zero** e exercícios para fixar.

> Dica: leia com o código aberto ao lado. Os links do tipo [app.js:23](../js/app.js#L23) levam direto para a linha citada.

---

## Sumário

1. [Visão geral da arquitetura](#1-visão-geral-da-arquitetura)
2. [Recursos da linguagem usados no projeto](#2-recursos-da-linguagem-usados-no-projeto)
3. [mock-data.js — os dados fictícios](#3-mock-datajs--os-dados-fictícios)
4. [app.js — o núcleo compartilhado](#4-appjs--o-núcleo-compartilhado)
5. [clientes.js — consulta e ficha do cliente](#5-clientesjs--consulta-e-ficha-do-cliente)
6. [cadastro-cliente.js — cadastro e edição](#6-cadastro-clientejs--cadastro-e-edição)
7. [venda.js — cadastro de venda](#7-vendajs--cadastro-de-venda)
8. [Fluxos completos, do clique ao localStorage](#8-fluxos-completos-do-clique-ao-localstorage)
9. [Como replicar: roteiro passo a passo](#9-como-replicar-roteiro-passo-a-passo)
10. [Exercícios](#10-exercícios)
11. [Padrões para levar para outros projetos](#11-padrões-para-levar-para-outros-projetos)

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
página (clientes.js / cadastro-cliente.js / venda.js)
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
| Telas | `clientes.js`, `cadastro-cliente.js`, `venda.js` | Eventos, renderização de HTML, validação de formulário |

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

`precoPadrao` é o preço de tabela.

### 3.3 `window.MGK_MOCK_VENDAS` ([linha 216](../js/mock-data.js#L216))

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

---

## 4. app.js — o núcleo compartilhado

Arquivo: [js/app.js](../js/app.js). Tudo o que é usado por mais de uma tela mora aqui.

### 4.1 Constantes de chave ([linhas 12–18](../js/app.js#L12-L18))

```js
const STORAGE_KEY = "mgk.clientes.v1";
const PRODUTOS_KEY = "mgk.produtos.v1";
const VENDAS_KEY  = "mgk.vendas.v1";
const SEED_KEY    = "mgk.seed";
const SEED_VERSION = 2;
const FLASH_KEY   = "mgk.flash";
```

O sufixo `.v1` permite, no futuro, mudar o formato dos dados usando outra chave sem quebrar quem tem dados antigos. O comentário `gitleaks:allow` só avisa a ferramenta de segurança que aquilo não é uma senha.

### 4.2 Helpers ([linhas 23–47](../js/app.js#L23-L47))

**`onlyDigits(value)`** — remove tudo que não é número. `"123.456.789-09"` → `"12345678909"`. O `String(value ?? "")` garante que funciona mesmo com `null`, `undefined` ou número.

**`normalize(value)`** — prepara texto para comparação:
1. `.normalize("NFD")` separa a letra do acento (`"é"` vira `"e"` + `"´"`).
2. `.replace(/[̀-ͯ]/g, "")` remove os acentos soltos (faixa Unicode U+0300 a U+036F; no arquivo os caracteres aparecem literalmente).
3. `.toLowerCase().trim()` → minúsculas e sem espaços nas pontas.

Resultado: `"  João "` → `"joao"`. É isso que permite buscar "joao" e achar "João".

**`escapeHtml(value)`** — troca `& < > " '` pelas entidades HTML. **Essencial para segurança**: todo dado vindo do usuário que entra em `innerHTML` passa por aqui. Sem isso, um cliente chamado `<img src=x onerror=alert(1)>` executaria código na página (ataque XSS).

A técnica: `replace` com uma **função** como segundo argumento; para cada caractere encontrado, devolve a tradução de um objeto-dicionário.

**`initials(name)`** — `"Ana Fictícia Moreira"` → `"AM"` (primeira letra do primeiro e do último nome). `split(/\s+/)` quebra por um ou mais espaços; `filter(Boolean)` remove strings vazias.

### 4.3 `format` — máscaras e formatação ([linhas 52–113](../js/app.js#L52-L113))

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

### 4.4 `centavos(value)` ([linha 116](../js/app.js#L116))

```js
const centavos = (value) => Math.round((Number(value) || 0) * 100) / 100;
```

Em JavaScript, `0.1 + 0.2` dá `0.30000000000000004` (limitação do ponto flutuante). Arredondar para centavos depois de cada conta evita esses resíduos nos totais. **Regra prática para dinheiro em JS**: arredonde sempre, ou trabalhe em centavos inteiros.

### 4.5 `validate` — validações ([linhas 121–165](../js/app.js#L121-L165))

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

### 4.6 Repositório de clientes ([linhas 170–256](../js/app.js#L170-L256))

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

### 4.7 `store(key, seed)` — fábrica de armazenamento ([linhas 261–283](../js/app.js#L261-L283))

Clientes têm um `read/write` próprio (por causa da migração). Para produtos e vendas, em vez de copiar o mesmo código duas vezes, existe uma **função que cria objetos** com `read`, `write` e `reset` para uma chave qualquer:

```js
const produtosStore = store(PRODUTOS_KEY, () => window.MGK_MOCK_PRODUTOS);
const vendasStore   = store(VENDAS_KEY,   () => window.MGK_MOCK_VENDAS);
```

Pontos de estudo:
- **Closure**: os métodos "lembram" de `key` e `seed` mesmo depois que `store` terminou de executar.
- `seed` é uma **função** (e não o array direto) para que o valor seja lido só quando necessário.
- Dentro de `read()`, `this.write(...)` funciona porque `read` é chamado como `produtosStore.read()`, então `this` é `produtosStore`. Por isso esses métodos usam a sintaxe `read() {}` e não arrow function (arrow functions não têm `this` próprio).

### 4.8 Repositório de produtos ([linhas 289–303](../js/app.js#L289-L303))

`listar`, `obter` e `restaurarDemonstracao`, todos delegando para `produtosStore`.

### 4.9 Repositório de vendas ([linhas 312–402](../js/app.js#L312-L402))

**`STATUS`** — dicionário código → texto exibido (`concluido` → `"Concluído"`).

**`listar()`** — ordena da mais recente para a mais antiga: `b.data.localeCompare(a.data)`. Datas ISO (`2026-09-15T...`) podem ser comparadas como texto porque o formato vai do maior para o menor (ano, mês, dia). O `|| b.numero.localeCompare(a.numero)` desempata quando a data é igual (comparação dá `0`, que é "falso").

**`porCliente(clienteId)`** — filtra por cliente.

**`resumoCliente(clienteId)`** — ignora canceladas e devolve `{ quantidade, totalGasto, ultimaCompra }`. Como a lista já vem ordenada, a última compra é `validas[0]`.

**`calcular(itens, desconto)`** — **a regra de negócio dos totais**, usada tanto pela tela (ao vivo) quanto no registro (ao salvar), garantindo que os dois nunca divergem:
1. Subtotal de cada linha = quantidade × preço unitário.
2. Subtotal geral = soma das linhas.
3. Desconto é "prendido" entre 0 e o subtotal: `Math.min(Math.max(desconto, 0), subtotal)` (padrão *clamp*).
4. Total = subtotal − desconto.

**`proximoNumero()`** — maior número existente + 1, com zeros à esquerda: `padStart(6, "0")` → `"000134"`.

**`registrar({ clienteId, itens, desconto })`** — grava uma venda:
1. **Valida de novo** tudo (cliente existe, há itens, produto existe, quantidade inteira ≥ 1, preço > 0). Mesmo que a tela já valide, o repositório não confia em quem o chama. Erros são lançados com `throw new Error(...)` e a tela os captura com `try/catch`.
2. Monta cada item com o **nome e o preço padrão copiados do produto naquele momento** (uma "fotografia"). Se o produto mudar de nome ou preço depois, o histórico continua correto.
3. Calcula totais com `calcular`, gera número/id/data e grava.

### 4.10 `ui` — interface comum ([linhas 407–449](../js/app.js#L407-L449))

**`ui.toast(message, type)`** — notificação no canto da tela:
1. Procura o contêiner `#toastContainer`; se não existir, cria e anexa ao `body`.
2. Cria o elemento do toast com `createElement` e `innerHTML` (a mensagem passa por `escapeHtml`).
3. `new bootstrap.Toast(el, { delay: 3500 })` e `toast.show()`: o Bootstrap cuida da animação e de sumir após 3,5 s.
4. No evento `hidden.bs.toast`, remove o elemento do DOM para não acumular lixo.
5. `role="status"` e `aria-live="polite"` fazem leitores de tela anunciarem a mensagem.

**`ui.flash(message, type)` e `ui.consumeFlash()`** — resolvem um problema clássico: depois de salvar, a página redireciona (`location.href = ...`) e um toast mostrado antes do redirecionamento sumiria. Então:
1. Antes de sair, `flash` grava a mensagem no `sessionStorage`.
2. A nova página, ao carregar, chama `consumeFlash`, que lê, **apaga** (para não repetir num F5) e mostra o toast.

### 4.11 Exportação e inicialização ([linhas 451–463](../js/app.js#L451-L463))

```js
window.MGK = { onlyDigits, normalize, escapeHtml, initials, format, validate, clientes, produtos, vendas, ui };
```

`{ onlyDigits }` é atalho de `{ onlyDigits: onlyDigits }`.

No `DOMContentLoaded` (HTML pronto), mostra o flash pendente e faz os links do menu lateral fecharem o menu no celular (`bootstrap.Offcanvas.getInstance(sidebar)?.hide()`; o `?.` evita erro quando o menu não foi aberto como offcanvas).

---

## 5. clientes.js — consulta e ficha do cliente

Arquivo: [js/clientes.js](../js/clientes.js). Tela `clientes.html`.

### 5.1 Referências aos elementos ([linhas 11–27](../js/clientes.js#L11-L27))

O objeto `el` junta, uma vez só, todos os elementos usados. Evita repetir `document.getElementById` e deixa claro de quais partes do HTML o script depende.

`new bootstrap.Modal(...)` cria os controladores das duas janelas modais (ficha do cliente e detalhes da venda).

### 5.2 Renderização da lista ([linhas 32–101](../js/clientes.js#L32-L101))

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

### 5.3 Ficha do cliente ([linhas 106–266](../js/clientes.js#L106-L266))

- `campo(label, valor, col)` → bloco "rótulo + valor" reutilizável, com classe de coluna do Bootstrap.
- `CLASSE_STATUS_VENDA` + `statusVenda(status)` → selo colorido de cada status de venda.
- `produtosResumo(venda)` → `"Shampoo Profissional (2x), Leave-in (2x)"`.
- `resumoCompras(clienteId)` → os três cartões (total de compras, total gasto, última compra), usando `vendas.resumoCliente`.
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

### 5.4 Detalhes da venda e troca de modais ([linhas 273–360](../js/clientes.js#L273-L360))

O Bootstrap **não empilha modais**. A solução foi alternar:

```js
// Da ficha para a venda: espera a ficha fechar e então abre a venda
el.modal.addEventListener("hidden.bs.modal", () => modalVenda.show(), { once: true });
modal.hide();

// Botão "Voltar para a ficha": o inverso
el.modalVenda.addEventListener("hidden.bs.modal", () => modal.show(), { once: true });
modalVenda.hide();
```

Em `abrirVenda`, `alterado` indica se o preço praticado foi diferente do padrão; nesse caso mostra "Preço padrão: R$ ...". Se o cliente da venda não existir mais, mostra "Cliente removido" (programação defensiva).

Os cliques e teclas (Enter/Espaço) nas linhas do histórico usam **delegação** no próprio modal (`el.modal`), já que o conteúdo é recriado a cada abertura.

### 5.5 Eventos e inicialização ([linhas 365–401](../js/clientes.js#L365-L401))

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

### 6.3 Validação com a API nativa do navegador ([linhas 54–92](../js/cadastro-cliente.js#L54-L92))

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

### 6.4 Modo edição ([linhas 97–129](../js/cadastro-cliente.js#L97-L129))

- Se o id não existe: `ui.flash` + `location.replace("clientes.html")` (o `replace` não deixa a página inválida no histórico do botão Voltar) e `return` encerra a IIFE.
- Ajusta títulos, breadcrumb, texto do botão e mostra o interruptor de status.
- `preencher(cliente)` copia cada campo e reaplica as máscaras.

### 6.5 Salvar ([linhas 134–166](../js/cadastro-cliente.js#L134-L166))

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

### 7.1 Estado da tela ([linhas 33–43](../js/venda.js#L33-L43))

```js
const venda = { clienteId: null, itens: [] }; // itens: { uid, produtoId, quantidade, precoUnitario }
let proximoUid = 1;
```

Este é o conceito mais importante da tela: **o objeto `venda` é a fonte da verdade**. O HTML é só um reflexo dele. Os eventos alteram o objeto e depois atualizam a tela.

Por que `uid` e não `produtoId` para identificar a linha? Porque o usuário pode trocar o produto de uma linha; o `uid` continua o mesmo, então sabemos qual linha é qual.

`catalogo` é carregado uma vez; `quantidadeValida` centraliza a regra (inteiro de 1 a 999).

### 7.2 Busca de cliente com autocomplete acessível ([linhas 48–146](../js/venda.js#L48-L146))

Um *combobox* feito à mão:

- `renderOpcoes()` busca até 8 clientes e desenha a lista (ou "nenhum cliente encontrado" com link para cadastrar).
- `marcarAtiva(indice)` destaca a opção navegada pelo teclado, atualiza `aria-selected` / `aria-activedescendant` (para leitores de tela) e rola até ela com `scrollIntoView({ block: "nearest" })`.
- Teclado: `ArrowDown`/`ArrowUp` navegam (com `Math.min`/`Math.max` para não sair dos limites), `Enter` seleciona (a opção ativa, ou a única se só houver uma), `Escape` fecha.
- **Truque do blur**: ao clicar numa opção, o campo perde o foco (`blur`) *antes* do clique. Duas proteções:
  - A lista usa `mousedown` (que acontece antes do `blur`) com `preventDefault()`, que impede o campo de perder o foco.
  - O `blur` fecha a lista com `setTimeout(..., 150)`, dando tempo para o clique ser processado.
- `selecionarCliente(id)` grava em `venda.clienteId`, mostra o cartão do cliente e esconde a busca. `trocarCliente()` faz o inverso.

### 7.3 Itens da venda ([linhas 152–298](../js/venda.js#L152-L298))

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

### 7.4 Resumo e total ([linhas 303–328](../js/venda.js#L303-L328))

`calcularVenda()` passa os itens para `vendas.calcular` (a **mesma regra** do repositório), trocando valores inválidos por 0 para que o total parcial nunca vire `NaN`.

`atualizarResumo()` mostra quantidade de itens, subtotal, desconto e total e marca o desconto como inválido se for maior que o subtotal.

Curiosidade: `atualizarResumo` é declarada com `function` (e não `const`) porque é chamada por `renderItens`, que aparece **antes** no arquivo. Declarações `function` sofrem *hoisting* (ficam disponíveis em todo o escopo). Com `const`, também funcionaria aqui, porque a chamada só acontece depois que o arquivo inteiro foi lido, mas `function` deixa isso explícito.

### 7.5 Finalizar ([linhas 333–399](../js/venda.js#L333-L399))

`validarVenda()` devolve **a mensagem de erro** ou `null`. Ordem: cliente → pelo menos um item → quantidades/preços (reaproveita `atualizarLinha` e procura o primeiro `.is-invalid`) → desconto. Sempre foca o campo problemático.

No `submit`:
1. Valida; se houver erro, toast.
2. `vendas.registrar(...)` dentro de `try/catch`, pois o repositório pode lançar erro.
3. Envia só os campos necessários (o `uid` é detalhe da tela e não é gravado).
4. `ui.flash(...)` e redireciona para `clientes.html?ver=...&venda=...`: a ficha abre com a venda nova destacada.

Enter nos campos: por padrão, apertar Enter num `<input>` envia o formulário. Aqui isso é bloqueado; no produto/quantidade, Enter **adiciona o produto**.

"Limpar venda" pede confirmação só se já houver itens, zera tudo e volta à busca de cliente.

### 7.6 Inicialização ([linhas 404–406](../js/venda.js#L404-L406))

Desenha a tabela vazia e, se a URL tiver `?cliente=<id>` válido, já seleciona o cliente (vindo do botão "Nova venda" da ficha).

---

## 8. Fluxos completos, do clique ao localStorage

### 8.1 Cadastrar um cliente

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

### 8.2 Registrar uma venda

```text
[clientes.html] botão "Nova venda" → venda.html?cliente=c-0001
[venda.html] init → selecionarCliente("c-0001")
usuário adiciona produtos → estado venda.itens muda → renderItens()
usuário altera preço/qtd → estado muda → atualizarLinha() + atualizarResumo()
     (ambos usam MGK.vendas.calcular → mesma regra do registro)
"Finalizar" → validarVenda()
     └─ MGK.vendas.registrar() → revalida → "fotografa" nome/preço → calcula → grava
     └─ ui.flash(...) → clientes.html?ver=c-0001&venda=v-000134
[clientes.html] abre ficha com histórico aberto e a venda destacada + toast
```

---

## 9. Como replicar: roteiro passo a passo

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

**Etapa 11 — Tela de venda.** Comece pelo **estado** (`venda = { clienteId, itens }`), depois `renderItens`, depois os eventos que alteram o estado, depois `atualizarLinha`/`atualizarResumo`, e por último a busca de cliente com teclado.

**Etapa 12 — Histórico.** Na ficha, liste `vendas.porCliente`, o resumo e o modal de detalhes; por fim, o deep link `?ver=&venda=`.

---

## 10. Exercícios

Do mais fácil ao mais difícil. Tente sem olhar a solução no código.

1. No console, rode `MGK.format.cnpj("12345678000195")`, `MGK.validate.cpf("11111111111")` e `MGK.format.moedaInput("123456")`. Explique cada resultado.
2. Adicione um campo "Data de nascimento" ao cadastro de cliente (HTML, `CAMPOS`, exibição na ficha).
3. Crie `format.cepSemMascara` e um botão que busca o endereço pelo CEP na API pública ViaCEP (`fetch("https://viacep.com.br/ws/01001000/json/")`) e preenche rua/bairro/cidade/UF.
4. Mostre na tabela de clientes uma coluna "Total gasto" usando `vendas.resumoCliente`.
5. Permita **cancelar** uma venda na tela de detalhes (novo método `vendas.cancelar(id)` no repositório, mudando o `status`).
6. Adicione um filtro "Somente ativos" na consulta de clientes.
7. Crie uma tela `produtos.html` com cadastro de produtos, reaproveitando `store`, `ui.toast` e as máscaras de moeda.
8. Desafio: transforme `MGK.clientes.listar()` em `async` usando `fetch` para um `clientes.json` local e adapte as telas com `await`.

---

## 11. Padrões para levar para outros projetos

- **Separe dados de tela.** Repositórios (`listar`, `obter`, `salvar`) isolam o armazenamento; trocar `localStorage` por API afeta um arquivo só.
- **Guarde dados crus, formate na exibição.** Documento só com dígitos, valores como número, datas em ISO.
- **Estado primeiro, tela depois.** Altere o objeto de estado e redesenhe a partir dele (padrão que frameworks como React automatizam).
- **Uma regra, um lugar.** `vendas.calcular` é usada pela tela e pelo registro; `quantidadeValida` centraliza a regra de quantidade.
- **Valide nas duas pontas.** A tela valida para a experiência do usuário; o repositório valida para garantir a integridade.
- **Escape tudo que vai para `innerHTML`.** `escapeHtml` para HTML, `encodeURIComponent` para URLs, `textContent` quando não precisar de HTML.
- **Delegação de eventos** para listas que são redesenhadas.
- **Dinheiro:** arredonde para centavos após cada conta.
- **Acessibilidade:** `aria-*`, `role`, labels escondidos visualmente, navegação por teclado e foco no campo com erro.
