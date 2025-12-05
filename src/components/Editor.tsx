// 编辑器主组件
import { useRef, useEffect, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readImage } from "@tauri-apps/plugin-clipboard-manager";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { useEditorStore } from "@/store/editorStore";
import { AnnotationCanvas } from "./canvas/AnnotationCanvas";
import { Toolbar, FloatingToolConfig } from "./toolbar/Toolbar";
import { CustomActionsPanel } from "./CustomActionsPanel";
import { SettingsDialog } from "./SettingsDialog";
import type { CustomAction, ImageInfo } from "@/types";
import Konva from "konva";
import { Keyboard, Mouse, Zap, FolderOpen } from "lucide-react";

// 工具栏高度和边距常量
const TOOLBAR_HEIGHT = 48;
const TOOLBAR_MARGIN = 16;
const MIN_WINDOW_WIDTH = 1050;
const MIN_WINDOW_HEIGHT = 500;
const MAX_WINDOW_WIDTH = 1920;
const MAX_WINDOW_HEIGHT = 1080;

export function Editor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showOpenConfirm, setShowOpenConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [cliOutputPattern, setCliOutputPattern] = useState<string | null>(null);

  const {
    image,
    setImage,
    setCustomActions,
    currentTool,
    setCurrentTool,
    undo,
    redo,
    selectedIds,
    deleteAnnotation,
    cropArea,
    setCropArea,
    cropMask,
    setCropMask,
    pushHistory,
    annotations,
    outputPattern,
    viewState,
  } = useEditorStore();

  // 监听容器大小变化
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    // 跟踪鼠标位置
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mousePositionRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    container.addEventListener("mousemove", handleMouseMove);

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // 计算图片贴图位置：鼠标位置转换为图片坐标，如果不在范围内则居中
  const getImageInsertPosition = useCallback((imgWidth: number, imgHeight: number) => {
    if (!image || !mousePositionRef.current) {
      // 没有背景图或鼠标位置，放中心
      return { x: 50, y: 50 };
    }

    // 计算图片适应参数
    const containerW = containerSize.width;
    const containerH = containerSize.height;
    const scaleX = containerW / image.width;
    const scaleY = containerH / image.height;
    const fitScale = Math.min(scaleX, scaleY, 1);
    const fitX = (containerW - image.width * fitScale) / 2;
    const fitY = (containerH - image.height * fitScale) / 2;

    // 当前总缩放
    const totalScale = fitScale * viewState.scale;

    // 鼠标位置转换为图片坐标
    const mouseX = mousePositionRef.current.x;
    const mouseY = mousePositionRef.current.y;
    
    const imageX = (mouseX - fitX - viewState.offsetX) / totalScale;
    const imageY = (mouseY - fitY - viewState.offsetY) / totalScale;

    // 检查是否在图片范围内
    if (imageX >= 0 && imageX <= image.width && imageY >= 0 && imageY <= image.height) {
      // 在范围内，返回鼠标位置（减去贴图尺寸的一半使其居中于鼠标）
      return {
        x: Math.max(0, imageX - imgWidth / 2),
        y: Math.max(0, imageY - imgHeight / 2),
      };
    } else {
      // 不在范围内，放图片中心
      return {
        x: Math.max(0, (image.width - imgWidth) / 2),
        y: Math.max(0, (image.height - imgHeight) / 2),
      };
    }
  }, [image, containerSize, viewState]);

  // 初始化：加载 CLI 传入的图片和自定义动作
  useEffect(() => {
    const init = async () => {
      try {
        // 加载配置
        await useEditorStore.getState().loadConfig();

        // 获取 CLI 传入的图片路径
        const initialPath = await invoke<string | null>("get_initial_image");
        if (initialPath) {
          await loadImageFromPath(initialPath);
        }

        // 加载自定义动作
        const actions = await invoke<CustomAction[]>("get_custom_actions");
        setCustomActions(actions);

        // 获取 CLI 指定的输出模式（优先于配置）
        const cliPattern = await invoke<string | null>("get_cli_output_pattern");
        if (cliPattern) {
          setCliOutputPattern(cliPattern);
        }
      } catch (error) {
        console.error("初始化失败:", error);
      }
    };

    init();
  }, [setCustomActions]);

  // 根据图片大小调整窗口大小
  const adjustWindowSize = useCallback(async (imgWidth: number, imgHeight: number) => {
    try {
      const appWindow = getCurrentWindow();
      
      // 计算理想窗口大小（图片大小 + 工具栏和边距）
      const idealWidth = imgWidth + TOOLBAR_MARGIN * 2;
      const idealHeight = imgHeight + TOOLBAR_HEIGHT + TOOLBAR_MARGIN * 3;
      
      // 限制在最小和最大范围内
      const newWidth = Math.max(MIN_WINDOW_WIDTH, Math.min(MAX_WINDOW_WIDTH, idealWidth));
      const newHeight = Math.max(MIN_WINDOW_HEIGHT, Math.min(MAX_WINDOW_HEIGHT, idealHeight));
      
      // 设置窗口大小
      await appWindow.setSize(new LogicalSize(newWidth, newHeight));
      
      // 居中窗口
      await appWindow.center();
    } catch (error) {
      console.error("调整窗口大小失败:", error);
    }
  }, []);

  // 从路径加载图片
  const loadImageFromPath = async (path: string) => {
    try {
      const dataUrl = await invoke<string>("read_image_file", { path });
      const img = new Image();
      img.onload = async () => {
        const imageInfo: ImageInfo = {
          src: dataUrl,
          width: img.width,
          height: img.height,
          name: path.split(/[\\/]/).pop(),
          path: path,
        };
        setImage(imageInfo);
        
        // 自动调整窗口大小
        await adjustWindowSize(img.width, img.height);
      };
      img.src = dataUrl;
    } catch (error) {
      console.error("加载图片失败:", error);
      alert(`加载图片失败: ${error}`);
    }
  };

  // 打开文件
  const handleOpenFile = async () => {
    // 如果当前有图片，先询问是否保存
    if (image) {
      setShowOpenConfirm(true);
    } else {
      await doOpenFile();
    }
  };

  // 实际执行打开文件
  const doOpenFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "图片",
            extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"],
          },
        ],
      });

      if (selected) {
        // 清除当前状态
        useEditorStore.getState().clearAnnotations();
        useEditorStore.getState().setCropMask(null);
        useEditorStore.getState().resetMarkerCounter();
        await loadImageFromPath(selected);
      }
    } catch (error) {
      console.error("打开文件失败:", error);
    }
  };

  // 确认打开新文件（不保存当前）
  const handleConfirmOpen = useCallback(async () => {
    setShowOpenConfirm(false);
    await doOpenFile();
  }, []);

  // 获取画布数据 URL（应用裁剪蒙版，保持原始图片大小）
  const getCanvasDataUrl = useCallback(async (): Promise<string | null> => {
    if (!image) return null;
    
    // 查找 Konva Stage
    const stageElement = containerRef.current?.querySelector(".konvajs-content");
    if (!stageElement) return null;

    // 获取 Konva Stage 实例
    const stage = Konva.stages.find((s) =>
      s.container().contains(stageElement as HTMLElement)
    );
    if (!stage) return null;

    // 确定导出区域：如果有裁剪蒙版则使用蒙版区域，否则使用原始图片大小
    const exportWidth = cropMask ? cropMask.width : image.width;
    const exportHeight = cropMask ? cropMask.height : image.height;
    const exportX = cropMask ? cropMask.x : 0;
    const exportY = cropMask ? cropMask.y : 0;

    // 创建离屏 Stage 以原始分辨率导出
    const offscreenContainer = document.createElement("div");
    offscreenContainer.style.position = "absolute";
    offscreenContainer.style.left = "-9999px";
    document.body.appendChild(offscreenContainer);

    const offscreenStage = new Konva.Stage({
      container: offscreenContainer,
      width: exportWidth,
      height: exportHeight,
    });

    const offscreenLayer = new Konva.Layer();
    offscreenStage.add(offscreenLayer);

    // 加载原始图片
    return new Promise<string | null>((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        // 绘制背景图片（原始大小，应用裁剪偏移）
        const konvaImg = new Konva.Image({
          image: img,
          x: -exportX,
          y: -exportY,
          width: image.width,
          height: image.height,
        });
        offscreenLayer.add(konvaImg);

        // 复制所有标注到离屏 Layer（原始坐标，应用裁剪偏移）
        const annotationGroup = stage.findOne(".annotations-group") as Konva.Group;
        if (annotationGroup) {
          annotationGroup.children?.forEach((child) => {
            if (child.name() !== "background-image") {
              const clone = child.clone();
              // 重置缩放，应用裁剪偏移
              clone.scaleX(1);
              clone.scaleY(1);
              clone.x(clone.x() - exportX);
              clone.y(clone.y() - exportY);
              offscreenLayer.add(clone);
            }
          });
        }

        offscreenLayer.draw();
        const dataUrl = offscreenStage.toDataURL({ pixelRatio: 1 });
        
        // 清理
        offscreenStage.destroy();
        offscreenContainer.remove();
        
        resolve(dataUrl);
      };
      img.onerror = () => {
        offscreenStage.destroy();
        offscreenContainer.remove();
        resolve(null);
      };
      img.src = image.src;
    });
  }, [cropMask, image, annotations]);

  // 保存文件
  const handleSave = async () => {
    if (!image) return;

    try {
      const dataUrl = await getCanvasDataUrl();
      if (!dataUrl) {
        showToast("无法获取画布数据", "error");
        return;
      }

      // 生成默认文件名，根据配置的模式
      const baseName = image.name?.replace(/\.[^.]+$/, "") || "image";
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const timestamp = `${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

      // CLI 参数优先于配置
      let defaultName = cliOutputPattern || outputPattern || "{input_file_base}_{YYYY_MM_DD-hh-mm-ss}_markpix.png";
      defaultName = defaultName
        .replace(/{input_file_base}/g, baseName)
        .replace(/{input_file}/g, image.path || image.name || "")
        .replace(/{YYYY_MM_DD-hh-mm-ss}/g, timestamp);

      const filePath = await save({
        defaultPath: defaultName,
        filters: [
          { name: "PNG", extensions: ["png"] },
          { name: "JPEG", extensions: ["jpg", "jpeg"] },
        ],
      });

      if (filePath) {
        await invoke("save_image_file", { path: filePath, data: dataUrl });
        showToast("保存成功");
      }
    } catch (error) {
      console.error("保存失败:", error);
      showToast(`保存失败: ${error}`, "error");
    }
  };

  // 保存当前并打开新文件
  const handleSaveAndOpen = useCallback(async () => {
    setShowOpenConfirm(false);
    await handleSave();
    await doOpenFile();
  }, []);

  // 插入图片（作为贴图）
  const handleInsertImage = async () => {
    if (!image) return;
    
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "图片",
            extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"],
          },
        ],
      });

      if (selected) {
        // 读取图片文件
        const imageData = await invoke<string>("read_image_file", { path: selected });
        
        // 创建 Image 对象获取尺寸
        const img = new window.Image();
        img.src = imageData;
        await new Promise((resolve) => { img.onload = resolve; });
        
        // 计算插入位置
        const pos = getImageInsertPosition(img.width, img.height);
        
        // 添加为贴图标注
        const { addAnnotation, pushHistory } = useEditorStore.getState();
        const imageAnnotation = {
          id: `image-${Date.now()}`,
          type: "image" as const,
          x: pos.x,
          y: pos.y,
          width: img.width,
          height: img.height,
          src: imageData,
        };
        addAnnotation(imageAnnotation);
        pushHistory();
      }
    } catch (error) {
      console.error("插入图片失败:", error);
    }
  };

  // 显示无侵入式提示
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2000);
  }, []);

  // 复制到剪贴板 - 直接从内存复制，无需临时文件
  const handleCopy = async () => {
    if (!image) return;

    try {
      const dataUrl = await getCanvasDataUrl();
      if (!dataUrl) {
        showToast("无法获取画布数据", "error");
        return;
      }

      // 提取 base64 数据并直接复制
      const base64Data = dataUrl.split(",")[1];
      await invoke("copy_image_data_to_clipboard", { data: base64Data });
      showToast("已复制到剪贴板");
    } catch (error) {
      console.error("复制失败:", error);
      showToast(`复制失败: ${error}`, "error");
    }
  };

  // 关闭窗口处理
  const handleClose = useCallback(async () => {
    // 如果有图片，无论是否编辑过，都显示确认对话框
    // 用户需求：当加载图片但是未编辑任何内容时退出 也走先问是否保存逻辑
    if (image) {
      setShowCloseConfirm(true);
    } else {
      await invoke("exit_app");
    }
  }, [image]);

  // 确认关闭（不保存）
  const handleConfirmClose = useCallback(async () => {
    setShowCloseConfirm(false);
    await invoke("exit_app");
  }, []);

  // 保存并关闭
  const handleSaveAndClose = useCallback(async () => {
    setShowCloseConfirm(false);
    await handleSave();
    await invoke("exit_app");
  }, [handleSave]);

  // 确认裁剪 - 设置蒙版而不是直接裁剪
  const handleCropConfirm = useCallback(() => {
    if (!cropArea) return;

    // 设置裁剪蒙版（保存时才真正应用）
    pushHistory();
    setCropMask({
      x: cropArea.x,
      y: cropArea.y,
      width: cropArea.width,
      height: cropArea.height,
    });
    
    // 清除裁剪区域
    setCropArea(null);
    // 切换回选择工具
    setCurrentTool("select");
  }, [cropArea, setCropArea, setCropMask, setCurrentTool, pushHistory]);

  // 从剪贴板粘贴
  const handlePaste = useCallback(async () => {
    try {
      const clipboardImage = await readImage();
      if (clipboardImage) {
        // readImage 返回 Image 对象，包含 rgba() 和 size() 方法
        const size = await clipboardImage.size();
        const rgbaData = await clipboardImage.rgba();

        if (rgbaData && rgbaData.length > 0) {
          // 将 RGBA 数据转换为 PNG
          const canvas = document.createElement("canvas");
          canvas.width = size.width;
          canvas.height = size.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          const imgData = new ImageData(
            new Uint8ClampedArray(rgbaData),
            size.width,
            size.height
          );
          ctx.putImageData(imgData, 0, 0);

          const dataUrl = canvas.toDataURL("image/png");

          // 如果已有背景图，则作为贴图添加
          if (image) {
            // 计算插入位置
            const pos = getImageInsertPosition(size.width, size.height);
            
            const { addAnnotation, pushHistory } = useEditorStore.getState();
            const imageAnnotation = {
              id: `image-${Date.now()}`,
              type: "image" as const,
              x: pos.x,
              y: pos.y,
              width: size.width,
              height: size.height,
              src: dataUrl,
            };
            addAnnotation(imageAnnotation);
            pushHistory();
          } else {
            // 首次粘贴，设置为背景图
            const imageInfo: ImageInfo = {
              src: dataUrl,
              width: size.width,
              height: size.height,
              name: "clipboard-image.png",
            };
            setImage(imageInfo);
            
            // 自动调整窗口大小
            await adjustWindowSize(size.width, size.height);
          }
        }
      }
    } catch (error) {
      console.error("粘贴失败:", error);
    }
  }, [image, setImage, adjustWindowSize]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 检查是否在输入框中（textarea, input 等）
      const target = e.target as HTMLElement;
      const isInInput = target.tagName === "INPUT" || 
                        target.tagName === "TEXTAREA" || 
                        target.isContentEditable;

      // Ctrl+V 粘贴（在输入框外才触发自定义粘贴）
      if (e.ctrlKey && e.key === "v" && !isInInput) {
        handlePaste();
        return;
      }

      // Ctrl+Z 撤销（在输入框外）
      if (e.ctrlKey && e.key === "z" && !isInInput) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Y 重做（在输入框外）
      if (e.ctrlKey && e.key === "y" && !isInInput) {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl+S 保存
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        handleSave();
        return;
      }

      // Ctrl+Shift+C 或 F12 打开开发者工具（开发模式下）
      if ((e.ctrlKey && e.shiftKey && e.key === "C") || e.key === "F12") {
        // 不阻止默认行为，允许浏览器/Tauri 处理开发者工具
        return;
      }

      // Ctrl+C 复制（在输入框外）
      if (e.ctrlKey && e.key === "c" && image && !isInInput) {
        e.preventDefault();
        handleCopy();
        return;
      }

      // Delete 或 Backspace 删除选中（在输入框外）
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0 && !isInInput) {
        e.preventDefault();
        selectedIds.forEach((id) => deleteAnnotation(id));
        return;
      }

      // 工具快捷键（在输入框外才生效）
      if (isInInput) return;
      
      const toolKeys: Record<string, typeof currentTool> = {
        v: "select",
        h: "pan",
        r: "rectangle",
        e: "ellipse",
        a: "arrow",
        l: "line",
        t: "text",
        b: "brush",
        m: "marker",
        u: "blur",
        c: "crop",
      };

      if (!e.ctrlKey && !e.altKey && toolKeys[e.key.toLowerCase()]) {
        setCurrentTool(toolKeys[e.key.toLowerCase()]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handlePaste,
    undo,
    redo,
    handleSave,
    handleCopy,
    selectedIds,
    deleteAnnotation,
    setCurrentTool,
    image,
  ]);

  const [showCustomActions, setShowCustomActions] = useState(false);

  return (
    <div className="flex flex-col w-screen h-screen bg-muted/30">
      {/* 顶部工具栏 */}
      <Toolbar
        onOpenFile={handleOpenFile}
        onSave={handleSave}
        onCopy={handleCopy}
        onOpenSettings={() => setShowSettings(true)}
        onClose={handleClose}
        onInsertImage={handleInsertImage}
        onOpenCustomActions={() => setShowCustomActions(!showCustomActions)}
      />
      
      {/* 画布区域 - 顶部留出工具栏空间 */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden mt-10">
        {containerSize.width > 0 && containerSize.height > 0 && (
          <AnnotationCanvas
            containerWidth={containerSize.width}
            containerHeight={containerSize.height - 40}
          />
        )}

        {/* 工具配置面板 */}
        <FloatingToolConfig />

        {/* 自定义动作面板 */}
        {showCustomActions && image && (
          <CustomActionsPanel getCanvasDataUrl={getCanvasDataUrl} imagePath={image?.path} />
        )}

        {/* 欢迎提示 */}
        {!image && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-muted-foreground max-w-lg">
              <p className="text-xl font-medium mb-4">欢迎使用 MarkPix</p>
              <p className="text-sm mb-6 flex items-center justify-center gap-1">
                点击工具栏的 <FolderOpen size={16} className="inline" /> 打开图片，或按 <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+V</kbd> 粘贴剪贴板图片
              </p>
              
              <div className="grid grid-cols-2 gap-6 text-left text-xs">
                {/* 快捷键 */}
                <div>
                  <p className="font-medium text-sm mb-2 text-foreground flex items-center gap-1"><Keyboard size={14} /> 快捷键</p>
                  <div className="space-y-1">
                    <p><kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded">V</kbd> 选择工具</p>
                    <p><kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded">H</kbd> 平移画布</p>
                    <p><kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded">R</kbd> 矩形</p>
                    <p><kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded">E</kbd> 椭圆</p>
                    <p><kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded">A</kbd> 箭头</p>
                    <p><kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded">L</kbd> 直线</p>
                    <p><kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded">T</kbd> 文字</p>
                    <p><kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded">B</kbd> 画笔</p>
                    <p><kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded">M</kbd> 序号标记</p>
                    <p><kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded">U</kbd> 马赛克</p>
                    <p><kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded">C</kbd> 裁剪</p>
                  </div>
                </div>

                {/* 鼠标操作 */}
                <div>
                  <p className="font-medium text-sm mb-2 text-foreground flex items-center gap-1"><Mouse size={14} /> 鼠标操作</p>
                  <div className="space-y-1">
                    <p><span className="font-medium">左键</span> 绘制/选择标注</p>
                    <p><span className="font-medium">左键拖动</span> 移动标注/画布</p>
                    <p><span className="font-medium">右键</span> 取消绘制/切换选择工具</p>
                    <p><span className="font-medium">中键拖动</span> 平移画布</p>
                    <p><span className="font-medium">滚轮</span> 缩放画布</p>
                    <p><span className="font-medium">选中+滚轮</span> 调节属性</p>
                  </div>
                  
                  <p className="font-medium text-sm mt-4 mb-2 text-foreground flex items-center gap-1"><Zap size={14} /> 常用操作</p>
                  <div className="space-y-1">
                    <p><kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded">Ctrl+Z</kbd> 撤销</p>
                    <p><kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded">Ctrl+Y</kbd> 重做</p>
                    <p><kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded">Ctrl+S</kbd> 保存</p>
                    <p><kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded">Ctrl+C</kbd> 复制</p>
                    <p><kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded">Del/Backspace</kbd> 删除选中</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 裁剪确认面板 */}
        {cropArea && cropArea.width > 10 && cropArea.height > 10 && (
          <div 
            className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 p-3 rounded-lg bg-white dark:bg-gray-800 border-2 border-blue-500 shadow-xl"
            style={{ zIndex: 9999 }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCropConfirm();
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors cursor-pointer"
            >
              确认裁剪
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCropArea(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-md transition-colors cursor-pointer"
            >
              取消
            </button>
          </div>
        )}
      </div>

      {/* 设置对话框 */}
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />

      {/* 关闭确认对话框 */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCloseConfirm(false)}
          />
          <div className="relative z-10 w-full max-w-sm p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl">
            <h3 className="text-lg font-semibold mb-2">确认关闭</h3>
            <p className="text-sm text-muted-foreground mb-6">
              您有未保存的更改，是否保存后再关闭？
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmClose}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
              >
                不保存关闭
              </button>
              <button
                onClick={handleSaveAndClose}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors"
              >
                保存并关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 打开新文件确认对话框 */}
      {showOpenConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowOpenConfirm(false)}
          />
          <div className="relative z-10 w-full max-w-sm p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl">
            <h3 className="text-lg font-semibold mb-2">打开新文件</h3>
            <p className="text-sm text-muted-foreground mb-6">
              当前图片尚未保存，是否保存后再打开新文件？
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowOpenConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmOpen}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
              >
                不保存打开
              </button>
              <button
                onClick={handleSaveAndOpen}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors"
              >
                保存并打开
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast 提示 */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300 ${
            toast.type === "success"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
