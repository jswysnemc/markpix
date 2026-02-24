// MarkPix - 图片标注工具
// 主入口：支持 CLI 参数解析

// 在 Windows Release 模式下隐藏控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use clap::Parser;
use std::path::PathBuf;
use std::io::{self, Read};

/// MarkPix - 图片标注工具
#[derive(Parser, Debug)]
#[command(name = "markpix")]
#[command(author = "snemc")]
#[command(version = "0.5.4")]
#[command(about = "一个现代化的图片标注工具", long_about = None)]
struct Args {
    /// 要打开的图片文件路径（位置参数）
    #[arg(value_name = "IMAGE")]
    image_path: Option<PathBuf>,

    /// 配置文件路径，默认读取 ~/.config/markpix/config.toml
    #[arg(short = 'c', long = "config")]
    config: Option<PathBuf>,

    /// 输入图片路径，使用 '-' 从 stdin 读取
    #[arg(short = 'f', long = "filename")]
    filename: Option<String>,

    /// 输出文件名模式，使用 '-' 输出到 stdout
    /// 支持占位符: {input_file_base}, {YYYY_MM_DD-hh-mm-ss}
    #[arg(short = 'o', long = "output-filename")]
    output_filename: Option<String>,

    /// 启动时最大化窗口
    #[arg(long = "fullscreen")]
    fullscreen: bool,
}

fn main() {
    let args = Args::parse();

    // 处理输入图片路径
    // 优先级: -f/--filename > 位置参数
    let initial_image = if let Some(ref filename) = args.filename {
        if filename == "-" {
            // 从 stdin 读取图片数据
            read_image_from_stdin()
        } else {
            resolve_path(filename)
        }
    } else {
        args.image_path.and_then(|path| {
            path.to_str().and_then(|s| resolve_path(s))
        })
    };

    // 处理配置文件路径
    let config_path = args.config.and_then(|p| p.to_str().map(|s| s.to_string()));

    // 处理输出文件名模式
    let output_pattern = args.output_filename;

    markpix_lib::run_with_args(initial_image, config_path, output_pattern, args.fullscreen)
}

/// 解析路径为绝对路径
fn resolve_path(path: &str) -> Option<String> {
    let path = PathBuf::from(path);
    let abs_path = if path.is_absolute() {
        path
    } else {
        std::env::current_dir()
            .ok()
            .map(|cwd| cwd.join(&path))
            .unwrap_or(path)
    };

    if abs_path.exists() {
        abs_path.to_str().map(|s| s.to_string())
    } else {
        eprintln!("警告: 文件不存在 - {}", abs_path.display());
        None
    }
}

/// 从 stdin 读取图片数据并保存到临时文件
fn read_image_from_stdin() -> Option<String> {
    let mut buffer = Vec::new();
    if io::stdin().read_to_end(&mut buffer).is_ok() && !buffer.is_empty() {
        // 保存到临时文件
        let temp_dir = std::env::temp_dir().join("markpix");
        std::fs::create_dir_all(&temp_dir).ok()?;
        
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let temp_path = temp_dir.join(format!("stdin-{}.png", timestamp));
        
        std::fs::write(&temp_path, buffer).ok()?;
        temp_path.to_str().map(|s| s.to_string())
    } else {
        None
    }
}
