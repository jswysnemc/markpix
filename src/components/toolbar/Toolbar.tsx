// 顶部工具栏组件 - 伪装为窗口标题栏
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { ToolConfigPanel } from "./ToolConfigPanel";
import { SelectedAnnotationConfig } from "./SelectedAnnotationConfig";
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
  ImagePlus,
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
  Terminal,
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
  { type: "image", icon: <ImagePlus size={18} />, label: "插入图片 (I)" },
];

interface ToolbarProps {
  onOpenFile: () => void;
  onSave: () => void;
  onCopy: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
  onInsertImage?: () => void;
  onOpenCustomActions?: () => void;
}

export function Toolbar({
  onOpenFile,
  onSave,
  onCopy,
  onOpenSettings,
  onClose,
  onInsertImage,
  onOpenCustomActions,
}: ToolbarProps) {
  const {
    currentTool,
    setCurrentTool,
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
    customActions,
  } = useEditorStore();

  const handleZoomIn = () => setViewState({ scale: Math.min(viewState.scale * 1.2, 5) });
  const handleZoomOut = () => setViewState({ scale: Math.max(viewState.scale / 1.2, 0.1) });

  return (
    // 1. 最外层容器：仅负责定位和尺寸，没有任何事件逻辑
    <div className="absolute top-0 left-0 right-0 h-10 z-50 select-none">
      
      {/* 2. 拖拽层 (底层 z-0) - 独立的空 div，专门接收拖拽信号 */}
      <div 
        className="absolute inset-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 z-0"
        data-tauri-drag-region
      />

      {/* 3. 交互层 (顶层 z-10) - pointer-events-none 让点击穿透到拖拽层 */}
      <div className="absolute inset-0 flex items-center z-10 pointer-events-none">
        
        {/* 文件操作 - pointer-events-auto 恢复交互 */}
        <div className="flex items-center gap-0.5 px-1 border-r border-gray-200 dark:border-gray-700 pointer-events-auto">
          <Tooltip content="打开文件" side="bottom" className="left-0 translate-x-0">
            <Button variant="ghost" size="icon-sm" onClick={onOpenFile}>
              <FolderOpen size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="保存" side="bottom">
            <Button variant="ghost" size="icon-sm" onClick={onSave} disabled={!image}>
              <Download size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="复制到剪贴板" side="bottom">
            <Button variant="ghost" size="icon-sm" onClick={onCopy} disabled={!image}>
              <Copy size={16} />
            </Button>
          </Tooltip>
        </div>

        {/* 绘图工具 */}
        <div className="flex items-center gap-0.5 px-1 border-r border-gray-200 dark:border-gray-700 pointer-events-auto">
          {tools.map((tool) => (
            <Tooltip key={tool.type} content={tool.label} side="bottom">
              <Button
                variant={currentTool === tool.type ? "default" : "ghost"}
                size="icon-sm"
                onClick={() => tool.type === "image" && onInsertImage ? onInsertImage() : setCurrentTool(tool.type)}
                disabled={!image && tool.type !== "select"}
                className={cn(
                  "transition-all duration-150",
                  currentTool === tool.type && "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                )}
              >
                {tool.icon}
              </Button>
            </Tooltip>
          ))}
        </div>

        {/* 编辑操作 */}
        <div className="flex items-center gap-0.5 px-1 border-r border-gray-200 dark:border-gray-700 pointer-events-auto">
          <Tooltip content="撤销 (Ctrl+Z)" side="bottom">
            <Button variant="ghost" size="icon-sm" onClick={undo} disabled={!canUndo()}>
              <Undo2 size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="重做 (Ctrl+Y)" side="bottom">
            <Button variant="ghost" size="icon-sm" onClick={redo} disabled={!canRedo()}>
              <Redo2 size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="删除选中 (Delete)" side="bottom">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => { selectedIds.forEach((id) => deleteAnnotation(id)); clearSelection(); }}
              disabled={selectedIds.length === 0}
            >
              <X size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="清空所有标注" side="bottom">
            <Button variant="ghost" size="icon-sm" onClick={clearAnnotations} disabled={!image}>
              <Trash2 size={16} />
            </Button>
          </Tooltip>
        </div>

        {/* 视图控制 */}
        <div className="flex items-center gap-0.5 px-1 border-r border-gray-200 dark:border-gray-700 pointer-events-auto">
          <Tooltip content="放大" side="bottom">
            <Button variant="ghost" size="icon-sm" onClick={handleZoomIn} disabled={!image}>
              <ZoomIn size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="缩小" side="bottom">
            <Button variant="ghost" size="icon-sm" onClick={handleZoomOut} disabled={!image}>
              <ZoomOut size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="重置视图" side="bottom">
            <Button variant="ghost" size="icon-sm" onClick={resetView} disabled={!image}>
              <RotateCcw size={16} />
            </Button>
          </Tooltip>
          {image && (
            <span className="text-xs text-muted-foreground min-w-[40px] text-center pointer-events-none">
              {Math.round(viewState.scale * 100)}%
            </span>
          )}
        </div>

        {/* 中间空白区域 - 点击会穿透到拖拽层 */}
        <div className="flex-1" />

        {/* 右侧工具区 */}
        <div className="flex items-center gap-0.5 px-1 border-l border-gray-200 dark:border-gray-700 pointer-events-auto">
          {customActions.length > 0 && (
            <Tooltip content="自定义动作" side="bottom">
              <Button variant="ghost" size="icon-sm" onClick={onOpenCustomActions}>
                <Terminal size={16} />
              </Button>
            </Tooltip>
          )}
          <Tooltip content="设置" side="bottom">
            <Button variant="ghost" size="icon-sm" onClick={onOpenSettings}>
              <Settings size={16} />
            </Button>
          </Tooltip>
        </div>

        {/* 关闭按钮 */}
        <div className="pointer-events-auto">
          <Tooltip content="关闭" side="bottom">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className="h-8 w-10 hover:bg-red-500/20 hover:text-red-500"
            >
              <X size={18} />
            </Button>
          </Tooltip>
        </div>

      </div>
    </div>
  );
}

// 工具配置面板（浮动）
export function FloatingToolConfig() {
  const { currentTool, image, selectedIds } = useEditorStore();

  // 绘图工具显示工具配置面板
  const isDrawingTool = [
    "rectangle",
    "ellipse",
    "arrow",
    "line",
    "text",
    "brush",
    "marker",
    "blur",
  ].includes(currentTool);

  // 选中标注时显示标注属性面板
  const hasSelection = selectedIds.length > 0;

  // 显示条件：绘图工具 或 有选中的标注
  const showConfig = isDrawingTool || hasSelection;

  if (!showConfig || !image) return null;

  return (
    <div
      className={cn(
        "absolute z-10 p-2 rounded-lg",
        "bg-white dark:bg-gray-900",
        "border border-gray-200 dark:border-gray-700",
        "shadow-lg",
        "top-4 left-4" // 位于画布左上角
      )}
    >
      {/* 有选中的标注时显示标注属性面板，否则显示工具配置面板 */}
      {hasSelection ? (
        <SelectedAnnotationConfig orientation="horizontal" />
      ) : (
        <ToolConfigPanel orientation="horizontal" />
      )}
    </div>
  );
}
