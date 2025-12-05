// 下拉选择组件
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "请选择",
  className,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // 检测下拉框是否会超出窗口
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownHeight = options.length * 32 + 8; // 估算下拉框高度
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // 如果下方空间不够且上方空间更大，则向上弹出
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        setDropUp(true);
      } else {
        setDropUp(false);
      }
    }
  }, [isOpen, options.length]);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-1.5",
          "min-w-[100px] rounded-md border border-input",
          "bg-background text-sm",
          "hover:bg-accent hover:text-accent-foreground",
          "focus:outline-none focus:ring-1 focus:ring-ring"
        )}
      >
        <span className={cn(!selectedOption && "text-muted-foreground")}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className={cn(
            "absolute z-50 w-full rounded-md border border-gray-200 dark:border-gray-700",
            "bg-white dark:bg-gray-800 shadow-lg max-h-48 overflow-auto",
            "animate-in fade-in-0 zoom-in-95",
            dropUp ? "bottom-full mb-1" : "top-full mt-1"
          )}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={cn(
                "w-full px-3 py-1.5 text-sm text-left",
                "hover:bg-accent hover:text-accent-foreground",
                "first:rounded-t-md last:rounded-b-md",
                value === option.value && "bg-accent text-accent-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
