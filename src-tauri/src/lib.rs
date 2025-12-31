// MarkPix - 图片标注工具
// Rust 后端核心模块

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use tauri::State;

/// 应用状态：存储 CLI 传入的参数
pub struct AppState {
    pub initial_image_path: Mutex<Option<String>>,
    pub config: Mutex<AppConfig>,
    pub cli_config_path: Mutex<Option<String>>,
    pub cli_output_pattern: Mutex<Option<String>>,
}

/// 自定义动作配置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CustomAction {
    /// 动作名称（显示在 UI 上）
    pub name: String,
    /// Shell 命令模板，{file} 会被替换为图片路径
    pub command: String,
    /// 图标名称（可选）
    pub icon: Option<String>,
}

/// 应用配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    /// 主题设置: light, dark, auto
    pub theme: String,
    /// 输出文件命名模式
    pub output_pattern: String,
    /// 自定义动作列表
    pub custom_actions: Vec<CustomAction>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: "auto".to_string(),
            output_pattern: "{input_file_base}_{YYYY_MM_DD-hh-mm-ss}_markpix.png".to_string(),
            custom_actions: vec![],
        }
    }
}

impl AppConfig {
    /// 从默认配置文件加载
    pub fn load() -> Self {
        Self::load_from_path(&Self::config_path())
    }

    /// 从指定路径加载配置
    pub fn load_from(path: &str) -> Self {
        Self::load_from_path(&PathBuf::from(path))
    }

    /// 从指定路径加载配置（内部方法）
    fn load_from_path(config_path: &PathBuf) -> Self {
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(config_path) {
                if let Ok(config) = toml::from_str(&content) {
                    return config;
                }
            }
        }
        // 返回默认配置并创建示例配置文件
        let default_config = Self::default_with_examples();
        let _ = default_config.save();
        default_config
    }

    /// 创建带示例的默认配置
    fn default_with_examples() -> Self {
        let mut config = Self::default();
        config.custom_actions = vec![
            CustomAction {
                name: "打开所在文件夹".to_string(),
                command: if cfg!(target_os = "windows") {
                    "explorer /select, \"{file}\"".to_string()
                } else if cfg!(target_os = "macos") {
                    "open -R \"{file}\"".to_string()
                } else {
                    "xdg-open \"$(dirname \"{file}\")\"".to_string()
                },
                icon: Some("folder".to_string()),
            },
        ];
        config
    }

    /// 保存配置到文件
    pub fn save(&self) -> Result<(), String> {
        let config_path = Self::config_path();
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let content = toml::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(&config_path, content).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// 获取配置文件路径
    fn config_path() -> PathBuf {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("markpix")
            .join("config.toml")
    }
}

/// 获取 CLI 传入的初始图片路径
#[tauri::command]
fn get_initial_image(state: State<AppState>) -> Option<String> {
    state.initial_image_path.lock().unwrap().clone()
}

/// 读取图片文件并返回 Base64 编码
#[tauri::command]
fn read_image_file(path: String) -> Result<String, String> {
    let path = PathBuf::from(&path);
    if !path.exists() {
        return Err(format!("文件不存在: {}", path.display()));
    }

    let data = fs::read(&path).map_err(|e| format!("读取文件失败: {}", e))?;

    // 检测图片格式
    let mime_type = match path.extension().and_then(|e| e.to_str()) {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        _ => "image/png",
    };

    let base64_data = STANDARD.encode(&data);
    Ok(format!("data:{};base64,{}", mime_type, base64_data))
}

/// 保存图片到文件
#[tauri::command]
fn save_image_file(path: String, data: String) -> Result<(), String> {
    // 支持两种格式：完整的 data URL 或纯 base64 数据
    let base64_data = if data.contains(',') {
        // 完整的 data URL 格式: data:image/png;base64,xxxxx
        data.split(',').nth(1).unwrap_or(&data)
    } else {
        // 纯 base64 数据
        &data
    };

    let bytes = STANDARD
        .decode(base64_data)
        .map_err(|e| format!("Base64 解码失败: {}", e))?;

    fs::write(&path, bytes).map_err(|e| format!("保存文件失败: {}", e))?;
    Ok(())
}

