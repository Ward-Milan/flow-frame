pub mod photometrics;
pub mod project;

use photometrics::calculate_ground_lux;
use project::{read_project_file, save_project_file, write_binary_file};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            save_project_file,
            read_project_file,
            write_binary_file,
            calculate_ground_lux,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Flow Frame Studio application");
}
