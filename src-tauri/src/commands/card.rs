use rusqlite::{params, Connection};
use tauri::State;
use uuid::Uuid;

use crate::commands::settings::load_settings_conn;
use crate::db::{
    add_months, compute_billing_month, format_brl_cents, log_activity, today_iso, validate_ym,
    validate_ymd, Database,
};
use crate::models::{CardStatementView, CardTransaction};

pub fn get_statement_conn(conn: &Connection, month: &str) -> Result<CardStatementView, String> {
    validate_ym(month)?;
    let settings = load_settings_conn(conn);

    let mut stmt = conn
        .prepare(
            r#"
            SELECT t.id, t.title, t.amount_cents, t.purchase_date, t.billing_month,
                   t.installment_number, t.installment_total, t.installment_group_id,
                   t.category_id, c.name
            FROM card_transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            WHERE t.billing_month = ?1
            ORDER BY t.purchase_date DESC, t.id DESC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![month], |row| {
            Ok(CardTransaction {
                id: row.get(0)?,
                title: row.get(1)?,
                amount_cents: row.get(2)?,
                purchase_date: row.get(3)?,
                billing_month: row.get(4)?,
                installment_number: row.get(5)?,
                installment_total: row.get(6)?,
                installment_group_id: row.get(7)?,
                category_id: row.get(8)?,
                category_name: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let transactions = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let total_cents: i64 = transactions.iter().map(|t| t.amount_cents).sum();

    let (paid, paid_at) = conn
        .query_row(
            "SELECT paid, paid_at FROM card_statements WHERE month = ?1",
            params![month],
            |r| Ok((r.get::<_, i64>(0)? != 0, r.get::<_, Option<String>>(1)?)),
        )
        .unwrap_or((false, None));

    Ok(CardStatementView {
        month: month.to_string(),
        total_cents,
        paid,
        paid_at,
        closing_day: settings.card_closing_day,
        due_day: settings.card_due_day,
        transactions,
    })
}

pub fn create_card_purchase_conn(
    conn: &Connection,
    title: &str,
    total_amount_cents: i64,
    purchase_date: &str,
    installments: i64,
    category_id: Option<i64>,
    billing_month_override: Option<&str>,
) -> Result<String, String> {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return Err("Descrição da compra é obrigatória".to_string());
    }
    if total_amount_cents <= 0 {
        return Err("Valor deve ser maior que zero".to_string());
    }
    if !(1..=60).contains(&installments) {
        return Err("Número de parcelas deve estar entre 1 e 60".to_string());
    }
    validate_ymd(purchase_date)?;

    let settings = load_settings_conn(conn);
    let first_billing_month = match billing_month_override {
        Some(m) if !m.trim().is_empty() => {
            validate_ym(m.trim())?;
            m.trim().to_string()
        }
        _ => compute_billing_month(purchase_date, settings.card_closing_day)?,
    };

    let group_id = if installments > 1 {
        Some(Uuid::new_v4().to_string())
    } else {
        None
    };

    let base_cents = total_amount_cents / installments;
    let remainder = total_amount_cents % installments;

    for i in 0..installments {
        let billing_month = add_months(&first_billing_month, i as i32)?;
        let amount = if i == 0 {
            base_cents + remainder
        } else {
            base_cents
        };
        conn.execute(
            r#"
            INSERT INTO card_transactions
                (title, amount_cents, purchase_date, billing_month,
                 installment_number, installment_total, installment_group_id, category_id)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#,
            params![
                trimmed,
                amount,
                purchase_date,
                billing_month,
                i + 1,
                installments,
                group_id,
                category_id
            ],
        )
        .map_err(|e| format!("Falha ao registrar compra no cartão: {e}"))?;
    }

    let detail = if installments > 1 {
        format!("{installments}x total {}", format_brl_cents(total_amount_cents))
    } else {
        format!("{} à vista", format_brl_cents(total_amount_cents))
    };
    log_activity(
        conn,
        "card",
        "create",
        &format!("Nova compra no cartão: {trimmed} ({detail})"),
    );

    Ok(first_billing_month)
}

#[tauri::command]
pub fn get_card_statement(
    db: State<'_, Database>,
    month: String,
) -> Result<CardStatementView, String> {
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    get_statement_conn(&conn, &month)
}

#[tauri::command]
pub fn create_card_purchase(
    db: State<'_, Database>,
    title: String,
    total_amount_cents: i64,
    purchase_date: String,
    installments: i64,
    category_id: Option<i64>,
    billing_month_override: Option<String>,
) -> Result<String, String> {
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    create_card_purchase_conn(
        &conn,
        &title,
        total_amount_cents,
        &purchase_date,
        installments,
        category_id,
        billing_month_override.as_deref(),
    )
}

#[tauri::command]
pub fn delete_card_transaction(
    db: State<'_, Database>,
    id: i64,
    delete_all_installments: bool,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    let info: Option<(String, Option<String>, i64)> = conn
        .query_row(
            "SELECT title, installment_group_id, installment_total FROM card_transactions WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .ok();
    if delete_all_installments {
        if let Some((title, Some(gid), total)) = info {
            conn.execute(
                "DELETE FROM card_transactions WHERE installment_group_id = ?1",
                params![gid],
            )
            .map_err(|e| format!("Falha ao excluir parcelas: {e}"))?;
            log_activity(
                &conn,
                "card",
                "delete",
                &format!("Excluiu compra parcelada: {title} ({total} parcelas)"),
            );
            return Ok(());
        }
    }
    conn.execute("DELETE FROM card_transactions WHERE id = ?1", params![id])
        .map_err(|e| format!("Falha ao excluir compra do cartão: {e}"))?;
    if let Some((title, _, _)) = info {
        log_activity(&conn, "card", "delete", &format!("Excluiu compra do cartão: {title}"));
    }
    Ok(())
}

pub fn toggle_card_statement_paid_conn(conn: &Connection, month: &str) -> Result<bool, String> {
    validate_ym(month)?;
    let current = conn
        .query_row(
            "SELECT paid FROM card_statements WHERE month = ?1",
            params![month],
            |r| r.get::<_, i64>(0),
        )
        .unwrap_or(0);
    let next = if current == 0 { 1 } else { 0 };
    let paid_at = if next == 1 { Some(today_iso()) } else { None };
    conn.execute(
        r#"
        INSERT INTO card_statements (month, paid, paid_at)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(month) DO UPDATE SET paid = excluded.paid, paid_at = excluded.paid_at
        "#,
        params![month, next, paid_at],
    )
    .map_err(|e| format!("Falha ao atualizar pagamento da fatura: {e}"))?;
    if next == 1 {
        log_activity(conn, "card", "pay", &format!("Marcou fatura do cartão como paga ({month})"));
    } else {
        log_activity(conn, "card", "unpay", &format!("Reabriu fatura do cartão ({month})"));
    }
    Ok(next != 0)
}

#[tauri::command]
pub fn toggle_card_statement_paid(
    db: State<'_, Database>,
    month: String,
) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    toggle_card_statement_paid_conn(&conn, &month)
}
