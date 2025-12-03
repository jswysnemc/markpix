// 标注画布组件 - 核心 Konva 画布
import { useRef, useEffect, useCallback, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Transformer, Group, Rect, Circle, Line } from "react-konva";
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
    setToolConfig,
    annotations,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
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
    setEditingTextId,
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
  
  // 删除按钮位置（基于选中标注的边界框）
  const [deleteButtonPos, setDeleteButtonPos] = useState<{ x: number; y: number } | null>(null);
  const [deleteButtonHover, setDeleteButtonHover] = useState(false);
  
  // 框选状态
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);

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

  // 更新 Transformer 和删除按钮位置
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

    // 更新删除按钮位置（以右上角锚点为参考，偏移到右上方）
    const updateDeleteButtonPos = () => {
      if (selectedNodes.length > 0) {
        // 获取 top-right 锚点的位置作为参考
        const topRightAnchor = transformer.findOne(".top-right");
        if (topRightAnchor) {
          const anchorPos = topRightAnchor.absolutePosition();
          setDeleteButtonPos({
            x: anchorPos.x + 12,  // 向右偏移
            y: anchorPos.y - 12,  // 向上偏移
          });
        }
      } else {
        setDeleteButtonPos(null);
      }
    };
    
    updateDeleteButtonPos();
    
    // 监听 Transformer 变换以实时更新按钮位置
    transformer.on("transform", updateDeleteButtonPos);
    transformer.on("dragmove", updateDeleteButtonPos);
    
    return () => {
      transformer.off("transform", updateDeleteButtonPos);
      transformer.off("dragmove", updateDeleteButtonPos);
    };
  }, [selectedIds, annotations, viewState]);

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
        // 点击空白区域
        if (e.target === e.target.getStage() || e.target.name() === "background-image") {
          // 开始框选
          isSelectingRef.current = true;
          selectionStartRef.current = pos;
          setSelectionRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
          // 如果没有按 Ctrl，清除之前的选择
          if (!e.evt.ctrlKey && !e.evt.metaKey) {
            clearSelection();
          }
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
          text: "",  // 空文本，立即进入编辑模式
        });
        addAnnotation(newAnnotation);
        setSelectedIds([newAnnotation.id]);
        // 设置为正在编辑，触发自动进入编辑模式
        setEditingTextId(newAnnotation.id);
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

    // 处理框选
    if (isSelectingRef.current && selectionStartRef.current) {
      const pos = getPointerPosition();
      if (!pos) return;
      const startPos = selectionStartRef.current;
      setSelectionRect({
        x: Math.min(startPos.x, pos.x),
        y: Math.min(startPos.y, pos.y),
        width: Math.abs(pos.x - startPos.x),
        height: Math.abs(pos.y - startPos.y),
      });
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

    // 结束框选
    if (isSelectingRef.current && selectionRect) {
      isSelectingRef.current = false;
      selectionStartRef.current = null;
      
      // 找出框选范围内的标注
      if (selectionRect.width > 5 && selectionRect.height > 5) {
        const selectedAnnotations = annotations.filter((annotation) => {
          // 获取标注的边界框
          let ax = annotation.x;
          let ay = annotation.y;
          let aw = 0;
          let ah = 0;
          
          switch (annotation.type) {
            case "rectangle":
            case "blur":
            case "image":
              aw = (annotation as { width: number }).width;
              ah = (annotation as { height: number }).height;
              break;
            case "ellipse":
              const rx = (annotation as { radiusX: number }).radiusX;
              const ry = (annotation as { radiusY: number }).radiusY;
              ax = annotation.x - rx;
              ay = annotation.y - ry;
              aw = rx * 2;
              ah = ry * 2;
              break;
            case "text":
            case "marker":
              // 文字和标记使用固定大小估算
              aw = 100;
              ah = 30;
              break;
            case "arrow":
            case "line":
            case "brush":
              // 线条类型使用 points 计算边界
              const points = (annotation as { points: number[] }).points;
              if (points.length >= 4) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (let i = 0; i < points.length; i += 2) {
                  minX = Math.min(minX, points[i]);
                  maxX = Math.max(maxX, points[i]);
                  minY = Math.min(minY, points[i + 1]);
                  maxY = Math.max(maxY, points[i + 1]);
                }
                ax = annotation.x + minX;
                ay = annotation.y + minY;
                aw = maxX - minX;
                ah = maxY - minY;
              }
              break;
          }
          
          // 检查是否与选择框相交
          const sx = selectionRect.x;
          const sy = selectionRect.y;
          const sw = selectionRect.width;
          const sh = selectionRect.height;
          
          return !(ax + aw < sx || ax > sx + sw || ay + ah < sy || ay > sy + sh);
        });
        
        if (selectedAnnotations.length > 0) {
          const newIds = selectedAnnotations.map(a => a.id);
          // 合并已选中的（如果按住 Ctrl）
          setSelectedIds([...new Set([...selectedIds, ...newIds])]);
        }
      }
      
      setSelectionRect(null);
      return;
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
  }, [isDrawing, drawingAnnotation, addAnnotation, setIsDrawing, isCropping, currentTool, cropArea, setIsCropping, setCropArea, selectionRect, annotations, selectedIds, setSelectedIds]);

  // 处理滚轮：根据选中标注类型调节属性，或缩放画布
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const delta = e.evt.deltaY > 0 ? -1 : 1;

      // 如果有选中的标注，根据标注类型调节对应属性
      if (selectedIds.length > 0 && currentTool !== "pan") {
        // 获取选中的标注
        const selectedAnnotations = selectedIds
          .map(id => annotations.find(a => a.id === id))
          .filter((a): a is Annotation => a !== undefined);
        
        if (selectedAnnotations.length === 0) return;

        // 根据第一个选中标注的类型来决定调节什么属性
        const firstAnn = selectedAnnotations[0];
        let adjusted = false;

        switch (firstAnn.type) {
          case "rectangle":
          case "ellipse":
          case "arrow":
          case "line":
          case "brush": {
            // 调节线条粗细
            const currentWidth = (firstAnn as { strokeWidth: number }).strokeWidth;
            const newStrokeWidth = clamp(currentWidth + delta, 1, 50);
            setToolConfig({ strokeWidth: newStrokeWidth });
            selectedAnnotations.forEach(ann => {
              if ("strokeWidth" in ann) {
                updateAnnotation(ann.id, { strokeWidth: newStrokeWidth });
              }
            });
            adjusted = true;
            break;
          }
          case "text": {
            // 调节字体大小
            const currentFontSize = (firstAnn as { fontSize: number }).fontSize;
            const newFontSize = clamp(currentFontSize + delta * 2, 8, 200);
            setToolConfig({ fontSize: newFontSize });
            selectedAnnotations.forEach(ann => {
              if (ann.type === "text") {
                updateAnnotation(ann.id, { fontSize: newFontSize });
              }
            });
            adjusted = true;
            break;
          }
          case "marker": {
            // 调节序号大小
            const currentSize = (firstAnn as { size: number }).size;
            const newSize = clamp(currentSize + delta * 2, 16, 100);
            setToolConfig({ markerSize: newSize });
            selectedAnnotations.forEach(ann => {
              if (ann.type === "marker") {
                updateAnnotation(ann.id, { size: newSize });
              }
            });
            adjusted = true;
            break;
          }
          case "blur": {
            // 调节模糊半径
            const currentRadius = (firstAnn as { blurRadius?: number }).blurRadius || 10;
            const newRadius = clamp(currentRadius + delta, 2, 30);
            setToolConfig({ blurRadius: newRadius });
            selectedAnnotations.forEach(ann => {
              if (ann.type === "blur") {
                updateAnnotation(ann.id, { blurRadius: newRadius });
              }
            });
            adjusted = true;
            break;
          }
          case "image": {
            // 调节图片大小（等比例缩放）
            const scaleFactor = 1 + delta * 0.05; // 每次缩放 5%
            selectedAnnotations.forEach(ann => {
              if (ann.type === "image") {
                const ia = ann as { width: number; height: number };
                updateAnnotation(ann.id, { 
                  width: clamp(ia.width * scaleFactor, 20, 2000),
                  height: clamp(ia.height * scaleFactor, 20, 2000)
                });
              }
            });
            adjusted = true;
            break;
          }
        }

        if (adjusted) return;
      }

      // 默认：缩放画布
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
    [viewState, setViewState, getImageFit, currentTool, selectedIds, toolConfig, setToolConfig, annotations, updateAnnotation]
  );

  // 平移状态
  const isPanningRef = useRef(false);
  const lastPanPosRef = useRef<{ x: number; y: number } | null>(null);

  // 处理标注选中
  const handleAnnotationSelect = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (currentTool !== "select") return;

      e.cancelBubble = true;

      // Ctrl/Cmd 或 Shift 多选 (仅鼠标事件支持)
      const isMultiSelectKey = "ctrlKey" in e.evt && (e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey);
      if (isMultiSelectKey) {
        if (selectedIds.includes(id)) {
          // 已选中则取消选中
          setSelectedIds(selectedIds.filter((sid) => sid !== id));
        } else {
          // 未选中则添加到选择
          setSelectedIds([...selectedIds, id]);
        }
      } else {
        // 单选
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
        case "image":
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
        case "arrow":
        case "line":
        case "brush":
          // 线条类型：缩放 points 数组
          const points = (annotation as { points: number[] }).points;
          const scaledPoints = points.map((val, i) => 
            i % 2 === 0 ? val * scaleX : val * scaleY
          );
          updates.points = scaledPoints;
          // 同时更新线条粗细
          if ((annotation as { strokeWidth?: number }).strokeWidth) {
            updates.strokeWidth = (annotation as { strokeWidth: number }).strokeWidth * Math.max(scaleX, scaleY);
          }
          break;
        case "text":
          // 文字类型：缩放字体大小
          updates.fontSize = (annotation as { fontSize: number }).fontSize * Math.max(scaleX, scaleY);
          break;
        case "marker":
          // 序号标记：缩放尺寸
          updates.size = (annotation as { size: number }).size * Math.max(scaleX, scaleY);
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

  // 右键切换到选择工具（编辑文字时不切换）
  const handleContextMenu = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      // 如果正在编辑文字，不切换工具
      if (editingTextId) return;
      setCurrentTool("select");
    },
    [setCurrentTool, editingTextId]
  );

  if (!image || !loadedImage) {
    return null;
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
          name="annotations-group"
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
            listening={false}
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
            listening={false}
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

        {/* 框选矩形 */}
        {selectionRect && selectionRect.width > 0 && selectionRect.height > 0 && (
          <Group
            x={imageFit.x + viewState.offsetX}
            y={imageFit.y + viewState.offsetY}
            scaleX={imageFit.scale * viewState.scale}
            scaleY={imageFit.scale * viewState.scale}
          >
            <Rect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              fill="rgba(59, 130, 246, 0.1)"
              stroke="#3b82f6"
              strokeWidth={1 / (imageFit.scale * viewState.scale)}
              dash={[6, 3]}
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

        {/* 删除按钮 - 选中标注时显示在右上角 */}
        {deleteButtonPos && selectedIds.length > 0 && (
          <Group
            x={deleteButtonPos.x}
            y={deleteButtonPos.y}
            onClick={() => {
              selectedIds.forEach(id => deleteAnnotation(id));
              clearSelection();
            }}
            onTap={() => {
              selectedIds.forEach(id => deleteAnnotation(id));
              clearSelection();
            }}
            onMouseEnter={(e) => {
              setDeleteButtonHover(true);
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = "pointer";
            }}
            onMouseLeave={(e) => {
              setDeleteButtonHover(false);
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = "default";
            }}
          >
            {/* 背景圆 - 使用 Transformer 相同的蓝色，hover 时变深 */}
            <Circle
              radius={10}
              fill={deleteButtonHover ? "#2563eb" : "#3b82f6"}
              stroke="#fff"
              strokeWidth={1}
              scaleX={deleteButtonHover ? 1.1 : 1}
              scaleY={deleteButtonHover ? 1.1 : 1}
            />
            {/* X 图标 */}
            <Line
              points={[-3, -3, 3, 3]}
              stroke="#fff"
              strokeWidth={2}
              lineCap="round"
            />
            <Line
              points={[3, -3, -3, 3]}
              stroke="#fff"
              strokeWidth={2}
              lineCap="round"
            />
          </Group>
        )}
      </Layer>
    </Stage>
  );
}
