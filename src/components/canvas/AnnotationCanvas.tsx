// 标注画布组件 - 核心 Konva 画布
import { useRef, useEffect, useCallback, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Transformer, Group, Rect } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import { useEditorStore, createAnnotation } from "@/store/editorStore";
import { clamp } from "@/lib/utils";
import { RenderAnnotation } from "./RenderAnnotation";
import type { Annotation } from "@/types";

interface AnnotationCanvasProps {
  containerWidth: number;
  containerHeight: number;
}

export function AnnotationCanvas({
  containerWidth,
  containerHeight,
}: AnnotationCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);

  // 从 store 获取状态
  const {
    image,
    currentTool,
    setCurrentTool,
    toolConfig,
    annotations,
    addAnnotation,
    updateAnnotation,
    selectedIds,
    setSelectedIds,
    clearSelection,
    viewState,
    setViewState,
    isDrawing,
    setIsDrawing,
    markerCounter,
    incrementMarkerCounter,
    pushHistory,
    cropArea,
    setCropArea,
    isCropping,
    setIsCropping,
    cropMask,
    editingTextId,
  } = useEditorStore();

  // 加载图片
  const [loadedImage] = useImage(image?.src || "");

  // 当前正在绘制的标注
  const [drawingAnnotation, setDrawingAnnotation] = useState<Annotation | null>(
    null
  );

  // 绘制起始点
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  
  // 文字工具防抖
  const lastTextCreateTimeRef = useRef<number>(0);
  
  // 裁剪等待第二次点击的标记
  const cropWaitingSecondClickRef = useRef(false);
  
  // 用于 requestAnimationFrame 节流
  const rafRef = useRef<number | null>(null);

  // 计算图片适应容器的缩放和位置
  const getImageFit = useCallback(() => {
    if (!image) return { scale: 1, x: 0, y: 0 };

    const scaleX = containerWidth / image.width;
    const scaleY = containerHeight / image.height;
    const scale = Math.min(scaleX, scaleY, 1); // 不超过原始大小

    const x = (containerWidth - image.width * scale) / 2;
    const y = (containerHeight - image.height * scale) / 2;

    return { scale, x, y };
  }, [image, containerWidth, containerHeight]);

  // 获取鼠标在图片坐标系中的位置
  const getPointerPosition = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;

    const pointer = stage.getPointerPosition();
    if (!pointer) return null;

    const { scale, x, y } = getImageFit();
    const totalScale = scale * viewState.scale;

    // 转换到图片坐标系
    const imageX =
      (pointer.x - x - viewState.offsetX) / totalScale;
    const imageY =
      (pointer.y - y - viewState.offsetY) / totalScale;

    return { x: imageX, y: imageY };
  }, [getImageFit, viewState]);

  // 更新 Transformer
  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;

    // 获取选中的节点
    const selectedNodes = selectedIds
      .map((id) => stage.findOne(`#${id}`))
      .filter((node): node is Konva.Node => node !== null);

    transformer.nodes(selectedNodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, annotations]);

  // 处理鼠标按下
  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // 如果正在编辑文字，不处理（让 blur 事件先触发）
      if (editingTextId) return;
      
      // 如果点击的是 Transformer 的锚点，不处理
      if (e.target.getParent()?.className === "Transformer") return;

      const pos = getPointerPosition();
      if (!pos) return;

      // 鼠标中键平移（任何工具下都可用）
      if (e.evt.button === 1) {
        e.evt.preventDefault();
        isPanningRef.current = true;
        const stage = stageRef.current;
        if (stage) {
          const stagePos = stage.getPointerPosition();
          if (stagePos) {
            lastPanPosRef.current = stagePos;
          }
        }
        return;
      }

      // 手型工具 - 开始平移
      if (currentTool === "pan") {
        isPanningRef.current = true;
        const stage = stageRef.current;
        if (stage) {
          const stagePos = stage.getPointerPosition();
          if (stagePos) {
            lastPanPosRef.current = stagePos;
          }
        }
        return;
      }

      // 选择工具
      if (currentTool === "select") {
        // 点击空白区域取消选中
        if (e.target === e.target.getStage() || e.target.name() === "background-image") {
          clearSelection();
        }
        return;
      }

      // 绘制工具
      if (
        [
          "rectangle",
          "ellipse",
          "arrow",
          "line",
          "brush",
          "blur",
        ].includes(currentTool)
      ) {
        setIsDrawing(true);
        startPointRef.current = pos;

        // 创建新标注
        const newAnnotation = createAnnotation(currentTool, toolConfig, pos);
        setDrawingAnnotation(newAnnotation);
        return;
      }

      // 文字工具 - 点击空白区域创建文字（排除已有文字标注）
      if (currentTool === "text") {
        // 检查是否点击了已有的文字标注
        const clickedOnText = e.target.className === "Text";
        if (clickedOnText) {
          // 点击已有文字，不创建新的，让 RenderAnnotation 处理双击编辑
          return;
        }
        
        // 防抖：300ms 内不允许重复创建
        const now = Date.now();
        if (now - lastTextCreateTimeRef.current < 300) {
          return;
        }
        lastTextCreateTimeRef.current = now;
        
        const newAnnotation = createAnnotation(currentTool, toolConfig, pos, {
          text: "双击编辑",
        });
        addAnnotation(newAnnotation);
        setSelectedIds([newAnnotation.id]);
        return;
      }

      // 序号标记工具
      if (currentTool === "marker") {
        const value =
          toolConfig.markerType === "number"
            ? markerCounter
            : String.fromCharCode(64 + markerCounter); // A, B, C...

        const newAnnotation = createAnnotation(currentTool, toolConfig, pos, {
          value,
        });
        addAnnotation(newAnnotation);
        incrementMarkerCounter();
        return;
      }

      // 裁剪工具 - 支持两种模式：拖动或点击两次
      if (currentTool === "crop") {
        // 如果已有有效的裁剪区域（宽高>10），不重新开始
        if (cropArea && cropArea.width > 10 && cropArea.height > 10) {
          return;
        }
        
        // 第二次点击：确定裁剪区域
        if (cropWaitingSecondClickRef.current && startPointRef.current) {
          const startPos = startPointRef.current;
          const newCropArea = {
            x: Math.min(startPos.x, pos.x),
            y: Math.min(startPos.y, pos.y),
            width: Math.abs(pos.x - startPos.x),
            height: Math.abs(pos.y - startPos.y),
          };
          // 如果裁剪区域太小，取消并重置
          if (newCropArea.width < 10 || newCropArea.height < 10) {
            startPointRef.current = null;
            cropWaitingSecondClickRef.current = false;
            setCropArea(null);
          } else {
            setCropArea(newCropArea);
            startPointRef.current = null;
            cropWaitingSecondClickRef.current = false;
          }
          return;
        }
        
        // 第一次点击，设置起始点
        startPointRef.current = pos;
        cropWaitingSecondClickRef.current = false; // 拖动模式，还不是等待第二次点击
        setIsCropping(true);
        setCropArea({ x: pos.x, y: pos.y, width: 0, height: 0 });
        return;
      }
    },
    [
      currentTool,
      toolConfig,
      getPointerPosition,
      clearSelection,
      addAnnotation,
      setSelectedIds,
      setIsDrawing,
      markerCounter,
      incrementMarkerCounter,
      setIsCropping,
      setCropArea,
      cropArea,
      isCropping,
      editingTextId,
    ]
  );

  // 处理鼠标移动（使用 RAF 节流提升性能）
  const handleMouseMoveInternal = useCallback(() => {
    // 处理平移（手型工具或鼠标中键）
    if (isPanningRef.current) {
      const stage = stageRef.current;
      if (!stage) return;

      const pos = stage.getPointerPosition();
      if (!pos || !lastPanPosRef.current) return;

      const dx = pos.x - lastPanPosRef.current.x;
      const dy = pos.y - lastPanPosRef.current.y;

      setViewState({
        offsetX: viewState.offsetX + dx,
        offsetY: viewState.offsetY + dy,
      });

      lastPanPosRef.current = pos;
      return;
    }

    // 处理裁剪 - 拖动模式或点击模式的预览
    if (currentTool === "crop" && startPointRef.current) {
      const pos = getPointerPosition();
      if (!pos) return;
      const startPos = startPointRef.current;
      setCropArea({
        x: Math.min(startPos.x, pos.x),
        y: Math.min(startPos.y, pos.y),
        width: Math.abs(pos.x - startPos.x),
        height: Math.abs(pos.y - startPos.y),
      });
      return;
    }

    if (!isDrawing || !drawingAnnotation || !startPointRef.current) return;

    const pos = getPointerPosition();
    if (!pos) return;

    const startPos = startPointRef.current;

    // 根据标注类型更新
    switch (drawingAnnotation.type) {
      case "rectangle":
      case "blur":
        setDrawingAnnotation({
          ...drawingAnnotation,
          x: Math.min(startPos.x, pos.x),
          y: Math.min(startPos.y, pos.y),
          width: Math.abs(pos.x - startPos.x),
          height: Math.abs(pos.y - startPos.y),
        });
        break;

      case "ellipse":
        setDrawingAnnotation({
          ...drawingAnnotation,
          x: (startPos.x + pos.x) / 2,
          y: (startPos.y + pos.y) / 2,
          radiusX: Math.abs(pos.x - startPos.x) / 2,
          radiusY: Math.abs(pos.y - startPos.y) / 2,
        });
        break;

      case "arrow":
      case "line":
        setDrawingAnnotation({
          ...drawingAnnotation,
          points: [0, 0, pos.x - startPos.x, pos.y - startPos.y],
        });
        break;

      case "brush":
        setDrawingAnnotation({
          ...drawingAnnotation,
          points: [
            ...drawingAnnotation.points,
            pos.x - startPos.x,
            pos.y - startPos.y,
          ],
        });
        break;
    }
  }, [isDrawing, drawingAnnotation, getPointerPosition, currentTool, viewState.offsetX, viewState.offsetY, setViewState, setCropArea]);

  // 使用 requestAnimationFrame 节流的鼠标移动处理
  const handleMouseMove = useCallback(() => {
    if (rafRef.current !== null) return;
    
    rafRef.current = requestAnimationFrame(() => {
      handleMouseMoveInternal();
      rafRef.current = null;
    });
  }, [handleMouseMoveInternal]);

  // 清理 RAF
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // 处理鼠标松开
  const handleMouseUp = useCallback(() => {
    // 结束平移
    if (isPanningRef.current) {
      isPanningRef.current = false;
      lastPanPosRef.current = null;
    }

    // 结束裁剪拖动（但保留裁剪区域显示，等待确认）
    if (isCropping && currentTool === "crop") {
      setIsCropping(false);
      // 如果裁剪区域有效（拖动模式成功），清理起始点
      if (cropArea && cropArea.width > 10 && cropArea.height > 10) {
        startPointRef.current = null;
        cropWaitingSecondClickRef.current = false;
      }
      // 如果裁剪区域太小（点击模式），标记等待第二次点击
      else {
        cropWaitingSecondClickRef.current = true;
        // 不清除 startPointRef，等待第二次点击
      }
      return;
    }

    if (!isDrawing || !drawingAnnotation) return;

    setIsDrawing(false);

    // 检查标注是否有效（有一定大小）
    let isValid = false;
    switch (drawingAnnotation.type) {
      case "rectangle":
      case "blur":
        isValid =
          (drawingAnnotation as { width: number; height: number }).width > 5 &&
          (drawingAnnotation as { width: number; height: number }).height > 5;
        break;
      case "ellipse":
        isValid =
          (drawingAnnotation as { radiusX: number; radiusY: number }).radiusX > 3 &&
          (drawingAnnotation as { radiusX: number; radiusY: number }).radiusY > 3;
        break;
      case "arrow":
      case "line":
        const points = (drawingAnnotation as { points: number[] }).points;
        const length = Math.sqrt(
          Math.pow(points[2], 2) + Math.pow(points[3], 2)
        );
        isValid = length > 10;
        break;
      case "brush":
        isValid = (drawingAnnotation as { points: number[] }).points.length > 4;
        break;
    }

    if (isValid) {
      addAnnotation(drawingAnnotation);
    }

    setDrawingAnnotation(null);
    startPointRef.current = null;
  }, [isDrawing, drawingAnnotation, addAnnotation, setIsDrawing, isCropping, currentTool, cropArea, setIsCropping, setCropArea]);

  // 处理滚轮缩放
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();

      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = viewState.scale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // 计算新缩放
      const scaleBy = 1.1;
      const newScale =
        e.evt.deltaY < 0
          ? clamp(oldScale * scaleBy, 0.1, 5)
          : clamp(oldScale / scaleBy, 0.1, 5);

      // 以鼠标位置为中心缩放
      const { x, y } = getImageFit();
      const mousePointTo = {
        x: (pointer.x - x - viewState.offsetX) / oldScale,
        y: (pointer.y - y - viewState.offsetY) / oldScale,
      };

      const newOffsetX = pointer.x - x - mousePointTo.x * newScale;
      const newOffsetY = pointer.y - y - mousePointTo.y * newScale;

      setViewState({
        scale: newScale,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      });
    },
    [viewState, setViewState, getImageFit]
  );

  // 平移状态
  const isPanningRef = useRef(false);
  const lastPanPosRef = useRef<{ x: number; y: number } | null>(null);

  // 处理标注选中
  const handleAnnotationSelect = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (currentTool !== "select") return;

      e.cancelBubble = true;

      // Shift 多选 (仅鼠标事件支持)
      const isShiftKey = "shiftKey" in e.evt && e.evt.shiftKey;
      if (isShiftKey) {
        if (selectedIds.includes(id)) {
          setSelectedIds(selectedIds.filter((sid) => sid !== id));
        } else {
          setSelectedIds([...selectedIds, id]);
        }
      } else {
        setSelectedIds([id]);
      }
    },
    [currentTool, selectedIds, setSelectedIds]
  );

  // 处理标注变换结束
  const handleTransformEnd = useCallback(
    (id: string, node: Konva.Node) => {
      const annotation = annotations.find((a) => a.id === id);
      if (!annotation) return;

      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      // 重置缩放，将其应用到尺寸
      node.scaleX(1);
      node.scaleY(1);

      const updates: Record<string, unknown> = {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
      };

      // 根据类型更新尺寸
      switch (annotation.type) {
        case "rectangle":
        case "blur":
          updates.width =
            (annotation as { width: number }).width * scaleX;
          updates.height =
            (annotation as { height: number }).height * scaleY;
          break;
        case "ellipse":
          updates.radiusX =
            (annotation as { radiusX: number }).radiusX * scaleX;
          updates.radiusY =
            (annotation as { radiusY: number }).radiusY * scaleY;
          break;
      }

      updateAnnotation(id, updates as Partial<Annotation>);
      pushHistory();
    },
    [annotations, updateAnnotation, pushHistory]
  );

  // 计算图片适应参数
  const imageFit = getImageFit();

  // 光标样式
  const getCursor = () => {
    switch (currentTool) {
      case "pan":
        return "grab";
      case "select":
        return "default";
      case "text":
        return "text";
      default:
        return "crosshair";
    }
  };

  // 右键切换到选择工具
  const handleContextMenu = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      setCurrentTool("select");
    },
    [setCurrentTool]
  );

  if (!image || !loadedImage) {
    return (
      <div className="flex items-center justify-center w-full h-full text-muted-foreground">
        请打开或粘贴图片
      </div>
    );
  }

  return (
    <Stage
      ref={stageRef}
      width={containerWidth}
      height={containerHeight}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
      style={{ cursor: getCursor() }}
      perfectDrawEnabled={false}
    >
      <Layer ref={layerRef}>
        {/* 背景图片 */}
        <KonvaImage
          name="background-image"
          image={loadedImage}
          x={imageFit.x + viewState.offsetX}
          y={imageFit.y + viewState.offsetY}
          width={image.width}
          height={image.height}
          scaleX={imageFit.scale * viewState.scale}
          scaleY={imageFit.scale * viewState.scale}
          perfectDrawEnabled={false}
          listening={false}
        />

        {/* 标注层 - 使用 Group 来应用变换 */}
        <Group
          x={imageFit.x + viewState.offsetX}
          y={imageFit.y + viewState.offsetY}
          scaleX={imageFit.scale * viewState.scale}
          scaleY={imageFit.scale * viewState.scale}
        >
          {/* 渲染所有标注 */}
          {annotations.map((annotation) => (
            <RenderAnnotation
              key={annotation.id}
              annotation={annotation}
              isSelected={selectedIds.includes(annotation.id)}
              onSelect={(e) => handleAnnotationSelect(annotation.id, e)}
              onTransformEnd={(node) =>
                handleTransformEnd(annotation.id, node)
              }
              scale={imageFit.scale * viewState.scale}
            />
          ))}

          {/* 正在绘制的标注 */}
          {drawingAnnotation && (
            <RenderAnnotation
              annotation={drawingAnnotation}
              isSelected={false}
              onSelect={() => {}}
              onTransformEnd={() => {}}
              scale={imageFit.scale * viewState.scale}
            />
          )}
        </Group>

        {/* 裁剪区域 */}
        {cropArea && cropArea.width > 0 && cropArea.height > 0 && (
          <Group
            x={imageFit.x + viewState.offsetX}
            y={imageFit.y + viewState.offsetY}
            scaleX={imageFit.scale * viewState.scale}
            scaleY={imageFit.scale * viewState.scale}
          >
            {/* 裁剪区域外的遮罩 */}
            <Rect
              x={-10000}
              y={-10000}
              width={20000}
              height={cropArea.y + 10000}
              fill="rgba(0,0,0,0.5)"
            />
            <Rect
              x={-10000}
              y={cropArea.y + cropArea.height}
              width={20000}
              height={10000}
              fill="rgba(0,0,0,0.5)"
            />
            <Rect
              x={-10000}
              y={cropArea.y}
              width={cropArea.x + 10000}
              height={cropArea.height}
              fill="rgba(0,0,0,0.5)"
            />
            <Rect
              x={cropArea.x + cropArea.width}
              y={cropArea.y}
              width={10000}
              height={cropArea.height}
              fill="rgba(0,0,0,0.5)"
            />
            {/* 裁剪区域边框 */}
            <Rect
              x={cropArea.x}
              y={cropArea.y}
              width={cropArea.width}
              height={cropArea.height}
              stroke="#3b82f6"
              strokeWidth={2 / (imageFit.scale * viewState.scale)}
              dash={[5, 5]}
            />
          </Group>
        )}

        {/* 裁剪蒙版（已确认的裁剪区域） */}
        {cropMask && (
          <Group
            x={imageFit.x + viewState.offsetX}
            y={imageFit.y + viewState.offsetY}
            scaleX={imageFit.scale * viewState.scale}
            scaleY={imageFit.scale * viewState.scale}
          >
            {/* 裁剪蒙版外的遮罩 - 半透明黑色 */}
            <Rect
              x={-10000}
              y={-10000}
              width={20000}
              height={cropMask.y + 10000}
              fill="rgba(0,0,0,0.6)"
            />
            <Rect
              x={-10000}
              y={cropMask.y + cropMask.height}
              width={20000}
              height={10000}
              fill="rgba(0,0,0,0.6)"
            />
            <Rect
              x={-10000}
              y={cropMask.y}
              width={cropMask.x + 10000}
              height={cropMask.height}
              fill="rgba(0,0,0,0.6)"
            />
            <Rect
              x={cropMask.x + cropMask.width}
              y={cropMask.y}
              width={10000}
              height={cropMask.height}
              fill="rgba(0,0,0,0.6)"
            />
            {/* 裁剪蒙版边框 - 绿色表示已确认 */}
            <Rect
              x={cropMask.x}
              y={cropMask.y}
              width={cropMask.width}
              height={cropMask.height}
              stroke="#22c55e"
              strokeWidth={2 / (imageFit.scale * viewState.scale)}
              dash={[8, 4]}
            />
          </Group>
        )}

        {/* Transformer */}
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // 限制最小尺寸
            if (newBox.width < 10 || newBox.height < 10) {
              return oldBox;
            }
            return newBox;
          }}
          rotateEnabled={true}
          enabledAnchors={[
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
            "middle-left",
            "middle-right",
            "top-center",
            "bottom-center",
          ]}
        />
      </Layer>
    </Stage>
  );
}
