// MarkPix - 图片标注工具
// Rust 后端核心模块

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use tauri::State;

/// 应用状态：存储 CLI 传入的初始图片路径
pub struct AppState {
    pub initial_image_path: Mutex<Option<String>>,
    pub config: Mutex<AppConfig>,
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
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    /// 自定义动作列表
    pub custom_actions: Vec<CustomAction>,
}

impl AppConfig {
    /// 从配置文件加载
    pub fn load() -> Self {
        let config_path = Self::config_path();
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
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

    /// 带示例的默认配置
    fn default_with_examples() -> Self {
        Self {
            custom_actions: vec![
                CustomAction {
                    name: "OCR 识别".to_string(),
                    command: "echo '图片路径: {file}'".to_string(),
                    icon: Some("scan".to_string()),
                },
                CustomAction {
                    name: "上传到图床".to_string(),
                    command: "echo '上传: {file}'".to_string(),
                    icon: Some("upload".to_string()),
                },
            ],
        }
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

/// 执行自定义动作
#[tauri::command]
fn execute_custom_action(
    action_index: usize,
    image_data: String,
    state: State<AppState>,
) -> Result<String, String> {
    let config = state.config.lock().unwrap();
    let action = config
        .custom_actions
        .get(action_index)
        .ok_or("无效的动作索引")?
        .clone();
    drop(config);

    // 创建临时文件
    let temp_dir = tempfile::tempdir().map_err(|e| format!("创建临时目录失败: {}", e))?;
    let temp_path = temp_dir.path().join("markpix-temp.png");

    // 保存图片到临时文件
    let base64_data = image_data
        .split(',')
        .nth(1)
        .ok_or("无效的图片数据格式")?;
    let bytes = STANDARD
        .decode(base64_data)
        .map_err(|e| format!("Base64 解码失败: {}", e))?;
    fs::write(&temp_path, bytes).map_err(|e| format!("保存临时文件失败: {}", e))?;

    // 替换命令中的 {file} 占位符
    let command = action.command.replace("{file}", temp_path.to_str().unwrap_or(""));

    // 执行 Shell 命令
    let output = Command::new("sh")
        .arg("-c")
        .arg(&command)
        .output()
        .map_err(|e| format!("执行命令失败: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("命令执行失败:\n{}\n{}", stdout, stderr))
    }
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

/// 复制图片到剪贴板（Wayland 使用 wl-copy）
#[tauri::command]
fn copy_image_to_clipboard(path: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        // 优先尝试 wl-copy (Wayland)
        let wl_result = Command::new("wl-copy")
            .args(["--type", "image/png"])
            .stdin(std::process::Stdio::piped())
            .spawn()
            .and_then(|mut child| {
                use std::io::Write;
                let image_data = std::fs::read(&path)
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
                if let Some(stdin) = child.stdin.as_mut() {
                    stdin.write_all(&image_data)?;
                }
                child.wait()
            });
        
        if wl_result.is_ok() {
            return Ok(());
        }
        
        // 回退到 xclip (X11)
        let output = Command::new("xclip")
            .args(["-selection", "clipboard", "-t", "image/png", "-i", &path])
            .output()
            .map_err(|e| format!("执行剪贴板命令失败: {}。请确保已安装 wl-copy (wl-clipboard) 或 xclip", e))?;
        
        if !output.status.success() {
            return Err(format!("剪贴板命令执行失败: {}", String::from_utf8_lossy(&output.stderr)));
        }
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("osascript")
            .args(["-e", &format!("set the clipboard to (read (POSIX file \"{}\") as TIFF picture)", path)])
            .output()
            .map_err(|e| format!("复制到剪贴板失败: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("powershell")
            .args(["-Command", &format!("Set-Clipboard -Path '{}'", path)])
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    run_with_args(None)
}

/// 带参数运行（供 main.rs 调用）
pub fn run_with_args(initial_image: Option<String>) {
    let app_state = AppState {
        initial_image_path: Mutex::new(initial_image),
        config: Mutex::new(AppConfig::load()),
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
            execute_custom_action,
            reload_config,
            get_config_path,
            copy_image_to_clipboard,
            open_directory,
        ])
        .run(tauri::generate_context!())
        .expect("启动 Tauri 应用时发生错误");
}
