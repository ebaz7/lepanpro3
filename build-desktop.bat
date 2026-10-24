@echo off
echo ========================================================
echo   LEPAN WAREHOUSE - TAURI WINDOWS BUILDER (LOW MEMORY)
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Updating src-tauri/Cargo.toml with memory-safe configuration...
(
echo [package]
echo name = "sayan-warehouse"
echo version = "1.0.0"
echo description = "Sayan warehouse desktop"
echo authors = ["Sayan Team"]
echo edition = "2021"
echo rust-version = "1.65"
echo.
echo [build-dependencies]
echo tauri-build = { version = "1.4", features = [] }
echo.
echo [features]
echo default = ["custom-protocol"]
echo custom-protocol = ["tauri/custom-protocol"]
echo.
echo [dependencies]
echo serde_json = "1.0"
echo serde = { version = "1.0", features = ["derive"] }
echo tauri = { version = "1.4", default-features = false, features = ["wry", "custom-protocol", "shell-open", "http-request"] }
echo tokio = { version = "1", features = ["rt-multi-thread", "macros", "sync", "time"] }
echo reqwest = { version = "0.11", default-features = false, features = ["json", "blocking", "rustls-tls"] }
echo axum = { version = "0.6", default-features = false, features = ["http1", "json", "tokio"] }
echo tower = { version = "0.4", default-features = false, features = ["util"] }
echo tower-http = { version = "0.4", default-features = false, features = ["cors", "fs"] }
echo.
echo [profile.release]
echo panic = "abort"
echo opt-level = 2
echo codegen-units = 16
echo lto = false
echo strip = true
) > src-tauri\Cargo.toml

echo [2/3] Cleaning previous corrupted cache...
cd src-tauri
call cargo clean
cd ..

echo [3/3] Compiling Tauri Desktop App in single-thread mode (Low RAM)...
set CARGO_BUILD_JOBS=1
call npx tauri build -- --jobs 1

echo.
echo ========================================================
echo   BUILD PROCESS FINISHED!
echo   Installer location: src-tauri\target\release\bundle\nsis\
echo ========================================================
pause
