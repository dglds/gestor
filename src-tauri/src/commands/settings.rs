use rusqlite::{params, Connection};
use tauri::State;

use crate::db::{
    get_setting_i64, get_setting_string, log_activity, Database, DEFAULT_CARD_CLOSING_DAY,
    DEFAULT_CARD_DUE_DAY, DEFAULT_FONT_SCALE, DEFAULT_PRIMARY_COLOR, DEFAULT_SECONDARY_COLOR,
};
use crate::models::{AppSettings, Category};

pub fn load_settings_conn(conn: &Connection) -> AppSettings {
    AppSettings {
        primary_color: get_setting_string(conn, "primary_color", DEFAULT_PRIMARY_COLOR),
        secondary_color: get_setting_string(conn, "secondary_color", DEFAULT_SECONDARY_COLOR),
        card_closing_day: get_setting_i64(conn, "card_closing_day", DEFAULT_CARD_CLOSING_DAY),
        card_due_day: get_setting_i64(conn, "card_due_day", DEFAULT_CARD_DUE_DAY),
        font_scale: get_setting_i64(conn, "font_scale", DEFAULT_FONT_SCALE).clamp(85, 130),
        company_name: get_setting_string(conn, "company_name", "Finance"),
        company_logo: get_setting_string(conn, "company_logo", ""),
    }
}

pub fn update_settings_conn(
    conn: &Connection,
    primary_color: &str,
    secondary_color: &str,
    card_closing_day: i64,
    card_due_day: i64,
    font_scale: i64,
    company_name: &str,
    company_logo: &str,
) -> Result<AppSettings, String> {
    if !(1..=31).contains(&card_closing_day) || !(1..=31).contains(&card_due_day) {
        return Err("Dias de fechamento e vencimento devem estar entre 1 e 31".to_string());
    }
    if !(85..=130).contains(&font_scale) {
        return Err("Tamanho da fonte deve estar entre 85% e 130%".to_string());
    }
    let name_trimmed = company_name.trim();
    let final_name = if name_trimmed.is_empty() {
        "Finance".to_string()
    } else {
        name_trimmed.to_string()
    };
    let logo_trimmed = company_logo.trim().to_string();
    if logo_trimmed.len() > 1_000_000 {
        return Err("Imagem do logo muito grande (máximo 1 MB)".to_string());
    }
    if !logo_trimmed.is_empty() && !logo_trimmed.starts_with("data:image/") {
        return Err("Formato de imagem inválido para o logo".to_string());
    }
    let prev = load_settings_conn(conn);
    let primary_trimmed = primary_color.trim().to_string();
    let secondary_trimmed = secondary_color.trim().to_string();
    let pairs = [
        ("primary_color", primary_trimmed.clone()),
        ("secondary_color", secondary_trimmed.clone()),
        ("card_closing_day", card_closing_day.to_string()),
        ("card_due_day", card_due_day.to_string()),
        ("font_scale", font_scale.to_string()),
        ("company_name", final_name.clone()),
        ("company_logo", logo_trimmed.clone()),
    ];
    for (k, v) in pairs {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![k, v],
        )
        .map_err(|e| format!("Falha ao salvar configuração {k}: {e}"))?;
    }
    let mut changes: Vec<String> = Vec::new();
    if prev.primary_color != primary_trimmed || prev.secondary_color != secondary_trimmed {
        changes.push("cores do tema".to_string());
    }
    if prev.font_scale != font_scale {
        changes.push(format!("fonte para {font_scale}%"));
    }
    if prev.card_closing_day != card_closing_day || prev.card_due_day != card_due_day {
        changes.push(format!(
            "cartão (fecha dia {card_closing_day:02} · vence dia {card_due_day:02})"
        ));
    }
    if prev.company_name != final_name {
        changes.push(format!("nome da empresa para {final_name}"));
    }
    if prev.company_logo != logo_trimmed {
        if logo_trimmed.is_empty() {
            changes.push("removeu logo da empresa".to_string());
        } else {
            changes.push("logo da empresa".to_string());
        }
    }
    if !changes.is_empty() {
        log_activity(conn, "settings", "update", &format!("Alterou {}", changes.join(", ")));
    }
    Ok(load_settings_conn(conn))
}

#[tauri::command]
pub fn get_settings(db: State<'_, Database>) -> Result<AppSettings, String> {
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    Ok(load_settings_conn(&conn))
}

#[tauri::command]
pub fn update_settings(
    db: State<'_, Database>,
    primary_color: String,
    secondary_color: String,
    card_closing_day: i64,
    card_due_day: i64,
    font_scale: i64,
    company_name: String,
    company_logo: String,
) -> Result<AppSettings, String> {
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    update_settings_conn(
        &conn,
        &primary_color,
        &secondary_color,
        card_closing_day,
        card_due_day,
        font_scale,
        &company_name,
        &company_logo,
    )
}

#[tauri::command]
pub fn list_categories(db: State<'_, Database>) -> Result<Vec<Category>, String> {
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, kind FROM categories ORDER BY kind ASC, name ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                kind: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_category(
    db: State<'_, Database>,
    name: String,
    kind: String,
) -> Result<Category, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Nome da categoria não pode estar vazio".to_string());
    }
    if kind != "income" && kind != "expense" {
        return Err("Tipo de categoria inválido".to_string());
    }
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    conn.execute(
        "INSERT INTO categories (name, kind) VALUES (?1, ?2)",
        params![trimmed, kind],
    )
    .map_err(|e| format!("Falha ao criar categoria: {e}"))?;
    let id = conn.last_insert_rowid();
    let kind_label = if kind == "income" { "Entrada" } else { "Saída" };
    log_activity(
        &conn,
        "settings",
        "create",
        &format!("Criou categoria: {trimmed} ({kind_label})"),
    );
    Ok(Category {
        id,
        name: trimmed.to_string(),
        kind,
    })
}

#[tauri::command]
pub fn delete_category(db: State<'_, Database>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    let name: Option<String> = conn
        .query_row("SELECT name FROM categories WHERE id = ?1", params![id], |r| r.get(0))
        .ok();
    conn.execute("DELETE FROM categories WHERE id = ?1", params![id])
        .map_err(|e| format!("Falha ao excluir categoria: {e}"))?;
    if let Some(n) = name {
        log_activity(&conn, "settings", "delete", &format!("Removeu categoria: {n}"));
    }
    Ok(())
}
