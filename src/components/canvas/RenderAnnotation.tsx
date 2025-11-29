// 标注渲染组件 - 根据类型渲染不同的 Konva 元素
import { useRef } from "react";
import {
  Rect,
  Ellipse,
  Arrow,
  Line,
  Text,
  Circle,
  Group,
} from "react-konva";
import Konva from "konva";
import type { Annotation } from "@/types";
import { useEditorStore } from "@/store/editorStore";

interface RenderAnnotationProps {
  annotation: Annotation;
  isSelected?: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onTransformEnd: (node: Konva.Node) => void;
  scale?: number; // 当前缩放比例，用于补偿线宽等
}

export function RenderAnnotation({
  annotation,
  onSelect,
  onTransformEnd,
  scale = 1,
}: RenderAnnotationProps) {
  const nodeRef = useRef<Konva.Node | null>(null);
  const { updateAnnotation, setEditingTextId } = useEditorStore();
  
  // 计算补偿后的线宽（保持视觉上的一致性）
  const compensatedStrokeWidth = (width: number) => width / scale;

  // 处理拖拽结束
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    updateAnnotation(annotation.id, {
      x: e.target.x(),
      y: e.target.y(),
    });
  };

  // 处理变换结束
  const handleTransformEnd = () => {
    if (nodeRef.current) {
      onTransformEnd(nodeRef.current);
    }
  };

  // 通用属性
  const commonProps = {
    id: annotation.id,
    x: annotation.x,
    y: annotation.y,
    rotation: annotation.rotation || 0,
    draggable: true,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: handleDragEnd,
    onTransformEnd: handleTransformEnd,
  };

  switch (annotation.type) {
    case "rectangle":
      return (
        <Rect
          ref={nodeRef as React.RefObject<Konva.Rect>}
          {...commonProps}
          width={annotation.width}
          height={annotation.height}
          stroke={annotation.stroke}
          strokeWidth={compensatedStrokeWidth(annotation.strokeWidth)}
          fill={annotation.fill}
          opacity={annotation.fillOpacity > 0 ? annotation.fillOpacity : undefined}
          cornerRadius={annotation.cornerRadius}
        />
      );

    case "ellipse":
      return (
        <Ellipse
          ref={nodeRef as React.RefObject<Konva.Ellipse>}
          {...commonProps}
          radiusX={annotation.radiusX}
          radiusY={annotation.radiusY}
          stroke={annotation.stroke}
          strokeWidth={compensatedStrokeWidth(annotation.strokeWidth)}
          fill={annotation.fill}
          opacity={annotation.fillOpacity > 0 ? annotation.fillOpacity : undefined}
        />
      );

    case "arrow":
      return (
        <Arrow
          ref={nodeRef as React.RefObject<Konva.Arrow>}
          {...commonProps}
          points={annotation.points}
          stroke={annotation.stroke}
          strokeWidth={compensatedStrokeWidth(annotation.strokeWidth)}
          fill={annotation.stroke}
          pointerLength={(annotation.pointerLength || 15) / scale}
          pointerWidth={(annotation.pointerWidth || 12) / scale}
          dash={annotation.lineStyle === "dashed" ? [10 / scale, 5 / scale] : undefined}
          lineCap="round"
          lineJoin="round"
        />
      );

    case "line":
      return (
        <Line
          ref={nodeRef as React.RefObject<Konva.Line>}
          {...commonProps}
          points={annotation.points}
          stroke={annotation.stroke}
          strokeWidth={compensatedStrokeWidth(annotation.strokeWidth)}
          dash={annotation.lineStyle === "dashed" ? [10 / scale, 5 / scale] : undefined}
          lineCap="round"
          lineJoin="round"
        />
      );

    case "text":
      return (
        <TextAnnotationRenderer
          annotation={annotation}
          commonProps={commonProps}
          nodeRef={nodeRef}
          scale={scale}
          onStartEdit={() => setEditingTextId(annotation.id)}
          onEndEdit={() => setEditingTextId(null)}
        />
      );

    case "brush":
      return (
        <Line
          ref={nodeRef as React.RefObject<Konva.Line>}
          {...commonProps}
          points={annotation.points}
          stroke={annotation.stroke}
          strokeWidth={compensatedStrokeWidth(annotation.strokeWidth)}
          tension={annotation.tension || 0.5}
          lineCap={annotation.lineCap || "round"}
          lineJoin={annotation.lineJoin || "round"}
        />
      );

    case "marker":
      return (
        <MarkerAnnotationRenderer
          annotation={annotation}
          commonProps={commonProps}
          nodeRef={nodeRef}
          scale={scale}
        />
      );

    case "blur":
      return (
        <BlurAnnotationRenderer
          annotation={annotation}
          commonProps={commonProps}
          nodeRef={nodeRef}
        />
      );

    default:
      return null;
  }
}

// 文字标注渲染器
interface TextAnnotationRendererProps {
  annotation: Extract<Annotation, { type: "text" }>;
  isSelected?: boolean;
  commonProps: Record<string, unknown>;
  nodeRef: React.RefObject<Konva.Node | null>;
  scale?: number;
  onStartEdit: () => void;
  onEndEdit: () => void;
}

