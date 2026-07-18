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
        .invoke_handler(tauri::generate_handler![get_desktop_config, set_desktop_config])
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
