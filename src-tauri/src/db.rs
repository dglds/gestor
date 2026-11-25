use rusqlite::{params, Connection};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct Database(pub Mutex<Connection>);

pub const DEFAULT_PRIMARY_COLOR: &str = "#FFE500";
pub const DEFAULT_SECONDARY_COLOR: &str = "#FF6B6B";
pub const DEFAULT_CARD_CLOSING_DAY: i64 = 25;
pub const DEFAULT_CARD_DUE_DAY: i64 = 5;
pub const DEFAULT_FONT_SCALE: i64 = 100;

pub const PAYMENT_METHODS: &[&str] = &["PIX", "Dinheiro", "Boleto", "Cartão", "Transferência"];

const SCHEMA_SQL: &str = r#"
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense'))
);

CREATE TABLE IF NOT EXISTS fixed_costs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title          TEXT NOT NULL,
  amount_cents   INTEGER NOT NULL,
  due_day        INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL DEFAULT 'Boleto',
  active         INTEGER NOT NULL DEFAULT 1,
  start_month    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fixed_cost_entries (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  fixed_cost_id  INTEGER NOT NULL REFERENCES fixed_costs(id) ON DELETE CASCADE,
  month          TEXT NOT NULL,
  title          TEXT NOT NULL,
  amount_cents   INTEGER NOT NULL,
  due_day        INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Boleto',
  paid           INTEGER NOT NULL DEFAULT 0,
  paid_at        TEXT,
  UNIQUE(fixed_cost_id, month)
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  kind           TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  title          TEXT NOT NULL,
  amount_cents   INTEGER NOT NULL,
  date           TEXT NOT NULL,
  month          TEXT NOT NULL,
  category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL DEFAULT 'PIX',
  paid           INTEGER NOT NULL DEFAULT 1,
  notes          TEXT
);

