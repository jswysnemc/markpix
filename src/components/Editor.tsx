// 编辑器主组件
import { useRef, useEffect, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readImage } from "@tauri-apps/plugin-clipboard-manager";
import { useEditorStore } from "@/store/editorStore";
import { AnnotationCanvas } from "./canvas/AnnotationCanvas";
import { Toolbar, FloatingToolConfig } from "./toolbar/Toolbar";
import { CustomActionsPanel } from "./CustomActionsPanel";
import { SettingsDialog } from "./SettingsDialog";
import type { CustomAction, ImageInfo } from "@/types";
import Konva from "konva";

export function Editor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [showSettings, setShowSettings] = useState(false);

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
    clearAnnotations,
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

    return () => resizeObserver.disconnect();
  }, []);

  // 初始化：加载 CLI 传入的图片和自定义动作
  useEffect(() => {
    const init = async () => {
      try {
        // 获取 CLI 传入的图片路径
        const initialPath = await invoke<string | null>("get_initial_image");
        if (initialPath) {
          await loadImageFromPath(initialPath);
        }

        // 加载自定义动作
        const actions = await invoke<CustomAction[]>("get_custom_actions");
        setCustomActions(actions);
      } catch (error) {
        console.error("初始化失败:", error);
      }
    };

    init();
  }, [setCustomActions]);

  // 从路径加载图片
  const loadImageFromPath = async (path: string) => {
    try {
      const dataUrl = await invoke<string>("read_image_file", { path });
      const img = new Image();
      img.onload = () => {
        const imageInfo: ImageInfo = {
          src: dataUrl,
          width: img.width,
          height: img.height,
          name: path.split("/").pop(),
        };
        setImage(imageInfo);
      };
      img.src = dataUrl;
    } catch (error) {
      console.error("加载图片失败:", error);
      alert(`加载图片失败: ${error}`);
    }
  };

  // 打开文件
  const handleOpenFile = async () => {
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
        await loadImageFromPath(selected);
      }
    } catch (error) {
      console.error("打开文件失败:", error);
    }
  };

  // 获取画布数据 URL
  const getCanvasDataUrl = useCallback((): string | null => {
    // 查找 Konva Stage
    const stageElement = containerRef.current?.querySelector(".konvajs-content");
    if (!stageElement) return null;

    // 获取 Konva Stage 实例
    const stage = Konva.stages.find((s) =>
      s.container().contains(stageElement as HTMLElement)
    );
    if (!stage) return null;

    // 导出为 Data URL
    return stage.toDataURL({ pixelRatio: 2 });
  }, []);

  // 保存文件
  const handleSave = async () => {
    if (!image) return;

    try {
      const dataUrl = getCanvasDataUrl();
      if (!dataUrl) {
        alert("无法获取画布数据");
        return;
      }

      // 生成默认文件名，避免覆盖源文件
      const baseName = image.name?.replace(/\.[^.]+$/, "") || "image";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const defaultName = `${baseName}_marked_${timestamp}.png`;

      const filePath = await save({
        defaultPath: defaultName,
        filters: [
          { name: "PNG", extensions: ["png"] },
          { name: "JPEG", extensions: ["jpg", "jpeg"] },
        ],
      });

      if (filePath) {
        await invoke("save_image_file", { path: filePath, data: dataUrl });
        alert("保存成功！");
      }
    } catch (error) {
      console.error("保存失败:", error);
      alert(`保存失败: ${error}`);
    }
  };

  // 复制到剪贴板 - 通过临时文件方式
  const handleCopy = async () => {
    if (!image) return;

    try {
      const dataUrl = getCanvasDataUrl();
      if (!dataUrl) {
        alert("无法获取画布数据");
        return;
      }

      // 提取 base64 数据
      const base64Data = dataUrl.split(",")[1];
      
      // 保存到临时文件并复制
      const tempPath = `/tmp/markpix-clipboard-${Date.now()}.png`;
      await invoke("save_image_file", {
        path: tempPath,
        data: base64Data,
      });

      // 使用 Rust 后端复制图片文件到剪贴板
      await invoke("copy_image_to_clipboard", { path: tempPath });
      alert("已复制到剪贴板！");
    } catch (error) {
      console.error("复制失败:", error);
      alert(`复制失败: ${error}`);
    }
  };

  // 执行裁剪
  const handleCropConfirm = useCallback(() => {
    if (!image || !cropArea) return;

    // 创建临时 canvas 进行裁剪
    const canvas = document.createElement("canvas");
    canvas.width = cropArea.width;
    canvas.height = cropArea.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 加载原图并裁剪
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(
        img,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        0,
        0,
        cropArea.width,
        cropArea.height
      );

      const croppedDataUrl = canvas.toDataURL("image/png");
      const newImageInfo: ImageInfo = {
        src: croppedDataUrl,
        width: cropArea.width,
        height: cropArea.height,
        name: image.name ? `${image.name.replace(/\.[^.]+$/, "")}_cropped.png` : "cropped.png",
      };

      // 清除标注（因为坐标已经变化）
      clearAnnotations();
      // 设置新图片
      setImage(newImageInfo);
      // 清除裁剪区域
      setCropArea(null);
      // 切换回选择工具
      setCurrentTool("select");
    };
    img.src = image.src;
  }, [image, cropArea, setImage, setCropArea, clearAnnotations, setCurrentTool]);

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

          const imageInfo: ImageInfo = {
            src: dataUrl,
            width: size.width,
            height: size.height,
            name: "clipboard-image.png",
          };
          setImage(imageInfo);
        }
      }
    } catch (error) {
      console.error("粘贴失败:", error);
    }
  }, [setImage]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+V 粘贴
      if (e.ctrlKey && e.key === "v") {
        handlePaste();
        return;
      }

      // Ctrl+Z 撤销
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Y 重做
      if (e.ctrlKey && e.key === "y") {
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

      // Ctrl+C 复制
      if (e.ctrlKey && e.key === "c" && image) {
        e.preventDefault();
        handleCopy();
        return;
      }

      // Delete 删除选中
      if (e.key === "Delete" && selectedIds.length > 0) {
        selectedIds.forEach((id) => deleteAnnotation(id));
        return;
      }

      // 工具快捷键
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

  return (
    <div className="flex flex-col w-screen h-screen bg-muted/30">
      {/* 画布区域 */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        {containerSize.width > 0 && containerSize.height > 0 && (
          <AnnotationCanvas
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
          />
        )}

        {/* 工具栏 */}
        <Toolbar
          onOpenFile={handleOpenFile}
          onSave={handleSave}
          onCopy={handleCopy}
          onOpenSettings={() => setShowSettings(true)}
        />

        {/* 工具配置面板 */}
        <FloatingToolConfig />

        {/* 自定义动作面板 */}
        {image && <CustomActionsPanel getCanvasDataUrl={getCanvasDataUrl} />}

        {/* 欢迎提示 */}
        {!image && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">欢迎使用 MarkPix</p>
              <p className="text-sm">
                点击工具栏的 📂 打开图片，或按 Ctrl+V 粘贴剪贴板图片
              </p>
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
    </div>
  );
}
