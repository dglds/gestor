use rusqlite::{params, Connection};
use tauri::State;

use crate::commands::card::get_statement_conn;
use crate::commands::fixed_costs::list_entries_conn;
use crate::db::{validate_ym, Database};
use crate::models::{DashboardSummary, PendingItem};

pub fn compute_dashboard_conn(conn: &Connection, month: &str) -> Result<DashboardSummary, String> {
    validate_ym(month)?;

    // 1. Custos fixos (garante geração mensal)
    let fixed_entries = list_entries_conn(conn, month)?;
    let mut fixed_paid_cents = 0i64;
    let mut fixed_pending_cents = 0i64;
    let mut pending_items: Vec<PendingItem> = Vec::new();

    for entry in &fixed_entries {
        if entry.paid {
            fixed_paid_cents += entry.amount_cents;
        } else {
            fixed_pending_cents += entry.amount_cents;
            pending_items.push(PendingItem {
                source: "fixed".to_string(),
                id: entry.id,
                title: entry.title.clone(),
                amount_cents: entry.amount_cents,
                due_info: format!("Vence dia {:02}", entry.due_day),
            });
        }
    }

    // 2. Extrato bancário (receitas e despesas)
    let mut stmt = conn
        .prepare(
            "SELECT id, kind, title, amount_cents, date, paid FROM bank_transactions WHERE month = ?1 ORDER BY date ASC, id ASC",
        )
        .map_err(|e| e.to_string())?;
    let bank_rows = stmt
        .query_map(params![month], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, i64>(3)?,
                r.get::<_, String>(4)?,
                r.get::<_, i64>(5)? != 0,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut income_cents = 0i64;
    let mut income_received_cents = 0i64;
    let mut bank_expense_paid_cents = 0i64;
    let mut bank_expense_pending_cents = 0i64;

    for row in bank_rows {
        let (id, kind, title, amount_cents, date, paid) = row.map_err(|e| e.to_string())?;
        if kind == "income" {
            income_cents += amount_cents;
            if paid {
                income_received_cents += amount_cents;
            }
        } else if paid {
            bank_expense_paid_cents += amount_cents;
        } else {
            bank_expense_pending_cents += amount_cents;
            pending_items.push(PendingItem {
                source: "bank".to_string(),
                id,
                title,
                amount_cents,
                due_info: format!("Banco · {date}"),
            });
        }
    }

    // 3. Fatura do cartão de crédito (sem dupla contagem com banco)
    let card_statement = get_statement_conn(conn, month)?;
    let card_total_cents = card_statement.total_cents;
    let card_paid = card_statement.paid;

    let card_paid_cents = if card_paid { card_total_cents } else { 0 };
    let card_pending_cents = if card_paid { 0 } else { card_total_cents };

    if !card_paid && card_total_cents > 0 {
        pending_items.push(PendingItem {
            source: "card".to_string(),
            id: 0,
            title: format!("Fatura Cartão ({month})"),
            amount_cents: card_total_cents,
            due_info: format!("Vence dia {:02}", card_statement.due_day),
        });
    }

    let total_paid_cents = fixed_paid_cents + bank_expense_paid_cents + card_paid_cents;
    let total_pending_cents = fixed_pending_cents + bank_expense_pending_cents + card_pending_cents;
    let balance_cents = income_cents - (total_paid_cents + total_pending_cents);

    Ok(DashboardSummary {
        month: month.to_string(),
        income_cents,
        income_received_cents,
        fixed_paid_cents,
        fixed_pending_cents,
        bank_expense_paid_cents,
        bank_expense_pending_cents,
        card_total_cents,
        card_paid,
        total_paid_cents,
        total_pending_cents,
        balance_cents,
        pending_items,
    })
}

#[tauri::command]
pub fn get_dashboard_summary(
    db: State<'_, Database>,
    month: String,
) -> Result<DashboardSummary, String> {
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    compute_dashboard_conn(&conn, &month)
}
