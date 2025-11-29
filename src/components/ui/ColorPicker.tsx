// 颜色选择器组件
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

// 预设颜色
const presetColors = [
  "#ef4444", // 红色
  "#f97316", // 橙色
  "#eab308", // 黄色
  "#22c55e", // 绿色
  "#06b6d4", // 青色
  "#3b82f6", // 蓝色
  "#8b5cf6", // 紫色
  "#ec4899", // 粉色
  "#000000", // 黑色
  "#ffffff", // 白色
  "#6b7280", // 灰色
  "transparent", // 透明
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
            "absolute z-50 mt-2 p-3 rounded-lg shadow-lg",
            "bg-popover border border-border",
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
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={customColor === "transparent" ? "#ffffff" : customColor}
              onChange={(e) => {
                setCustomColor(e.target.value);
                onChange(e.target.value);
              }}
              className="w-8 h-8 rounded cursor-pointer border-0"
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
              className={cn(
                "flex-1 px-2 py-1 text-xs rounded border border-input",
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
