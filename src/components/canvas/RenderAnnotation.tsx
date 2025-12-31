// 标注渲染组件 - 根据类型渲染不同的 Konva 元素
import { useRef, useState, useEffect, useCallback } from "react";
import {
  Rect,
  Ellipse,
  Arrow,
  Line,
  Text,
  Circle,
  Group,
  Image as KonvaImage,
  Shape,
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
  onLiveChange?: () => void;
}

export function RenderAnnotation({
  annotation,
  isSelected,
  onSelect,
  onTransformEnd,
  scale = 1,
  onLiveChange,
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

    case "arrow": {
      // 计算边界框以便整个区域可拖动
      const arrowPoints = annotation.points;
      const arrowMinX = Math.min(arrowPoints[0], arrowPoints[2]);
      const arrowMaxX = Math.max(arrowPoints[0], arrowPoints[2]);
      const arrowMinY = Math.min(arrowPoints[1], arrowPoints[3]);
      const arrowMaxY = Math.max(arrowPoints[1], arrowPoints[3]);
      const arrowPadding = Math.max(20, annotation.strokeWidth * 2) / scale;
      
      // 实心箭头样式：绘制一个填充的多边形
      if (annotation.arrowStyle === "filled") {
        const [x1, y1, x2, y2] = arrowPoints;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return null;
        
        // 单位向量
        const ux = dx / len;
        const uy = dy / len;
        // 垂直向量
        const px = -uy;
        const py = ux;
        
        // 箭头头部大小
        const headLength = Math.min(len * 0.35, 40 / scale);
        const headWidth = headLength * 0.6;
        // 箭身宽度（从起点到箭头底部逐渐变宽）
        const tailWidth = (annotation.strokeWidth * 0.8) / scale;
        const bodyWidth = headWidth * 0.35;
        
        // 箭头各点坐标
        const headBase = { x: x2 - ux * headLength, y: y2 - uy * headLength };
        const filledArrowPoints = [
          // 起点（尾部，细）
          x1 + px * tailWidth, y1 + py * tailWidth,
          // 箭身左侧到箭头底部
          headBase.x + px * bodyWidth, headBase.y + py * bodyWidth,
          // 箭头左翼
          headBase.x + px * headWidth, headBase.y + py * headWidth,
          // 箭头尖端
          x2, y2,
          // 箭头右翼
          headBase.x - px * headWidth, headBase.y - py * headWidth,
          // 箭身右侧到箭头底部
          headBase.x - px * bodyWidth, headBase.y - py * bodyWidth,
          // 起点（尾部，细）
          x1 - px * tailWidth, y1 - py * tailWidth,
        ];
        
        return (
          <Group
            ref={nodeRef as React.RefObject<Konva.Group>}
            {...commonProps}
          >
            <Rect
              x={arrowMinX - arrowPadding}
              y={arrowMinY - arrowPadding}
              width={arrowMaxX - arrowMinX + arrowPadding * 2}
              height={arrowMaxY - arrowMinY + arrowPadding * 2}
              fill="transparent"
            />
            <Line
              points={filledArrowPoints}
              fill={annotation.stroke}
              closed={true}
              listening={false}
            />
          </Group>
        );
      }
      
      // 普通箭头样式
      return (
        <Group
          ref={nodeRef as React.RefObject<Konva.Group>}
          {...commonProps}
        >
          {/* 透明点击区域，覆盖整个边界框 */}
          <Rect
            x={arrowMinX - arrowPadding}
            y={arrowMinY - arrowPadding}
            width={arrowMaxX - arrowMinX + arrowPadding * 2}
            height={arrowMaxY - arrowMinY + arrowPadding * 2}
            fill="transparent"
          />
          <Arrow
            points={arrowPoints}
            stroke={annotation.stroke}
            strokeWidth={compensatedStrokeWidth(annotation.strokeWidth)}
            fill={annotation.stroke}
            pointerLength={(annotation.pointerLength || 15) / scale}
            pointerWidth={(annotation.pointerWidth || 12) / scale}
            dash={annotation.lineStyle === "dashed" ? [10 / scale, 5 / scale] : undefined}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        </Group>
      );
    }

    case "line": {
      // 计算边界框以便整个区域可拖动
      const linePoints = annotation.points;
      const lineMinX = Math.min(linePoints[0], linePoints[2]);
      const lineMaxX = Math.max(linePoints[0], linePoints[2]);
      const lineMinY = Math.min(linePoints[1], linePoints[3]);
      const lineMaxY = Math.max(linePoints[1], linePoints[3]);
      const linePadding = Math.max(20, annotation.strokeWidth * 2) / scale;
      return (
        <Group
          ref={nodeRef as React.RefObject<Konva.Group>}
          {...commonProps}
        >
          {/* 透明点击区域，覆盖整个边界框 */}
          <Rect
            x={lineMinX - linePadding}
            y={lineMinY - linePadding}
            width={lineMaxX - lineMinX + linePadding * 2}
            height={lineMaxY - lineMinY + linePadding * 2}
            fill="transparent"
          />
          <Line
            points={linePoints}
            stroke={annotation.stroke}
            strokeWidth={compensatedStrokeWidth(annotation.strokeWidth)}
            dash={annotation.lineStyle === "dashed" ? [10 / scale, 5 / scale] : undefined}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        </Group>
      );
    }

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

    case "brush": {
      // 计算画笔的边界框
      const brushPoints = annotation.points;
      let brushMinX = Infinity, brushMaxX = -Infinity;
      let brushMinY = Infinity, brushMaxY = -Infinity;
      for (let i = 0; i < brushPoints.length; i += 2) {
        brushMinX = Math.min(brushMinX, brushPoints[i]);
        brushMaxX = Math.max(brushMaxX, brushPoints[i]);
        brushMinY = Math.min(brushMinY, brushPoints[i + 1]);
        brushMaxY = Math.max(brushMaxY, brushPoints[i + 1]);
      }
      const brushPadding = Math.max(20, annotation.strokeWidth * 2) / scale;
      return (
        <Group
          ref={nodeRef as React.RefObject<Konva.Group>}
          {...commonProps}
        >
          {/* 透明点击区域，覆盖整个边界框 */}
          <Rect
            x={brushMinX - brushPadding}
            y={brushMinY - brushPadding}
            width={brushMaxX - brushMinX + brushPadding * 2}
            height={brushMaxY - brushMinY + brushPadding * 2}
            fill="transparent"
          />
          <Line
            points={brushPoints}
            stroke={annotation.stroke}
            strokeWidth={compensatedStrokeWidth(annotation.strokeWidth)}
            tension={annotation.tension || 0.5}
            lineCap={annotation.lineCap || "round"}
            lineJoin={annotation.lineJoin || "round"}
            listening={false}
          />
        </Group>
      );
    }

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

    case "image":
      return (
        <ImageAnnotationRenderer
          annotation={annotation}
          commonProps={commonProps}
          nodeRef={nodeRef}
        />
      );

    case "magnifier":
      return (
        <MagnifierAnnotationRenderer
          annotation={annotation}
          commonProps={commonProps}
          nodeRef={nodeRef}
          scale={scale}
          isSelected={isSelected}
          onLiveChange={onLiveChange}
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
  const { updateAnnotation, deleteAnnotation, currentTool, editingTextId } = useEditorStore();
  const hasAutoEditedRef = useRef(false);

  // 进入编辑模式
  const enterEditMode = () => {
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

    // 如果是默认占位文字或空文本，清空便于用户输入
    const isPlaceholder = annotation.text === "双击编辑" || annotation.text === "点击编辑" || annotation.text === "";
    textarea.value = isPlaceholder ? "" : annotation.text;
    textarea.style.position = "absolute";
    textarea.style.top = `${stageBox.top + textPosition.y}px`;
    textarea.style.left = `${stageBox.left + textPosition.x}px`;
    textarea.style.width = `${Math.max(textNode.width() * textNode.scaleX(), 200)}px`;
    textarea.style.minHeight = `${Math.max(textNode.height() * textNode.scaleY(), 30)}px`;
    textarea.style.fontSize = `${annotation.fontSize}px`;
    textarea.style.fontFamily = annotation.fontFamily;
    textarea.style.color = annotation.fill;
    textarea.style.border = "2px solid #3b82f6";
    textarea.style.padding = "4px";
    textarea.style.margin = "0";
    textarea.style.overflow = "auto";
    textarea.style.background = "white";
    textarea.style.outline = "none";
    textarea.style.resize = "both";
    textarea.style.lineHeight = "1.4";
    textarea.style.zIndex = "1000";
    textarea.style.whiteSpace = "pre-wrap";
    textarea.style.wordWrap = "break-word";

    textarea.focus();
    if (!isPlaceholder) {
      textarea.select(); // 非占位文字时选中所有文本
    }

    let isRemoved = false;
    const removeTextarea = () => {
      if (isRemoved) return;
      isRemoved = true;
      textarea.remove();
      textNode.show();
      onEndEdit();
    };

    const saveAndRemove = () => {
      const newText = textarea.value.trim();
      if (newText === "") {
        // 空文本则删除标注
        deleteAnnotation(annotation.id);
      } else {
        updateAnnotation(annotation.id, { text: textarea.value });
      }
      removeTextarea();
    };

    textarea.addEventListener("keydown", (e) => {
      // Ctrl+Enter 或 Cmd+Enter 提交，普通 Enter 换行
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveAndRemove();
      }
      if (e.key === "Escape") {
        // 取消编辑，恢复原文本（如果原文本是占位符且未输入内容，则删除）
        if (isPlaceholder && textarea.value.trim() === "") {
          deleteAnnotation(annotation.id);
        }
        removeTextarea();
      }
    });
    
    // 自动调整 textarea 高度
    textarea.addEventListener("input", () => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    });

    textarea.addEventListener("blur", (e) => {
      // 如果是点击了自定义右键菜单，不要触发保存
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (relatedTarget?.closest('.text-context-menu')) {
        return;
      }
      saveAndRemove();
    });

    // 滚轮调节字号
    let currentFontSize = annotation.fontSize;
    textarea.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -2 : 2;
      currentFontSize = Math.max(8, Math.min(200, currentFontSize + delta));
      textarea.style.fontSize = `${currentFontSize}px`;
      updateAnnotation(annotation.id, { fontSize: currentFontSize });
    }, { passive: false });

    // 自定义右键菜单（只显示复制、剪切、粘贴）
    textarea.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      
      // 移除已有的菜单
      document.querySelectorAll('.text-context-menu').forEach(el => el.remove());
      
      // 创建自定义菜单
      const menu = document.createElement("div");
      menu.className = "text-context-menu";
      menu.style.cssText = `
        position: fixed;
        left: ${e.clientX}px;
        top: ${e.clientY}px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 4px 0;
        z-index: 10000;
        min-width: 100px;
      `;
      
      const createMenuItem = (label: string, action: () => void) => {
        const item = document.createElement("div");
        item.textContent = label;
        item.style.cssText = `
          padding: 6px 12px;
          cursor: pointer;
          font-size: 13px;
          color: #374151;
        `;
        item.addEventListener("mouseenter", () => {
          item.style.background = "#f3f4f6";
        });
        item.addEventListener("mouseleave", () => {
          item.style.background = "transparent";
        });
        item.addEventListener("mousedown", (e) => {
          e.preventDefault();
          action();
          menu.remove();
          textarea.focus();
        });
        return item;
      };
      
      menu.appendChild(createMenuItem("剪切", () => {
        document.execCommand("cut");
      }));
      menu.appendChild(createMenuItem("复制", () => {
        document.execCommand("copy");
      }));
      menu.appendChild(createMenuItem("粘贴", async () => {
        try {
          const text = await navigator.clipboard.readText();
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + text.length;
        } catch {
          document.execCommand("paste");
        }
      }));
      
      document.body.appendChild(menu);
      
      // 点击其他地方关闭菜单
      const closeMenu = (e: MouseEvent) => {
        if (!menu.contains(e.target as Node)) {
          menu.remove();
          document.removeEventListener("mousedown", closeMenu);
        }
      };
      setTimeout(() => {
        document.addEventListener("mousedown", closeMenu);
      }, 0);
    });
  };

  // 单击处理：文字工具下单击进入编辑，选择工具下选中标注
  const handleClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (currentTool === "text") {
      enterEditMode();
    } else if (currentTool === "select") {
      // 选择工具下，调用原始的 onClick 来选中标注
      const originalOnClick = commonProps.onClick as ((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void) | undefined;
      if (originalOnClick) {
        originalOnClick(e);
      }
    }
  };

  const handleDblClick = () => {
    // 非文字工具下双击进入编辑
    if (currentTool !== "text") {
      enterEditMode();
    }
  };

  // 自动进入编辑模式（新创建的文字）
  useEffect(() => {
    if (editingTextId === annotation.id && !hasAutoEditedRef.current) {
      hasAutoEditedRef.current = true;
      // 延迟一帧等待渲染完成
      requestAnimationFrame(() => {
        enterEditMode();
      });
    }
  }, [editingTextId, annotation.id]);

  // 补偿后的字体大小
  const compensatedFontSize = annotation.fontSize / scale;
  const compensatedPadding = (annotation.padding || 4) / scale;

  // 气泡样式
  if (annotation.textStyle === "bubble") {
    const bubbleStroke = annotation.bubbleStroke || annotation.fill;
    const bubbleFill = annotation.bubbleFill || "transparent";
    const strokeWidth = 2 / scale;
    const radius = 10 / scale;
    const tailSize = 10 / scale;
    const tailWidth = 8 / scale;
    const tailPosition = annotation.bubbleTailPosition || "left";
    
    // 临时测量文字大小
    const tempText = new Konva.Text({
      text: annotation.text || "双击编辑",
      fontSize: compensatedFontSize,
      fontFamily: annotation.fontFamily,
      padding: compensatedPadding,
    });
    const textWidth = tempText.width();
    const textHeight = tempText.height();
    tempText.destroy();
    
    // 使用 Shape 绘制带圆角的气泡
    const drawBubble = (context: Konva.Context, shape: Konva.Shape) => {
      const w = textWidth;
      const h = textHeight;
      const r = Math.min(radius, w / 2, h / 2);
      
      context.beginPath();
      // 左上角
      context.moveTo(r, 0);
      // 上边
      context.lineTo(w - r, 0);
      // 右上角圆弧
      context.arcTo(w, 0, w, r, r);
      // 右边
      context.lineTo(w, h - r);
      // 右下角圆弧
      context.arcTo(w, h, w - r, h, r);
      
      if (tailPosition === "right") {
        // 尾巴在右边
        context.lineTo(w - tailWidth, h);
        context.lineTo(w - tailWidth / 2, h + tailSize);
        context.lineTo(w - tailWidth * 2, h);
      }
      
      // 下边
      if (tailPosition === "left") {
        context.lineTo(tailWidth * 2, h);
        // 尾巴在左边
        context.lineTo(tailWidth / 2, h + tailSize);
        context.lineTo(tailWidth, h);
      }
      
      context.lineTo(r, h);
      // 左下角圆弧
      context.arcTo(0, h, 0, h - r, r);
      // 左边
      context.lineTo(0, r);
      // 左上角圆弧
      context.arcTo(0, 0, r, 0, r);
      context.closePath();
      
      context.fillStrokeShape(shape);
    };
    
    return (
      <Group
        ref={(node) => {
          if (nodeRef) {
            (nodeRef as React.MutableRefObject<Konva.Node | null>).current = node;
          }
        }}
        {...commonProps}
      >
        {/* 气泡背景 - 使用 Rect 作为点击区域 */}
        <Rect
          x={0}
          y={0}
          width={textWidth}
          height={textHeight + tailSize}
          fill="transparent"
          onClick={handleClick}
          onTap={handleClick}
          onDblClick={handleDblClick}
          onDblTap={handleDblClick}
        />
        {/* 气泡形状 */}
        <Shape
          sceneFunc={drawBubble}
          fill={bubbleFill}
          stroke={bubbleStroke}
          strokeWidth={strokeWidth}
          listening={false}
        />
        {/* 文字 */}
        <Text
          ref={textRef}
          text={annotation.text}
          fontSize={compensatedFontSize}
          fontFamily={annotation.fontFamily}
          fill={annotation.fill}
          padding={compensatedPadding}
          listening={false}
        />
      </Group>
    );
  }

  // 普通样式
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
      padding={compensatedPadding}
      onClick={handleClick}
      onTap={handleClick}
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
  const { image, annotations } = useEditorStore();
  const filterRadius = annotation.blurRadius || 10;
  const cornerRadius = annotation.cornerRadius || 10;

  // 应用 Kuwahara 滤镜
  useEffect(() => {
    if (!image || annotation.width <= 0 || annotation.height <= 0) return;

    const processBlur = async () => {
      const w = Math.ceil(annotation.width);
      const h = Math.ceil(annotation.height);
      
      // 创建合成画布（原始图片大小）
      const compositeCanvas = document.createElement("canvas");
      compositeCanvas.width = image.width;
      compositeCanvas.height = image.height;
      const compositeCtx = compositeCanvas.getContext("2d");
      if (!compositeCtx) return;

      // 1. 先绘制背景图
      const bgImg = new window.Image();
      bgImg.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        bgImg.onload = () => resolve();
        bgImg.onerror = () => resolve();
        bgImg.src = image.src;
      });
      compositeCtx.drawImage(bgImg, 0, 0);

      // 2. 绘制所有贴图标注（按顺序，排除马赛克）
      const imageAnnotations = annotations.filter(a => a.type === 'image');
      for (const imgAnnotation of imageAnnotations) {
        const img = new window.Image();
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = (imgAnnotation as { src: string }).src;
        });
        const ia = imgAnnotation as { x: number; y: number; width: number; height: number };
        compositeCtx.drawImage(img, ia.x, ia.y, ia.width, ia.height);
      }

      // 3. 从合成画布裁剪马赛克区域
      const blurCanvas = document.createElement("canvas");
      blurCanvas.width = w;
      blurCanvas.height = h;
      const blurCtx = blurCanvas.getContext("2d");
      if (!blurCtx) return;

      blurCtx.drawImage(
        compositeCanvas,
        annotation.x, annotation.y, w, h,
        0, 0, w, h
      );

      const imageData = blurCtx.getImageData(0, 0, w, h);
      
      // 应用 Kuwahara 滤镜
      const filtered = applyKuwaharaFilter(imageData, filterRadius);

      blurCtx.putImageData(filtered, 0, 0);

      const result = new window.Image();
      result.onload = () => setProcessedImage(result);
      result.src = blurCanvas.toDataURL();
    };

    processBlur();
  }, [image, annotation.x, annotation.y, annotation.width, annotation.height, filterRadius, annotations]);

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

