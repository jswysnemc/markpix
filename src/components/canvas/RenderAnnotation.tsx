// 标注渲染组件 - 根据类型渲染不同的 Konva 元素
import { useRef, useState, useEffect } from "react";
import {
  Rect,
  Ellipse,
  Arrow,
  Line,
  Text,
  Circle,
  Group,
  Image as KonvaImage,
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
  const { updateAnnotation, setEditingTextId, currentTool } = useEditorStore();
  
  // 只有在选择工具时才允许拖动和点击选中
  const isSelectTool = currentTool === "select";
  // 文本工具时，文本标注也需要响应事件（用于双击编辑）
  const isTextToolOnText = currentTool === "text" && annotation.type === "text";
  const shouldListen = isSelectTool || isTextToolOnText;
  
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

  // 通用属性 - 只有选择工具时才允许拖动和交互
  const commonProps = {
    id: annotation.id,
    x: annotation.x,
    y: annotation.y,
    rotation: annotation.rotation || 0,
    draggable: isSelectTool,
    onClick: isSelectTool ? onSelect : undefined,
    onTap: isSelectTool ? onSelect : undefined,
    onDragEnd: isSelectTool ? handleDragEnd : undefined,
    onTransformEnd: isSelectTool ? handleTransformEnd : undefined,
    listening: shouldListen, // 选择工具或文本工具编辑文本时监听事件
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
          hitStrokeWidth={Math.max(20 / scale, compensatedStrokeWidth(annotation.strokeWidth) * 3)}
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
          hitStrokeWidth={Math.max(20 / scale, compensatedStrokeWidth(annotation.strokeWidth) * 3)}
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
    textarea.select(); // 默认选中所有文本

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

// 马赛克区域渲染器 - 使用 Kuwahara 滤镜实现油画效果
interface BlurAnnotationRendererProps {
  annotation: Extract<Annotation, { type: "blur" }>;
  commonProps: Record<string, unknown>;
  nodeRef: React.RefObject<Konva.Node | null>;
}

// Kuwahara 滤镜实现 - 积分图优化版
function applyKuwaharaFilter(imageData: ImageData, radius: number): ImageData {
  const { width, height, data } = imageData;
  const output = new Uint8ClampedArray(data.length);
  const r = Math.max(2, Math.floor(radius));
  
  // 创建积分图数组 (R, G, B, R^2, G^2, B^2)
  // 使用 Float64Array 防止溢出
  const size = (width + 1) * (height + 1);
  const satR = new Float64Array(size);
  const satG = new Float64Array(size);
  const satB = new Float64Array(size);
  const satR2 = new Float64Array(size);
  const satG2 = new Float64Array(size);
  const satB2 = new Float64Array(size);

  // 1. 构建积分图
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const rVal = data[idx];
      const gVal = data[idx + 1];
      const bVal = data[idx + 2];

      const satIdx = (y + 1) * (width + 1) + (x + 1);
      const topIdx = y * (width + 1) + (x + 1);
      const leftIdx = (y + 1) * (width + 1) + x;
      const diagIdx = y * (width + 1) + x;

      satR[satIdx] = rVal + satR[topIdx] + satR[leftIdx] - satR[diagIdx];
      satG[satIdx] = gVal + satG[topIdx] + satG[leftIdx] - satG[diagIdx];
      satB[satIdx] = bVal + satB[topIdx] + satB[leftIdx] - satB[diagIdx];

      satR2[satIdx] = rVal * rVal + satR2[topIdx] + satR2[leftIdx] - satR2[diagIdx];
      satG2[satIdx] = gVal * gVal + satG2[topIdx] + satG2[leftIdx] - satG2[diagIdx];
      satB2[satIdx] = bVal * bVal + satB2[topIdx] + satB2[leftIdx] - satB2[diagIdx];
    }
  }

  // 辅助函数：获取矩形区域的和
  const getSum = (sat: Float64Array, x1: number, y1: number, x2: number, y2: number) => {
    const A = y1 * (width + 1) + x1;
    const B = y1 * (width + 1) + (x2 + 1);
    const C = (y2 + 1) * (width + 1) + x1;
    const D = (y2 + 1) * (width + 1) + (x2 + 1);
    return sat[D] - sat[B] - sat[C] + sat[A];
  };

  // 2. 应用滤镜
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 定义四个象限
      // (x-r, y-r) to (x, y)
      // (x, y-r) to (x+r, y)
      // (x-r, y) to (x, y+r)
      // (x, y) to (x+r, y+r)
      
      let minVariance = Infinity;
      let bestR = 0, bestG = 0, bestB = 0;

      // 遍历四个象限
      for (let i = 0; i < 4; i++) {
        let x1, y1, x2, y2;
        if (i === 0) { x1 = x - r; y1 = y - r; x2 = x; y2 = y; }
        else if (i === 1) { x1 = x; y1 = y - r; x2 = x + r; y2 = y; }
        else if (i === 2) { x1 = x - r; y1 = y; x2 = x; y2 = y + r; }
        else { x1 = x; y1 = y; x2 = x + r; y2 = y + r; }

        // 边界裁剪
        x1 = Math.max(0, x1); y1 = Math.max(0, y1);
        x2 = Math.min(width - 1, x2); y2 = Math.min(height - 1, y2);

        if (x1 > x2 || y1 > y2) continue;

        const count = (x2 - x1 + 1) * (y2 - y1 + 1);
        if (count === 0) continue;

        const sR = getSum(satR, x1, y1, x2, y2);
        const sG = getSum(satG, x1, y1, x2, y2);
        const sB = getSum(satB, x1, y1, x2, y2);
        const sR2 = getSum(satR2, x1, y1, x2, y2);
        const sG2 = getSum(satG2, x1, y1, x2, y2);
        const sB2 = getSum(satB2, x1, y1, x2, y2);

        const mR = sR / count;
        const mG = sG / count;
        const mB = sB / count;

        const vR = sR2 / count - mR * mR;
        const vG = sG2 / count - mG * mG;
        const vB = sB2 / count - mB * mB;
        const variance = vR + vG + vB;

        if (variance < minVariance) {
          minVariance = variance;
          bestR = mR;
          bestG = mG;
          bestB = mB;
        }
      }

      const idx = (y * width + x) * 4;
      output[idx] = bestR;
      output[idx + 1] = bestG;
      output[idx + 2] = bestB;
      output[idx + 3] = data[idx + 3];
    }
  }

  return new ImageData(output, width, height);
}

