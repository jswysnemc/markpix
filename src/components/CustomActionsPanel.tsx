// 自定义动作面板
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import {
  Scan,
  Upload,
  Terminal,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

interface CustomActionsPanelProps {
  getCanvasDataUrl: () => string | null;
}

// 图标映射
const iconMap: Record<string, React.ReactNode> = {
  scan: <Scan size={16} />,
  upload: <Upload size={16} />,
  terminal: <Terminal size={16} />,
};

export function CustomActionsPanel({ getCanvasDataUrl }: CustomActionsPanelProps) {
  const { customActions, toolbarOrientation } = useEditorStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [executingIndex, setExecutingIndex] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const isHorizontal = toolbarOrientation === "horizontal";

  // 执行自定义动作
  const handleExecute = async (index: number) => {
    const dataUrl = getCanvasDataUrl();
    if (!dataUrl) {
      alert("无法获取画布数据");
      return;
    }

    setExecutingIndex(index);
    setResult(null);

    try {
      const output = await invoke<string>("execute_custom_action", {
        actionIndex: index,
        imageData: dataUrl,
      });
      setResult(output);
    } catch (error) {
      setResult(`错误: ${error}`);
    } finally {
      setExecutingIndex(null);
    }
  };

  if (customActions.length === 0) return null;

  return (
    <div
      className={cn(
        "absolute z-10",
        isHorizontal
          ? "top-4 right-4"
          : "bottom-4 left-4"
      )}
    >
      {/* 展开/收起按钮 */}
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="mb-2"
      >
        {isExpanded ? (
          isHorizontal ? <ChevronRight size={16} /> : <ChevronLeft size={16} />
        ) : (
          <Terminal size={16} />
        )}
      </Button>

      {/* 动作列表 */}
      {isExpanded && (
        <div
          className={cn(
            "flex gap-2 p-2 rounded-lg",
            "bg-background/95 backdrop-blur-sm border border-border shadow-lg",
            isHorizontal ? "flex-col" : "flex-row"
          )}
        >
          {customActions.map((action, index) => (
            <Tooltip
              key={index}
              content={action.name}
              side={isHorizontal ? "left" : "top"}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleExecute(index)}
                disabled={executingIndex !== null}
              >
                {executingIndex === index ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  iconMap[action.icon || "terminal"] || <Terminal size={16} />
                )}
              </Button>
            </Tooltip>
          ))}
        </div>
      )}

      {/* 执行结果 */}
      {result && (
        <div
          className={cn(
            "mt-2 p-2 rounded-lg max-w-xs",
            "bg-background/95 backdrop-blur-sm border border-border shadow-lg",
            "text-xs text-muted-foreground"
          )}
        >
          <div className="flex justify-between items-center mb-1">
            <span className="font-medium">执行结果</span>
            <button
              onClick={() => setResult(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
          <pre className="whitespace-pre-wrap break-all max-h-32 overflow-auto">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}