/// 获取自定义动作列表
#[tauri::command]
fn get_custom_actions(state: State<AppState>) -> Vec<CustomAction> {
    state.config.lock().unwrap().custom_actions.clone()
}

/// 获取 CLI 指定的输出模式
#[tauri::command]
fn get_cli_output_pattern(state: State<AppState>) -> Option<String> {
    state.cli_output_pattern.lock().unwrap().clone()
}

/// 执行自定义动作
#[tauri::command]
fn execute_custom_action(
    action_index: usize,
    image_path: Option<String>,
    image_data: Option<String>,
    state: State<AppState>,
) -> Result<String, String> {
    let config = state.config.lock().unwrap();
    let action = config
        .custom_actions
        .get(action_index)
        .ok_or("无效的动作索引")?
        .clone();
    drop(config);

    // 确定图片路径
    let file_path = if let Some(path) = image_path {
        // 使用已有的图片路径
        path
    } else if let Some(data) = image_data {
        // 从 base64 数据创建临时文件
        let temp_dir = std::env::temp_dir().join("markpix");
        fs::create_dir_all(&temp_dir).map_err(|e| format!("创建临时目录失败: {}", e))?;
        
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let temp_path = temp_dir.join(format!("markpix-{}.png", timestamp));

        let base64_data = data
            .split(',')
            .nth(1)
            .ok_or("无效的图片数据格式")?;
        let bytes = STANDARD
            .decode(base64_data)
            .map_err(|e| format!("Base64 解码失败: {}", e))?;
        fs::write(&temp_path, &bytes).map_err(|e| format!("保存临时文件失败: {}", e))?;
        
        temp_path.to_string_lossy().to_string()
    } else {
        return Err("需要提供图片路径或图片数据".to_string());
    };

    // 替换命令中的 {file} 占位符
    let command = action.command.replace("{file}", &file_path);

    // 使用 spawn 启动独立子进程，不等待完成
    // 这样子进程被杀掉不会影响主进程
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", &command])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("执行命令失败: {}", e))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        // 使用 nohup 和 & 在后台运行，脱离父进程
        let bg_command = format!("nohup sh -c '{}' >/dev/null 2>&1 &", command.replace("'", "'\"'\"'"));
        Command::new("sh")
            .args(["-c", &bg_command])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("执行命令失败: {}", e))?;
    }

    Ok(format!("已启动: {}", action.name))
}

/// 重新加载配置
#[tauri::command]
fn reload_config(state: State<AppState>) -> Result<(), String> {
    let new_config = AppConfig::load();
    *state.config.lock().unwrap() = new_config;
    Ok(())
}

/// 获取配置文件路径
#[tauri::command]
fn get_config_path() -> String {
    AppConfig::config_path().to_string_lossy().to_string()
}

/// 直接从 base64 数据复制图片到剪贴板（更快，无需临时文件）
#[tauri::command]
fn copy_image_data_to_clipboard(data: String) -> Result<(), String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    
    // 解码 base64 数据
    let image_data = STANDARD.decode(&data)
        .map_err(|e| format!("解码图片数据失败: {}", e))?;
    
    copy_raw_image_to_clipboard(&image_data)
}

/// 复制图片到剪贴板（Wayland 使用 wl-copy）
#[tauri::command]
fn copy_image_to_clipboard(path: String) -> Result<(), String> {
    let image_data = std::fs::read(&path)
        .map_err(|e| format!("读取图片文件失败: {}", e))?;
    copy_raw_image_to_clipboard(&image_data)
}

