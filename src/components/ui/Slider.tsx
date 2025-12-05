// 滑块组件 - 支持滑动、输入、滚轮调节
import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  editable?: boolean;
  className?: string;
  previewColor?: string; // 显示预览圆点的颜色
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = true,
  editable = true,
  className,
  previewColor,
}: SliderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(Math.round(value)));
  const inputRef = useRef<HTMLInputElement>(null);

  // 限制值在范围内
  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max]);

  // 处理滚轮
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -step : step;
    onChange(clamp(value + delta));
  }, [value, step, onChange, clamp]);

  // 开始编辑
  const startEditing = () => {
    if (!editable) return;
    setInputValue(String(Math.round(value)));
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  // 结束编辑
  const endEditing = () => {
    setIsEditing(false);
    const num = parseInt(inputValue, 10);
    if (!isNaN(num)) {
      onChange(clamp(num));
    }
  };

  // 处理输入键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      endEditing();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const num = parseInt(inputValue, 10) || value;
      setInputValue(String(clamp(num + step)));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const num = parseInt(inputValue, 10) || value;
      setInputValue(String(clamp(num - step)));
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)} onWheel={handleWheel}>
      {label && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {label}
        </span>
      )}
      {/* 预览圆点 */}
      {previewColor && (
        <div
          className="flex-shrink-0 rounded-full"
          style={{
            width: Math.max(4, Math.min(value, 20)),
            height: Math.max(4, Math.min(value, 20)),
            backgroundColor: previewColor,
          }}
        />
      )}
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className={cn(
          "flex-1 h-2 min-w-[60px] rounded-full appearance-none cursor-pointer",
          "bg-gray-200 dark:bg-gray-700", // 深色模式下轨道颜色更深
          "[&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:w-4",
          "[&::-webkit-slider-thumb]:h-4",
          "[&::-webkit-slider-thumb]:rounded-full",
          "[&::-webkit-slider-thumb]:bg-blue-500 dark:[&::-webkit-slider-thumb]:bg-blue-400", // 深色模式下滑块颜色稍亮
          "[&::-webkit-slider-thumb]:shadow-md",
          "[&::-webkit-slider-thumb]:hover:scale-110",
          "[&::-webkit-slider-thumb]:transition-transform",
          "[&::-moz-range-thumb]:w-4",
          "[&::-moz-range-thumb]:h-4",
          "[&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:bg-blue-500 dark:[&::-moz-range-thumb]:bg-blue-400",
          "[&::-moz-range-thumb]:border-0",
          "[&::-moz-range-track]:bg-gray-200 dark:bg-gray-700",
          "[&::-moz-range-track]:rounded-full",
          "[&::-moz-range-track]:h-2"
        )}
      />
      {showValue && (
        isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={endEditing}
            onKeyDown={handleKeyDown}
            className="w-10 text-xs text-center bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 tabular-nums"
            autoFocus
          />
        ) : (
          <span
            onClick={startEditing}
            className={cn(
              "text-xs text-gray-500 dark:text-gray-400 w-10 text-center tabular-nums rounded px-1 py-0.5",
              editable && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
            title={editable ? "点击编辑" : undefined}
          >
            {Math.round(value)}
          </span>
        )
      )}
    </div>
  );
}
