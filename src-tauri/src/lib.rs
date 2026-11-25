mod commands;
mod db;
mod models;

use std::fs;
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::Manager;

use crate::commands::{activity, bank, card, dashboard, fixed_costs, settings, updates};
use crate::db::{init_connection, Database};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Não foi possível obter diretório de dados: {e}"))?;
            fs::create_dir_all(&data_dir)
                .map_err(|e| format!("Não foi possível criar diretório de dados: {e}"))?;
            let db_path = data_dir.join("finance.db");
            let conn = Connection::open(db_path)
                .map_err(|e| format!("Não foi possível abrir SQLite: {e}"))?;
            init_connection(&conn)?;
            app.manage(Database(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            settings::get_settings,
            settings::update_settings,
            settings::list_categories,
            settings::create_category,
            settings::delete_category,
            fixed_costs::list_fixed_cost_entries,
            fixed_costs::list_fixed_costs,
            fixed_costs::create_fixed_cost,
            fixed_costs::update_fixed_cost,
            fixed_costs::toggle_fixed_cost_active,
            fixed_costs::delete_fixed_cost,
            fixed_costs::toggle_fixed_cost_entry_paid,
            fixed_costs::update_fixed_cost_entry_amount,
            bank::list_bank_transactions,
            bank::create_bank_transaction,
            bank::update_bank_transaction,
            bank::toggle_bank_transaction_paid,
            bank::delete_bank_transaction,
            card::get_card_statement,
            card::create_card_purchase,
            card::delete_card_transaction,
            card::toggle_card_statement_paid,
            dashboard::get_dashboard_summary,
            activity::list_activity_logs,
            activity::clear_activity_logs,
            updates::get_app_version,
            updates::open_release_url,
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao executar aplicativo Finance");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::card::{
        create_card_purchase_conn, get_statement_conn, toggle_card_statement_paid_conn,
    };
    use crate::commands::dashboard::compute_dashboard_conn;
    use crate::commands::fixed_costs::{create_fixed_cost_conn, list_entries_conn};
    use crate::db::{add_months, compute_billing_month};
    use rusqlite::params;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory sqlite");
        init_connection(&conn).expect("init schema");
        conn
    }

    #[test]
    fn billing_month_respects_closing_day_and_year_rollover() {
        assert_eq!(compute_billing_month("2026-03-10", 25).unwrap(), "2026-03");
        assert_eq!(compute_billing_month("2026-03-25", 25).unwrap(), "2026-04");
        assert_eq!(compute_billing_month("2026-12-28", 25).unwrap(), "2027-01");
        assert_eq!(add_months("2026-11", 2).unwrap(), "2027-01");
        assert_eq!(add_months("2026-01", -1).unwrap(), "2025-12");
    }

    #[test]
    fn fixed_costs_generate_idempotently_and_preserve_history() {
        let conn = test_conn();
        let fc_id =
            create_fixed_cost_conn(&conn, "DAS-MEI", 7_590, 20, None, "Boleto", "2026-01")
                .unwrap();

        let jan = list_entries_conn(&conn, "2026-01").unwrap();
        assert_eq!(jan.len(), 1);
        assert!(!jan[0].paid);
        assert_eq!(jan[0].payment_method, "Boleto");

        // Marca janeiro como pago
        conn.execute(
            "UPDATE fixed_cost_entries SET paid = 1 WHERE id = ?1",
            params![jan[0].id],
        )
        .unwrap();

        // Fevereiro gera pendente automaticamente herdando forma de pagamento
        let feb = list_entries_conn(&conn, "2026-02").unwrap();
        assert_eq!(feb.len(), 1);
        assert!(!feb[0].paid);
        assert_eq!(feb[0].payment_method, "Boleto");

        // Desativar não apaga janeiro nem fevereiro, mas impede março
        conn.execute("UPDATE fixed_costs SET active = 0 WHERE id = ?1", params![fc_id])
            .unwrap();
        let mar = list_entries_conn(&conn, "2026-03").unwrap();
        assert_eq!(mar.len(), 0);
        let jan_again = list_entries_conn(&conn, "2026-01").unwrap();
        assert_eq!(jan_again.len(), 1);
        assert!(jan_again[0].paid);
    }

    #[test]
    fn card_installments_split_cents_without_losing_remainder() {
        let conn = test_conn();
        let first_month = create_card_purchase_conn(
            &conn,
            "Notebook PJ",
            10_000, // R$ 100,00 em 3x => 33,34 + 33,33 + 33,33
            "2026-05-10",
            3,
            None,
            None,
        )
        .unwrap();
        assert_eq!(first_month, "2026-05");

        let may = get_statement_conn(&conn, "2026-05").unwrap();
        let jun = get_statement_conn(&conn, "2026-06").unwrap();
        let jul = get_statement_conn(&conn, "2026-07").unwrap();

        assert_eq!(may.total_cents, 3334);
        assert_eq!(jun.total_cents, 3333);
        assert_eq!(jul.total_cents, 3333);
        assert_eq!(may.transactions[0].installment_number, 1);
        assert_eq!(jul.transactions[0].installment_number, 3);
        assert_eq!(may.total_cents + jun.total_cents + jul.total_cents, 10_000);
    }

    #[test]
    fn dashboard_summary_has_no_double_counting() {
        let conn = test_conn();

        // Faturamento de R$ 5.000,00 via PIX
        conn.execute(
            "INSERT INTO bank_transactions (kind, title, amount_cents, date, month, payment_method, paid) VALUES ('income', 'Venda Projeto', 500000, '2026-05-05', '2026-05', 'PIX', 1)",
            [],
        )
        .unwrap();

        // Despesa bancária paga de R$ 200,00 e pendente de R$ 100,00
        conn.execute(
            "INSERT INTO bank_transactions (kind, title, amount_cents, date, month, payment_method, paid) VALUES ('expense', 'Fornecedor', 20000, '2026-05-06', '2026-05', 'PIX', 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO bank_transactions (kind, title, amount_cents, date, month, payment_method, paid) VALUES ('expense', 'Contador', 10000, '2026-05-20', '2026-05', 'Boleto', 0)",
            [],
        )
        .unwrap();

        // Custo fixo pendente de R$ 1.200,00
        create_fixed_cost_conn(&conn, "Aluguel Sala", 120_000, 10, None, "Boleto", "2026-05")
            .unwrap();

        // Compra no cartão de R$ 300,00 na fatura de maio
        create_card_purchase_conn(&conn, "Anúncios", 30_000, "2026-05-02", 1, None, None).unwrap();

        let summary = compute_dashboard_conn(&conn, "2026-05").unwrap();
        assert_eq!(summary.income_cents, 500_000);
        assert_eq!(summary.total_paid_cents, 20_000);
        assert_eq!(summary.total_pending_cents, 120_000 + 10_000 + 30_000);
        assert_eq!(summary.balance_cents, 500_000 - 180_000);
        assert_eq!(summary.pending_items.len(), 3);

        // Marca fatura do cartão como paga
        let paid = toggle_card_statement_paid_conn(&conn, "2026-05").unwrap();
        assert!(paid);
        let summary_after = compute_dashboard_conn(&conn, "2026-05").unwrap();
        assert_eq!(summary_after.total_paid_cents, 20_000 + 30_000);
        assert_eq!(summary_after.total_pending_cents, 120_000 + 10_000);
        assert_eq!(summary_after.balance_cents, 500_000 - 180_000);
        assert_eq!(summary_after.pending_items.len(), 2);
    }

    #[test]
    fn migrates_legacy_db_adding_payment_method_and_pj_categories() {
        let conn = Connection::open_in_memory().unwrap();
        // Simula banco antigo (sem coluna payment_method e com categorias pessoais)
        conn.execute_batch(
            r#"
            CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, kind TEXT NOT NULL);
            CREATE TABLE fixed_costs (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, amount_cents INTEGER NOT NULL, due_day INTEGER NOT NULL, category_id INTEGER, active INTEGER NOT NULL DEFAULT 1, start_month TEXT NOT NULL);
            CREATE TABLE fixed_cost_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, fixed_cost_id INTEGER NOT NULL, month TEXT NOT NULL, title TEXT NOT NULL, amount_cents INTEGER NOT NULL, due_day INTEGER NOT NULL, paid INTEGER NOT NULL DEFAULT 0, paid_at TEXT, UNIQUE(fixed_cost_id, month));
            CREATE TABLE bank_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, title TEXT NOT NULL, amount_cents INTEGER NOT NULL, date TEXT NOT NULL, month TEXT NOT NULL, category_id INTEGER, paid INTEGER NOT NULL DEFAULT 1, notes TEXT);
            CREATE TABLE card_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, amount_cents INTEGER NOT NULL, purchase_date TEXT NOT NULL, billing_month TEXT NOT NULL, installment_number INTEGER NOT NULL DEFAULT 1, installment_total INTEGER NOT NULL DEFAULT 1, installment_group_id TEXT, category_id INTEGER);
            CREATE TABLE card_statements (month TEXT PRIMARY KEY, paid INTEGER NOT NULL DEFAULT 0, paid_at TEXT);
            INSERT INTO categories (name, kind) VALUES ('Salário', 'income'), ('Lazer', 'expense');
            INSERT INTO bank_transactions (kind, title, amount_cents, date, month, category_id, paid)
              VALUES ('income', 'Entrada Antiga', 10000, '2026-01-10', '2026-01', 1, 1);
            "#,
        )
        .unwrap();

        // Migração deve ser idempotente
        init_connection(&conn).unwrap();
        init_connection(&conn).unwrap();

        let method: String = conn
            .query_row("SELECT payment_method FROM bank_transactions WHERE id = 1", [], |r| r.get(0))
            .unwrap();
        assert_eq!(method, "PIX");

        // Categoria 'Salário' tinha lançamento vinculado -> preservada; 'Lazer' sem uso -> removida
        let salario_exists: i64 = conn
            .query_row("SELECT COUNT(*) FROM categories WHERE name = 'Salário'", [], |r| r.get(0))
            .unwrap();
        let lazer_exists: i64 = conn
            .query_row("SELECT COUNT(*) FROM categories WHERE name = 'Lazer'", [], |r| r.get(0))
            .unwrap();
        let das_exists: i64 = conn
            .query_row("SELECT COUNT(*) FROM categories WHERE name = 'DAS / Impostos'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(salario_exists, 1);
        assert_eq!(lazer_exists, 0);
        assert_eq!(das_exists, 1);
    }

    #[test]
    fn validates_payment_methods() {
        assert_eq!(crate::db::validate_payment_method("PIX").unwrap(), "PIX");
        assert_eq!(crate::db::validate_payment_method("Boleto").unwrap(), "Boleto");
        assert!(crate::db::validate_payment_method("Cheque").is_err());
    }

    #[test]
    fn persists_and_validates_font_scale_setting() {
        let conn = test_conn();
        let initial = crate::commands::settings::load_settings_conn(&conn);
        assert_eq!(initial.font_scale, 100);

        let updated = crate::commands::settings::update_settings_conn(
            &conn,
            "#FFE500",
            "#FF6B6B",
            25,
            5,
            115,
            "Minha Loja",
            "data:image/png;base64,iVBORw0KGgo=",
        )
        .unwrap();
        assert_eq!(updated.font_scale, 115);
        assert_eq!(updated.company_name, "Minha Loja");
        assert_eq!(updated.company_logo, "data:image/png;base64,iVBORw0KGgo=");

        assert!(crate::commands::settings::update_settings_conn(
            &conn, "#FFE500", "#FF6B6B", 25, 5, 50, "Finance", "",
        )
        .is_err());

        assert!(crate::commands::settings::update_settings_conn(
            &conn, "#FFE500", "#FF6B6B", 25, 5, 100, "Finance", "not-a-data-url",
        )
        .is_err());

        let logs = crate::commands::activity::list_activity_logs_conn(&conn, None, 20).unwrap();
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].area, "settings");
        assert!(logs[0].summary.contains("115%"));
    }

    #[test]
    fn logs_user_actions_across_areas() {
        let conn = test_conn();
        create_fixed_cost_conn(&conn, "DAS-MEI", 7_590, 20, None, "Boleto", "2026-05").unwrap();
        create_card_purchase_conn(&conn, "Anúncios", 30_000, "2026-05-02", 1, None, None).unwrap();

        let all = crate::commands::activity::list_activity_logs_conn(&conn, None, 20).unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].area, "card");
        assert_eq!(all[1].area, "fixed");

        let only_fixed =
            crate::commands::activity::list_activity_logs_conn(&conn, Some("fixed"), 20).unwrap();
        assert_eq!(only_fixed.len(), 1);
        assert!(only_fixed[0].summary.contains("DAS-MEI"));
    }

    #[test]
    fn validates_release_urls() {
        assert!(crate::commands::updates::validate_release_url(
            "https://github.com/dglds/gestor/releases/tag/v1.1"
        )
        .is_ok());
        assert!(crate::commands::updates::validate_release_url(
            "https://github.com/outro/repo/releases"
        )
        .is_err());
        assert!(crate::commands::updates::validate_release_url(
            "https://github.com/dglds/gestor/releases/tag/v1.1 && whoami"
        )
        .is_err());
    }
}
