// MarkPix - 图片标注工具
// 主入口：支持 CLI 参数解析

// 在 Windows Release 模式下隐藏控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use clap::Parser;
use std::path::PathBuf;

/// MarkPix - 图片标注工具
#[derive(Parser, Debug)]
#[command(name = "markpix")]
#[command(author = "snemc")]
#[command(version = "0.1.0")]
#[command(about = "一个现代化的图片标注工具", long_about = None)]
struct Args {
    /// 要打开的图片文件路径
    #[arg(value_name = "IMAGE")]
    image_path: Option<PathBuf>,
}

fn main() {
    let args = Args::parse();

    // 处理 CLI 传入的图片路径
    let initial_image = args.image_path.and_then(|path| {
        // 转换为绝对路径
        let abs_path = if path.is_absolute() {
            path
        } else {
            std::env::current_dir()
                .ok()
                .map(|cwd| cwd.join(&path))
                .unwrap_or(path)
        };

        // 验证文件存在
        if abs_path.exists() {
            abs_path.to_str().map(|s| s.to_string())
        } else {
            eprintln!("警告: 文件不存在 - {}", abs_path.display());
            None
        }
    });

    markpix_lib::run_with_args(initial_image)
}
