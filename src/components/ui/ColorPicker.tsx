// 颜色选择器组件
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

// 预设颜色 - 更丰富的调色板
const presetColors = [
  // 第一行：鲜艳色
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6",
  // 第二行：深色
  "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0891b2", "#2563eb",
  // 第三行：浅色
  "#fca5a5", "#fdba74", "#fde047", "#86efac", "#67e8f9", "#93c5fd",
  // 第四行：紫粉灰
  "#8b5cf6", "#a855f7", "#ec4899", "#f472b6", "#000000", "#ffffff",
  // 第五行：灰色系
  "#1f2937", "#4b5563", "#9ca3af", "#d1d5db", "#f3f4f6", "transparent",
];

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleColorSelect = (color: string) => {
    onChange(color);
    setCustomColor(color);
    setIsOpen(false);
  };

  const isTransparent = value === "transparent";

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* 当前颜色按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-8 h-8 rounded-md border-2 border-border shadow-sm",
          "hover:ring-2 hover:ring-ring hover:ring-offset-1",
          "transition-all duration-150",
          isTransparent && "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0iI2NjYyIvPjxyZWN0IHg9IjgiIHk9IjgiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNjY2MiLz48L3N2Zz4=')]"
        )}
        style={{
          backgroundColor: isTransparent ? undefined : value,
        }}
      />

      {/* 颜色选择面板 */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 top-full mt-2 p-3 rounded-lg shadow-xl",
            "bg-white/95 dark:bg-gray-800/95 backdrop-blur-md",
            "border border-gray-200 dark:border-gray-700",
            "animate-in fade-in-0 zoom-in-95"
          )}
        >
          {/* 预设颜色网格 */}
          <div className="grid grid-cols-6 gap-1.5 mb-3">
            {presetColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleColorSelect(color)}
                className={cn(
                  "w-6 h-6 rounded-md border border-border",
                  "hover:scale-110 transition-transform",
                  value === color && "ring-2 ring-ring ring-offset-1",
                  color === "transparent" &&
                    "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0iI2NjYyIvPjxyZWN0IHg9IjgiIHk9IjgiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNjY2MiLz48L3N2Zz4=')]"
                )}
                style={{
                  backgroundColor:
                    color === "transparent" ? undefined : color,
                }}
                title={color === "transparent" ? "透明" : color}
              />
            ))}
          </div>

          {/* 自定义颜色输入 */}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <label className="text-xs text-muted-foreground">自定义</label>
            <input
              type="color"
              value={customColor === "transparent" ? "#ffffff" : customColor}
              onChange={(e) => {
                setCustomColor(e.target.value);
                onChange(e.target.value);
              }}
              className="w-8 h-8 rounded cursor-pointer border border-border"
            />
            <input
              type="text"
              value={customColor}
              onChange={(e) => {
                setCustomColor(e.target.value);
                if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                  onChange(e.target.value);
                }
              }}
              onBlur={(e) => {
                // 失焦时如果是有效颜色则应用
                if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                  onChange(e.target.value);
                }
              }}
              className={cn(
                "w-20 px-2 py-1 text-xs rounded border border-input",
                "bg-background text-foreground",
                "focus:outline-none focus:ring-1 focus:ring-ring"
              )}
              placeholder="#000000"
            />
          </div>
        </div>
      )}
    </div>
  );
}