CREATE TABLE IF NOT EXISTS card_transactions (
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

CREATE TABLE IF NOT EXISTS card_statements (
  month   TEXT PRIMARY KEY,
  paid    INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  area       TEXT NOT NULL,
  action     TEXT NOT NULL,
  summary    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fixed_entries_month ON fixed_cost_entries(month);
CREATE INDEX IF NOT EXISTS idx_bank_tx_month ON bank_transactions(month);
CREATE INDEX IF NOT EXISTS idx_card_tx_billing ON card_transactions(billing_month);
CREATE INDEX IF NOT EXISTS idx_card_tx_group ON card_transactions(installment_group_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_area ON activity_logs(area, id DESC);
"#;

fn ensure_column(conn: &Connection, table: &str, column: &str, col_def: &str) -> Result<(), String> {
    let pragma = format!("PRAGMA table_info({table})");
    let mut stmt = conn
        .prepare(&pragma)
        .map_err(|e| format!("Falha ao inspecionar tabela {table}: {e}"))?;
    let existing: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    if !existing.iter().any(|c| c == column) {
        let alter = format!("ALTER TABLE {table} ADD COLUMN {column} {col_def}");
        conn.execute(&alter, [])
            .map_err(|e| format!("Falha ao migrar coluna {table}.{column}: {e}"))?;
    }
    Ok(())
}

pub fn init_connection(conn: &Connection) -> Result<(), String> {
    conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")
        .map_err(|e| format!("Falha ao configurar SQLite: {e}"))?;
    conn.execute_batch(SCHEMA_SQL)
        .map_err(|e| format!("Falha ao criar tabelas: {e}"))?;

    // Migrações não-destrutivas para bancos criados antes da adaptação PJ/MEI
    ensure_column(conn, "fixed_costs", "payment_method", "TEXT NOT NULL DEFAULT 'Boleto'")?;
    ensure_column(
        conn,
        "fixed_cost_entries",
        "payment_method",
        "TEXT NOT NULL DEFAULT 'Boleto'",
    )?;
    ensure_column(
        conn,
        "bank_transactions",
        "payment_method",
        "TEXT NOT NULL DEFAULT 'PIX'",
    )?;

    let default_settings = [
        ("primary_color", DEFAULT_PRIMARY_COLOR.to_string()),
        ("secondary_color", DEFAULT_SECONDARY_COLOR.to_string()),
        ("card_closing_day", DEFAULT_CARD_CLOSING_DAY.to_string()),
        ("card_due_day", DEFAULT_CARD_DUE_DAY.to_string()),
        ("font_scale", DEFAULT_FONT_SCALE.to_string()),
        ("company_name", "Finance".to_string()),
        ("company_logo", String::new()),
    ];
    for (k, v) in default_settings {
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)",
            params![k, v],
        )
        .map_err(|e| format!("Falha ao inicializar configuração {k}: {e}"))?;
    }

    let pj_seeded = get_setting_string(conn, "categories_seeded_pj", "0") == "1";
    if !pj_seeded {
        // Remove categorias pessoais antigas apenas se não estiverem vinculadas a lançamentos
        let legacy_personal = [
            "Salário",
            "Freelance",
            "Outras Entradas",
            "Moradia",
            "Alimentação",
            "Transporte",
            "Saúde",
            "Assinaturas",
            "Lazer",
        ];
        for name in legacy_personal {
            conn.execute(
                r#"
                DELETE FROM categories
                WHERE name = ?1
                  AND NOT EXISTS (SELECT 1 FROM fixed_costs WHERE category_id = categories.id)
                  AND NOT EXISTS (SELECT 1 FROM bank_transactions WHERE category_id = categories.id)
                  AND NOT EXISTS (SELECT 1 FROM card_transactions WHERE category_id = categories.id)
                "#,
                params![name],
            )
            .map_err(|e| format!("Falha ao migrar categoria antiga {name}: {e}"))?;
        }

        let pj_categories = [
            ("Vendas / Serviços", "income"),
            ("Recebimentos a Prazo", "income"),
            ("Outras Receitas", "income"),
            ("DAS / Impostos", "expense"),
            ("Fornecedores / Estoque", "expense"),
            ("Pró-labore", "expense"),
            ("Aluguel / Espaço", "expense"),
            ("Ferramentas / Software", "expense"),
            ("Marketing / Anúncios", "expense"),
            ("Taxas / Tarifas", "expense"),
            ("Transporte / Entregas", "expense"),
            ("Outros", "expense"),
        ];
        for (name, kind) in pj_categories {
            conn.execute(
                "INSERT OR IGNORE INTO categories (name, kind) VALUES (?1, ?2)",
                params![name, kind],
            )
            .map_err(|e| format!("Falha ao inicializar categoria {name}: {e}"))?;
        }

        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('categories_seeded_pj', '1') ON CONFLICT(key) DO UPDATE SET value = '1'",
            [],
        )
        .map_err(|e| format!("Falha ao marcar seed PJ: {e}"))?;
    }

    Ok(())
}

pub fn validate_payment_method(method: &str) -> Result<String, String> {
    let trimmed = method.trim();
    if PAYMENT_METHODS.contains(&trimmed) {
        Ok(trimmed.to_string())
    } else {
        Err(format!(
            "Meio de pagamento inválido '{trimmed}'. Use: {}",
            PAYMENT_METHODS.join(", ")
        ))
    }
}

pub fn ensure_fixed_cost_entries(conn: &Connection, month: &str) -> Result<(), String> {
    validate_ym(month)?;
    conn.execute(
        r#"
        INSERT OR IGNORE INTO fixed_cost_entries
            (fixed_cost_id, month, title, amount_cents, due_day, payment_method, paid)
        SELECT id, ?1, title, amount_cents, due_day, payment_method, 0
        FROM fixed_costs
        WHERE active = 1 AND start_month <= ?1
        "#,
        params![month],
    )
    .map_err(|e| format!("Falha ao gerar custos fixos do mês: {e}"))?;
    Ok(())
}

