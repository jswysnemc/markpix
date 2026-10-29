// 左右竖向工具栏 - 单列直接展示全部工具，按功能分组并用分隔线区分
import { Fragment, useState } from "react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/Button";
import type { ToolType } from "@/types";
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
  Crop,
  MessageSquareShare,
  Grid3X3,
  Search,
  ImagePlus,
  RulerDimensionLine,
  Triangle,
  Radius,
  Crosshair,
  Waypoints,
  Tag,
} from "lucide-react";

type ToolItem = { type: ToolType; icon: React.ReactNode; label: string };
type ToolGroup = { title: string; tools: ToolItem[] };

// 左侧：常用标注工具（基础标注 / 标注增强 / 图像）
const baseToolGroups: ToolGroup[] = [
  {
    title: "基础标注",
    tools: [
      { type: "select", icon: <MousePointer2 size={18} />, label: "选择 (V)" },
      { type: "pan", icon: <Hand size={18} />, label: "平移 (H)" },
      { type: "rectangle", icon: <Square size={18} />, label: "矩形 (R)" },
      { type: "ellipse", icon: <Circle size={18} />, label: "椭圆 (E)" },
      { type: "arrow", icon: <ArrowRight size={18} />, label: "箭头 (A)" },
      { type: "line", icon: <Minus size={18} />, label: "直线 (L)" },
      { type: "text", icon: <Type size={18} />, label: "文字 (T)" },
      { type: "brush", icon: <Pencil size={18} />, label: "画笔 (B)" },
      { type: "marker", icon: <Hash size={18} />, label: "序号 (M)" },
      { type: "crop", icon: <Crop size={18} />, label: "裁剪 (C)" },
    ],
  },
  {
    title: "标注增强",
    tools: [
      { type: "callout", icon: <MessageSquareShare size={18} />, label: "引导序号 (N)" },
      { type: "blur", icon: <Grid3X3 size={18} />, label: "马赛克 (U)" },
      { type: "magnifier", icon: <Search size={18} />, label: "放大镜 (Z)" },
    ],
  },
  {
    title: "图像",
    tools: [
      { type: "image", icon: <ImagePlus size={18} />, label: "插入图片 (I)" },
    ],
  },
];

// 右侧：工程制图工具
const engineeringToolGroups: ToolGroup[] = [
  {
    title: "工程制图",
    tools: [
      { type: "dim_linear", icon: <RulerDimensionLine size={18} />, label: "线性尺寸 (D)" },
      { type: "dim_angular", icon: <Triangle size={18} />, label: "角度标注 (G)" },
      { type: "dim_radial", icon: <Radius size={18} />, label: "半径/直径 (Y)" },
      { type: "center_mark", icon: <Crosshair size={18} />, label: "中心线标记 (K)" },
      { type: "leader", icon: <Waypoints size={18} />, label: "引线标注 (F)" },
      { type: "balloon", icon: <Tag size={18} />, label: "件号气泡 (J)" },
    ],
  },
];

interface RailProps {
  groups: ToolGroup[];
  side: "left" | "right";
  label: string;
  onInsertImage?: () => void;
}

interface HoverTip {
  label: string;
  top: number;
  left?: number;
  right?: number;
}

// 竖排工具列：固定定位的悬停提示不受滚动容器裁剪
function ToolRailBase({ groups, side, label, onInsertImage }: RailProps) {
  const { currentTool, setCurrentTool, image } = useEditorStore();
  const [tip, setTip] = useState<HoverTip | null>(null);

  const showTip = (event: React.MouseEvent<HTMLDivElement>, text: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTip({
      label: text,
      top: rect.top + rect.height / 2,
      ...(side === "left"
        ? { left: rect.right + 8 }
        : { right: window.innerWidth - rect.left + 8 }),
    });
  };

  const selectTool = (type: ToolType) => {
    if (type === "image" && onInsertImage) {
      onInsertImage();
    } else {
      setCurrentTool(type);
    }
  };

  return (
    <aside
      aria-label={label}
      className={cn(
        "relative z-20 flex w-11 shrink-0 flex-col bg-[#f3f3f3] dark:bg-gray-900",
        side === "left"
          ? "border-r border-[#d9d9d9] dark:border-gray-700"
          : "border-l border-[#d9d9d9] dark:border-gray-700"
      )}
    >
      <div className="flex flex-1 flex-col items-center gap-0.5 overflow-y-auto overflow-x-hidden py-1">
        {groups.map((group, index) => (
          <Fragment key={group.title}>
            {index > 0 && (
              <div className="my-1 h-px w-7 shrink-0 bg-[#c8c8c8] dark:bg-gray-600" />
            )}
            {group.tools.map((tool) => (
              <div
                key={tool.type}
                className="shrink-0"
                onMouseEnter={(event) => showTip(event, tool.label)}
                onMouseLeave={() => setTip(null)}
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={tool.label}
                  onClick={() => selectTool(tool.type)}
                  disabled={!image && tool.type !== "select"}
                  className={cn(
                    "h-7 w-7 rounded-[3px] transition-colors duration-100 hover:bg-[#e5f1fb] dark:hover:bg-gray-700",
                    currentTool === tool.type &&
                      "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                  )}
                >
                  {tool.icon}
                </Button>
              </div>
            ))}
          </Fragment>
        ))}
      </div>

      {/* 悬停提示 */}
      {tip && (
        <div
          className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-[3px] border border-[#d9d9d9] bg-white px-2 py-1 text-xs font-medium text-gray-800 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          style={{ top: tip.top, left: tip.left, right: tip.right }}
        >
          {tip.label}
        </div>
      )}
    </aside>
  );
}

// 左侧常用工具列
export function ToolRail({ onInsertImage }: { onInsertImage?: () => void }) {
  return (
    <ToolRailBase
      groups={baseToolGroups}
      side="left"
      label="常用标注工具"
      onInsertImage={onInsertImage}
    />
  );
}

// 右侧工程制图工具列
export function EngineeringRail() {
  return <ToolRailBase groups={engineeringToolGroups} side="right" label="工程制图工具" />;
}