/// 内部函数：将原始图片数据复制到剪贴板
fn copy_raw_image_to_clipboard(image_data: &[u8]) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        use std::io::Write;
        
        // 优先尝试 wl-copy (Wayland)
        let wl_result = Command::new("wl-copy")
            .args(["--type", "image/png"])
            .stdin(std::process::Stdio::piped())
            .spawn()
            .and_then(|mut child| {
                if let Some(stdin) = child.stdin.as_mut() {
                    stdin.write_all(image_data)?;
                }
                child.wait()
            });
        
        if wl_result.is_ok() {
            return Ok(());
        }
        
        // 回退到 xclip (X11) - 需要通过 stdin 传递数据
        let mut child = Command::new("xclip")
            .args(["-selection", "clipboard", "-t", "image/png"])
            .stdin(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("执行剪贴板命令失败: {}。请确保已安装 wl-copy (wl-clipboard) 或 xclip", e))?;
        
        if let Some(stdin) = child.stdin.as_mut() {
            stdin.write_all(image_data)
                .map_err(|e| format!("写入剪贴板数据失败: {}", e))?;
        }
        
        let status = child.wait()
            .map_err(|e| format!("等待剪贴板命令完成失败: {}", e))?;
        
        if !status.success() {
            return Err("剪贴板命令执行失败".to_string());
        }
    }
    #[cfg(target_os = "macos")]
    {
        // macOS: 保存到临时文件后使用 osascript 复制
        let temp_path = std::env::temp_dir().join("markpix_clipboard.png");
        std::fs::write(&temp_path, image_data)
            .map_err(|e| format!("保存临时文件失败: {}", e))?;
        
        let script = format!(
            "set the clipboard to (read (POSIX file \"{}\") as «class PNGf»)",
            temp_path.display()
        );
        Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| format!("复制到剪贴板失败: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        // Windows: 需要保存到临时文件
        let temp_path = std::env::temp_dir().join("markpix_clipboard.png");
        std::fs::write(&temp_path, image_data)
            .map_err(|e| format!("保存临时文件失败: {}", e))?;
        Command::new("powershell")
            .args(["-Command", &format!("Set-Clipboard -Path '{}'", temp_path.display())])
            .output()
            .map_err(|e| format!("复制到剪贴板失败: {}", e))?;
    }
    Ok(())
}

/// 打开目录（使用系统文件管理器）
#[tauri::command]
fn open_directory(path: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("打开目录失败: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("打开目录失败: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("打开目录失败: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn save_config(app_state: State<AppState>, config: AppConfig) -> Result<(), String> {
    let mut state_config = app_state.config.lock().map_err(|e| e.to_string())?;
    *state_config = config;
    state_config.save()
}

#[tauri::command]
fn get_config(app_state: State<AppState>) -> Result<AppConfig, String> {
    Ok(app_state.config.lock().map_err(|e| e.to_string())?.clone())
}

/// 退出应用程序
#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// 打开开发者工具
#[tauri::command]
fn open_devtools(webview: tauri::WebviewWindow) {
    #[cfg(debug_assertions)]
    {
        if webview.is_devtools_open() {
            webview.close_devtools();
        } else {
            webview.open_devtools();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    run_with_args(None, None, None)
}

/// 带参数运行（供 main.rs 调用）
pub fn run_with_args(
    initial_image: Option<String>,
    config_path: Option<String>,
    output_pattern: Option<String>,
) {
    // 加载配置（优先使用 CLI 指定的配置文件）
    let config = if let Some(ref path) = config_path {
        AppConfig::load_from(path)
    } else {
        AppConfig::load()
    };

    let app_state = AppState {
        initial_image_path: Mutex::new(initial_image),
        config: Mutex::new(config),
        cli_config_path: Mutex::new(config_path),
        cli_output_pattern: Mutex::new(output_pattern),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_initial_image,
            read_image_file,
            save_image_file,
            get_custom_actions,
            get_cli_output_pattern,
            execute_custom_action,
            reload_config,
            get_config_path,
            copy_image_to_clipboard,
            copy_image_data_to_clipboard,
            open_directory,
            exit_app,
            save_config,
            get_config,
            open_devtools,
        ])
        .run(tauri::generate_context!())
        .expect("启动 Tauri 应用时发生错误");
}
