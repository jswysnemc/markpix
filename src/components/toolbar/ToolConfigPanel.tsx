// 工具配置面板
import { useId } from "react";
import { cn } from "@/lib/utils";
import { buildFontOptions } from "@/lib/fonts";
import { useEditorStore } from "@/store/editorStore";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Slider } from "@/components/ui/Slider";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { RotateCcw } from "lucide-react";

interface ToolConfigPanelProps {
  orientation: "horizontal" | "vertical";
}

export function ToolConfigPanel({ orientation }: ToolConfigPanelProps) {
  const {
    currentTool,
    toolConfig,
    setToolConfig,
    resetMarkerCounter,
    markerCounter,
    systemFonts,
  } = useEditorStore();

  const isHorizontal = orientation === "horizontal";
  const fontOptions = buildFontOptions(systemFonts, toolConfig.fontFamily);
  const fontListId = useId();

  // 根据当前工具显示不同配置
  const renderConfig = () => {
    switch (currentTool) {
      case "rectangle":
        return (
          <>
            <ConfigItem label="边框颜色" isHorizontal={isHorizontal}>
              <ColorPicker
                value={toolConfig.strokeColor}
                onChange={(color) => setToolConfig({ strokeColor: color })}
              />
            </ConfigItem>
            <ConfigItem label="填充颜色" isHorizontal={isHorizontal}>
              <ColorPicker
                value={toolConfig.fillColor}
                onChange={(color) => setToolConfig({ fillColor: color })}
              />
            </ConfigItem>
            <ConfigItem label="边框粗细" isHorizontal={isHorizontal}>
              <Slider
                value={toolConfig.strokeWidth}
                onChange={(v) => setToolConfig({ strokeWidth: v })}
                min={1}
                max={20}
                className="w-24"
                previewColor={toolConfig.strokeColor}
              />
            </ConfigItem>
            <ConfigItem label="填充透明度" isHorizontal={isHorizontal}>
              <Slider
                value={toolConfig.fillOpacity * 100}
                onChange={(v) => setToolConfig({ fillOpacity: v / 100 })}
                min={0}
                max={100}
                className="w-24"
              />
            </ConfigItem>
            <ConfigItem label="圆角" isHorizontal={isHorizontal}>
              <Slider
                value={toolConfig.cornerRadius}
                onChange={(v) => setToolConfig({ cornerRadius: v })}
                min={0}
                max={50}
                className="w-24"
              />
            </ConfigItem>
          </>
        );

      case "ellipse":
        return (
          <>
            <ConfigItem label="边框颜色" isHorizontal={isHorizontal}>
              <ColorPicker
                value={toolConfig.strokeColor}
                onChange={(color) => setToolConfig({ strokeColor: color })}
              />
            </ConfigItem>
            <ConfigItem label="填充颜色" isHorizontal={isHorizontal}>
              <ColorPicker
                value={toolConfig.fillColor}
                onChange={(color) => setToolConfig({ fillColor: color })}
              />
            </ConfigItem>
            <ConfigItem label="边框粗细" isHorizontal={isHorizontal}>
              <Slider
                value={toolConfig.strokeWidth}
                onChange={(v) => setToolConfig({ strokeWidth: v })}
                min={1}
                max={20}
                className="w-24"
                previewColor={toolConfig.strokeColor}
              />
            </ConfigItem>
            <ConfigItem label="填充透明度" isHorizontal={isHorizontal}>
              <Slider
                value={toolConfig.fillOpacity * 100}
                onChange={(v) => setToolConfig({ fillOpacity: v / 100 })}
                min={0}
                max={100}
                className="w-24"
              />
            </ConfigItem>
          </>
        );

      case "arrow":
        return (
          <>
            <ConfigItem label="颜色" isHorizontal={isHorizontal}>
              <ColorPicker
                value={toolConfig.strokeColor}
                onChange={(color) => setToolConfig({ strokeColor: color })}
              />
            </ConfigItem>
            <ConfigItem label="粗细" isHorizontal={isHorizontal}>
              <Slider
                value={toolConfig.strokeWidth}
                onChange={(v) => setToolConfig({ strokeWidth: v })}
                min={1}
                max={20}
                className="w-24"
                previewColor={toolConfig.strokeColor}
              />
            </ConfigItem>
            <ConfigItem label="箭头样式" isHorizontal={isHorizontal}>
              <Select
                value={toolConfig.arrowStyle}
                onChange={(v) =>
                  setToolConfig({ arrowStyle: v as "normal" | "filled" })
                }
                options={[
                  { value: "filled", label: "实心" },
                  { value: "normal", label: "普通" },
                ]}
              />
            </ConfigItem>
            <ConfigItem label="线条样式" isHorizontal={isHorizontal}>
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
            <ConfigItem label="颜色" isHorizontal={isHorizontal}>
              <ColorPicker
                value={toolConfig.strokeColor}
                onChange={(color) => setToolConfig({ strokeColor: color })}
              />
            </ConfigItem>
            <ConfigItem label="粗细" isHorizontal={isHorizontal}>
              <Slider
                value={toolConfig.strokeWidth}
                onChange={(v) => setToolConfig({ strokeWidth: v })}
                min={1}
                max={20}
                className="w-24"
                previewColor={toolConfig.strokeColor}
              />
            </ConfigItem>
            <ConfigItem label="样式" isHorizontal={isHorizontal}>
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
            <ConfigItem label="颜色" isHorizontal={isHorizontal}>
              <ColorPicker
                value={toolConfig.strokeColor}
                onChange={(color) => setToolConfig({ strokeColor: color })}
              />
            </ConfigItem>
            <ConfigItem label="字号" isHorizontal={isHorizontal}>
              <Slider
                value={toolConfig.fontSize}
                onChange={(v) => setToolConfig({ fontSize: v })}
                min={12}
                max={72}
                className="w-24"
              />
            </ConfigItem>
            <ConfigItem label="字体" isHorizontal={isHorizontal}>
              <div className="min-w-[140px]">
                <input
                  value={toolConfig.fontFamily}
                  onChange={(e) => setToolConfig({ fontFamily: e.target.value })}
                  list={fontListId}
                  placeholder="搜索字体"
                  className={cn(
                    "w-full rounded-md border border-input px-3 py-1.5 text-sm",
                    "bg-background text-foreground",
                    "focus:outline-none focus:ring-1 focus:ring-ring"
                  )}
                />
                <datalist id={fontListId}>
                  {fontOptions.map((option) => (
                    <option key={option.value} value={option.value} label={option.label} />
                  ))}
                </datalist>
              </div>
            </ConfigItem>
            <ConfigItem label="样式" isHorizontal={isHorizontal}>
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
                <ConfigItem label="气泡边框" isHorizontal={isHorizontal}>
                  <ColorPicker
                    value={toolConfig.bubbleStroke || toolConfig.strokeColor}
                    onChange={(color) => setToolConfig({ bubbleStroke: color })}
                  />
                </ConfigItem>
                <ConfigItem label="气泡背景" isHorizontal={isHorizontal}>
                  <ColorPicker
                    value={toolConfig.bubbleFill}
                    onChange={(color) => setToolConfig({ bubbleFill: color })}
                  />
                </ConfigItem>
                <ConfigItem label="尾巴位置" isHorizontal={isHorizontal}>
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
            <ConfigItem label="颜色" isHorizontal={isHorizontal}>
              <ColorPicker
                value={toolConfig.strokeColor}
                onChange={(color) => setToolConfig({ strokeColor: color })}
              />
            </ConfigItem>
            <ConfigItem label="笔刷大小" isHorizontal={isHorizontal}>
              <Slider
                value={toolConfig.brushSize}
                onChange={(v) => setToolConfig({ brushSize: v })}
                min={1}
                max={50}
                className="w-24"
                previewColor={toolConfig.strokeColor}
              />
            </ConfigItem>
          </>
        );

      case "marker":
        return (
          <>
            <ConfigItem label="颜色" isHorizontal={isHorizontal}>
              <ColorPicker
                value={toolConfig.strokeColor}
                onChange={(color) => setToolConfig({ strokeColor: color })}
              />
            </ConfigItem>
            <ConfigItem label="大小" isHorizontal={isHorizontal}>
              <Slider
                value={toolConfig.markerSize}
                onChange={(v) => setToolConfig({ markerSize: v })}
                min={20}
                max={60}
                className="w-24"
              />
            </ConfigItem>
            <ConfigItem label="类型" isHorizontal={isHorizontal}>
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
            <ConfigItem label="样式" isHorizontal={isHorizontal}>
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
            <ConfigItem label={`当前: ${markerCounter}`} isHorizontal={isHorizontal}>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetMarkerCounter}
                title="重置序号计数器"
              >
                <RotateCcw size={14} />
              </Button>
            </ConfigItem>
          </>
        );

      case "blur":
        return (
          <>
            <ConfigItem label="模糊强度" isHorizontal={isHorizontal}>
              <Slider
                value={toolConfig.blurRadius}
                onChange={(v) => setToolConfig({ blurRadius: v })}
                min={5}
                max={30}
                className="w-24"
              />
            </ConfigItem>
            <ConfigItem label="圆角" isHorizontal={isHorizontal}>
              <Slider
                value={toolConfig.blurCornerRadius}
                onChange={(v) => setToolConfig({ blurCornerRadius: v })}
                min={0}
                max={50}
                className="w-24"
              />
            </ConfigItem>
          </>
        );

      case "magnifier":
        return (
          <>
            <ConfigItem label="放大倍率" isHorizontal={isHorizontal}>
              <Slider
                value={toolConfig.magnifierScale}
                onChange={(v) => setToolConfig({ magnifierScale: v })}
                min={1.5}
                max={5}
                step={0.1}
                className="w-24"
              />
            </ConfigItem>
            <ConfigItem label={`${toolConfig.magnifierScale.toFixed(1)}x`} isHorizontal={isHorizontal}>
              <span className="text-xs text-gray-400">滚轮调节</span>
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
        "flex gap-4",
        isHorizontal ? "flex-row items-center" : "flex-col"
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
}

function ConfigItem({ label, children, isHorizontal }: ConfigItemProps) {
  return (
    <div
      className={cn(
        "flex gap-2",
        isHorizontal ? "flex-row items-center" : "flex-col"
      )}
    >
      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-medium">
        {label}
      </span>
      {children}
    </div>
  );
}
