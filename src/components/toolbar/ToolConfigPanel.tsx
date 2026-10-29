// 工具配置面板
import { useId, useRef } from "react";
import { cn } from "@/lib/utils";
import { buildFontOptions } from "@/lib/fonts";
import { useEditorStore } from "@/store/editorStore";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Slider } from "@/components/ui/Slider";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ChevronDown, RotateCcw } from "lucide-react";
import type {
  BalloonShape,
  CadTermination,
  DimMode,
  DimTextPosition,
  RadialKind,
} from "@/types";

interface ToolConfigPanelProps {
  orientation: "horizontal" | "vertical";
  compact?: boolean;
}

export function ToolConfigPanel({ orientation, compact = false }: ToolConfigPanelProps) {
  const {
    currentTool,
    toolConfig,
    setToolConfig,
    resetMarkerCounter,
    setMarkerCounter,
    markerCounter,
    systemFonts,
  } = useEditorStore();

  const isHorizontal = orientation === "horizontal";
  const isCompact = compact;
  const sliderClass = isCompact ? "w-20" : "w-24";
  const fontOptions = buildFontOptions(systemFonts, toolConfig.fontFamily);
  const fontListId = useId();
  const fontInputRef = useRef<HTMLInputElement>(null);
  const fontInputClass = isCompact ? "min-w-[110px]" : "min-w-[140px]";

  // CAD 标注共用配置项
  const cadColorItem = (
    <ConfigItem label="颜色" isHorizontal={isHorizontal} isCompact={isCompact}>
      <ColorPicker
        value={toolConfig.strokeColor}
        onChange={(color) => setToolConfig({ strokeColor: color })}
      />
    </ConfigItem>
  );
  const cadWidthItem = (
    <ConfigItem label="线宽" isHorizontal={isHorizontal} isCompact={isCompact}>
      <Slider
        value={toolConfig.cadStrokeWidth}
        onChange={(v) => setToolConfig({ cadStrokeWidth: v })}
        min={0.6}
        max={6}
        step={0.2}
        className={sliderClass}
        previewColor={toolConfig.strokeColor}
      />
    </ConfigItem>
  );
  const cadFontSizeItem = (
    <ConfigItem label="字号" isHorizontal={isHorizontal} isCompact={isCompact}>
      <Slider
        value={toolConfig.fontSize}
        onChange={(v) => setToolConfig({ fontSize: v })}
        min={10}
        max={48}
        className={sliderClass}
      />
    </ConfigItem>
  );
  const cadTerminationItem = (
    <ConfigItem label="端点符号" isHorizontal={isHorizontal} isCompact={isCompact}>
      <Select
        value={toolConfig.dimTermination}
        onChange={(v) => setToolConfig({ dimTermination: v as CadTermination })}
        options={[
          { value: "arrow", label: "实心箭头 (ASME)" },
          { value: "slash", label: "45°斜线 (ISO)" },
          { value: "dot", label: "圆点" },
        ]}
      />
    </ConfigItem>
  );

  // 根据当前工具显示不同配置
  const renderConfig = () => {
    switch (currentTool) {
      case "rectangle":
        return (
          <>
            <ConfigItem label="边框颜色" isHorizontal={isHorizontal} isCompact={isCompact}>
              <ColorPicker
                value={toolConfig.strokeColor}
                onChange={(color) => setToolConfig({ strokeColor: color })}
              />
            </ConfigItem>
            <ConfigItem label="填充颜色" isHorizontal={isHorizontal} isCompact={isCompact}>
              <ColorPicker
                value={toolConfig.fillColor}
                onChange={(color) => setToolConfig({ fillColor: color })}
              />
            </ConfigItem>
            <ConfigItem label="边框粗细" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Slider
                value={toolConfig.strokeWidth}
                onChange={(v) => setToolConfig({ strokeWidth: v })}
                min={2}
                max={20}
                className={sliderClass}
                previewColor={toolConfig.strokeColor}
              />
            </ConfigItem>
            <ConfigItem label="填充透明度" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Slider
                value={toolConfig.fillOpacity * 100}
                onChange={(v) => setToolConfig({ fillOpacity: v / 100 })}
                min={0}
                max={100}
                className={sliderClass}
              />
            </ConfigItem>
            <ConfigItem label="圆角" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Slider
                value={toolConfig.cornerRadius}
                onChange={(v) => setToolConfig({ cornerRadius: v })}
                min={0}
                max={50}
                className={sliderClass}
              />
            </ConfigItem>
          </>
        );

      case "ellipse":
        return (
          <>
            <ConfigItem label="边框颜色" isHorizontal={isHorizontal} isCompact={isCompact}>
              <ColorPicker
                value={toolConfig.strokeColor}
                onChange={(color) => setToolConfig({ strokeColor: color })}
              />
            </ConfigItem>
            <ConfigItem label="填充颜色" isHorizontal={isHorizontal} isCompact={isCompact}>
              <ColorPicker
                value={toolConfig.fillColor}
                onChange={(color) => setToolConfig({ fillColor: color })}
              />
            </ConfigItem>
            <ConfigItem label="边框粗细" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Slider
                value={toolConfig.strokeWidth}
                onChange={(v) => setToolConfig({ strokeWidth: v })}
                min={1}
                max={20}
                className={sliderClass}
                previewColor={toolConfig.strokeColor}
              />
            </ConfigItem>
            <ConfigItem label="填充透明度" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Slider
                value={toolConfig.fillOpacity * 100}
                onChange={(v) => setToolConfig({ fillOpacity: v / 100 })}
                min={0}
                max={100}
                className={sliderClass}
              />
            </ConfigItem>
          </>
        );

      case "arrow":
        return (
          <>
            <ConfigItem label="颜色" isHorizontal={isHorizontal} isCompact={isCompact}>
              <ColorPicker
                value={toolConfig.strokeColor}
                onChange={(color) => setToolConfig({ strokeColor: color })}
              />
            </ConfigItem>
            <ConfigItem label="粗细" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Slider
                value={toolConfig.strokeWidth}
                onChange={(v) => setToolConfig({ strokeWidth: v })}
                min={1}
                max={20}
                className={sliderClass}
                previewColor={toolConfig.strokeColor}
              />
            </ConfigItem>
            <ConfigItem label="箭头样式" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Select
                value={toolConfig.arrowStyle}
                onChange={(v) =>
                  setToolConfig({ arrowStyle: v as "normal" | "filled" })
                }
                options={[
                  { value: "filled", label: "QQ风格" },
                  { value: "normal", label: "普通" },
                ]}
              />
            </ConfigItem>
            <ConfigItem label="线条样式" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Select
                value={toolConfig.lineStyle}
                onChange={(v) =>
                  setToolConfig({ lineStyle: v as "solid" | "dashed" })
                }
                options={[
                  { value: "solid", label: "实线" },
                  { value: "dashed", label: "虚线" },
                ]}
              />
            </ConfigItem>
          </>
        );

      case "line":
        return (
          <>
            <ConfigItem label="颜色" isHorizontal={isHorizontal} isCompact={isCompact}>
              <ColorPicker
                value={toolConfig.strokeColor}
                onChange={(color) => setToolConfig({ strokeColor: color })}
              />
            </ConfigItem>
            <ConfigItem label="粗细" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Slider
                value={toolConfig.strokeWidth}
                onChange={(v) => setToolConfig({ strokeWidth: v })}
                min={1}
                max={20}
                className={sliderClass}
                previewColor={toolConfig.strokeColor}
              />
            </ConfigItem>
            <ConfigItem label="样式" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Select
                value={toolConfig.lineStyle}
                onChange={(v) =>
                  setToolConfig({ lineStyle: v as "solid" | "dashed" })
                }
                options={[
                  { value: "solid", label: "实线" },
                  { value: "dashed", label: "虚线" },
                ]}
              />
            </ConfigItem>
          </>
        );

      case "text":
        return (
          <>
            <ConfigItem label="颜色" isHorizontal={isHorizontal} isCompact={isCompact}>
              <ColorPicker
                value={toolConfig.strokeColor}
                onChange={(color) => setToolConfig({ strokeColor: color })}
              />
            </ConfigItem>
            <ConfigItem label="字号" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Slider
                value={toolConfig.fontSize}
                onChange={(v) => setToolConfig({ fontSize: v })}
                min={12}
                max={72}
                className={sliderClass}
              />
            </ConfigItem>
            <ConfigItem label="字体" isHorizontal={isHorizontal} isCompact={isCompact}>
              <div className={cn("relative", fontInputClass)}>
                <input
                  ref={fontInputRef}
                  value={toolConfig.fontFamily}
                  onChange={(e) => setToolConfig({ fontFamily: e.target.value })}
                  list={fontListId}
                  placeholder="搜索字体"
                  className={cn(
                    "w-full rounded-md border border-input px-3 py-1.5 pr-6 text-sm",
                    "bg-background text-foreground",
                    "focus:outline-none focus:ring-1 focus:ring-ring"
                  )}
                />
                <button
                  type="button"
                  onClick={() => {
                    const input = fontInputRef.current;
                    if (!input) return;
                    setToolConfig({ fontFamily: "" });
                    requestAnimationFrame(() => {
                      input.focus();
                      const picker = (input as HTMLInputElement & { showPicker?: () => void }).showPicker;
                      if (picker) {
                        picker.call(input);
                      } else {
                        input.dispatchEvent(
                          new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
                        );
                      }
                    });
                  }}
                  className={cn(
                    "absolute right-1.5 top-1/2 -translate-y-1/2",
                    "p-0.5 rounded text-gray-400 hover:text-gray-600",
                    "hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                  aria-label="展开字体列表"
                >
                  <ChevronDown size={14} />
                </button>
                <datalist id={fontListId}>
                  {fontOptions.map((option) => (
                    <option key={option.value} value={option.value} label={option.label} />
                  ))}
                </datalist>
              </div>
            </ConfigItem>
            <ConfigItem label="样式" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Select
                value={toolConfig.textStyle}
                onChange={(v) => setToolConfig({ textStyle: v as "normal" | "bubble" })}
                options={[
                  { value: "normal", label: "普通" },
                  { value: "bubble", label: "气泡" },
                ]}
              />
            </ConfigItem>
            {toolConfig.textStyle === "bubble" && (
              <>
                <ConfigItem label="气泡边框" isHorizontal={isHorizontal} isCompact={isCompact}>
                  <ColorPicker
                    value={toolConfig.bubbleStroke || toolConfig.strokeColor}
                    onChange={(color) => setToolConfig({ bubbleStroke: color })}
                  />
                </ConfigItem>
                <ConfigItem label="气泡背景" isHorizontal={isHorizontal} isCompact={isCompact}>
                  <ColorPicker
                    value={toolConfig.bubbleFill}
                    onChange={(color) => setToolConfig({ bubbleFill: color })}
                  />
                </ConfigItem>
                <ConfigItem label="尾巴位置" isHorizontal={isHorizontal} isCompact={isCompact}>
                  <Select
                    value={toolConfig.bubbleTailPosition}
                    onChange={(v) => setToolConfig({ bubbleTailPosition: v as "left" | "right" })}
                    options={[
                      { value: "left", label: "左" },
                      { value: "right", label: "右" },
                    ]}
                  />
                </ConfigItem>
              </>
            )}
          </>
        );

      case "brush":
        return (
          <>
            <ConfigItem label="颜色" isHorizontal={isHorizontal} isCompact={isCompact}>
              <ColorPicker
                value={toolConfig.strokeColor}
                onChange={(color) => setToolConfig({ strokeColor: color })}
              />
            </ConfigItem>
            <ConfigItem label="笔刷大小" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Slider
                value={toolConfig.brushSize}
                onChange={(v) => setToolConfig({ brushSize: v })}
                min={1}
                max={50}
                className={sliderClass}
                previewColor={toolConfig.strokeColor}
              />
            </ConfigItem>
          </>
        );

      case "callout":
        return (
          <>
            <ConfigItem label="颜色" isHorizontal={isHorizontal} isCompact={isCompact}>
              <ColorPicker
                value={toolConfig.strokeColor}
                onChange={(color) => setToolConfig({ strokeColor: color })}
              />
            </ConfigItem>
            <ConfigItem label="序号大小" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Slider
                value={toolConfig.markerSize}
                onChange={(v) => setToolConfig({ markerSize: v })}
                min={20}
                max={60}
                className={sliderClass}
              />
            </ConfigItem>
            <ConfigItem label="线条粗细" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Slider
                value={toolConfig.strokeWidth}
                onChange={(v) => setToolConfig({ strokeWidth: v })}
                min={1}
                max={20}
                className={sliderClass}
                previewColor={toolConfig.strokeColor}
              />
            </ConfigItem>
            <ConfigItem label="类型" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Select
                value={toolConfig.markerType}
                onChange={(v) =>
                  setToolConfig({ markerType: v as "number" | "letter" })
                }
                options={[
                  { value: "number", label: "数字 (1,2,3)" },
                  { value: "letter", label: "字母 (A,B,C)" },
                ]}
              />
            </ConfigItem>
            <ConfigItem label="样式" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Select
                value={toolConfig.markerStyle}
                onChange={(v) =>
                  setToolConfig({ markerStyle: v as "filled" | "outlined" })
                }
                options={[
                  { value: "filled", label: "实心" },
                  { value: "outlined", label: "空心" },
                ]}
              />
            </ConfigItem>
            <ConfigItem label="箭头样式" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Select
                value={toolConfig.arrowStyle}
                onChange={(v) =>
                  setToolConfig({ arrowStyle: v as "normal" | "filled" })
                }
                options={[
                  { value: "filled", label: "QQ风格" },
                  { value: "normal", label: "普通" },
                ]}
              />
            </ConfigItem>
            <ConfigItem label="线条样式" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Select
                value={toolConfig.lineStyle}
                onChange={(v) =>
                  setToolConfig({ lineStyle: v as "solid" | "dashed" })
                }
                options={[
                  { value: "solid", label: "实线" },
                  { value: "dashed", label: "虚线" },
                ]}
              />
            </ConfigItem>
            <ConfigItem label="起始序号" isHorizontal={isHorizontal} isCompact={isCompact}>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  value={markerCounter}
                  onChange={(e) => setMarkerCounter(Number(e.target.value) || 1)}
                  className={cn(
                    "rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring",
                    isCompact ? "w-14 px-1.5 py-0.5 text-xs" : "w-16 px-2 py-1 text-sm"
                  )}
                  title="设置下一个插入的序号"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetMarkerCounter}
                  title="重置序号为 1"
                >
                  <RotateCcw size={14} />
                </Button>
              </div>
            </ConfigItem>
          </>
        );

      case "marker":
        return (
          <>
            <ConfigItem label="颜色" isHorizontal={isHorizontal} isCompact={isCompact}>
              <ColorPicker
                value={toolConfig.strokeColor}
                onChange={(color) => setToolConfig({ strokeColor: color })}
              />
            </ConfigItem>
            <ConfigItem label="大小" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Slider
                value={toolConfig.markerSize}
                onChange={(v) => setToolConfig({ markerSize: v })}
                min={20}
                max={60}
                className={sliderClass}
              />
            </ConfigItem>
            <ConfigItem label="类型" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Select
                value={toolConfig.markerType}
                onChange={(v) =>
                  setToolConfig({ markerType: v as "number" | "letter" })
                }
                options={[
                  { value: "number", label: "数字 (1,2,3)" },
                  { value: "letter", label: "字母 (A,B,C)" },
                ]}
              />
            </ConfigItem>
            <ConfigItem label="样式" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Select
                value={toolConfig.markerStyle}
                onChange={(v) =>
                  setToolConfig({ markerStyle: v as "filled" | "outlined" })
                }
                options={[
                  { value: "filled", label: "实心" },
                  { value: "outlined", label: "空心" },
                ]}
              />
            </ConfigItem>
            <ConfigItem label="起始序号" isHorizontal={isHorizontal} isCompact={isCompact}>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  value={markerCounter}
                  onChange={(e) => setMarkerCounter(Number(e.target.value) || 1)}
                  className={cn(
                    "rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring",
                    isCompact ? "w-14 px-1.5 py-0.5 text-xs" : "w-16 px-2 py-1 text-sm"
                  )}
                  title="设置下一个插入的序号"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetMarkerCounter}
                  title="重置序号为 1"
                >
                  <RotateCcw size={14} />
                </Button>
              </div>
            </ConfigItem>
          </>
        );

      case "blur":
        return (
          <>
            <ConfigItem label="模糊强度" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Slider
                value={toolConfig.blurRadius}
                onChange={(v) => setToolConfig({ blurRadius: v })}
                min={5}
                max={30}
                className={sliderClass}
              />
            </ConfigItem>
            <ConfigItem label="圆角" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Slider
                value={toolConfig.blurCornerRadius}
                onChange={(v) => setToolConfig({ blurCornerRadius: v })}
                min={0}
                max={50}
                className={sliderClass}
              />
            </ConfigItem>
          </>
        );

      case "magnifier":
        return (
          <>
            <ConfigItem label="放大倍率" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Slider
                value={toolConfig.magnifierScale}
                onChange={(v) => setToolConfig({ magnifierScale: v })}
                min={1.5}
                max={5}
                step={0.1}
                className={sliderClass}
              />
            </ConfigItem>
            <ConfigItem label={`${toolConfig.magnifierScale.toFixed(1)}x`} isHorizontal={isHorizontal} isCompact={isCompact}>
              <span className="text-xs text-gray-400">滚轮调节</span>
            </ConfigItem>
          </>
        );

      case "dim_linear":
        return (
          <>
            {cadColorItem}
            {cadWidthItem}
            {cadFontSizeItem}
            <ConfigItem label="测量方式" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Select
                value={toolConfig.dimMode}
                onChange={(v) => setToolConfig({ dimMode: v as DimMode })}
                options={[
                  { value: "aligned", label: "对齐" },
                  { value: "horizontal", label: "水平" },
                  { value: "vertical", label: "垂直" },
                ]}
              />
            </ConfigItem>
            {cadTerminationItem}
            <ConfigItem label="文字位置" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Select
                value={toolConfig.dimTextPosition}
                onChange={(v) =>
                  setToolConfig({ dimTextPosition: v as DimTextPosition })
                }
                options={[
                  { value: "above", label: "线上方 (ASME)" },
                  { value: "inline", label: "居中打断 (ISO)" },
                ]}
              />
            </ConfigItem>
            <ConfigItem label="尺寸界线" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Select
                value={toolConfig.showExtensionLines ? "on" : "off"}
                onChange={(v) => setToolConfig({ showExtensionLines: v === "on" })}
                options={[
                  { value: "on", label: "显示" },
                  { value: "off", label: "隐藏" },
                ]}
              />
            </ConfigItem>
          </>
        );

      case "dim_angular":
        return (
          <>
            {cadColorItem}
            {cadWidthItem}
            {cadFontSizeItem}
          </>
        );

      case "dim_radial":
        return (
          <>
            {cadColorItem}
            {cadWidthItem}
            {cadFontSizeItem}
            {cadTerminationItem}
            <ConfigItem label="类型" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Select
                value={toolConfig.radialKind}
                onChange={(v) => setToolConfig({ radialKind: v as RadialKind })}
                options={[
                  { value: "radius", label: "半径 R" },
                  { value: "diameter", label: "直径 ⌀" },
                ]}
              />
            </ConfigItem>
          </>
        );

      case "center_mark":
        return (
          <>
            {cadColorItem}
            {cadWidthItem}
            <ConfigItem label="大小" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Slider
                value={toolConfig.markerSize}
                onChange={(v) => setToolConfig({ markerSize: v })}
                min={12}
                max={80}
                className={sliderClass}
              />
            </ConfigItem>
          </>
        );

      case "leader":
        return (
          <>
            {cadColorItem}
            {cadWidthItem}
            {cadFontSizeItem}
            {cadTerminationItem}
          </>
        );

      case "balloon":
        return (
          <>
            {cadColorItem}
            {cadWidthItem}
            <ConfigItem label="大小" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Slider
                value={toolConfig.markerSize}
                onChange={(v) => setToolConfig({ markerSize: v })}
                min={16}
                max={60}
                className={sliderClass}
              />
            </ConfigItem>
            <ConfigItem label="外形" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Select
                value={toolConfig.balloonShape}
                onChange={(v) =>
                  setToolConfig({ balloonShape: v as BalloonShape })
                }
                options={[
                  { value: "circle", label: "圆形气泡" },
                  { value: "rect", label: "方框" },
                  { value: "none", label: "无框" },
                ]}
              />
            </ConfigItem>
            <ConfigItem label="类型" isHorizontal={isHorizontal} isCompact={isCompact}>
              <Select
                value={toolConfig.markerType}
                onChange={(v) =>
                  setToolConfig({ markerType: v as "number" | "letter" })
                }
                options={[
                  { value: "number", label: "数字 (1,2,3)" },
                  { value: "letter", label: "字母 (A,B,C)" },
                ]}
              />
            </ConfigItem>
            {cadTerminationItem}
            <ConfigItem label="起始序号" isHorizontal={isHorizontal} isCompact={isCompact}>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  value={markerCounter}
                  onChange={(e) => setMarkerCounter(Number(e.target.value) || 1)}
                  className={cn(
                    "rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring",
                    isCompact ? "w-14 px-1.5 py-0.5 text-xs" : "w-16 px-2 py-1 text-sm"
                  )}
                  title="设置下一个插入的件号"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetMarkerCounter}
                  title="重置序号为 1"
                >
                  <RotateCcw size={14} />
                </Button>
              </div>
            </ConfigItem>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        "flex",
        isHorizontal
          ? isCompact
            ? "flex-row flex-wrap items-center gap-2"
            : "flex-row items-center gap-4"
          : isCompact
            ? "flex-col gap-2"
            : "flex-col gap-3"
      )}
    >
      {renderConfig()}
    </div>
  );
}

// 配置项组件
interface ConfigItemProps {
  label: string;
  children: React.ReactNode;
  isHorizontal: boolean;
  isCompact?: boolean;
}

function ConfigItem({ label, children, isHorizontal, isCompact = false }: ConfigItemProps) {
  return (
    <div
      className={cn(
        "flex",
        isHorizontal ? "flex-row items-center" : "flex-col",
        isCompact ? "gap-1" : "gap-2"
      )}
    >
      <span
        className={cn(
          "text-gray-500 dark:text-gray-400 whitespace-nowrap font-medium",
          isCompact ? "text-[10px]" : "text-xs"
        )}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
