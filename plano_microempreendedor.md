# Plano de Adaptação — Foco Microempreendedor (PJ/MEI)

## Objetivo

Adaptar o aplicativo **Finance** para o dia a dia de um **microempreendedor (100% focado no negócio PJ)**, mantendo a simplicidade e facilidade de manutenção da v1:

1. **Vocabulário e Categorias PJ/MEI** em todas as telas e no seed inicial do SQLite (`Vendas / Serviços`, `DAS / Impostos`, `Fornecedores / Estoque`, `Pró-labore`, `Taxas / Tarifas`, `Ferramentas / Software`, `Marketing / Anúncios`, etc.).
2. **Forma de Pagamento / Recebimento** (`PIX`, `Dinheiro`, `Boleto`, `Cartão`, `Transferência`) nas movimentações bancárias/caixa e nos custos fixos, com exibição em badge e filtro rápido no extrato.
3. **Migração não-destrutiva do SQLite** para bancos já criados, adicionando `payment_method` de forma idempotente sem perda de dados.

---

## Mudanças Propostas

### Backend Rust + SQLite (`src-tauri/src/`)

- **`db.rs`**:
  - Migração idempotente (`PRAGMA table_info` + `ALTER TABLE`) adicionando:
    - `bank_transactions.payment_method TEXT NOT NULL DEFAULT 'PIX'`
    - `fixed_costs.payment_method TEXT NOT NULL DEFAULT 'Boleto'`
    - `fixed_cost_entries.payment_method TEXT NOT NULL DEFAULT 'Boleto'`
  - Propagar `payment_method` em `ensure_fixed_cost_entries`.
  - Seed de categorias PJ/MEI:
    - Entradas: `Vendas / Serviços`, `Recebimentos a Prazo`, `Outras Receitas`
    - Despesas: `DAS / Impostos`, `Fornecedores / Estoque`, `Pró-labore`, `Aluguel / Espaço`, `Ferramentas / Software`, `Marketing / Anúncios`, `Taxas / Tarifas`, `Transporte / Entregas`, `Outros`
  - Em bancos antigos sem lançamentos vinculados às categorias pessoais antigas, substitui automaticamente pelas categorias PJ/MEI; se houver dados vinculados, preserva tudo e apenas soma as novas categorias PJ.
  - Validação `validate_payment_method` (`PIX`, `Dinheiro`, `Boleto`, `Cartão`, `Transferência`).
- **`models.rs`**: adicionar `payment_method: String` em `FixedCost`, `FixedCostEntry` e `BankTransaction`.
- **`commands/bank.rs`**: ler e salvar `payment_method` nos lançamentos de caixa/banco.
- **`commands/fixed_costs.rs`**: ler e salvar `payment_method` nos modelos e entradas mensais.
- **`lib.rs`**: testes unitários de migração idempotente de banco antigo, persistência de `payment_method` e seed PJ/MEI.

### Frontend React + TypeScript (`src/`)

- **`lib/types.ts` e `lib/api.ts`**: tipo `PaymentMethod`, constante `PAYMENT_METHODS` e payloads atualizados.
- **`components/layout/AppShell.tsx`**: identidade e subtítulos PJ (`Caixa PJ`, `Resumo do Negócio`, `Extrato Caixa / Banco`, `Cartão PJ`).
- **`features/dashboard/DashboardPage.tsx`**: KPIs em linguagem de negócio (**Faturamento do Mês**, **Total Pago**, **Falta Pagar**, **Resultado do Mês**) e composição PJ.
- **`features/fixed-costs/FixedCostsPage.tsx`**: seletor + badge de forma de pagamento e placeholders PJ (`DAS-MEI, Aluguel comercial, Internet, Contador...`).
- **`features/bank/BankPage.tsx`**: ações `+ Faturamento` / `+ Despesa`, seletor + badge de meio de pagamento e filtro rápido por meio (`PIX`, `Dinheiro`, `Boleto`, `Cartão`, `Transferência`).
- **`features/card/CardPage.tsx` e `features/settings/SettingsPage.tsx`**: textos e placeholders adaptados ao contexto PJ/MEI.

---

## Verificação

- **Automatizada:** `pnpm build && just check` (TS + Vite + `cargo check` + testes Rust incluindo migração e `payment_method`).
- **Manual (`just`):** validar categorias PJ, lançamento de faturamento via `PIX`, despesa via `Boleto`, filtro por meio de pagamento e cálculo no Dashboard.
