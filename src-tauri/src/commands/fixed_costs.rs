use rusqlite::{params, Connection};
use tauri::State;

use crate::db::{
    ensure_fixed_cost_entries, format_brl_cents, log_activity, today_iso, validate_payment_method,
    validate_ym, Database,
};
use crate::models::{FixedCost, FixedCostEntry};

pub fn list_entries_conn(conn: &Connection, month: &str) -> Result<Vec<FixedCostEntry>, String> {
    ensure_fixed_cost_entries(conn, month)?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT e.id, e.fixed_cost_id, e.month, e.title, e.amount_cents, e.due_day,
                   fc.category_id, c.name, e.payment_method, e.paid, e.paid_at
            FROM fixed_cost_entries e
            JOIN fixed_costs fc ON fc.id = e.fixed_cost_id
            LEFT JOIN categories c ON c.id = fc.category_id
            WHERE e.month = ?1
            ORDER BY e.paid ASC, e.due_day ASC, e.title ASC
            "#,
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![month], |row| {
            Ok(FixedCostEntry {
                id: row.get(0)?,
                fixed_cost_id: row.get(1)?,
                month: row.get(2)?,
                title: row.get(3)?,
                amount_cents: row.get(4)?,
                due_day: row.get(5)?,
                category_id: row.get(6)?,
                category_name: row.get(7)?,
                payment_method: row.get(8)?,
                paid: row.get::<_, i64>(9)? != 0,
                paid_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_fixed_cost_entries(
    db: State<'_, Database>,
    month: String,
) -> Result<Vec<FixedCostEntry>, String> {
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    list_entries_conn(&conn, &month)
}

#[tauri::command]
pub fn list_fixed_costs(db: State<'_, Database>) -> Result<Vec<FixedCost>, String> {
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT fc.id, fc.title, fc.amount_cents, fc.due_day,
                   fc.category_id, c.name, fc.payment_method, fc.active, fc.start_month
            FROM fixed_costs fc
            LEFT JOIN categories c ON c.id = fc.category_id
            ORDER BY fc.active DESC, fc.due_day ASC, fc.title ASC
            "#,
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(FixedCost {
                id: row.get(0)?,
                title: row.get(1)?,
                amount_cents: row.get(2)?,
                due_day: row.get(3)?,
                category_id: row.get(4)?,
                category_name: row.get(5)?,
                payment_method: row.get(6)?,
                active: row.get::<_, i64>(7)? != 0,
                start_month: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn create_fixed_cost_conn(
    conn: &Connection,
    title: &str,
    amount_cents: i64,
    due_day: i64,
    category_id: Option<i64>,
    payment_method: &str,
    start_month: &str,
) -> Result<i64, String> {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return Err("Título do custo fixo é obrigatório".to_string());
    }
    if amount_cents <= 0 {
        return Err("Valor deve ser maior que zero".to_string());
    }
    if !(1..=31).contains(&due_day) {
        return Err("Dia de vencimento deve estar entre 1 e 31".to_string());
    }
    let method = validate_payment_method(payment_method)?;
    validate_ym(start_month)?;

    conn.execute(
        r#"
        INSERT INTO fixed_costs (title, amount_cents, due_day, category_id, payment_method, active, start_month)
        VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6)
        "#,
        params![trimmed, amount_cents, due_day, category_id, method, start_month],
    )
    .map_err(|e| format!("Falha ao criar custo fixo: {e}"))?;
    let id = conn.last_insert_rowid();
    ensure_fixed_cost_entries(conn, start_month)?;
    log_activity(
        conn,
        "fixed",
        "create",
        &format!(
            "Nova conta fixa: {trimmed} ({} · dia {due_day:02})",
            format_brl_cents(amount_cents)
        ),
    );
    Ok(id)
}

#[tauri::command]
pub fn create_fixed_cost(
    db: State<'_, Database>,
    title: String,
    amount_cents: i64,
    due_day: i64,
    category_id: Option<i64>,
    payment_method: String,
    start_month: String,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    create_fixed_cost_conn(
        &conn,
        &title,
        amount_cents,
        due_day,
        category_id,
        &payment_method,
        &start_month,
    )
}

#[tauri::command]
pub fn update_fixed_cost(
    db: State<'_, Database>,
    id: i64,
    title: String,
    amount_cents: i64,
    due_day: i64,
    category_id: Option<i64>,
    payment_method: String,
    current_month: String,
) -> Result<(), String> {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return Err("Título do custo fixo é obrigatório".to_string());
    }
    if amount_cents <= 0 {
        return Err("Valor deve ser maior que zero".to_string());
    }
    if !(1..=31).contains(&due_day) {
        return Err("Dia de vencimento deve estar entre 1 e 31".to_string());
    }
    let method = validate_payment_method(&payment_method)?;
    validate_ym(&current_month)?;

    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    conn.execute(
        "UPDATE fixed_costs SET title = ?1, amount_cents = ?2, due_day = ?3, category_id = ?4, payment_method = ?5 WHERE id = ?6",
        params![trimmed, amount_cents, due_day, category_id, method, id],
    )
    .map_err(|e| format!("Falha ao atualizar custo fixo: {e}"))?;

    // Atualiza apenas ocorrências em aberto a partir do mês atual, preservando histórico pago
    conn.execute(
        "UPDATE fixed_cost_entries SET title = ?1, amount_cents = ?2, due_day = ?3, payment_method = ?4 WHERE fixed_cost_id = ?5 AND month >= ?6 AND paid = 0",
        params![trimmed, amount_cents, due_day, method, id, current_month],
    )
    .map_err(|e| format!("Falha ao sincronizar ocorrências pendentes: {e}"))?;

    log_activity(
        &conn,
        "fixed",
        "update",
        &format!(
            "Editou conta fixa: {trimmed} ({} · dia {due_day:02})",
            format_brl_cents(amount_cents)
        ),
    );
    Ok(())
}

#[tauri::command]
pub fn toggle_fixed_cost_active(db: State<'_, Database>, id: i64) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    let (current, title): (i64, String) = conn
        .query_row(
            "SELECT active, title FROM fixed_costs WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| format!("Custo fixo não encontrado: {e}"))?;
    let next = if current == 0 { 1 } else { 0 };
    conn.execute("UPDATE fixed_costs SET active = ?1 WHERE id = ?2", params![next, id])
        .map_err(|e| format!("Falha ao alterar status do custo fixo: {e}"))?;
    if next == 0 {
        log_activity(&conn, "fixed", "pause", &format!("Pausou conta fixa: {title}"));
    } else {
        log_activity(&conn, "fixed", "resume", &format!("Reativou conta fixa: {title}"));
    }
    Ok(next != 0)
}

#[tauri::command]
pub fn delete_fixed_cost(db: State<'_, Database>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    let title: Option<String> = conn
        .query_row("SELECT title FROM fixed_costs WHERE id = ?1", params![id], |r| r.get(0))
        .ok();
    conn.execute("DELETE FROM fixed_costs WHERE id = ?1", params![id])
        .map_err(|e| format!("Falha ao excluir custo fixo: {e}"))?;
    if let Some(t) = title {
        log_activity(&conn, "fixed", "delete", &format!("Excluiu conta fixa: {t}"));
    }
    Ok(())
}

#[tauri::command]
pub fn toggle_fixed_cost_entry_paid(
    db: State<'_, Database>,
    entry_id: i64,
) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    let (current, title, month, amount_cents): (i64, String, String, i64) = conn
        .query_row(
            "SELECT paid, title, month, amount_cents FROM fixed_cost_entries WHERE id = ?1",
            params![entry_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .map_err(|e| format!("Lançamento fixo não encontrado: {e}"))?;
    let next = if current == 0 { 1 } else { 0 };
    let paid_at = if next == 1 { Some(today_iso()) } else { None };
    conn.execute(
        "UPDATE fixed_cost_entries SET paid = ?1, paid_at = ?2 WHERE id = ?3",
        params![next, paid_at, entry_id],
    )
    .map_err(|e| format!("Falha ao atualizar status de pagamento: {e}"))?;
    let (action, verb) = if next == 1 {
        ("pay", "Pagou conta fixa")
    } else {
        ("unpay", "Reabriu conta fixa")
    };
    log_activity(
        &conn,
        "fixed",
        action,
        &format!("{verb}: {title} ({} · {month})", format_brl_cents(amount_cents)),
    );
    Ok(next != 0)
}

#[tauri::command]
pub fn update_fixed_cost_entry_amount(
    db: State<'_, Database>,
    entry_id: i64,
    amount_cents: i64,
) -> Result<(), String> {
    if amount_cents <= 0 {
        return Err("Valor deve ser maior que zero".to_string());
    }
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    let info: Option<(String, String)> = conn
        .query_row(
            "SELECT title, month FROM fixed_cost_entries WHERE id = ?1",
            params![entry_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .ok();
    conn.execute(
        "UPDATE fixed_cost_entries SET amount_cents = ?1 WHERE id = ?2",
        params![amount_cents, entry_id],
    )
    .map_err(|e| format!("Falha ao atualizar valor do mês: {e}"))?;
    if let Some((title, month)) = info {
        log_activity(
            &conn,
            "fixed",
            "update",
            &format!(
                "Ajustou valor de {title} em {month} para {}",
                format_brl_cents(amount_cents)
            ),
        );
    }
    Ok(())
}
