use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

#[derive(Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct DesktopConfig {
    mode: Option<String>,
    database_url: Option<String>,
    jwt_secret: Option<String>,
    jwt_refresh_secret: Option<String>,
    telegram_bot_token: Option<String>,
}

struct SidecarChild(Mutex<Option<CommandChild>>);

fn config_path(app: &tauri::AppHandle) -> PathBuf {
    let dir = app.path().app_data_dir().expect("no app data dir");
    fs::create_dir_all(&dir).ok();
    dir.join("desktop-config.json")
}

fn load_config(app: &tauri::AppHandle) -> DesktopConfig {
    fs::read_to_string(config_path(app))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn get_desktop_config(app: tauri::AppHandle) -> DesktopConfig {
    load_config(&app)
}

#[tauri::command]
fn set_desktop_config(app: tauri::AppHandle, config: DesktopConfig) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(config_path(&app), json).map_err(|e| e.to_string())
}

// Delete the saved config so the next launch shows the mode-picker onboarding
// again. Used by Settings -> "Switch mode / reset". Missing file is fine.
#[tauri::command]
fn clear_desktop_config(app: tauri::AppHandle) -> Result<(), String> {
    match fs::remove_file(config_path(&app)) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

// Spawn the sidecar in check-only mode (Task 1 contract): it connects,
// prints DB_CHECK_OK, and exits. Same driver + TLS behavior as real runtime.
#[tauri::command]
async fn test_db_connection(app: tauri::AppHandle, database_url: String) -> Result<(), String> {
    let resources = app.path().resource_dir().map_err(|e| e.to_string())?;
    let envs: Vec<(String, String)> = vec![
        ("NODE_ENV".into(), "production".into()),
        ("DB_CHECK_ONLY".into(), "true".into()),
        ("DATABASE_URL".into(), database_url),
        ("DB_PROVIDER".into(), "postgres".into()),
        // env.ts requires >=16 chars; values are never used in check mode.
        ("JWT_SECRET".into(), "check-only-secret-0000".into()),
        ("JWT_REFRESH_SECRET".into(), "check-only-secret-0000".into()),
        ("PRISMA_QUERY_ENGINE_LIBRARY".into(), resources.join("prisma").join("query-engine.node").display().to_string()),
    ];
    let output = app
        .shell()
        .sidecar("ngocky-api")
        .map_err(|e| e.to_string())?
        .envs(envs)
        .output()
        .await
        .map_err(|e| e.to_string())?;
    if output.status.success() && String::from_utf8_lossy(&output.stdout).contains("DB_CHECK_OK") {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(stderr
            .lines()
            .rev()
            .find(|l| !l.trim().is_empty())
            .unwrap_or("Connection failed")
            .to_string())
    }
}

fn spawn_sidecar(app: &tauri::AppHandle, cfg: &DesktopConfig) -> CommandChild {
    let mode = cfg.mode.clone().unwrap_or_default();
    let data_dir = app.path().app_data_dir().expect("no app data dir");
    let resources = app.path().resource_dir().expect("no resource dir");
    let (db_url, provider) = if mode == "offline" {
        (format!("file:{}", data_dir.join("ngocky.db").display()), "sqlite")
    } else {
        (cfg.database_url.clone().unwrap_or_default(), "postgres")
    };
    let mut envs: Vec<(String, String)> = vec![
        ("NODE_ENV".into(), "production".into()),
        ("APP_PORT".into(), "21473".into()),
        // Tauri spawns the sidecar with cwd "/", so cwd-relative writes (uploads)
        // fail. Pin writable dirs under the app data dir.
        ("UPLOAD_DIR".into(), data_dir.display().to_string()),
        ("DATABASE_URL".into(), db_url),
        ("DB_PROVIDER".into(), provider.into()),
        ("JWT_SECRET".into(), cfg.jwt_secret.clone().unwrap_or_default()),
        ("JWT_REFRESH_SECRET".into(), cfg.jwt_refresh_secret.clone().unwrap_or_default()),
        ("CORS_ORIGIN".into(), "tauri://localhost,http://tauri.localhost".into()),
        ("MIGRATIONS_DIR".into(), resources.join("migrations").join(provider).display().to_string()),
        ("PRISMA_QUERY_ENGINE_LIBRARY".into(), resources.join("prisma").join("query-engine.node").display().to_string()),
        ("SCHEDULER_ENABLED".into(), "true".into()),
    ];
    if let Some(t) = &cfg.telegram_bot_token {
        envs.push(("TELEGRAM_BOT_TOKEN".into(), t.clone()));
    }
    let (_rx, child) = app
        .shell()
        .sidecar("ngocky-api")
        .expect("sidecar not bundled")
        .envs(envs)
        .spawn()
        .expect("failed to spawn sidecar");
    child
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![get_desktop_config, set_desktop_config, clear_desktop_config, test_db_connection])
        .setup(|app| {
            let cfg = load_config(app.handle());
            let child = match cfg.mode.as_deref() {
                Some("offline") | Some("shared") => Some(spawn_sidecar(app.handle(), &cfg)),
                _ => None,
            };
            app.manage(SidecarChild(Mutex::new(child)));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running NgocKy")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(state) = app.try_state::<SidecarChild>() {
                    if let Some(child) = state.0.lock().unwrap().take() {
                        child.kill().ok();
                    }
                }
            }
        });
}
