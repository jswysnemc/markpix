// 智能工具栏组件 - 根据图片比例自动调整布局
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { ToolConfigPanel } from "./ToolConfigPanel";
import {
  MousePointer2,
  Hand,
  Square,
  Circle,
  ArrowRight,
  Minus,
  Type,
  Pencil,
  Hash,
  Grid3X3,
  Crop,
  Undo2,
  Redo2,
  Trash2,
  X,
  Download,
  Copy,
  FolderOpen,
  Settings,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { ToolType } from "@/types";

// 工具定义
const tools: { type: ToolType; icon: React.ReactNode; label: string }[] = [
  { type: "select", icon: <MousePointer2 size={18} />, label: "选择 (V)" },
  { type: "pan", icon: <Hand size={18} />, label: "平移 (H)" },
  { type: "rectangle", icon: <Square size={18} />, label: "矩形 (R)" },
  { type: "ellipse", icon: <Circle size={18} />, label: "椭圆 (E)" },
  { type: "arrow", icon: <ArrowRight size={18} />, label: "箭头 (A)" },
  { type: "line", icon: <Minus size={18} />, label: "直线 (L)" },
  { type: "text", icon: <Type size={18} />, label: "文字 (T)" },
  { type: "brush", icon: <Pencil size={18} />, label: "画笔 (B)" },
  { type: "marker", icon: <Hash size={18} />, label: "序号 (M)" },
  { type: "blur", icon: <Grid3X3 size={18} />, label: "马赛克 (U)" },
  { type: "crop", icon: <Crop size={18} />, label: "裁剪 (C)" },
];

interface ToolbarProps {
  onOpenFile: () => void;
  onSave: () => void;
  onCopy: () => void;
  onOpenSettings: () => void;
}

export function Toolbar({
  onOpenFile,
  onSave,
  onCopy,
  onOpenSettings,
}: ToolbarProps) {
  const {
    currentTool,
    setCurrentTool,
    toolbarOrientation,
    canUndo,
    canRedo,
    undo,
    redo,
    clearAnnotations,
    viewState,
    setViewState,
    resetView,
    image,
    selectedIds,
    deleteAnnotation,
    clearSelection,
  } = useEditorStore();

  const isHorizontal = toolbarOrientation === "horizontal";

  // 缩放控制
  const handleZoomIn = () => {
    setViewState({ scale: Math.min(viewState.scale * 1.2, 5) });
  };

  const handleZoomOut = () => {
    setViewState({ scale: Math.max(viewState.scale / 1.2, 0.1) });
  };

  return (
    <div
      className={cn(
        "absolute z-10 flex gap-1 p-2 rounded-lg",
        "bg-background/95 backdrop-blur-sm border border-border shadow-lg",
        isHorizontal
          ? "bottom-4 left-1/2 -translate-x-1/2 flex-row items-center"
          : "right-4 top-1/2 -translate-y-1/2 flex-col items-center"
      )}
    >
      {/* 文件操作 */}
      <div
        className={cn(
          "flex gap-1",
          isHorizontal ? "flex-row" : "flex-col",
          "pb-1 border-b border-border",
          !isHorizontal && "pb-0 pr-1 border-b-0 border-r"
        )}
      >
        <Tooltip content="打开文件" side={isHorizontal ? "top" : "left"}>
          <Button variant="ghost" size="icon-sm" onClick={onOpenFile}>
            <FolderOpen size={18} />
          </Button>
        </Tooltip>
        <Tooltip content="保存" side={isHorizontal ? "top" : "left"}>
          <Button variant="ghost" size="icon-sm" onClick={onSave} disabled={!image}>
            <Download size={18} />
          </Button>
        </Tooltip>
        <Tooltip content="复制到剪贴板" side={isHorizontal ? "top" : "left"}>
          <Button variant="ghost" size="icon-sm" onClick={onCopy} disabled={!image}>
            <Copy size={18} />
          </Button>
        </Tooltip>
      </div>

      {/* 绘图工具 */}
      <div
        className={cn(
          "flex gap-1",
          isHorizontal ? "flex-row" : "flex-col",
          "py-1 border-b border-border",
          !isHorizontal && "py-0 px-1 border-b-0 border-r"
        )}
      >
        {tools.map((tool) => (
          <Tooltip
            key={tool.type}
            content={tool.label}
            side={isHorizontal ? "top" : "left"}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              active={currentTool === tool.type}
              onClick={() => setCurrentTool(tool.type)}
              disabled={!image && tool.type !== "select"}
            >
              {tool.icon}
            </Button>
          </Tooltip>
        ))}
      </div>

      {/* 编辑操作 */}
      <div
        className={cn(
          "flex gap-1",
          isHorizontal ? "flex-row" : "flex-col",
          "py-1 border-b border-border",
          !isHorizontal && "py-0 px-1 border-b-0 border-r"
        )}
      >
        <Tooltip content="撤销 (Ctrl+Z)" side={isHorizontal ? "top" : "left"}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={undo}
            disabled={!canUndo()}
          >
            <Undo2 size={18} />
          </Button>
        </Tooltip>
        <Tooltip content="重做 (Ctrl+Y)" side={isHorizontal ? "top" : "left"}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={redo}
            disabled={!canRedo()}
          >
            <Redo2 size={18} />
          </Button>
        </Tooltip>
        <Tooltip content="删除选中 (Delete)" side={isHorizontal ? "top" : "left"}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              selectedIds.forEach((id) => deleteAnnotation(id));
              clearSelection();
            }}
            disabled={selectedIds.length === 0}
          >
            <X size={18} />
          </Button>
        </Tooltip>
        <Tooltip content="清空所有标注" side={isHorizontal ? "top" : "left"}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={clearAnnotations}
            disabled={!image}
          >
            <Trash2 size={18} />
          </Button>
        </Tooltip>
      </div>

      {/* 视图控制 */}
      <div
        className={cn(
          "flex gap-1",
          isHorizontal ? "flex-row" : "flex-col",
          "py-1 border-b border-border",
          !isHorizontal && "py-0 px-1 border-b-0 border-r"
        )}
      >
        <Tooltip content="放大" side={isHorizontal ? "top" : "left"}>
          <Button variant="ghost" size="icon-sm" onClick={handleZoomIn} disabled={!image}>
            <ZoomIn size={18} />
          </Button>
        </Tooltip>
        <Tooltip content="缩小" side={isHorizontal ? "top" : "left"}>
          <Button variant="ghost" size="icon-sm" onClick={handleZoomOut} disabled={!image}>
            <ZoomOut size={18} />
          </Button>
        </Tooltip>
        <Tooltip content="重置视图" side={isHorizontal ? "top" : "left"}>
          <Button variant="ghost" size="icon-sm" onClick={resetView} disabled={!image}>
            <RotateCcw size={18} />
          </Button>
        </Tooltip>
      </div>

      {/* 设置 */}
      <div className={cn("flex gap-1", isHorizontal ? "flex-row" : "flex-col")}>
        <Tooltip content="设置" side={isHorizontal ? "top" : "left"}>
          <Button variant="ghost" size="icon-sm" onClick={onOpenSettings}>
            <Settings size={18} />
          </Button>
        </Tooltip>
      </div>

      {/* 缩放比例显示 */}
      {image && (
        <div
          className={cn(
            "flex items-center justify-center px-2 text-xs text-muted-foreground",
            "min-w-[50px]"
          )}
        >
          {Math.round(viewState.scale * 100)}%
        </div>
      )}
    </div>
  );
}

// 工具配置面板（浮动）
export function FloatingToolConfig() {
  const { currentTool, toolbarOrientation, image } = useEditorStore();

  // 只有绘图工具才显示配置面板
  const showConfig = [
    "rectangle",
    "ellipse",
    "arrow",
    "line",
    "text",
    "brush",
    "marker",
    "blur",
  ].includes(currentTool);

  if (!showConfig || !image) return null;

  const isHorizontal = toolbarOrientation === "horizontal";

  return (
    <div
      className={cn(
        "absolute z-10 p-3 rounded-lg",
        "bg-background/95 backdrop-blur-sm border border-border shadow-lg",
        isHorizontal
          ? "top-4 left-1/2 -translate-x-1/2"
          : "left-4 top-1/2 -translate-y-1/2"
      )}
    >
      <ToolConfigPanel orientation={isHorizontal ? "horizontal" : "vertical"} />
    </div>
  );
}
