// 选中标注的属性配置面板
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editorStore";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Slider } from "@/components/ui/Slider";
import { Select } from "@/components/ui/Select";
import type { Annotation } from "@/types";

interface SelectedAnnotationConfigProps {
  orientation: "horizontal" | "vertical";
}

export function SelectedAnnotationConfig({ orientation }: SelectedAnnotationConfigProps) {
  const { selectedIds, annotations, updateAnnotations, pushHistory } = useEditorStore();

  const isHorizontal = orientation === "horizontal";

  // 获取选中的标注
  const selectedAnnotations = annotations.filter((a) => selectedIds.includes(a.id));
  
  // 如果没有选中或选中多个不同类型，不显示配置
  if (selectedAnnotations.length === 0) return null;
  
  // 获取第一个选中的标注作为参考
  const firstAnnotation = selectedAnnotations[0];
  const annotationType = firstAnnotation.type;
  
  // 检查是否所有选中的标注类型相同
  const allSameType = selectedAnnotations.every((a) => a.type === annotationType);
  
  if (!allSameType) {
    return (
      <div className="text-xs text-muted-foreground">
        选中了多种类型的标注
      </div>
    );
  }

  // 更新所有选中标注的属性（批量更新）
  const updateSelectedAnnotations = (updates: Partial<Annotation>) => {
    updateAnnotations(selectedIds, updates);
    pushHistory();
  };

  // 根据标注类型渲染不同的配置
  const renderConfig = () => {
    switch (annotationType) {
      case "rectangle": {
        const rect = firstAnnotation as Extract<Annotation, { type: "rectangle" }>;
        return (
          <>
            <ConfigItem label="边框颜色" isHorizontal={isHorizontal}>
              <ColorPicker
                value={rect.stroke}
                onChange={(color) => updateSelectedAnnotations({ stroke: color })}
              />
            </ConfigItem>
            <ConfigItem label="填充颜色" isHorizontal={isHorizontal}>
              <ColorPicker
                value={rect.fill}
                onChange={(color) => updateSelectedAnnotations({ fill: color })}
              />
            </ConfigItem>
            <ConfigItem label="边框粗细" isHorizontal={isHorizontal}>
              <Slider
                value={rect.strokeWidth}
                onChange={(v) => updateSelectedAnnotations({ strokeWidth: v })}
                min={1}
                max={20}
                className="w-24"
              />
            </ConfigItem>
            <ConfigItem label="填充透明度" isHorizontal={isHorizontal}>
              <Slider
                value={rect.fillOpacity * 100}
                onChange={(v) => updateSelectedAnnotations({ fillOpacity: v / 100 })}
                min={0}
                max={100}
                className="w-24"
              />
            </ConfigItem>
            <ConfigItem label="圆角" isHorizontal={isHorizontal}>
              <Slider
                value={rect.cornerRadius || 0}
                onChange={(v) => updateSelectedAnnotations({ cornerRadius: v })}
                min={0}
                max={50}
                className="w-24"
              />
            </ConfigItem>
          </>
        );
      }

      case "ellipse": {
        const ellipse = firstAnnotation as Extract<Annotation, { type: "ellipse" }>;
        return (
          <>
            <ConfigItem label="边框颜色" isHorizontal={isHorizontal}>
              <ColorPicker
                value={ellipse.stroke}
                onChange={(color) => updateSelectedAnnotations({ stroke: color })}
              />
            </ConfigItem>
            <ConfigItem label="填充颜色" isHorizontal={isHorizontal}>
              <ColorPicker
                value={ellipse.fill}
                onChange={(color) => updateSelectedAnnotations({ fill: color })}
              />
            </ConfigItem>
            <ConfigItem label="边框粗细" isHorizontal={isHorizontal}>
              <Slider
                value={ellipse.strokeWidth}
                onChange={(v) => updateSelectedAnnotations({ strokeWidth: v })}
                min={1}
                max={20}
                className="w-24"
              />
            </ConfigItem>
            <ConfigItem label="填充透明度" isHorizontal={isHorizontal}>
              <Slider
                value={ellipse.fillOpacity * 100}
                onChange={(v) => updateSelectedAnnotations({ fillOpacity: v / 100 })}
                min={0}
                max={100}
                className="w-24"
              />
            </ConfigItem>
          </>
        );
      }

      case "arrow": {
        const arrow = firstAnnotation as Extract<Annotation, { type: "arrow" }>;
        return (
          <>
            <ConfigItem label="颜色" isHorizontal={isHorizontal}>
              <ColorPicker
                value={arrow.stroke}
                onChange={(color) => updateSelectedAnnotations({ stroke: color })}
              />
            </ConfigItem>
            <ConfigItem label="粗细" isHorizontal={isHorizontal}>
              <Slider
                value={arrow.strokeWidth}
                onChange={(v) => updateSelectedAnnotations({ strokeWidth: v })}
                min={1}
                max={20}
                className="w-24"
              />
            </ConfigItem>
            <ConfigItem label="箭头样式" isHorizontal={isHorizontal}>
              <Select
                value={arrow.arrowStyle}
                onChange={(v) => updateSelectedAnnotations({ arrowStyle: v as "normal" | "filled" })}
                options={[
                  { value: "filled", label: "实心" },
                  { value: "normal", label: "普通" },
                ]}
              />
            </ConfigItem>
            <ConfigItem label="线条样式" isHorizontal={isHorizontal}>
              <Select
                value={arrow.lineStyle}
                onChange={(v) => updateSelectedAnnotations({ lineStyle: v as "solid" | "dashed" })}
                options={[
                  { value: "solid", label: "实线" },
                  { value: "dashed", label: "虚线" },
                ]}
              />
            </ConfigItem>
          </>
        );
      }

      case "line": {
        const line = firstAnnotation as Extract<Annotation, { type: "line" }>;
        return (
          <>
            <ConfigItem label="颜色" isHorizontal={isHorizontal}>
              <ColorPicker
                value={line.stroke}
                onChange={(color) => updateSelectedAnnotations({ stroke: color })}
              />
            </ConfigItem>
            <ConfigItem label="粗细" isHorizontal={isHorizontal}>
              <Slider
                value={line.strokeWidth}
                onChange={(v) => updateSelectedAnnotations({ strokeWidth: v })}
                min={1}
                max={20}
                className="w-24"
              />
            </ConfigItem>
            <ConfigItem label="样式" isHorizontal={isHorizontal}>
              <Select
                value={line.lineStyle}
                onChange={(v) => updateSelectedAnnotations({ lineStyle: v as "solid" | "dashed" })}
                options={[
                  { value: "solid", label: "实线" },
                  { value: "dashed", label: "虚线" },
                ]}
              />
            </ConfigItem>
          </>
        );
      }

      case "text": {
        const text = firstAnnotation as Extract<Annotation, { type: "text" }>;
        return (
          <>
            <ConfigItem label="颜色" isHorizontal={isHorizontal}>
              <ColorPicker
                value={text.fill}
                onChange={(color) => updateSelectedAnnotations({ fill: color })}
              />
            </ConfigItem>
            <ConfigItem label="字号" isHorizontal={isHorizontal}>
              <Slider
                value={text.fontSize}
                onChange={(v) => updateSelectedAnnotations({ fontSize: v })}
                min={12}
                max={72}
                className="w-24"
              />
            </ConfigItem>
            <ConfigItem label="字体" isHorizontal={isHorizontal}>
              <Select
                value={text.fontFamily}
                onChange={(v) => updateSelectedAnnotations({ fontFamily: v })}
                options={[
                  { value: "system-ui", label: "系统字体" },
                  { value: "serif", label: "衬线体" },
                  { value: "monospace", label: "等宽字体" },
                ]}
              />
            </ConfigItem>
            <ConfigItem label="样式" isHorizontal={isHorizontal}>
              <Select
                value={text.textStyle}
                onChange={(v) => updateSelectedAnnotations({ textStyle: v as "normal" | "bubble" })}
                options={[
                  { value: "normal", label: "普通" },
                  { value: "bubble", label: "气泡" },
                ]}
              />
            </ConfigItem>
            {text.textStyle === "bubble" && (
              <>
                <ConfigItem label="气泡边框" isHorizontal={isHorizontal}>
                  <ColorPicker
                    value={text.bubbleStroke || text.fill}
                    onChange={(color) => updateSelectedAnnotations({ bubbleStroke: color })}
                  />
                </ConfigItem>
                <ConfigItem label="气泡背景" isHorizontal={isHorizontal}>
                  <ColorPicker
                    value={text.bubbleFill || "transparent"}
                    onChange={(color) => updateSelectedAnnotations({ bubbleFill: color })}
                  />
                </ConfigItem>
                <ConfigItem label="尾巴位置" isHorizontal={isHorizontal}>
                  <Select
                    value={text.bubbleTailPosition || "left"}
                    onChange={(v) => updateSelectedAnnotations({ bubbleTailPosition: v as "left" | "right" })}
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
      }

      case "brush": {
        const brush = firstAnnotation as Extract<Annotation, { type: "brush" }>;
        return (
          <>
            <ConfigItem label="颜色" isHorizontal={isHorizontal}>
              <ColorPicker
                value={brush.stroke}
                onChange={(color) => updateSelectedAnnotations({ stroke: color })}
              />
            </ConfigItem>
            <ConfigItem label="笔刷大小" isHorizontal={isHorizontal}>
              <Slider
                value={brush.strokeWidth}
                onChange={(v) => updateSelectedAnnotations({ strokeWidth: v })}
                min={1}
                max={50}
                className="w-24"
              />
            </ConfigItem>
          </>
        );
      }

      case "marker": {
        const marker = firstAnnotation as Extract<Annotation, { type: "marker" }>;
        return (
          <>
            <ConfigItem label="颜色" isHorizontal={isHorizontal}>
              <ColorPicker
                value={marker.fill}
                onChange={(color) => updateSelectedAnnotations({ fill: color, textColor: "#fff" })}
              />
            </ConfigItem>
            <ConfigItem label="大小" isHorizontal={isHorizontal}>
              <Slider
                value={marker.size}
                onChange={(v) => updateSelectedAnnotations({ size: v })}
                min={20}
                max={60}
                className="w-24"
              />
            </ConfigItem>
            <ConfigItem label="样式" isHorizontal={isHorizontal}>
              <Select
                value={marker.markerStyle}
                onChange={(v) => updateSelectedAnnotations({ markerStyle: v as "filled" | "outlined" })}
                options={[
                  { value: "filled", label: "实心" },
                  { value: "outlined", label: "空心" },
                ]}
              />
            </ConfigItem>
          </>
        );
      }

      case "blur": {
        const blur = firstAnnotation as Extract<Annotation, { type: "blur" }>;
        return (
          <>
            <ConfigItem label="模糊强度" isHorizontal={isHorizontal}>
              <Slider
                value={blur.blurRadius}
                onChange={(v) => updateSelectedAnnotations({ blurRadius: v })}
                min={5}
                max={30}
                className="w-24"
              />
            </ConfigItem>
            <ConfigItem label="圆角" isHorizontal={isHorizontal}>
              <Slider
                value={blur.cornerRadius}
                onChange={(v) => updateSelectedAnnotations({ cornerRadius: v })}
                min={0}
                max={50}
                className="w-24"
              />
            </ConfigItem>
          </>
        );
      }

      case "image":
        // 图片贴图没有可编辑的颜色属性
        return (
          <div className="text-xs text-muted-foreground">
            图片贴图：可拖动调整位置和大小
          </div>
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
