# Plano de Implementação — App de Controle Financeiro

## 1. Objetivo e Escopo

Aplicativo **desktop** simples, local e fácil de manter para controle financeiro pessoal, com visual **neo-brutalista** e cores personalizáveis.

**Incluso na v1:**
- **Resumo mensal:** receitas, total pago, o que falta pagar e saldo previsto.
- **Custos fixos:** cadastro recorrente que gera cobranças pendentes todo mês automaticamente, preservando o histórico de meses anteriores.
- **Extrato bancário:** cadastro manual de entradas (receitas) e saídas, com controle de pago/pendente.
- **Cartão de crédito:** cadastro manual de compras à vista ou parceladas (`1/N .. N/N`), agrupamento automático por fatura mensal (dia de fechamento/vencimento) e marcação de fatura paga/pendente.
- **Personalização:** escolha livre de cor primária e secundária salva localmente.

**Fora de escopo na v1 (para manter simples):**
- Mobile, sincronização em nuvem, múltiplos bancos/cartões e importação CSV/OFX.

---

## 2. Stack

- **Desktop / Backend:** Tauri v2 + Rust (`rusqlite` com SQLite embutido via `bundled`).
- **Frontend:** React + TypeScript + Vite + Tailwind CSS (`pnpm`).
- **Banco de dados:** SQLite local em arquivo único (`finance.db` no diretório de dados do app).
- **Automação (`justfile`):** apenas receitas essenciais:
  - `default: run` (`just` abre o app em modo dev)
  - `run` (`pnpm tauri dev`)
  - `build` (`pnpm tauri build`)
  - `check` (checagem TypeScript + `cargo check` + `cargo test`)

> Ambiente já verificado: Rust `1.98`, Node `22`, `pnpm`, `just`, `sqlite3`, `webkit2gtk-4.1`, `gtk+-3.0` e `librsvg-2.0` já instalados.

---

## 3. Modelo de Dados (SQLite)

Todos os valores monetários são armazenados em **centavos (`INTEGER`)** para evitar erros de arredondamento. Meses usam formato `YYYY-MM` e datas `YYYY-MM-DD`.

```sql
-- Configurações do app (cores, fechamento/vencimento do cartão)
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Categorias simples (pré-populadas na primeira execução)
CREATE TABLE categories (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense'))
);

-- Modelos de custos fixos recorrentes
CREATE TABLE fixed_costs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL,
  due_day       INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  start_month   TEXT NOT NULL
);

-- Ocorrências mensais dos custos fixos (garante histórico imutável)
CREATE TABLE fixed_cost_entries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  fixed_cost_id INTEGER NOT NULL REFERENCES fixed_costs(id) ON DELETE CASCADE,
  month         TEXT NOT NULL,
  title         TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL,
  due_day       INTEGER NOT NULL,
  paid          INTEGER NOT NULL DEFAULT 0,
  paid_at       TEXT,
  UNIQUE(fixed_cost_id, month)
);

-- Extrato bancário (receitas e despesas manuais)
CREATE TABLE bank_transactions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kind         TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  title        TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  date         TEXT NOT NULL,
  month        TEXT NOT NULL,
  category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  paid         INTEGER NOT NULL DEFAULT 1,
  notes        TEXT
);

-- Lançamentos do cartão de crédito (à vista ou parcelas)
CREATE TABLE card_transactions (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  title                TEXT NOT NULL,
  amount_cents         INTEGER NOT NULL,
  purchase_date        TEXT NOT NULL,
  billing_month        TEXT NOT NULL,
  installment_number   INTEGER NOT NULL DEFAULT 1,
  installment_total    INTEGER NOT NULL DEFAULT 1,
  installment_group_id TEXT,
  category_id          INTEGER REFERENCES categories(id) ON DELETE SET NULL
);

-- Status de pagamento da fatura mensal do cartão
CREATE TABLE card_statements (
  month   TEXT PRIMARY KEY,
  paid    INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT
);
```

### Regras de Negócio Principais

1. **Geração de custos fixos por mês:** ao consultar um mês `YYYY-MM`, o backend garante (`INSERT OR IGNORE`) uma entrada em `fixed_cost_entries` para cada `fixed_costs` ativo com `start_month <= month`. Alterar/desativar um custo fixo no futuro não altera meses anteriores já fechados.
2. **Cálculo da fatura e parcelas do cartão:**
   - Se o dia da compra for **maior ou igual** ao `card_closing_day`, a 1ª parcela entra no mês seguinte; caso contrário, entra no mês da compra.
   - Compras em `N` parcelas geram `N` registros em `card_transactions` com o mesmo `installment_group_id`, um por mês subsequente (`1/N` até `N/N`).
   - Excluir um lançamento parcelado oferece opção de excluir apenas aquela parcela ou toda a compra (`installment_group_id`).
3. **Sem dupla contagem no resumo mensal:**
   - **Receitas:** soma de `bank_transactions` (`kind = 'income'`).
   - **Total Pago:** custos fixos pagos + despesas do banco pagas + total da fatura do cartão (se `card_statements.paid = 1`).
   - **Falta Pagar:** custos fixos pendentes + despesas do banco pendentes + total da fatura do cartão (se `card_statements.paid = 0`).
   - **Saldo do Mês:** Receitas − (Total Pago + Falta Pagar).

