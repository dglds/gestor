use std::process::Command;

const ALLOWED_URL_PREFIX: &str = "https://github.com/dglds/gestor/";

pub fn validate_release_url(url: &str) -> Result<&str, String> {
    let trimmed = url.trim();
    if !trimmed.starts_with(ALLOWED_URL_PREFIX) {
        return Err("URL de atualização não permitida.".into());
    }
    if trimmed.len() > 512 || trimmed.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err("URL de atualização inválida.".into());
    }
    Ok(trimmed)
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub fn open_release_url(url: String) -> Result<(), String> {
    let valid_url = validate_release_url(&url)?;

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new("cmd")
            .args(["/C", "start", "", valid_url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Não foi possível abrir o navegador: {e}"))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(valid_url)
            .spawn()
            .map_err(|e| format!("Não foi possível abrir o navegador: {e}"))?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(valid_url)
            .spawn()
            .map_err(|e| format!("Não foi possível abrir o navegador: {e}"))?;
    }

    Ok(())
}