// 图片贴图渲染器
interface ImageAnnotationRendererProps {
  annotation: Extract<Annotation, { type: "image" }>;
  commonProps: Record<string, unknown>;
  nodeRef: React.RefObject<Konva.Node | null>;
}

function ImageAnnotationRenderer({
  annotation,
  commonProps,
  nodeRef,
}: ImageAnnotationRendererProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.src = annotation.src;
    img.onload = () => {
      setImage(img);
    };
  }, [annotation.src]);

  return (
    <KonvaImage
      ref={(node) => {
        if (nodeRef) {
          (nodeRef as React.MutableRefObject<Konva.Node | null>).current = node;
        }
      }}
      {...commonProps}
      image={image || undefined}
      width={annotation.width}
      height={annotation.height}
    />
  );
}

// 放大镜渲染器
interface MagnifierAnnotationRendererProps {
  annotation: Extract<Annotation, { type: "magnifier" }>;
  commonProps: Record<string, unknown>;
  nodeRef: React.RefObject<Konva.Node | null>;
  scale?: number;
  isSelected?: boolean;
  onLiveChange?: () => void;
}

function MagnifierAnnotationRenderer({
  annotation,
  commonProps,
  nodeRef,
  scale = 1,
  isSelected = false,
  onLiveChange,
}: MagnifierAnnotationRendererProps) {
  const { image: bgImage, updateAnnotation, currentTool } = useEditorStore();
  const [magnifiedImage, setMagnifiedImage] = useState<HTMLImageElement | null>(null);
  const groupRef = useRef<Konva.Group | null>(null);
  const sourceCircleRef = useRef<Konva.Circle | null>(null);
  const targetHandleRef = useRef<Konva.Circle | null>(null);
  const sourceHandleRef = useRef<Konva.Circle | null>(null);
  const line1Ref = useRef<Konva.Line | null>(null);
  const line2Ref = useRef<Konva.Line | null>(null);
  const magnifiedImageRef = useRef<Konva.Image | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const isDraggingSourceRef = useRef(false); // 标记是否正在拖动小圆
  const isDraggingGroupRef = useRef(false); // 标记是否正在拖动大圆/组
  const isDraggingAnyRef = useRef(false); // 标记是否正在进行任何拖动操作
  const isSelectTool = currentTool === "select";

  // 缩放控制点的大小（视觉上固定大小）
  const handleSize = 8 / scale;

  // 预加载背景图片
  useEffect(() => {
    if (!bgImage) return;
    const img = new window.Image();
    img.src = bgImage.src;
    img.onload = () => {
      bgImageRef.current = img;
    };
  }, [bgImage?.src]);

  // 绘制放大效果的函数
  const renderMagnifiedImage = useCallback((
    sourceX: number,
    sourceY: number,
    sourceRadius: number,
    targetRadius: number
  ) => {
    if (!bgImageRef.current) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置画布大小（大圆的尺寸）
    canvas.width = targetRadius * 2;
    canvas.height = targetRadius * 2;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 创建圆形裁剪路径
    ctx.save();
    ctx.beginPath();
    ctx.arc(targetRadius, targetRadius, targetRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // 绘制放大的图片（从源区域取样，放大到目标区域）
    const sourceSize = sourceRadius * 2;
    const sx = sourceX - sourceRadius;
    const sy = sourceY - sourceRadius;

    ctx.drawImage(
      bgImageRef.current,
      sx,
      sy,
      sourceSize,
      sourceSize,
      0,
      0,
      targetRadius * 2,
      targetRadius * 2
    );

    ctx.restore();

    // 绘制边框
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(targetRadius, targetRadius, targetRadius - 1.5, 0, Math.PI * 2);
    ctx.stroke();

    // 转换为图片
    const resultImg = new window.Image();
    resultImg.src = canvas.toDataURL();
    resultImg.onload = () => {
      setMagnifiedImage(resultImg);
    };
  }, []);

  // 初始绘制放大效果
  useEffect(() => {
    if (!bgImage) return;

    const img = new window.Image();
    img.src = bgImage.src;
    img.onload = () => {
      bgImageRef.current = img;
      renderMagnifiedImage(
        annotation.sourceX,
        annotation.sourceY,
        annotation.sourceRadius,
        annotation.targetRadius
      );
    };
  }, [bgImage, annotation.sourceX, annotation.sourceY, annotation.sourceRadius, annotation.targetRadius, renderMagnifiedImage]);

  // 所有尺寸都在图片坐标系中
  const targetRadius = annotation.targetRadius;
  const sourceRadius = annotation.sourceRadius;
  const sourceRadiusRef = useRef(sourceRadius);
  const targetRadiusRef = useRef(targetRadius);

  useEffect(() => {
    sourceRadiusRef.current = sourceRadius;
    targetRadiusRef.current = targetRadius;
  }, [sourceRadius, targetRadius]);

  // 小圆相对于大圆的位置（图片坐标系）
  const sourceRelativeX = annotation.sourceX - annotation.x;
  const sourceRelativeY = annotation.sourceY - annotation.y;

  // 计算两圆之间的外切线点
  // 大圆中心在 (0, 0)，小圆中心在 (sourceRelativeX, sourceRelativeY)
  const calculateTangentLines = useCallback((
    srcRelX: number,
    srcRelY: number,
    srcRadius: number,
    tgtRadius: number
  ): { line1: number[]; line2: number[] } => {
    // 两圆心之间的距离
    const dx = srcRelX;
    const dy = srcRelY;
    const d = Math.sqrt(dx * dx + dy * dy);

    // 如果两圆重叠或距离太近，返回简单连线
    if (d <= Math.abs(tgtRadius - srcRadius) + 1) {
      return {
        line1: [0, 0, srcRelX, srcRelY],
        line2: [0, 0, srcRelX, srcRelY]
      };
    }

    // 计算外切线
    // 外切线的角度：alpha = asin((R - r) / d)，这里R是大圆半径，r是小圆半径
    // 两圆心连线的角度
    const angle = Math.atan2(dy, dx);

    // 外切线与圆心连线的夹角
    const alpha = Math.asin((tgtRadius - srcRadius) / d);

    // 切线1的角度（上方）
    const angle1 = angle + Math.PI / 2 - alpha;
    // 切线2的角度（下方）
    const angle2 = angle - Math.PI / 2 + alpha;

    // 大圆上的切点
    const p1x = tgtRadius * Math.cos(angle1);
    const p1y = tgtRadius * Math.sin(angle1);
    const p2x = tgtRadius * Math.cos(angle2);
    const p2y = tgtRadius * Math.sin(angle2);

    // 小圆上的切点
    const q1x = srcRelX + srcRadius * Math.cos(angle1);
    const q1y = srcRelY + srcRadius * Math.sin(angle1);
    const q2x = srcRelX + srcRadius * Math.cos(angle2);
    const q2y = srcRelY + srcRadius * Math.sin(angle2);

    return {
      line1: [p1x, p1y, q1x, q1y],
      line2: [p2x, p2y, q2x, q2y]
    };
  }, []);

  // 获取当前切线点（用于初始渲染）
  const tangentLines = calculateTangentLines(sourceRelativeX, sourceRelativeY, sourceRadius, targetRadius);

  // 当不在拖动时，同步切线点到 React 计算的值
  useEffect(() => {
    // 只有在没有任何拖动操作时才同步
    if (!isDraggingAnyRef.current) {
      if (line1Ref.current) {
        line1Ref.current.points(tangentLines.line1);
      }
      if (line2Ref.current) {
        line2Ref.current.points(tangentLines.line2);
      }
    }
  }, [tangentLines.line1, tangentLines.line2]);

  // 实时更新放大图片（节流）
  const updateMagnifiedImageThrottled = useRef<number | null>(null);
  const updateMagnifiedImageRealtime = useCallback((newSourceX: number, newSourceY: number) => {
    if (updateMagnifiedImageThrottled.current) {
      cancelAnimationFrame(updateMagnifiedImageThrottled.current);
    }
    updateMagnifiedImageThrottled.current = requestAnimationFrame(() => {
      renderMagnifiedImage(newSourceX, newSourceY, annotation.sourceRadius, annotation.targetRadius);
    });
  }, [annotation.sourceRadius, annotation.targetRadius, renderMagnifiedImage]);

  // 处理大圆（组）拖拽开始
  const handleGroupDragStart = () => {
    isDraggingGroupRef.current = true;
    isDraggingAnyRef.current = true;
  };

  // 处理大圆（组）拖拽 - 只移动大圆，小圆保持绝对位置不变
  const handleGroupDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    // 获取新的大圆位置
    const newX = e.target.x();
    const newY = e.target.y();
    const currentSourceRadius = sourceRadiusRef.current;
    const currentTargetRadius = targetRadiusRef.current;

    // 小圆保持绝对位置不变，所以相对位置需要反向调整
    const newSourceRelX = annotation.sourceX - newX;
    const newSourceRelY = annotation.sourceY - newY;

    // 更新小圆的相对位置
    if (sourceCircleRef.current) {
      sourceCircleRef.current.x(newSourceRelX);
      sourceCircleRef.current.y(newSourceRelY);
    }

    // 更新小圆的缩放控制点位置
    if (sourceHandleRef.current) {
      sourceHandleRef.current.x(newSourceRelX + currentSourceRadius * Math.cos(Math.PI / 4));
      sourceHandleRef.current.y(newSourceRelY + currentSourceRadius * Math.sin(Math.PI / 4));
    }

    // 更新切线
    const lines = calculateTangentLines(newSourceRelX, newSourceRelY, currentSourceRadius, currentTargetRadius);
    if (line1Ref.current) {
      line1Ref.current.points(lines.line1);
    }
    if (line2Ref.current) {
      line2Ref.current.points(lines.line2);
    }
  };

  const handleGroupDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    isDraggingGroupRef.current = false;
    isDraggingAnyRef.current = false;

    const newX = e.target.x();
    const newY = e.target.y();

    updateAnnotation(annotation.id, {
      x: newX,
      y: newY,
    });
  };

  // 处理小圆位置拖拽开始
  const handleSourceDragStart = () => {
    isDraggingSourceRef.current = true;
    isDraggingAnyRef.current = true;
  };

  // 处理小圆位置拖拽
  const handleSourceDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;

    const newRelX = e.target.x();
    const newRelY = e.target.y();
    const currentSourceRadius = sourceRadiusRef.current;
    const currentTargetRadius = targetRadiusRef.current;

    // 直接更新切线 - 使用当前的半径值
    const lines = calculateTangentLines(newRelX, newRelY, currentSourceRadius, currentTargetRadius);
    if (line1Ref.current) {
      line1Ref.current.points(lines.line1);
    }
    if (line2Ref.current) {
      line2Ref.current.points(lines.line2);
    }

    // 更新小圆的缩放控制点位置
    if (sourceHandleRef.current) {
      sourceHandleRef.current.x(newRelX + currentSourceRadius * Math.cos(Math.PI / 4));
      sourceHandleRef.current.y(newRelY + currentSourceRadius * Math.sin(Math.PI / 4));
    }

    // 实时更新放大图片
    const groupX = groupRef.current?.x() ?? annotation.x;
    const groupY = groupRef.current?.y() ?? annotation.y;
    const newSourceX = groupX + newRelX;
    const newSourceY = groupY + newRelY;
    updateMagnifiedImageRealtime(newSourceX, newSourceY);
  };

  const handleSourceDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    isDraggingSourceRef.current = false;
    isDraggingAnyRef.current = false;

    const newRelX = e.target.x();
    const newRelY = e.target.y();
    const groupX = groupRef.current?.x() ?? annotation.x;
    const groupY = groupRef.current?.y() ?? annotation.y;
    const newSourceX = groupX + newRelX;
    const newSourceY = groupY + newRelY;

    updateAnnotation(annotation.id, {
      sourceX: newSourceX,
      sourceY: newSourceY,
    });
  };

  // 处理大圆缩放控制点拖拽 - 实时更新
  const handleTargetResizeDrag = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (!isSelectTool) return;
    e.cancelBubble = true;

    const handleX = e.target.x();
    const handleY = e.target.y();
    const distance = Math.sqrt(handleX * handleX + handleY * handleY);
    const newTargetRadius = Math.max(20, distance);
    targetRadiusRef.current = newTargetRadius;

    // 实时更新大圆图片的尺寸
    if (magnifiedImageRef.current) {
      magnifiedImageRef.current.x(-newTargetRadius);
      magnifiedImageRef.current.y(-newTargetRadius);
      magnifiedImageRef.current.width(newTargetRadius * 2);
      magnifiedImageRef.current.height(newTargetRadius * 2);
    }

    // 实时更新切线
    const currentSourceRelX = sourceCircleRef.current?.x() ?? sourceRelativeX;
    const currentSourceRelY = sourceCircleRef.current?.y() ?? sourceRelativeY;
    const currentSourceRadius = sourceRadiusRef.current;
    const lines = calculateTangentLines(
      currentSourceRelX,
      currentSourceRelY,
      currentSourceRadius,
      newTargetRadius
    );
    if (line1Ref.current) {
      line1Ref.current.points(lines.line1);
    }
    if (line2Ref.current) {
      line2Ref.current.points(lines.line2);
    }
  };

  const handleTargetResizeEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (!isSelectTool) return;
    e.cancelBubble = true;

    const handleX = e.target.x();
    const handleY = e.target.y();
    const distance = Math.sqrt(handleX * handleX + handleY * handleY);
    const newTargetRadius = Math.max(20, distance);
    const newScale = newTargetRadius / annotation.sourceRadius;

    updateAnnotation(annotation.id, {
      targetRadius: newTargetRadius,
      scale: Math.max(1, Math.min(10, newScale)),
    });
  };

  // 处理小圆缩放控制点拖拽 - 实时更新
  const handleSourceResizeDrag = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (!isSelectTool) return;
    e.cancelBubble = true;

    const currentSourceRelX = sourceCircleRef.current?.x() ?? sourceRelativeX;
    const currentSourceRelY = sourceCircleRef.current?.y() ?? sourceRelativeY;
    const handleX = e.target.x() - currentSourceRelX;
    const handleY = e.target.y() - currentSourceRelY;
    const distance = Math.sqrt(handleX * handleX + handleY * handleY);
    const newSourceRadius = Math.max(10, distance);
    sourceRadiusRef.current = newSourceRadius;

    // 实时更新小圆尺寸
    if (sourceCircleRef.current) {
      sourceCircleRef.current.radius(newSourceRadius);
    }

    // 实时更新切线
    const currentTargetRadius = targetRadiusRef.current;
    const lines = calculateTangentLines(
      currentSourceRelX,
      currentSourceRelY,
      newSourceRadius,
      currentTargetRadius
    );
    if (line1Ref.current) {
      line1Ref.current.points(lines.line1);
    }
    if (line2Ref.current) {
      line2Ref.current.points(lines.line2);
    }
  };

  const handleSourceResizeEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (!isSelectTool) return;
    e.cancelBubble = true;

    const currentSourceRelX = sourceCircleRef.current?.x() ?? sourceRelativeX;
    const currentSourceRelY = sourceCircleRef.current?.y() ?? sourceRelativeY;
    const handleX = e.target.x() - currentSourceRelX;
    const handleY = e.target.y() - currentSourceRelY;
    const distance = Math.sqrt(handleX * handleX + handleY * handleY);
    const newSourceRadius = Math.max(10, distance);
    const newScale = annotation.targetRadius / newSourceRadius;

    updateAnnotation(annotation.id, {
      sourceRadius: newSourceRadius,
      scale: Math.max(1, Math.min(10, newScale)),
    });
  };

  // 设置光标样式
  const setResizeCursor = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isSelectTool) {
      const container = e.target.getStage()?.container();
      if (container) container.style.cursor = "nwse-resize";
    }
  };

  const setMoveCursor = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isSelectTool) {
      const container = e.target.getStage()?.container();
      if (container) container.style.cursor = "move";
    }
  };

  const resetCursor = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const container = e.target.getStage()?.container();
    if (container) container.style.cursor = "default";
  };

  // 使用 useEffect 监听组位置变化，确保切线始终同步
  // 这个循环始终运行，以确保在 Transformer 拖动时也能更新
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    let animationId: number | null = null;
    let lastGroupX = group.x();
    let lastGroupY = group.y();
    let lastSourceX = sourceCircleRef.current?.x() ?? sourceRelativeX;
    let lastSourceY = sourceCircleRef.current?.y() ?? sourceRelativeY;
    let lastSourceRadius = sourceRadiusRef.current;
    let lastTargetRadius = targetRadiusRef.current;

    const updateLoop = () => {
      if (!groupRef.current) return;

      const currentGroupX = groupRef.current.x();
      const currentGroupY = groupRef.current.y();
      const currentSourceX = sourceCircleRef.current?.x() ?? sourceRelativeX;
      const currentSourceY = sourceCircleRef.current?.y() ?? sourceRelativeY;
      const currentSourceRadius = sourceRadiusRef.current;
      const currentTargetRadius = targetRadiusRef.current;

      // 检测是否有任何变化（组位置或小圆相对位置）
      const groupChanged = currentGroupX !== lastGroupX || currentGroupY !== lastGroupY;
      const sourceChanged = currentSourceX !== lastSourceX || currentSourceY !== lastSourceY;
      const radiusChanged = currentSourceRadius !== lastSourceRadius || currentTargetRadius !== lastTargetRadius;

      if (groupChanged || sourceChanged || radiusChanged) {
        let newSourceRelX: number;
        let newSourceRelY: number;

        if (isDraggingSourceRef.current) {
          // 正在拖动小圆：使用小圆的当前位置
          newSourceRelX = currentSourceX;
          newSourceRelY = currentSourceY;
        } else if (groupChanged) {
          // 组被移动（通过 Transformer 或直接拖动大圆）
          // 小圆保持绝对位置，计算新的相对位置
          newSourceRelX = annotation.sourceX - currentGroupX;
          newSourceRelY = annotation.sourceY - currentGroupY;

          // 更新小圆位置
          if (sourceCircleRef.current) {
            sourceCircleRef.current.x(newSourceRelX);
            sourceCircleRef.current.y(newSourceRelY);
          }

          // 更新控制点
          if (sourceHandleRef.current) {
            sourceHandleRef.current.x(newSourceRelX + currentSourceRadius * Math.cos(Math.PI / 4));
            sourceHandleRef.current.y(newSourceRelY + currentSourceRadius * Math.sin(Math.PI / 4));
          }
        } else {
          // 只有小圆相对位置变化
          newSourceRelX = currentSourceX;
          newSourceRelY = currentSourceY;
        }

        // 更新切线
        if (line1Ref.current && line2Ref.current) {
          const lines = calculateTangentLines(
            newSourceRelX,
            newSourceRelY,
            currentSourceRadius,
            currentTargetRadius
          );
          line1Ref.current.points(lines.line1);
          line2Ref.current.points(lines.line2);
        }

        lastGroupX = currentGroupX;
        lastGroupY = currentGroupY;
        lastSourceX = currentSourceX;
        lastSourceY = currentSourceY;
        lastSourceRadius = currentSourceRadius;
        lastTargetRadius = currentTargetRadius;

        if (onLiveChange && isSelected && isSelectTool) {
          onLiveChange();
        }
      }

      animationId = requestAnimationFrame(updateLoop);
    };

    // 始终启动更新循环
    animationId = requestAnimationFrame(updateLoop);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [
    annotation.sourceX,
    annotation.sourceY,
    sourceRadius,
    targetRadius,
    sourceRelativeX,
    sourceRelativeY,
    calculateTangentLines,
    isSelected,
    isSelectTool,
    onLiveChange,
  ]);

  // 修改 commonProps，使用我们的处理函数
  const modifiedCommonProps = {
    ...commonProps,
    onDragStart: handleGroupDragStart,
    onDragMove: handleGroupDragMove,
    onDragEnd: handleGroupDragEnd,
  };

  return (
    <Group
      ref={(node) => {
        groupRef.current = node;
        if (nodeRef) {
          (nodeRef as React.MutableRefObject<Konva.Node | null>).current = node;
        }
      }}
      {...modifiedCommonProps}
    >
      {/* 大圆 - 放大效果显示区域 */}
      {magnifiedImage ? (
        <KonvaImage
          ref={magnifiedImageRef}
          image={magnifiedImage}
          x={-targetRadius}
          y={-targetRadius}
          width={targetRadius * 2}
          height={targetRadius * 2}
        />
      ) : (
        <Circle
          radius={targetRadius}
          stroke="#3b82f6"
          strokeWidth={2 / scale}
          fill="rgba(59, 130, 246, 0.1)"
        />
      )}

      {/* 大圆缩放控制点（右下角45度位置） - 仅选中时显示 */}
      {isSelected && isSelectTool && (
        <Circle
          ref={targetHandleRef}
          x={targetRadius * Math.cos(Math.PI / 4)}
          y={targetRadius * Math.sin(Math.PI / 4)}
          radius={handleSize}
          fill="#ffffff"
          stroke="#3b82f6"
          strokeWidth={2 / scale}
          draggable
          onDragMove={handleTargetResizeDrag}
          onDragEnd={handleTargetResizeEnd}
          onMouseEnter={setResizeCursor}
          onMouseLeave={resetCursor}
        />
      )}

      {/* 切线1 */}
      <Line
        ref={line1Ref}
        stroke="#ef4444"
        strokeWidth={1.5 / scale}
        listening={false}
      />

      {/* 切线2 */}
      <Line
        ref={line2Ref}
        stroke="#ef4444"
        strokeWidth={1.5 / scale}
        listening={false}
      />

      {/* 小圆 - 源区域指示器（可独立拖拽移动位置） */}
      <Circle
        ref={sourceCircleRef}
        x={sourceRelativeX}
        y={sourceRelativeY}
        radius={sourceRadius}
        stroke="#ef4444"
        strokeWidth={2 / scale}
        fill="rgba(255, 255, 255, 0.3)"
        draggable={isSelectTool}
        onDragStart={handleSourceDragStart}
        onDragMove={handleSourceDragMove}
        onDragEnd={handleSourceDragEnd}
        onMouseEnter={setMoveCursor}
        onMouseLeave={resetCursor}
      />

      {/* 小圆缩放控制点（右下角45度位置） - 仅选中时显示 */}
      {isSelected && isSelectTool && (
        <Circle
          ref={sourceHandleRef}
          x={sourceRelativeX + sourceRadius * Math.cos(Math.PI / 4)}
          y={sourceRelativeY + sourceRadius * Math.sin(Math.PI / 4)}
          radius={handleSize}
          fill="#ffffff"
          stroke="#3b82f6"
          strokeWidth={2 / scale}
          draggable
          onDragMove={handleSourceResizeDrag}
          onDragEnd={handleSourceResizeEnd}
          onMouseEnter={setResizeCursor}
          onMouseLeave={resetCursor}
        />
      )}
    </Group>
  );
}
