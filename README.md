# Sistema MGK — Front-end (Etapa 3: Clientes, Produtos, Vendas e Pagamentos)

Front-end do Sistema MGK (Makyuner Professional), feito com HTML, CSS, JavaScript e Bootstrap 5.3.

Esta etapa cobre o cadastro e a consulta de clientes, o cadastro de produtos, a ficha do cliente com histórico de compras, o cadastro de vendas e o **pagamento em partes** (o cliente paga uma parte na hora e o resto depois, e pode abater a conta em aberto numa compra nova). Vendedores, estoque, a tela de pagamentos (contas a receber) e metas aparecem desabilitados no menu, à espera das próximas etapas.

> **Atualizando uma versão anterior com o back-end?** É preciso criar a tabela `pagamentos` no MySQL. Veja [docs/ATUALIZACOES.md](docs/ATUALIZACOES.md), que resume tudo que mudou e traz o passo a passo do banco.

## Como executar

Não há build nem dependências para instalar. Bootstrap, Bootstrap Icons e a fonte Inter são carregados via CDN (é preciso estar conectado à internet).

- **Opção 1:** abrir o `index.html` no navegador.
- **Opção 2 (recomendada):** servir a pasta localmente, por exemplo:
  - VS Code: extensão *Live Server* → "Open with Live Server"
  - Node: `npx serve .`
  - Python: `python -m http.server 8080` e acessar http://localhost:8080

## Estudar o código

O guia [docs/GUIA-JAVASCRIPT.md](docs/GUIA-JAVASCRIPT.md) explica todo o JavaScript, arquivo por arquivo. Ele traz um roteiro para reconstruir o sistema do zero e exercícios.

O guia [docs/BANCO-DE-DADOS.md](docs/BANCO-DE-DADOS.md) traz as tabelas do MySQL, o script SQL e o contrato da API para ligar o sistema a um back-end.

O [docs/ATUALIZACOES.md](docs/ATUALIZACOES.md) resume o que mudou nesta etapa (produtos e pagamentos) e o que fazer no banco.

O back-end (Node.js + Express + MySQL) fica em [backend/](backend/README.md), com o guia [backend/docs/GUIA-BACKEND.md](backend/docs/GUIA-BACKEND.md).

## Estrutura

```text
sistema-mgk/
├── index.html              # Redireciona para a consulta de clientes
├── clientes.html           # Consulta/busca + ficha do cliente + detalhes da venda (modais)
├── cadastro-cliente.html   # Cadastro (novo) e edição (?id=...)
├── produtos.html           # Cadastro, edição e lista de produtos (ativar/inativar)
├── venda.html              # Cadastro de venda (?cliente=... pré-seleciona o cliente)
├── css/
│   └── style.css           # Tema MGK (amarelo + preto) sobre o Bootstrap
├── docs/
│   ├── GUIA-JAVASCRIPT.md  # Explicação do JavaScript
│   ├── BANCO-DE-DADOS.md   # Tabelas MySQL + contrato da API
│   └── ATUALIZACOES.md     # O que mudou (produtos e pagamentos) + atualização do banco
├── backend/                # API Node.js + Express + MySQL (veja backend/README.md)
├── js/
│   ├── config.js           # Modo de dados: "local" (localStorage) ou "api" (back-end)
│   ├── mock-data.js        # Clientes, produtos e vendas FICTÍCIOS de demonstração
│   ├── app.js              # Núcleo: repositórios (local/API), cliente HTTP, máscaras, validações, toasts
│   ├── clientes.js         # Lógica da consulta e da ficha do cliente
│   ├── cadastro-cliente.js # Lógica da tela de cadastro/edição
│   ├── produtos.js         # Lógica da tela de produtos
│   └── venda.js            # Lógica do cadastro de venda
└── assets/
    └── favicon.svg
```

## Funcionalidades

