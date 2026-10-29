// 工具函数
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并 Tailwind CSS 类名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 限制数值在指定范围内
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 下载 Data URL 为文件
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 将 Blob 转换为 Data URL
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 将 Data URL 转换为 Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * 判断颜色是否为“接近白色/透明”（在白色背景上几乎不可见）
 * 支持 #rgb / #rrggbb / rgba() / rgb() / 常见命名色
 */
export function isNearWhiteColor(color?: string): boolean {
  if (!color) return true;
  const trimmed = color.trim();
  if (trimmed === "transparent") return true;

  // 命名颜色
  const named: Record<string, string> = {
    white: "#ffffff",
    black: "#000000",
    red: "#ff0000",
    gray: "#808080",
    grey: "#808080",
  };
  const src = named[trimmed.toLowerCase()] ?? trimmed;

  let r = 0, g = 0, b = 0;
  if (src.startsWith("#")) {
    const hex = src.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      return false;
    }
  } else {
    const match = src.match(/rgba?\(([^)]+)\)/);
    if (match) {
      const parts = match[1].split(",").map((p) => p.trim());
      r = Math.round(Number(parts[0]) || 0);
      g = Math.round(Number(parts[1]) || 0);
      b = Math.round(Number(parts[2]) || 0);
      const a = parts[3] !== undefined ? Number(parts[3]) : 1;
      if (!isNaN(a) && a < 0.5) return true;
    } else {
      return false;
    }
  }

  // 三通道都接近白色（阈值 0.92 = 约 235）
  return r >= 235 && g >= 235 && b >= 235;
}
