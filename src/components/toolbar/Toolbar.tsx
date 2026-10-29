// 顶部工具栏组件 - 伪装为窗口标题栏（Windows 标准工具栏样式）
import { useEffect, useRef, useState } from "react";
import { cn, clamp } from "@/lib/utils";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { ToolConfigPanel } from "./ToolConfigPanel";
import { SelectedAnnotationConfig } from "./SelectedAnnotationConfig";
import {
  Minus,
  FilePlus2,
  Undo2,
  Redo2,
  Trash2,
  X,
  Download,
  Save,
  Copy,
  FolderOpen,
  Settings,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Terminal,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface ToolbarProps {
  onOpenFile: () => void;
  onCreateBlank: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onCopy: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
  onOpenCustomActions?: () => void;
  isFullscreenMode?: boolean;
}

// Windows 标准扁平工具按钮：28px 方形、浅蓝悬停、无边框
const toolButtonClass =
  "h-7 w-7 rounded-[3px] text-gray-700 hover:bg-[#e5f1fb] hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-white";

// 分组间的 1px 竖直分隔线
function ToolbarSeparator() {
  return <div className="mx-1 h-6 w-px shrink-0 bg-[#d9d9d9] dark:bg-gray-700" />;
}

export function Toolbar({
  onOpenFile,
  onCreateBlank,
  onSave,
  onSaveAs,
  onCopy,
  onOpenSettings,
  onClose,
  onOpenCustomActions,
  isFullscreenMode = false,
}: ToolbarProps) {
  const {
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

  const handleZoomIn = () => setViewState({ scale: viewState.scale * 1.2 });
  const handleZoomOut = () => setViewState({ scale: Math.max(viewState.scale / 1.2, 0.1) });

  // 窗口最大化 / 还原
  const handleToggleMaximize = async () => {
    try {
      await getCurrentWindow().toggleMaximize();
    } catch {}
  };

  // 窗口最小化
  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch {}
  };

  // 窗口控制按钮：占满标题栏高度
  const windowButtonClass =
    "h-full w-11 rounded-none text-gray-700 dark:text-gray-200";

  return (
    // 1. 最外层容器：Windows 风格，紧贴窗口顶部通栏，不浮动
    <div
      className="absolute top-0 left-0 right-0 z-50 h-10 select-none"
      data-tauri-drag-region
    >
      {/* 2. 拖拽层 (底层 z-0) - 独立的空 div，专门接收拖拽信号 */}
      <div
        className="absolute inset-0 z-0 border-b border-[#d9d9d9] bg-[#f3f3f3] dark:border-gray-700 dark:bg-gray-900"
        data-tauri-drag-region
      />

      {/* 3. 交互层 (顶层 z-10) - pointer-events-none 让点击穿透到拖拽层 */}
      <div className="absolute inset-0 z-10 flex items-center pointer-events-none">

        {/* 文件操作（高频） - pointer-events-auto 恢复交互 */}
        <div className="flex items-center gap-0.5 pl-1.5 pr-0.5 pointer-events-auto">
          <Tooltip content="新建白板" side="bottom" className="left-0 translate-x-0">
            <Button variant="ghost" size="icon-sm" className={toolButtonClass} onClick={onCreateBlank}>
              <FilePlus2 size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="打开图片（新标签）" side="bottom" className="left-0 translate-x-0">
            <Button variant="ghost" size="icon-sm" className={toolButtonClass} onClick={onOpenFile}>
              <FolderOpen size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="保存 (Ctrl+S)" side="bottom">
            <Button variant="ghost" size="icon-sm" className={toolButtonClass} onClick={onSave} disabled={!image}>
              <Save size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="另存为" side="bottom">
            <Button variant="ghost" size="icon-sm" className={toolButtonClass} onClick={onSaveAs} disabled={!image}>
              <Download size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="复制到剪贴板" side="bottom">
            <Button variant="ghost" size="icon-sm" className={toolButtonClass} onClick={onCopy} disabled={!image}>
              <Copy size={16} />
            </Button>
          </Tooltip>
        </div>

        <ToolbarSeparator />

        {/* 编辑操作（高频） */}
        <div className="flex items-center gap-0.5 px-0.5 pointer-events-auto">
          <Tooltip content="撤销 (Ctrl+Z)" side="bottom">
            <Button variant="ghost" size="icon-sm" className={toolButtonClass} onClick={undo} disabled={!canUndo()}>
              <Undo2 size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="重做 (Ctrl+Y)" side="bottom">
            <Button variant="ghost" size="icon-sm" className={toolButtonClass} onClick={redo} disabled={!canRedo()}>
              <Redo2 size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="删除选中 (Delete)" side="bottom">
            <Button
              variant="ghost"
              size="icon-sm"
              className={toolButtonClass}
              onClick={() => {
                selectedIds.forEach((id) => deleteAnnotation(id));
                clearSelection();
              }}
              disabled={selectedIds.length === 0}
            >
              <X size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="清空所有标注" side="bottom">
            <Button variant="ghost" size="icon-sm" className={toolButtonClass} onClick={clearAnnotations} disabled={!image}>
              <Trash2 size={16} />
            </Button>
          </Tooltip>
        </div>

        {/* 中间空白区域 - 点击会穿透到拖拽层，可拖动窗口 */}
        <div className="flex-1" />

        {/* 视图缩放（高频） */}
        <div className="flex items-center gap-0.5 px-0.5 pointer-events-auto">
          <Tooltip content="缩小" side="bottom">
            <Button variant="ghost" size="icon-sm" className={toolButtonClass} onClick={handleZoomOut} disabled={!image}>
              <ZoomOut size={16} />
            </Button>
          </Tooltip>
          {image && (
            <span className="min-w-[42px] text-center text-xs tabular-nums text-gray-600 dark:text-gray-300 pointer-events-none">
              {Math.round(viewState.scale * 100)}%
            </span>
          )}
          <Tooltip content="放大" side="bottom">
            <Button variant="ghost" size="icon-sm" className={toolButtonClass} onClick={handleZoomIn} disabled={!image}>
              <ZoomIn size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="重置视图" side="bottom">
            <Button variant="ghost" size="icon-sm" className={toolButtonClass} onClick={resetView} disabled={!image}>
              <RotateCcw size={16} />
            </Button>
          </Tooltip>
        </div>

        <ToolbarSeparator />

        {/* 自定义动作 / 设置 */}
        <div className="flex items-center gap-0.5 px-0.5 pointer-events-auto">
          {customActions.length > 0 && (
            <Tooltip content="自定义动作" side="bottom">
              <Button variant="ghost" size="icon-sm" className={toolButtonClass} onClick={onOpenCustomActions}>
                <Terminal size={16} />
              </Button>
            </Tooltip>
          )}
          <Tooltip content="设置" side="bottom">
            <Button variant="ghost" size="icon-sm" className={toolButtonClass} onClick={onOpenSettings}>
              <Settings size={16} />
            </Button>
          </Tooltip>
        </div>

        {/* 窗口控制：最小化 / 最大化还原 / 关闭 - Windows 标准排布 */}
        <div className="flex h-full items-stretch pointer-events-auto">
          <Tooltip content="最小化" side="bottom">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleMinimize}
              className={cn(windowButtonClass, "hover:bg-[#e5e5e5] dark:hover:bg-gray-700")}
            >
              <Minus size={16} />
            </Button>
          </Tooltip>
          <Tooltip content={isFullscreenMode ? "还原窗口" : "最大化"} side="bottom">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleToggleMaximize}
              className={cn(windowButtonClass, "hover:bg-[#e5e5e5] dark:hover:bg-gray-700")}
            >
              {isFullscreenMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </Button>
          </Tooltip>
          <Tooltip content="关闭" side="bottom">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className={cn(
                windowButtonClass,
                "hover:bg-[#e81123] hover:text-white dark:hover:bg-[#e81123]"
              )}
            >
              <X size={16} />
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
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  // 绘图工具显示工具配置面板
  const isDrawingTool = [
    "rectangle",
    "ellipse",
    "arrow",
    "line",
    "text",
    "brush",
    "marker",
    "callout",
    "blur",
    "dim_linear",
    "dim_angular",
    "dim_radial",
    "center_mark",
    "leader",
    "balloon",
  ].includes(currentTool);

  // 选中标注时显示标注属性面板
  const hasSelection = selectedIds.length > 0;

  // 显示条件：绘图工具 或 有选中的标注
  const showConfig = isDrawingTool || hasSelection;

  const title = hasSelection ? "标注属性" : "工具配置";

  useEffect(() => {
    if (!showConfig) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragStateRef.current) return;

      const { startX, startY, originX, originY } = dragStateRef.current;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      let nextX = originX + deltaX;
      let nextY = originY + deltaY;

      const panel = panelRef.current;
      const parent = panel?.parentElement;
      if (panel && parent) {
        const parentRect = parent.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const maxX = Math.max(0, parentRect.width - panelRect.width);
        const maxY = Math.max(0, parentRect.height - panelRect.height);
        nextX = clamp(nextX, 0, maxX);
        nextY = clamp(nextY, 0, maxY);
      }

      setPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [showConfig, image]);

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };
    event.preventDefault();
  };

  if (!showConfig) return null;

  return (
    <div
      ref={panelRef}
      className={cn(
        "absolute z-10 p-1.5 rounded-md",
        "bg-white dark:bg-gray-900",
        "border border-gray-200 dark:border-gray-700",
        "shadow-md"
      )}
      style={{ left: position.x, top: position.y }}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-1 px-1.5 py-0.5 rounded-md",
          "bg-gray-50 dark:bg-gray-800/60",
          "cursor-move select-none"
        )}
        onPointerDown={handleDragStart}
      >
        <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
          {title}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOrientation("horizontal")}
            className={cn(
              "px-1.5 py-0 text-[10px] rounded border leading-none",
              orientation === "horizontal"
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-transparent text-gray-500 border-transparent hover:border-gray-300 dark:text-gray-300 dark:hover:border-gray-600"
            )}
          >
            横
          </button>
          <button
            type="button"
            onClick={() => setOrientation("vertical")}
            className={cn(
              "px-1.5 py-0 text-[10px] rounded border leading-none",
              orientation === "vertical"
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-transparent text-gray-500 border-transparent hover:border-gray-300 dark:text-gray-300 dark:hover:border-gray-600"
            )}
          >
            竖
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className={cn(
              "p-0.5 rounded-md",
              "text-gray-500 hover:text-gray-900 hover:bg-gray-200",
              "dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700"
            )}
            aria-label={collapsed ? "展开配置面板" : "收起配置面板"}
          >
            {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-1">
          {/* 有选中的标注时显示标注属性面板，否则显示工具配置面板 */}
          {hasSelection ? (
            <SelectedAnnotationConfig orientation={orientation} compact />
          ) : (
            <ToolConfigPanel orientation={orientation} compact />
          )}
        </div>
      )}
    </div>
  );
}
