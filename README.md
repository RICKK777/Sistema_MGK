# Sistema MGK — Front-end (Etapa 2: Clientes e Vendas)

Front-end do Sistema MGK (Makyuner Professional), feito com HTML, CSS, JavaScript e Bootstrap 5.3.

Esta etapa cobre o cadastro e a consulta de clientes, a ficha do cliente com histórico de compras e o cadastro de vendas. Vendedores, estoque, pagamentos e metas aparecem desabilitados no menu, à espera das próximas etapas.

## Como executar

Não há build nem dependências para instalar. Bootstrap, Bootstrap Icons e a fonte Inter são carregados via CDN (é preciso estar conectado à internet).

- **Opção 1:** abrir o `index.html` no navegador.
- **Opção 2 (recomendada):** servir a pasta localmente, por exemplo:
  - VS Code: extensão *Live Server* → "Open with Live Server"
  - Node: `npx serve .`
  - Python: `python -m http.server 8080` e acessar http://localhost:8080

## Estudar o código

O guia [docs/GUIA-JAVASCRIPT.md](docs/GUIA-JAVASCRIPT.md) explica todo o JavaScript, arquivo por arquivo. Ele traz um roteiro para reconstruir o sistema do zero e exercícios.

## Estrutura

```text
sistema-mgk/
├── index.html              # Redireciona para a consulta de clientes
├── clientes.html           # Consulta/busca + ficha do cliente + detalhes da venda (modais)
├── cadastro-cliente.html   # Cadastro (novo) e edição (?id=...)
├── venda.html              # Cadastro de venda (?cliente=... pré-seleciona o cliente)
├── css/
│   └── style.css           # Tema MGK (amarelo + preto) sobre o Bootstrap
├── js/
│   ├── mock-data.js        # Clientes, produtos e vendas FICTÍCIOS de demonstração
│   ├── app.js              # Núcleo: repositórios (localStorage), máscaras, validações, toasts
│   ├── clientes.js         # Lógica da consulta e da ficha do cliente
│   ├── cadastro-cliente.js # Lógica da tela de cadastro/edição
│   └── venda.js            # Lógica do cadastro de venda
└── assets/
    └── favicon.svg
```

## Funcionalidades

### Clientes
- Busca por **nome** (ignora acentos e maiúsculas) ou por **CPF/CNPJ** (com ou sem pontuação)
- Tabela responsiva, com rolagem horizontal em telas pequenas, e estado de "nenhum cliente encontrado"
- Máscaras de CPF/CNPJ, telefone e CEP; validação dos dígitos de CPF/CNPJ e bloqueio de documento duplicado
- Status Ativo/Inativo (definido na edição; novos clientes são cadastrados como ativos)

### Ficha do cliente
- Dados pessoais, endereço e registro
- Resumo de compras: quantidade, total gasto e data da última compra (calculados a partir das vendas; vendas canceladas não entram na conta)
- **Histórico de Compras** em painel expansível; clicar em uma compra abre os **detalhes da venda** (produtos, preço praticado, subtotal, desconto e total)
- Botão **Nova venda**, que abre o cadastro de venda com o cliente já selecionado

### Cadastro de venda
- Cliente escolhido por busca de nome ou CPF/CNPJ (teclado: ↑ ↓ Enter Esc)
- Vários produtos por venda; o preço padrão é preenchido automaticamente e pode ser alterado **só para esta venda**
- Subtotais, desconto e total recalculados a cada alteração
- Ao finalizar: valida cliente, produtos, quantidades, preços e desconto; registra a venda e abre a ficha do cliente com a nova compra destacada no histórico

### Geral
- Sidebar fixa no desktop e recolhível (menu hambúrguer) no tablet/celular
- No celular, os produtos da venda viram cards com os campos empilhados

## Dados

Todos os dados de demonstração são **fictícios** e ficam no `localStorage` do navegador:

| Chave              | Conteúdo  |
| ------------------ | --------- |
| `mgk.clientes.v1`  | Clientes  |
| `mgk.produtos.v1`  | Produtos  |
| `mgk.vendas.v1`    | Vendas    |

O botão **"Restaurar dados de demonstração"**, na tela de clientes, volta à carga inicial de todos eles.

Estrutura das vendas:

```js
// Venda
{ id, numero, clienteId, data, produtos: [...], subtotal, desconto, total, status }
// Produto dentro da venda
{ produtoId, nome, quantidade, precoPadrao, precoUnitario, subtotal }
```

`precoUnitario` é o preço **praticado** na venda e é gravado separado do `precoPadrao` do produto (que fica só como referência do preço de tabela na data da venda). Assim, mudar o preço de um produto não altera o histórico.

> Os campos do cliente seguem a estrutura já existente: `documento` corresponde ao CPF/CNPJ e o endereço está dividido em `cep`, `rua`, `numero`, `complemento`, `bairro`, `cidade` e `estado`.

## Próximos passos (integração com back-end)

Toda leitura e escrita de dados passa pelos repositórios de `js/app.js`:

- `MGK.clientes`: `listar`, `obter`, `buscar`, `salvar`, `documentoEmUso`
- `MGK.produtos`: `listar`, `obter`
- `MGK.vendas`: `listar`, `obter`, `porCliente`, `resumoCliente`, `calcular`, `registrar`

Para ligar a uma API, troque a implementação desses métodos por chamadas HTTP (o número do pedido e a data passam a vir do servidor). Como elas serão assíncronas, as chamadas nas telas também vão precisar de `await`, mas a estrutura das telas continua a mesma.