function TextAnnotationRenderer({
  annotation,
  commonProps,
  nodeRef,
  scale = 1,
  onStartEdit,
  onEndEdit,
}: TextAnnotationRendererProps) {
  const textRef = useRef<Konva.Text>(null);
  const { updateAnnotation } = useEditorStore();

  // 双击编辑
  const handleDblClick = () => {
    onStartEdit();

    const textNode = textRef.current;
    if (!textNode) return;

    const stage = textNode.getStage();
    if (!stage) return;

    // 隐藏文字节点
    textNode.hide();

    // 获取文字位置
    const textPosition = textNode.absolutePosition();
    const stageBox = stage.container().getBoundingClientRect();

    // 创建 textarea
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);

    textarea.value = annotation.text;
    textarea.style.position = "absolute";
    textarea.style.top = `${stageBox.top + textPosition.y}px`;
    textarea.style.left = `${stageBox.left + textPosition.x}px`;
    textarea.style.width = `${Math.max(textNode.width() * textNode.scaleX(), 100)}px`;
    textarea.style.height = `${Math.max(textNode.height() * textNode.scaleY(), 30)}px`;
    textarea.style.fontSize = `${annotation.fontSize}px`;
    textarea.style.fontFamily = annotation.fontFamily;
    textarea.style.color = annotation.fill;
    textarea.style.border = "2px solid #3b82f6";
    textarea.style.padding = "4px";
    textarea.style.margin = "0";
    textarea.style.overflow = "hidden";
    textarea.style.background = "white";
    textarea.style.outline = "none";
    textarea.style.resize = "none";
    textarea.style.lineHeight = "1.2";
    textarea.style.zIndex = "1000";

    textarea.focus();

    const removeTextarea = () => {
      textarea.remove();
      textNode.show();
      onEndEdit();
    };

    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        updateAnnotation(annotation.id, { text: textarea.value });
        removeTextarea();
      }
      if (e.key === "Escape") {
        removeTextarea();
      }
    });

    textarea.addEventListener("blur", () => {
      updateAnnotation(annotation.id, { text: textarea.value });
      removeTextarea();
    });
  };

  // 补偿后的字体大小
  const compensatedFontSize = annotation.fontSize / scale;

  return (
    <Text
      ref={(node) => {
        textRef.current = node;
        if (nodeRef) {
          (nodeRef as React.MutableRefObject<Konva.Node | null>).current = node;
        }
      }}
      {...commonProps}
      text={annotation.text}
      fontSize={compensatedFontSize}
      fontFamily={annotation.fontFamily}
      fill={annotation.fill}
      padding={(annotation.padding || 4) / scale}
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
    />
  );
}

// 序号标记渲染器
interface MarkerAnnotationRendererProps {
  annotation: Extract<Annotation, { type: "marker" }>;
  commonProps: Record<string, unknown>;
  nodeRef: React.RefObject<Konva.Node | null>;
  scale?: number;
}

function MarkerAnnotationRenderer({
  annotation,
  commonProps,
  nodeRef,
  scale = 1,
}: MarkerAnnotationRendererProps) {
  const isFilled = annotation.markerStyle === "filled";
  const textValue = String(annotation.value);
  
  // 补偿后的尺寸
  const compensatedSize = annotation.size / scale;
  const fontSize = compensatedSize * 0.5;

  return (
    <Group
      ref={nodeRef as React.RefObject<Konva.Group>}
      {...commonProps}
    >
      <Circle
        radius={compensatedSize / 2}
        fill={isFilled ? annotation.fill : "transparent"}
        stroke={annotation.stroke || annotation.fill}
        strokeWidth={(annotation.strokeWidth || 2) / scale}
      />
      <Text
        text={textValue}
        fontSize={fontSize}
        fontFamily="Arial, sans-serif"
        fontStyle="bold"
        fill={isFilled ? annotation.textColor : annotation.fill}
        width={compensatedSize}
        height={compensatedSize}
        align="center"
        verticalAlign="middle"
        offsetX={compensatedSize / 2}
        offsetY={compensatedSize / 2}
      />
    </Group>
  );
}

// 马赛克区域渲染器 - 使用棋盘格图案模拟马赛克效果
interface BlurAnnotationRendererProps {
  annotation: Extract<Annotation, { type: "blur" }>;
  commonProps: Record<string, unknown>;
  nodeRef: React.RefObject<Konva.Node | null>;
}

function BlurAnnotationRenderer({
  annotation,
  commonProps,
  nodeRef,
}: BlurAnnotationRendererProps) {
  const groupRef = useRef<Konva.Group>(null);
  const pixelSize = annotation.blurRadius || 10;

  // 生成马赛克格子
  const renderMosaicGrid = () => {
    const rects: React.ReactNode[] = [];
    const cols = Math.ceil(annotation.width / pixelSize);
    const rows = Math.ceil(annotation.height / pixelSize);
    
    // 使用多种灰色调创建马赛克效果
    const colors = ["#666666", "#888888", "#777777", "#999999", "#555555", "#7a7a7a"];
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const colorIndex = (row * cols + col + row) % colors.length;
        rects.push(
          <Rect
            key={`${row}-${col}`}
            x={col * pixelSize}
            y={row * pixelSize}
            width={pixelSize}
            height={pixelSize}
            fill={colors[colorIndex]}
          />
        );
      }
    }
    return rects;
  };

  return (
    <Group
      ref={(node) => {
        groupRef.current = node;
        if (nodeRef) {
          (nodeRef as React.MutableRefObject<Konva.Node | null>).current = node;
        }
      }}
      {...commonProps}
      clipFunc={(ctx) => {
        ctx.rect(0, 0, annotation.width, annotation.height);
      }}
    >
      {renderMosaicGrid()}
    </Group>
  );
}
