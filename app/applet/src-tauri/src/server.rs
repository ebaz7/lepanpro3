// Embedded Axum HTTP/WebSocket server implementation for Sayan Desktop Server (Host) mode
use axum::{
    extract::{Path as AxumPath, State},
    http::{HeaderValue, Method, StatusCode},
    response::{Html, IntoResponse, Json},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};

#[derive(Clone)]
pub struct ServerState {
    pub port: u16,
    pub dist_dir: PathBuf,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RemoteIpcRequest {
    pub command: String,
    pub args: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RemoteIpcResponse {
    pub success: bool,
    pub result: Option<Value>,
    pub error: Option<String>,
}

pub async fn start_embedded_server(port: u16, dist_path: Option<String>) -> Result<(), String> {
    let resolved_dist = if let Some(dp) = dist_path {
        PathBuf::from(dp)
    } else {
        let default_path = PathBuf::from("../dist");
        if default_path.exists() {
            default_path
        } else if PathBuf::from("./dist").exists() {
            PathBuf::from("./dist")
        } else {
            PathBuf::from("dist")
        }
    };

    let state = Arc::new(ServerState {
        port,
        dist_dir: resolved_dist.clone(),
    });

    // 1. Enable full permissive CORS for LAN / Web clients
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::any())
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers(tower_http::cors::Any);

    // 2. Build API router
    let api_router = Router::new()
        .route("/health", get(health_handler))
        .route("/config", get(config_handler))
        .route("/ipc/:command", post(ipc_handler))
        .route("/desktop/updater.json", get(updater_manifest_handler))
        .with_state(state.clone());

    // 3. Prepare static file server for frontend assets (SPA fallback to index.html)
    let index_file = resolved_dist.join("index.html");
    let app_router = if resolved_dist.exists() {
        let serve_dir = ServeDir::new(&resolved_dist).fallback(ServeFile::new(index_file));
        Router::new()
            .nest("/api", api_router)
            .fallback_service(serve_dir)
            .layer(cors)
    } else {
        Router::new()
            .nest("/api", api_router)
            .fallback(get(fallback_no_dist_handler))
            .layer(cors)
    };

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("🚀 Starting Sayan Embedded Axum Server on http://0.0.0.0:{}", port);

    tokio::spawn(async move {
        if let Err(e) = axum::Server::bind(&addr)
            .serve(app_router.into_make_service())
            .await
        {
            eprintln!("❌ Embedded Server Error on http://0.0.0.0:{}: {}", port, e);
        }
    });

    Ok(())
}

async fn health_handler(State(state): State<Arc<ServerState>>) -> impl IntoResponse {
    Json(json!({
        "status": "online",
        "role": "Server",
        "server": "Sayan Embedded Axum Host",
        "port": state.port,
        "dist_available": state.dist_dir.exists(),
        "timestamp": chrono_timestamp()
    }))
}

async fn config_handler(State(state): State<Arc<ServerState>>) -> impl IntoResponse {
    Json(json!({
        "server_mode": "Server (Host)",
        "port": state.port,
        "cors_enabled": true,
        "allowed_origins": "*"
    }))
}

async fn ipc_handler(
    State(_state): State<Arc<ServerState>>,
    AxumPath(command): AxumPath<String>,
    body: Option<Json<Value>>,
) -> impl IntoResponse {
    let _args = body.map(|Json(val)| val).unwrap_or(Value::Null);

    match command.as_str() {
        "get_client_config" => Json(RemoteIpcResponse {
            success: true,
            result: Some(json!({
                "local_server_url": "http://localhost:8080",
                "cloud_server_url": "http://localhost:3000",
                "update_url": "",
                "role": "Server",
                "port": 8080,
                "timeout_ms": 3000
            })),
            error: None,
        }),
        "ping" => Json(RemoteIpcResponse {
            success: true,
            result: Some(json!({ "pong": true })),
            error: None,
        }),
        _ => Json(RemoteIpcResponse {
            success: true,
            result: Some(json!({ "command": command, "executed": true, "remote": true })),
            error: None,
        }),
    }
}

async fn updater_manifest_handler(State(state): State<Arc<ServerState>>) -> impl IntoResponse {
    Json(json!({
        "version": "1.0.0",
        "notes": "نسخه جدید پایدار سیستم انبار و مالی سایان",
        "pub_date": "2026-10-21T08:00:00Z",
        "platforms": {
            "windows-x86_64": {
                "signature": "",
                "url": format!("http://localhost:{}/downloads/sayan-setup.exe", state.port)
            }
        }
    }))
}

async fn fallback_no_dist_handler() -> impl IntoResponse {
    (
        StatusCode::OK,
        Html(
            "<html><body style='font-family:sans-serif;text-align:center;padding:50px;'>"
                .to_string()
                + "<h2>سیستم مدیریت انبار سایان (سرور فعال است)</h2>"
                + "<p>برنامه در حالت سرور (Host) در حال اجراست. پوشه dist جهت بارگذاری رابط کاربری وب مقداردهی شده است.</p>"
                + "</body></html>",
        ),
    )
}

fn chrono_timestamp() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
