// 自定义动作面板
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  Scan,
  Upload,
  Terminal,
  Loader2,
} from "lucide-react";

interface CustomActionsPanelProps {
  getCanvasDataUrl: () => Promise<string | null>;
  imagePath?: string | null;
}

// 图标映射
const iconMap: Record<string, React.ReactNode> = {
  scan: <Scan size={16} />,
  upload: <Upload size={16} />,
  terminal: <Terminal size={16} />,
};

export function CustomActionsPanel({ getCanvasDataUrl, imagePath }: CustomActionsPanelProps) {
  const { customActions } = useEditorStore();
  const [executingIndex, setExecutingIndex] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);

  // 执行自定义动作
  const handleExecute = async (index: number) => {
    setExecutingIndex(index);
    setResult(null);

    try {
      // 优先使用原始图片路径，否则使用画布数据
      if (imagePath) {
        const output = await invoke<string>("execute_custom_action", {
          actionIndex: index,
          imagePath: imagePath,
        });
        setResult(output);
      } else {
        const dataUrl = await getCanvasDataUrl();
        if (!dataUrl) {
          setResult("错误: 无法获取画布数据");
          return;
        }
        const output = await invoke<string>("execute_custom_action", {
          actionIndex: index,
          imageData: dataUrl,
        });
        setResult(output);
      }
    } catch (error) {
      setResult(`错误: ${error}`);
    } finally {
      setExecutingIndex(null);
    }
  };

  if (customActions.length === 0) return null;

  return (
    <div className="absolute z-10 top-4 right-4">
      {/* 动作列表 */}
      <div className="flex flex-col gap-2 p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="text-xs font-medium text-muted-foreground px-1">自定义动作</div>
        {customActions.map((action, index) => (
          <Tooltip key={index} content={action.name} side="left">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleExecute(index)}
              disabled={executingIndex !== null}
              className="justify-start gap-2"
            >
              {executingIndex === index ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                iconMap[action.icon || "terminal"] || <Terminal size={14} />
              )}
              <span className="text-xs">{action.name}</span>
            </Button>
          </Tooltip>
        ))}
      </div>

      {/* 执行结果 */}
      {result && (
        <div className="mt-2 p-2 rounded-lg max-w-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg text-xs text-muted-foreground">
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
