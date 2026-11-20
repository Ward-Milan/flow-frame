use std::fs;
use std::path::Path;

/// Atomically saves project file to disk
#[tauri::command]
pub fn save_project_file(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);

    // Write to a temporary file first
    let temp_path = p.with_extension("tmp");
    fs::write(&temp_path, content.as_bytes())
        .map_err(|e| format!("Impossible d'écrire le fichier temporaire : {}", e))?;

    // Rename atomically to target destination
    fs::rename(&temp_path, p)
        .map_err(|e| format!("Impossible de finaliser l'enregistrement : {}", e))?;

    Ok(())
}

/// Reads a project file from disk
#[tauri::command]
pub fn read_project_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Impossible de lire le fichier de projet : {}", e))
}

/// Writes binary bytes (.flow ZIP, PDF, PNG) directly to user-chosen destination path
#[tauri::command]
pub fn write_binary_file(path: String, data: Vec<u8>) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.as_os_str().is_empty() {
            let _ = fs::create_dir_all(parent);
        }
    }
    fs::write(&path, &data)
        .map_err(|e| format!("Impossible d'enregistrer le fichier : {}", e))
}

