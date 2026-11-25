use rusqlite::{params, Connection};
use tauri::State;

use crate::db::Database;
use crate::models::ActivityLog;

pub fn list_activity_logs_conn(
    conn: &Connection,
    area: Option<&str>,
    limit: i64,
) -> Result<Vec<ActivityLog>, String> {
    let safe_limit = limit.clamp(1, 500);
    if let Some(a) = area.filter(|s| !s.trim().is_empty() && *s != "all") {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT id, created_at, area, action, summary
                FROM activity_logs
                WHERE area = ?1
                ORDER BY id DESC
                LIMIT ?2
                "#,
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![a, safe_limit], |row| {
                Ok(ActivityLog {
                    id: row.get(0)?,
                    created_at: row.get(1)?,
                    area: row.get(2)?,
                    action: row.get(3)?,
                    summary: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    } else {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT id, created_at, area, action, summary
                FROM activity_logs
                ORDER BY id DESC
                LIMIT ?1
                "#,
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![safe_limit], |row| {
                Ok(ActivityLog {
                    id: row.get(0)?,
                    created_at: row.get(1)?,
                    area: row.get(2)?,
                    action: row.get(3)?,
                    summary: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn list_activity_logs(
    db: State<'_, Database>,
    area: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<ActivityLog>, String> {
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    list_activity_logs_conn(&conn, area.as_deref(), limit.unwrap_or(200))
}

#[tauri::command]
pub fn clear_activity_logs(db: State<'_, Database>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "Erro ao acessar banco".to_string())?;
    conn.execute("DELETE FROM activity_logs", [])
        .map_err(|e| format!("Falha ao limpar histórico: {e}"))?;
    Ok(())
}
