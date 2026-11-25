use rusqlite::params;
use tauri::State;

use crate::db::{
    format_brl_cents, log_activity, validate_payment_method, validate_ym, validate_ymd, Database,
};
use crate::models::BankTransaction;

#[tauri::command]
pub fn list_bank_transactions(
    db: State<'_, Database>,
    month: String,
) -> Result<Vec<BankTransaction>, String> {
    validate_ym(&month)?;
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT b.id, b.kind, b.title, b.amount_cents, b.date, b.month,
                   b.category_id, c.name, b.payment_method, b.paid, b.notes
            FROM bank_transactions b
            LEFT JOIN categories c ON c.id = b.category_id
            WHERE b.month = ?1
            ORDER BY b.date DESC, b.id DESC
            "#,
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![month], |row| {
            Ok(BankTransaction {
                id: row.get(0)?,
                kind: row.get(1)?,
                title: row.get(2)?,
                amount_cents: row.get(3)?,
                date: row.get(4)?,
                month: row.get(5)?,
                category_id: row.get(6)?,
                category_name: row.get(7)?,
                payment_method: row.get(8)?,
                paid: row.get::<_, i64>(9)? != 0,
                notes: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_bank_transaction(
    db: State<'_, Database>,
    kind: String,
    title: String,
    amount_cents: i64,
    date: String,
    category_id: Option<i64>,
    payment_method: String,
    paid: bool,
    notes: Option<String>,
) -> Result<i64, String> {
    if kind != "income" && kind != "expense" {
        return Err("Tipo deve ser 'income' ou 'expense'".to_string());
    }
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return Err("Descrição é obrigatória".to_string());
    }
    if amount_cents <= 0 {
        return Err("Valor deve ser maior que zero".to_string());
    }
    let method = validate_payment_method(&payment_method)?;
    let (year, month_num, _) = validate_ymd(&date)?;
    let month = format!("{year:04}-{month_num:02}");
    let clean_notes = notes.and_then(|n| {
        let t = n.trim().to_string();
        if t.is_empty() { None } else { Some(t) }
    });

    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    conn.execute(
        r#"
        INSERT INTO bank_transactions
            (kind, title, amount_cents, date, month, category_id, payment_method, paid, notes)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        "#,
        params![
            kind,
            trimmed,
            amount_cents,
            date,
            month,
            category_id,
            method,
            if paid { 1 } else { 0 },
            clean_notes
        ],
    )
    .map_err(|e| format!("Falha ao salvar lançamento bancário: {e}"))?;
    let id = conn.last_insert_rowid();
    let kind_label = if kind == "income" { "entrada" } else { "saída" };
    log_activity(
        &conn,
        "bank",
        "create",
        &format!(
            "Nova {kind_label}: {trimmed} ({} · {method})",
            format_brl_cents(amount_cents)
        ),
    );
    Ok(id)
}

#[tauri::command]
pub fn update_bank_transaction(
    db: State<'_, Database>,
    id: i64,
    kind: String,
    title: String,
    amount_cents: i64,
    date: String,
    category_id: Option<i64>,
    payment_method: String,
    paid: bool,
    notes: Option<String>,
) -> Result<(), String> {
    if kind != "income" && kind != "expense" {
        return Err("Tipo deve ser 'income' ou 'expense'".to_string());
    }
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return Err("Descrição é obrigatória".to_string());
    }
    if amount_cents <= 0 {
        return Err("Valor deve ser maior que zero".to_string());
    }
    let method = validate_payment_method(&payment_method)?;
    let (year, month_num, _) = validate_ymd(&date)?;
    let month = format!("{year:04}-{month_num:02}");
    let clean_notes = notes.and_then(|n| {
        let t = n.trim().to_string();
        if t.is_empty() { None } else { Some(t) }
    });

    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    conn.execute(
        r#"
        UPDATE bank_transactions
        SET kind = ?1, title = ?2, amount_cents = ?3, date = ?4, month = ?5,
            category_id = ?6, payment_method = ?7, paid = ?8, notes = ?9
        WHERE id = ?10
        "#,
        params![
            kind,
            trimmed,
            amount_cents,
            date,
            month,
            category_id,
            method,
            if paid { 1 } else { 0 },
            clean_notes,
            id
        ],
    )
    .map_err(|e| format!("Falha ao atualizar lançamento bancário: {e}"))?;
    log_activity(
        &conn,
        "bank",
        "update",
        &format!(
            "Editou lançamento: {trimmed} ({} · {method})",
            format_brl_cents(amount_cents)
        ),
    );
    Ok(())
}

#[tauri::command]
pub fn toggle_bank_transaction_paid(db: State<'_, Database>, id: i64) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    let (current, kind, title, amount_cents): (i64, String, String, i64) = conn
        .query_row(
            "SELECT paid, kind, title, amount_cents FROM bank_transactions WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .map_err(|e| format!("Lançamento bancário não encontrado: {e}"))?;
    let next = if current == 0 { 1 } else { 0 };
    conn.execute(
        "UPDATE bank_transactions SET paid = ?1 WHERE id = ?2",
        params![next, id],
    )
    .map_err(|e| format!("Falha ao atualizar status: {e}"))?;
    let (action, verb) = if next == 1 {
        if kind == "income" {
            ("pay", "Marcou como recebido")
        } else {
            ("pay", "Marcou como pago")
        }
    } else {
        ("unpay", "Marcou como pendente")
    };
    log_activity(
        &conn,
        "bank",
        action,
        &format!("{verb}: {title} ({})", format_brl_cents(amount_cents)),
    );
    Ok(next != 0)
}

#[tauri::command]
pub fn delete_bank_transaction(db: State<'_, Database>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    let info: Option<(String, i64)> = conn
        .query_row(
            "SELECT title, amount_cents FROM bank_transactions WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .ok();
    conn.execute("DELETE FROM bank_transactions WHERE id = ?1", params![id])
        .map_err(|e| format!("Falha ao excluir lançamento bancário: {e}"))?;
    if let Some((title, amount_cents)) = info {
        log_activity(
            &conn,
            "bank",
            "delete",
            &format!("Excluiu lançamento: {title} ({})", format_brl_cents(amount_cents)),
        );
    }
    Ok(())
}