pub fn parse_ym(ym: &str) -> Result<(i32, u32), String> {
    let parts: Vec<&str> = ym.split('-').collect();
    if parts.len() != 2 || parts[0].len() != 4 || parts[1].len() != 2 {
        return Err(format!("Mês inválido '{ym}', esperado YYYY-MM"));
    }
    let year: i32 = parts[0]
        .parse()
        .map_err(|_| format!("Ano inválido em '{ym}'"))?;
    let month: u32 = parts[1]
        .parse()
        .map_err(|_| format!("Mês inválido em '{ym}'"))?;
    if !(1..=12).contains(&month) {
        return Err(format!("Mês fora do intervalo 1..12 em '{ym}'"));
    }
    Ok((year, month))
}

pub fn validate_ym(ym: &str) -> Result<(), String> {
    parse_ym(ym).map(|_| ())
}

pub fn validate_ymd(date: &str) -> Result<(i32, u32, u32), String> {
    let parts: Vec<&str> = date.split('-').collect();
    if parts.len() != 3 || parts[0].len() != 4 || parts[1].len() != 2 || parts[2].len() != 2 {
        return Err(format!("Data inválida '{date}', esperado YYYY-MM-DD"));
    }
    let year: i32 = parts[0]
        .parse()
        .map_err(|_| format!("Ano inválido em '{date}'"))?;
    let month: u32 = parts[1]
        .parse()
        .map_err(|_| format!("Mês inválido em '{date}'"))?;
    let day: u32 = parts[2]
        .parse()
        .map_err(|_| format!("Dia inválido em '{date}'"))?;
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return Err(format!("Data fora do intervalo em '{date}'"));
    }
    Ok((year, month, day))
}

pub fn add_months(ym: &str, delta: i32) -> Result<String, String> {
    let (year, month) = parse_ym(ym)?;
    let total = year * 12 + (month as i32 - 1) + delta;
    let new_year = total.div_euclid(12);
    let new_month = total.rem_euclid(12) + 1;
    Ok(format!("{new_year:04}-{new_month:02}"))
}

pub fn compute_billing_month(purchase_date: &str, closing_day: i64) -> Result<String, String> {
    let (year, month, day) = validate_ymd(purchase_date)?;
    let base_ym = format!("{year:04}-{month:02}");
    if (day as i64) >= closing_day {
        add_months(&base_ym, 1)
    } else {
        Ok(base_ym)
    }
}

pub fn today_iso() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let z = secs.div_euclid(86_400) + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = y + if m <= 2 { 1 } else { 0 };
    format!("{year:04}-{m:02}-{d:02}")
}

pub fn get_setting_string(conn: &Connection, key: &str, default: &str) -> String {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    )
    .unwrap_or_else(|_| default.to_string())
}

pub fn get_setting_i64(conn: &Connection, key: &str, default: i64) -> i64 {
    get_setting_string(conn, key, &default.to_string())
        .parse::<i64>()
        .unwrap_or(default)
}

pub fn format_brl_cents(cents: i64) -> String {
    let sign = if cents < 0 { "-" } else { "" };
    let abs = cents.unsigned_abs();
    let reais = abs / 100;
    let centavos = abs % 100;
    let digits = reais.to_string();
    let mut grouped = String::with_capacity(digits.len() + digits.len() / 3);
    for (idx, ch) in digits.chars().rev().enumerate() {
        if idx > 0 && idx % 3 == 0 {
            grouped.push('.');
        }
        grouped.push(ch);
    }
    let formatted_reais: String = grouped.chars().rev().collect();
    format!("{sign}R$ {formatted_reais},{centavos:02}")
}

pub fn log_activity(conn: &Connection, area: &str, action: &str, summary: &str) {
    let _ = conn.execute(
        "INSERT INTO activity_logs (area, action, summary) VALUES (?1, ?2, ?3)",
        params![area, action, summary],
    );
}