### Clientes
- Busca por **nome** (ignora acentos e maiúsculas) ou por **CPF/CNPJ** (com ou sem pontuação)
- Tabela responsiva, com rolagem horizontal em telas pequenas, e estado de "nenhum cliente encontrado"
- Máscaras de CPF/CNPJ, telefone e CEP; validação dos dígitos de CPF/CNPJ e bloqueio de documento duplicado
- Endereço preenchido automaticamente pelo CEP (API pública [ViaCEP](https://viacep.com.br)); se a busca falhar, o endereço é digitado manualmente
- Status Ativo/Inativo (definido na edição; novos clientes são cadastrados como ativos)

### Ficha do cliente
- Dados pessoais, endereço e registro
- Resumo de compras: quantidade, total gasto e data da última compra (calculados a partir das vendas; vendas canceladas não entram na conta)
- **Histórico de Compras** em painel expansível; clicar em uma compra abre os **detalhes da venda** (produtos, preço praticado, subtotal, desconto e total)
- Botão **Nova venda**, que abre o cadastro de venda com o cliente já selecionado

### Produtos
- Cadastro com nome (único) e preço padrão; edição pelo botão de lápis na lista
- Ativar/Inativar: produto inativo some da tela de venda, mas continua no histórico das vendas
- A tela de venda recarrega o catálogo sozinha: produto cadastrado em outra aba (ou antes de voltar para a aba da venda) já aparece no seletor, sem recarregar a página

### Cadastro de venda
- Cliente escolhido por busca de nome ou CPF/CNPJ (teclado: ↑ ↓ Enter Esc)
- Vários produtos por venda; o preço padrão é preenchido automaticamente e pode ser alterado **só para esta venda**
- Subtotais, desconto e total recalculados a cada alteração
- **Pagamento**: "Pago integral" ou "Outro valor". Com outro valor, informa-se quanto o cliente pagou agora:
  - **menos que o total** (ou nada): o restante fica **em aberto**;
  - **mais que o total**: se o cliente tem conta anterior em aberto, a diferença **abate essa conta**, do pedido mais antigo para o mais recente (limite: total da venda + conta anterior). A tela avisa quanto o cliente deve e tem o atalho "Receber tudo agora"
- Ao finalizar: valida cliente, produtos, quantidades, preços, desconto e pagamento; registra a venda e abre a ficha do cliente com a nova compra destacada no histórico

### Pagamentos em partes
- O cliente pode pagar a venda aos poucos, em dias diferentes (ex.: parte no pedido, o resto depositado depois)
- Ficha do cliente → histórico → clique na venda → seção **Pagamentos**: lista do que já foi pago (data, forma, observação), total pago, saldo em aberto e o formulário **Registrar pagamento** (o valor já vem com o saldo; a data pode ser de um dia anterior)
- O histórico mostra a situação de cada pedido (**Pago**, **Pago em parte** com quanto falta, **Não pago**) e o resumo da ficha mostra o total **Em aberto** do cliente
- Não deixa pagar mais que o saldo nem registrar pagamento em venda cancelada

### Geral
- Sidebar fixa no desktop e recolhível (menu hambúrguer) no tablet/celular
- No celular, os produtos da venda viram cards com os campos empilhados

## Dados

O lugar onde os dados ficam é definido em `js/config.js`:

- `modo: "local"` (padrão): os dados ficam no `localStorage` do navegador. Não precisa de servidor.
- `modo: "api"`: os dados vêm do back-end em `apiUrl`, gravados no MySQL. Veja [docs/BANCO-DE-DADOS.md](docs/BANCO-DE-DADOS.md).

No modo local, os dados de demonstração são **fictícios** e ficam nestas chaves do `localStorage`:

| Chave              | Conteúdo  |
| ------------------ | --------- |
| `mgk.clientes.v1`  | Clientes  |
| `mgk.produtos.v1`  | Produtos  |
| `mgk.vendas.v1`    | Vendas    |

O botão **"Restaurar dados de demonstração"**, na tela de clientes, volta à carga inicial de todos eles. No modo API ele não aparece.

Estrutura das vendas:

```js
// Venda
{ id, numero, clienteId, data, produtos: [...], subtotal, desconto, total, status, pagamentos: [...] }
// Pagamento (o saldo em aberto é sempre total − soma dos pagamentos; não é gravado)
{ id, data, valor, forma, observacao }
// Produto dentro da venda
{ produtoId, nome, quantidade, precoPadrao, precoUnitario, subtotal }
```

`precoUnitario` é o preço **praticado** na venda e é gravado separado do `precoPadrao` do produto (que fica só como referência do preço de tabela na data da venda). Assim, mudar o preço de um produto não altera o histórico.

> Os campos do cliente seguem a estrutura já existente: `documento` corresponde ao CPF/CNPJ e o endereço está dividido em `cep`, `rua`, `numero`, `complemento`, `bairro`, `cidade` e `estado`.

## Integração com back-end

Toda leitura e escrita de dados passa pelos repositórios de `js/app.js`. Cada um tem duas implementações com a mesma interface, uma para o localStorage e outra para a API, e as telas não sabem qual está em uso:

- `MGK.clientes`: `listar`, `obter`, `buscar`, `salvar`, `documentoEmUso`
- `MGK.produtos`: `listar` (só ativos), `listarTodos`, `obter`, `salvar`, `excluir`, `aoAlterar`
- `MGK.vendas`: `listar`, `obter`, `porCliente`, `registrar`, `registrarPagamento` + regras `calcular`, `resumir`, `resumoCliente`, `pagamento`, `contaEmAberto`, `distribuirPagamento`

Os métodos que acessam dados são **assíncronos** (devolvem `Promise`) e são chamados com `await` nas telas. Erros chegam como `MGK.ErroMGK`, com `message` para o usuário e `status` HTTP.

Para ligar o back-end: implemente a API descrita em [docs/BANCO-DE-DADOS.md](docs/BANCO-DE-DADOS.md) e troque `modo` para `"api"` em `js/config.js`.
