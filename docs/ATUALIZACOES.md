# Atualizações: produtos e pagamentos em partes

Este documento resume **tudo que mudou** nesta etapa do Sistema MGK e **o que precisa ser feito no banco de dados** para usar as novidades com o back-end (modo `"api"`).

- Detalhes das tabelas e da API: [BANCO-DE-DADOS.md](BANCO-DE-DADOS.md)
- Explicação do código do site: [GUIA-JAVASCRIPT.md](GUIA-JAVASCRIPT.md)
- Explicação do código do back-end: [GUIA-BACKEND.md](../backend/docs/GUIA-BACKEND.md)

## Sumário

1. [Resumo rápido](#resumo-rápido)
2. [O que fazer no banco](#o-que-fazer-no-banco)
3. [O que mudou para o usuário](#o-que-mudou-para-o-usuário)
4. [O que mudou no código](#o-que-mudou-no-código)
5. [Mudanças na API](#mudanças-na-api)
6. [Modo local (sem back-end)](#modo-local-sem-back-end)
7. [Checklist para colocar no ar](#checklist-para-colocar-no-ar)
8. [Próximos passos sugeridos](#próximos-passos-sugeridos)

---

## Resumo rápido

| Funcionalidade | Onde fica | Precisa mudar o banco? |
| --- | --- | --- |
| Tela de **Produtos** (cadastrar, editar, buscar, ativar/inativar, excluir) | Menu **Cadastros → Produtos** (`produtos.html`) | **Não** (a tabela `produtos` já tinha tudo) |
| Catálogo da venda **atualiza sozinho** quando um produto é cadastrado | Tela de venda | Não |
| Venda com pagamento **integral ou parcial** (ou nada na hora) | Tela de venda → bloco **Pagamento** | **Sim**: tabela nova `pagamentos` |
| **Registrar pagamentos depois**, em quantas vezes precisar | Ficha do cliente → venda → **Pagamentos** | Sim (mesma tabela) |
| Pagamento com **data anterior** à venda (lançar histórico do Excel) | Mesmo formulário | Sim (mesma tabela) |
| Pagar **mais que a compra do dia** para abater a conta em aberto | Tela de venda → **Outro valor** | Sim (mesma tabela) |
| Total **em aberto** do cliente e situação de cada pedido | Ficha do cliente | Sim (mesma tabela) |

**No banco, a única mudança é criar a tabela `pagamentos`** (e, opcionalmente, marcar as vendas antigas como pagas). Nenhuma tabela existente é alterada e nenhum dado é apagado.

---

## O que fazer no banco

> Só é necessário se o banco **já existia** antes desta atualização. Quem vai criar o banco agora pode rodar direto o script completo da [seção 5 do BANCO-DE-DADOS.md](BANCO-DE-DADOS.md#5-script-sql-completo), que já inclui a tabela `pagamentos`.

Requer **MySQL 8.0.16 ou superior** (por causa do `CHECK`). Rode no **MySQL Workbench** (aba SQL, botão ⚡) com um usuário que possa criar tabelas (ex.: `root`). O usuário da API (`mgk_app`) já tem as permissões necessárias (`SELECT, INSERT, UPDATE, DELETE`), não precisa mudar nada nele.

**Faça um backup antes** (Workbench → *Server* → *Data Export*, ou `mysqldump -u root -p mgk > backup-mgk.sql`).

### Passo 1: criar a tabela `pagamentos` (obrigatório)

```sql
USE mgk;

CREATE TABLE IF NOT EXISTS pagamentos (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  venda_id    INT UNSIGNED  NOT NULL,
  data        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,   -- quando o cliente pagou
  valor       DECIMAL(10,2) NOT NULL,
  forma       ENUM('dinheiro','pix','debito','credito','transferencia','boleto','outro') NOT NULL,
  observacao  VARCHAR(255)  NULL,
  criado_em   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,   -- quando foi lançado no sistema

  PRIMARY KEY (id),
  KEY idx_pag_venda (venda_id, data),
  CONSTRAINT fk_pag_venda FOREIGN KEY (venda_id) REFERENCES vendas (id) ON DELETE CASCADE,
  CONSTRAINT ck_pag_valor CHECK (valor > 0)
) ENGINE=InnoDB;
```

O `IF NOT EXISTS` deixa rodar de novo sem erro.

**Sem esta tabela, o back-end dá erro ao listar ou registrar vendas** (`Table 'mgk.pagamentos' doesn't exist`), porque toda venda agora é devolvida com os pagamentos.

### Passo 2: vendas que já estavam no banco (escolha uma opção)

Antes desta atualização não havia controle de pagamento: toda venda era tratada como paga. Depois do passo 1, essas vendas aparecem como **"Não pago"**, porque não têm nenhuma linha em `pagamentos`. Escolha:

**Opção A: considerar todas as vendas antigas como pagas.** Use quando as vendas existentes são de teste ou foram mesmo todas quitadas:

```sql
INSERT INTO pagamentos (venda_id, data, valor, forma, observacao)
SELECT v.id, v.data, v.total, 'outro', 'Registrado antes do controle de pagamentos'
  FROM vendas v
 WHERE v.status <> 'cancelado'
   AND v.total > 0
   AND NOT EXISTS (SELECT 1 FROM pagamentos p WHERE p.venda_id = v.id);
```

O `NOT EXISTS` evita duplicar: rodar duas vezes não cria pagamentos repetidos.

**Opção B: lançar os pagamentos reais.** Use quando existem vendas com saldo de verdade, por exemplo o histórico que está na planilha do Excel desde o começo do ano. Não rode o `INSERT` acima: abra cada venda pelo sistema (ficha do cliente → venda → **Registrar pagamento**) e lance cada pagamento com a **data em que ele aconteceu**. O sistema aceita datas anteriores à venda justamente para isso.

> Dá para misturar: rode a opção A só para as vendas quitadas, acrescentando `AND v.id IN (...)` ou `AND v.data < '2026-01-01'` ao `WHERE`, e lance o restante pela tela.

### Passo 3: conferir

```sql
-- A tabela existe e tem as colunas certas
DESCRIBE pagamentos;

-- Quantas vendas ficaram com saldo em aberto (e quanto)
SELECT COUNT(*) AS vendas_em_aberto, SUM(saldo) AS total_em_aberto
  FROM (
    SELECT v.id, v.total - COALESCE(SUM(p.valor), 0) AS saldo
      FROM vendas v
      LEFT JOIN pagamentos p ON p.venda_id = v.id
     WHERE v.status <> 'cancelado'
     GROUP BY v.id
    HAVING saldo > 0
  ) AS abertas;
```

Depois, reinicie a API (`Ctrl+C` e `npm start`) e abra http://localhost:3000/api/vendas: cada venda deve vir com `"pagamentos": [...]`.

### O que NÃO precisa mudar

| Item | Por quê |
| --- | --- |
| Tabela `produtos` | Já tinha `ativo`, `criado_em`, `atualizado_em` e o nome único (`uk_produtos_nome`), usados pela tela nova |
| Tabelas `clientes`, `vendas`, `venda_itens` | Sem alteração. O saldo **não** é uma coluna: é sempre calculado (`total − soma dos pagamentos`) |
| Permissões do `mgk_app` | O `DELETE` usado na exclusão de produtos já estava no `GRANT` |
| Arquivo `.env` | Sem variáveis novas |

### Desfazer (se precisar voltar à versão anterior)

```sql
DROP TABLE pagamentos;   -- apaga todos os pagamentos lançados!
```

A versão anterior do back-end não usa essa tabela. Os produtos cadastrados pela tela nova continuam válidos.

---

## O que mudou para o usuário

### Produtos (tela nova)

- Menu **Cadastros → Produtos**: formulário (nome e preço padrão) e lista com busca.
- **Editar** (lápis): carrega o produto no formulário. Na edição aparece o interruptor **Produto ativo**.
- **Ativar/Inativar**: produto inativo some da tela de venda, mas continua no histórico das vendas antigas.
- **Excluir** (lixeira): para produto cadastrado por engano. **Só é permitido se o produto nunca foi vendido**; senão, o sistema pede para inativar.
- Não deixa cadastrar dois produtos com o mesmo nome (ignorando acentos e maiúsculas).

### Tela de venda

- Link **"Cadastrar produto"** ao lado do seletor: abre a tela de produtos em outra aba. Ao voltar, o produto novo **já aparece**, sem recarregar a página.
- Se um produto que estava na venda for inativado ou excluído em outra aba, ele sai da venda com aviso. Se o preço padrão mudar, itens que estavam no preço antigo passam para o novo (preço ajustado à mão é mantido).
- Bloco **Pagamento** no resumo:
  - **Pago integral**: o cliente paga o total agora.
  - **Outro valor**: menos que o total (ou vazio) deixa o resto **em aberto**; **mais que o total** abate a **conta anterior** do cliente.
  - **Forma de pagamento**: Dinheiro, Pix, Cartão de débito, Cartão de crédito, Transferência / depósito, Boleto ou Outro.
- Quando o cliente escolhido deve compras anteriores, aparece o aviso **"Conta anterior em aberto: R$ X"**, com os pedidos e o atalho **"Receber tudo agora"**.
- O resumo mostra **Pago agora**, **Abate da conta anterior**, **Fica em aberto nesta venda** e **Conta anterior restante**.

**Exemplo:** compra de R$ 80, cliente devendo R$ 100 de antes, paga R$ 130 → R$ 80 quitam a compra do dia e R$ 50 abatem a dívida antiga (que passa a R$ 50). O abatimento começa pelo **pedido mais antigo**.

### Ficha do cliente

- Resumo com o cartão **Em aberto** (vermelho quando o cliente deve).
- Histórico com a coluna **Pagamento**: **Pago**, **Pago em parte** (com "Falta R$ X") ou **Não pago**.
- Detalhes da venda com a seção **Pagamentos**: total, pago, em aberto, lista de pagamentos (data, forma, observação) e o formulário **Registrar pagamento**:
  - o valor já vem com o saldo (basta alterar se o cliente pagou só uma parte);
  - a data pode ser **qualquer dia até hoje**, inclusive antes da venda (para lançar o histórico do Excel);
  - não aceita valor maior que o saldo, data no futuro nem venda cancelada.
- Pagamentos que vieram de abatimento aparecem com a observação **"Abatido na venda #000140"**, então dá para saber de onde veio cada valor.

---

## O que mudou no código

### Arquivos novos

| Arquivo | O que é |
| --- | --- |
| `produtos.html` | Tela de produtos |
| `js/produtos.js` | Lógica da tela de produtos |
| `docs/ATUALIZACOES.md` | Este documento |

### Arquivos alterados

| Arquivo | Mudança |
| --- | --- |
| `js/app.js` | `MGK.produtos`: `listarTodos`, `salvar`, `excluir`, `aoAlterar`; `listar` só devolve ativos. `MGK.vendas`: `FORMAS_PAGAMENTO`, `SITUACAO_PAGAMENTO`, `pagamento()`, `contaEmAberto()`, `distribuirPagamento()`, `registrarPagamento()`; `registrar` aceita `pagamento`; `resumir` devolve `emAberto` |
| `js/venda.js` | Bloco de pagamento, conta anterior do cliente e catálogo que se atualiza sozinho |
| `js/clientes.js` | Situação do pagamento no histórico, cartão "Em aberto", seção Pagamentos e formulário "Registrar pagamento" |
| `js/mock-data.js` | Vendas de demonstração com pagamentos (algumas em aberto) |
| `venda.html` | Bloco Pagamento, aviso de conta anterior, link "Cadastrar produto" |
| `clientes.html`, `cadastro-cliente.html`, `venda.html` | Item **Produtos** no menu lateral |
| `css/style.css` | Estilos da tela de produtos e dos pagamentos |
| `backend/src/rotas/produtos.js` | `POST`, `PUT`, `DELETE` e `?todos=1` |
| `backend/src/rotas/vendas.js` | Pagamentos nas vendas, abatimento da conta e `POST /vendas/:id/pagamentos` |
| `backend/src/validacao.js` | `validarProduto`, `validarPagamento`, `FORMAS_PAGAMENTO` |
| `backend/src/server.js` | CORS libera `DELETE` |
| Documentação | `README.md`, `BANCO-DE-DADOS.md`, `GUIA-JAVASCRIPT.md`, `GUIA-BACKEND.md`, `backend/README.md` |

---

## Mudanças na API

| Método | Rota | Novo? | Observação |
| --- | --- | :-: | --- |
| `GET` | `/produtos?todos=1` | ✔ | Ativos e inativos |
| `POST` | `/produtos` | ✔ | `{ nome, precoPadrao }` → 201 · 409 nome repetido |
| `PUT` | `/produtos/:id` | ✔ | `{ nome, precoPadrao, ativo }` → 200 · 409 nome repetido |
| `DELETE` | `/produtos/:id` | ✔ | 204 · 409 se o produto já foi vendido |
| `GET` | `/vendas`, `/vendas/:id`, `/vendas?clienteId=` | alterada | Cada venda vem com `pagamentos: [{ id, data, valor, forma, observacao }]` |
| `POST` | `/vendas` | alterada | Aceita `pagamento: { valor, forma }`. Valor acima do total abate a conta em aberto (limite: total + conta). A resposta traz `abatimentos: [{ vendaId, numero, valor }]` |
| `POST` | `/vendas/:id/pagamentos` | ✔ | `{ valor, forma, data, observacao }` → 201 com a venda atualizada |

**Compatibilidade:** um `POST /vendas` sem `pagamento` continua funcionando, mas a venda fica **sem nenhum pagamento** (em aberto). O site novo sempre envia o campo.

Formato completo dos objetos e regras: [BANCO-DE-DADOS.md, seções 7 e 8](BANCO-DE-DADOS.md#7-contrato-da-api).

---

## Modo local (sem back-end)

No modo `"local"` (dados no navegador), **não é preciso fazer nada**:

- Vendas antigas salvas no navegador, sem pagamentos, são lidas como **pagas** (um pagamento do total, forma "não informada").
- Produtos antigos, sem o campo `ativo`, são lidos como **ativos**.

Para ver os exemplos novos (vendas parciais e em aberto), clique em **"Restaurar dados de demonstração"** na tela de Clientes. Isso **apaga** o que foi cadastrado no navegador e volta aos dados fictícios. Exemplos que aparecem:

| Pedido | Cliente | Total | Pago | Em aberto |
| --- | --- | ---: | ---: | ---: |
| #000123 | Ana Fictícia Moreira | R$ 250,00 | R$ 150,00 | R$ 100,00 |
| #000127 | Salão Exemplo Beleza | R$ 890,00 | R$ 500,00 | R$ 390,00 |
| #000131 | Bruno Teste Carvalho | R$ 310,00 | — | R$ 310,00 |
| #000133 | Studio Hair Fictício | R$ 525,00 | R$ 200,00 | R$ 325,00 |

---

## Checklist para colocar no ar

- [ ] Backup do banco
- [ ] [Passo 1](#passo-1-criar-a-tabela-pagamentos-obrigatório): criar a tabela `pagamentos`
- [ ] [Passo 2](#passo-2-vendas-que-já-estavam-no-banco-escolha-uma-opção): decidir o que fazer com as vendas antigas (opção A, B ou as duas)
- [ ] [Passo 3](#passo-3-conferir): conferir no Workbench
- [ ] Atualizar os arquivos do back-end e reiniciar a API (`npm start`)
- [ ] Atualizar os arquivos do site (inclusive `produtos.html` e `js/produtos.js`)
- [ ] No navegador, `Ctrl+F5` para não usar arquivos antigos do cache
- [ ] Testar: cadastrar produto (aparece na venda?), excluir produto já vendido (deve recusar), venda com "Outro valor" menor que o total (fica em aberto?), registrar pagamento até quitar, venda pagando mais que o total para um cliente que deve (abateu o pedido antigo?)

---

## Próximos passos sugeridos

Ainda **não** existem e seriam úteis, principalmente para lançar o histórico da planilha:

- **Data da venda escolhível**: hoje a venda sempre recebe a data do dia em que é cadastrada. Para lançar vendas antigas com a data certa, falta um campo "Data da venda". Não muda o banco (a coluna `vendas.data` já existe); muda só a API e a tela.
- **Tela Contas a receber** (menu Pagamentos): todas as vendas com saldo, de todos os clientes, numa lista só. Não muda o banco; a consulta está na [seção 9.3 do BANCO-DE-DADOS.md](BANCO-DE-DADOS.md#93-pagamentos).
- **Excluir um pagamento lançado errado**: hoje não há como desfazer um pagamento pela tela. Não muda o banco.