---

## 4. Estrutura de Pastas

```text
Finance/
├── justfile
├── package.json
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs
│       ├── lib.rs                # Registro do DB e comandos Tauri
│       ├── db.rs                 # Conexão SQLite + schema + seed inicial
│       ├── models.rs             # Structs Serialize/Deserialize compartilhadas
│       └── commands/
│           ├── mod.rs
│           ├── dashboard.rs      # Resumo mensal consolidado
│           ├── fixed_costs.rs    # CRUD de fixos + geração mensal + toggle pago
│           ├── bank.rs           # CRUD extrato bancário + toggle pago
│           ├── card.rs           # CRUD cartão + parcelas + pagar fatura
│           └── settings.rs       # Cores, categorias e datas do cartão
└── src/
    ├── main.tsx
    ├── App.tsx                   # Shell: sidebar, seletor de mês e roteamento simples
    ├── index.css                 # Tokens neo-brutalistas e variáveis de cor
    ├── lib/
    │   ├── api.ts                # Chamadas tipadas ao invoke() do Tauri
    │   ├── format.ts             # Centavos <-> BRL, formatação de datas/meses
    │   └── theme.ts              # Aplica --color-primary e --color-secondary no DOM
    ├── components/
    │   ├── ui/                   # Componentes reutilizáveis neo-brutalistas
    │   │   ├── Button.tsx
    │   │   ├── Card.tsx
    │   │   ├── Badge.tsx
    │   │   ├── Input.tsx
    │   │   ├── Select.tsx
    │   │   ├── Modal.tsx
    │   │   ├── Table.tsx
    │   │   ├── StatCard.tsx
    │   │   └── MonthPicker.tsx
    │   └── layout/
    │       └── AppShell.tsx      # Navegação lateral + header do mês ativo
    └── features/
        ├── dashboard/            # Visão geral do mês (pago, falta pagar, saldo)
        ├── fixed-costs/          # Lista do mês + cadastro de fixos recorrentes
        ├── bank/                 # Extrato bancário (entradas e saídas)
        ├── card/                 # Extrato do cartão, parcelas e status da fatura
        └── settings/             # Cores primária/secundária, cartão e categorias
```

---

## 5. Design System Neo-brutalista e Cores Personalizáveis

- **Visual base:** fundo claro (`#F8F7F2`), superfícies brancas (`#FFFFFF`), bordas pretas grossas (`2px` / `3px solid #111111`), sombras sólidas sem blur (`4px 4px 0px #111111`), feedback tátil nos botões (deslocamento no `:active`), números monetários em fonte monoespaçada/tabular (`tabular-nums`).
- **Tokens personalizáveis em `index.css`:**
  - `--color-primary` (padrão ex: `#FFE500` amarelo vibrante) — botões principais, item ativo na navegação, destaques.
  - `--color-secondary` (padrão ex: `#FF6B6B` ou `#A3E635`) — acentos secundários, tags e badges.
  - Cores semânticas fixas de alto contraste para leitura financeira rápida (pago = verde, pendente = laranja/amarelo, saída = vermelho).
- **Persistência:** ao alterar na aba **Configurações**, as cores atualizam em tempo real via `document.documentElement.style.setProperty(...)` e são salvas na tabela `settings` do SQLite (com presets prontos + botão restaurar padrão).

---

## 6. Fases de Implementação

1. **Setup base:** inicializar projeto Tauri v2 + React + TypeScript + Tailwind CSS com `pnpm`, configurar `justfile` (`default: run`, `run`, `build`, `check`) e validar que `just` abre a janela.
2. **Backend Rust + SQLite:** implementar `db.rs` (migrations + seed de categorias/configurações), `models.rs`, todos os comandos Tauri e testes unitários da lógica financeira (parcelas, virada de fechamento, geração mensal de custos fixos e cálculos do resumo).
3. **UI Base Neo-brutalista:** configurar `index.css`, `theme.ts`, `format.ts`, `api.ts` e construir os componentes reutilizáveis em `src/components/ui/` + `AppShell`.
4. **Telas Funcionais:** implementar Dashboard, Custos Fixos, Extrato Banco, Cartão de Crédito e Configurações (com seletor de cores ao vivo).
5. **Verificação Final:** rodar `just check`, testar todos os fluxos na interface rodando via `just` e corrigir eventuais ajustes visuais ou de usabilidade.

---

## 7. Verificação

- **Automatizada:**
  - `just check` → `pnpm tsc --noEmit`, `cargo check` e `cargo test` (testes cobrindo geração idempotente de custos fixos por mês, cálculo de mês da fatura antes/depois do fechamento, geração de parcelas `1/N..N/N`, e resumo mensal sem dupla contagem).
- **Manual (executando `just`):**
  - Cadastrar 1 receita no banco, 2 custos fixos e 1 compra parcelada em 3x no cartão.
  - Conferir no Dashboard os totais de **Receitas**, **Pago**, **Falta Pagar** e **Saldo**.
  - Marcar 1 custo fixo como pago e a fatura como paga → confirmar atualização imediata dos totais.
  - Navegar para o próximo mês → confirmar replicação dos custos fixos como pendentes e presença da parcela `2/3`.
  - Alterar cor primária e secundária em Configurações, fechar e reabrir o app → confirmar que o tema e todos os dados persistiram.