function BlurAnnotationRenderer({
  annotation,
  commonProps,
  nodeRef,
}: BlurAnnotationRendererProps) {
  const groupRef = useRef<Konva.Group>(null);
  const [processedImage, setProcessedImage] = useState<HTMLImageElement | null>(null);
  const { image } = useEditorStore();
  const filterRadius = annotation.blurRadius || 10;
  const cornerRadius = annotation.cornerRadius || 10;

  // 应用 Kuwahara 滤镜
  useEffect(() => {
    if (!image || annotation.width <= 0 || annotation.height <= 0) return;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = Math.ceil(annotation.width);
      const h = Math.ceil(annotation.height);
      canvas.width = w;
      canvas.height = h;

      // 从原图裁剪对应区域
      ctx.drawImage(
        img,
        annotation.x, annotation.y, w, h,
        0, 0, w, h
      );

      const imageData = ctx.getImageData(0, 0, w, h);
      
      // 应用一次积分图优化的滤镜，性能应足够快
      // 只有在半径非常大时才会有感知延迟
      const filtered = applyKuwaharaFilter(imageData, filterRadius);

      ctx.putImageData(filtered, 0, 0);

      const result = new window.Image();
      result.onload = () => setProcessedImage(result);
      result.src = canvas.toDataURL();
    };
    img.src = image.src;
  }, [image, annotation.x, annotation.y, annotation.width, annotation.height, filterRadius]);

  // 圆角裁剪路径
  const clipWithRoundedRect = (ctx: Konva.Context) => {
    const w = annotation.width;
    const h = annotation.height;
    const r = Math.min(cornerRadius, w / 2, h / 2);
    
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
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
      clipFunc={clipWithRoundedRect}
    >
      {processedImage ? (
        <KonvaImage
          image={processedImage}
          x={0}
          y={0}
          width={annotation.width}
          height={annotation.height}
        />
      ) : (
        <Rect
          x={0}
          y={0}
          width={annotation.width}
          height={annotation.height}
          fill="#cccccc"
        />
      )}
    </Group>
  );
}
