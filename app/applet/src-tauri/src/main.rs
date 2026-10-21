#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod server;

use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{WindowBuilder, WindowUrl};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ClientConfig {
    pub role: String, // "Standalone", "Server", or "Client"
    pub local_server_url: String,
    pub cloud_server_url: String,
    pub update_url: String,
    pub timeout_ms: u64,
    pub port: u16,
}

impl Default for ClientConfig {
    fn default() -> Self {
        Self {
            role: "Standalone".to_string(),
            local_server_url: "http://localhost:8080".to_string(),
            cloud_server_url: "http://localhost:3000".to_string(),
            update_url: "".to_string(),
            timeout_ms: 2000,
            port: 8080,
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TauriUpdateManifest {
    pub version: Option<String>,
    pub notes: Option<String>,
    pub pub_date: Option<String>,
    pub platforms: Option<serde_json::Map<String, serde_json::Value>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateCheckResult {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub download_url: String,
    pub release_notes: String,
    pub error: Option<String>,
}

#[tauri::command]
fn get_client_config(handle: tauri::AppHandle) -> ClientConfig {
    get_or_create_config(&handle)
}

#[tauri::command]
fn save_client_config(handle: tauri::AppHandle, config: ClientConfig) -> Result<(), String> {
    let config_dir = handle
        .path_resolver()
        .app_config_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;

    let config_file = config_dir.join("config.json");
    let mut file = File::create(config_file).map_err(|e| e.to_string())?;
    let json_data = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    file.write_all(json_data.as_bytes())
        .map_err(|e| e.to_string())?;

    // If role switched to Server, start server on demand
    if config.role == "Server" {
        let port = config.port;
        tauri::async_runtime::spawn(async move {
            let _ = server::start_embedded_server(port, None).await;
        });
    }

    Ok(())
}

#[tauri::command]
async fn start_server_cmd(port: Option<u16>) -> Result<String, String> {
    let target_port = port.unwrap_or(8080);
    server::start_embedded_server(target_port, None).await?;
    Ok(format!("Embedded server started on 0.0.0.0:{}", target_port))
}

#[tauri::command]
fn check_desktop_update(
    handle: tauri::AppHandle,
    custom_url: Option<String>,
) -> UpdateCheckResult {
    let config = get_or_create_config(&handle);
    let app_version = handle.package_info().version.to_string();

    let target_endpoint = if let Some(u) = custom_url {
        if !u.trim().is_empty() {
            u
        } else {
            config.update_url.clone()
        }
    } else {
        config.update_url.clone()
    };

    let resolved_url = if !target_endpoint.trim().is_empty() {
        target_endpoint
    } else {
        if check_connection(&config.local_server_url, 800) {
            format!(
                "{}/api/desktop/updater.json",
                config.local_server_url.trim_end_matches('/')
            )
        } else {
            format!(
                "{}/api/desktop/updater.json",
                config.cloud_server_url.trim_end_matches('/')
            )
        }
    };

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(5))
        .build();

    match client {
        Ok(c) => match c.get(&resolved_url).send() {
            Ok(response) => {
                if response.status().is_success() {
                    if let Ok(manifest) = response.json::<TauriUpdateManifest>() {
                        let latest_ver = manifest
                            .version
                            .unwrap_or_else(|| app_version.clone());
                        let notes = manifest.notes.unwrap_or_default();

                        let mut dl_url = "".to_string();
                        if let Some(platforms) = manifest.platforms {
                            if let Some(win) = platforms.get("windows-x86_64") {
                                if let Some(u) = win.get("url").and_then(|v| v.as_str()) {
                                    dl_url = u.to_string();
                                }
                            }
                        }

                        let has_update = latest_ver != app_version;
                        UpdateCheckResult {
                            has_update,
                            current_version: app_version,
                            latest_version: latest_ver,
                            download_url: dl_url,
                            release_notes: notes,
                            error: None,
                        }
                    } else {
                        UpdateCheckResult {
                            has_update: false,
                            current_version: app_version,
                            latest_version: "نامشخص".to_string(),
                            download_url: "".to_string(),
                            release_notes: "".to_string(),
                            error: Some("فرمت فایل بروزرسانی نامعتبر است".to_string()),
                        }
                    }
                } else {
                    UpdateCheckResult {
                        has_update: false,
                        current_version: app_version,
                        latest_version: "نامشخص".to_string(),
                        download_url: "".to_string(),
                        release_notes: "".to_string(),
                        error: Some(format!("پاسخ ناموفق سرور: {}", response.status())),
                    }
                }
            }
            Err(e) => UpdateCheckResult {
                has_update: false,
                current_version: app_version,
                latest_version: "نامشخص".to_string(),
                download_url: "".to_string(),
                release_notes: "".to_string(),
                error: Some(format!("عدم برقراری ارتباط با لینک آپدیت: {}", e)),
            },
        },
        Err(e) => UpdateCheckResult {
            has_update: false,
            current_version: app_version,
            latest_version: "نامشخص".to_string(),
            download_url: "".to_string(),
            release_notes: "".to_string(),
            error: Some(e.to_string()),
        },
    }
}

fn get_or_create_config(handle: &tauri::AppHandle) -> ClientConfig {
    let config_dir = handle
        .path_resolver()
        .app_config_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    let config_file = config_dir.join("config.json");

    if config_file.exists() {
        if let Ok(content) = fs::read_to_string(&config_file) {
            if let Ok(config) = serde_json::from_str::<ClientConfig>(&content) {
                return config;
            }
        }
    }

    let default_config = ClientConfig::default();
    if let Ok(_) = fs::create_dir_all(&config_dir) {
        if let Ok(mut file) = File::create(config_file) {
            let _ = file.write_all(
                serde_json::to_string_pretty(&default_config)
                    .unwrap()
                    .as_bytes(),
            );
        }
    }
    default_config
}

fn check_connection(url: &str, timeout_ms: u64) -> bool {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build();

    if let Ok(c) = client {
        let test_url = if url.ends_with('/') {
            format!("{}api/health", url)
        } else {
            format!("{}/api/health", url)
        };

        match c.get(&test_url).send() {
            Ok(resp) => resp.status().is_success(),
            Err(_) => match c.get(url).send() {
                Ok(resp) => resp.status().is_success() || resp.status().as_u16() == 404,
                Err(_) => false,
            },
        }
    } else {
        false
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.app_handle();
            let config = get_or_create_config(&handle);

            println!(
                "Initializing Sayan Desktop application in mode: {}",
                config.role
            );

            // 1. If role is Server, auto-spawn Axum embedded server in background
            if config.role == "Server" {
                let port = config.port;
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = server::start_embedded_server(port, None).await {
                        eprintln!("Failed to start embedded server: {}", e);
                    }
                });
            }

            // 2. Resolve initial window URL according to network role
            let target_url = match config.role.as_str() {
                "Client" => {
                    println!("Client mode selected. Routing to Server URL: {}", config.local_server_url);
                    config.local_server_url
                }
                "Server" => {
                    println!("Server host mode active. Serving locally on port {}", config.port);
                    format!("http://localhost:{}", config.port)
                }
                _ => {
                    // Standalone mode: fallback to local server or bundled index.html
                    if check_connection(&config.local_server_url, config.timeout_ms) {
                        config.local_server_url
                    } else if check_connection(&config.cloud_server_url, config.timeout_ms) {
                        config.cloud_server_url
                    } else {
                        "index.html".to_string()
                    }
                }
            };

            let window_url = if target_url.starts_with("http://") || target_url.starts_with("https://") {
                if let Ok(parsed_url) = target_url.parse::<reqwest::Url>() {
                    WindowUrl::External(parsed_url)
                } else {
                    WindowUrl::App("index.html".into())
                }
            } else {
                WindowUrl::App("index.html".into())
            };

            let main_window = WindowBuilder::new(app, "main", window_url)
                .title("سیستم مدیریت انبار سایان (نسخه دوتایی سرور/کلاینت و خودکار)")
                .resizable(true)
                .fullscreen(false)
                .maximized(true)
                .decorations(true)
                .center(true)
                .build();

            match main_window {
                Ok(_) => println!("Main desktop window successfully spawned."),
                Err(e) => eprintln!("Error spawning desktop window: {:?}", e),
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_client_config,
            save_client_config,
            check_desktop_update,
            start_server_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
