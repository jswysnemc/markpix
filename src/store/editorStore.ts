// Zustand 状态管理 - 编辑器核心状态
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { generateId } from "@/lib/utils";
import type {
  Annotation,
  ToolType,
  ToolConfig,
  HistoryState,
  ViewState,
  ImageInfo,
  CropArea,
  CropMask,
  CustomAction,
  ToolbarOrientation,
  ThemeMode,
  AppConfig,
} from "@/types";

/**
 * 默认工具配置
 */
const defaultToolConfig: ToolConfig = {
  strokeColor: "#ef4444", // 红色
  fillColor: "transparent", // 默认透明填充
  strokeWidth: 3,
  fillOpacity: 0,
  lineStyle: "solid",
  fontSize: 18,
  fontFamily: "system-ui",
  textBackgroundColor: "transparent",
  textStyle: "normal",
  bubbleStroke: "", // 空字符串表示使用文字颜色
  bubbleFill: "transparent",
  bubbleTailPosition: "left",
  brushSize: 4,
  markerStyle: "filled",
  markerType: "number",
  markerSize: 28,
  blurRadius: 10,
  blurCornerRadius: 10, // 马赛克圆角，默认为10
  cornerRadius: 0, // 矩形圆角，默认为0
  arrowStyle: "filled", // 默认实心箭头
  magnifierScale: 2, // 放大镜倍率，默认2倍
};

/**
 * 历史记录最大长度
 */
const MAX_HISTORY_LENGTH = 50;

/**
 * 编辑器状态接口
 */
interface EditorState {
  // 图片
  image: ImageInfo | null;
  setImage: (image: ImageInfo | null) => void;

  // 当前工具
  currentTool: ToolType;
  setCurrentTool: (tool: ToolType) => void;

  // 工具配置
  toolConfig: ToolConfig;
  setToolConfig: (config: Partial<ToolConfig>) => void;

  // 标注对象
  annotations: Annotation[];
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  updateAnnotations: (ids: string[], updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  clearAnnotations: () => void;

  // 选中状态
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  clearSelection: () => void;

  // 历史记录
  history: HistoryState[];
  historyIndex: number;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // 复制到剪贴板时的历史索引（用于判断关闭时是否需要确认保存）
  lastCopiedHistoryIndex: number | null;
  setLastCopiedHistoryIndex: (index: number | null) => void;
  // 复制时的状态快照（用于精确比较）
  lastCopiedSnapshot: string | null;
  setLastCopiedSnapshot: () => void;
  hasChangedSinceCopy: () => boolean;

  // 视图状态
  viewState: ViewState;
  setViewState: (state: Partial<ViewState>) => void;
  resetView: () => void;

  // 裁剪
  cropArea: CropArea | null;
  setCropArea: (area: CropArea | null) => void;
  isCropping: boolean;
  setIsCropping: (cropping: boolean) => void;
  
  // 裁剪蒙版（用于遮罩不需要的部分，保存时应用）
  cropMask: CropMask | null;
  setCropMask: (mask: CropMask | null) => void;
  applyCropMask: () => void;

  // 序号标记计数器
  markerCounter: number;
  incrementMarkerCounter: () => void;
  resetMarkerCounter: () => void;

  // 自定义动作
  customActions: CustomAction[];
  setCustomActions: (actions: CustomAction[]) => void;

  // UI 状态
  toolbarOrientation: ToolbarOrientation;
  setToolbarOrientation: (orientation: ToolbarOrientation) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  // 正在绘制
  isDrawing: boolean;
  setIsDrawing: (drawing: boolean) => void;

  // 正在编辑文字
  editingTextId: string | null;
  setEditingTextId: (id: string | null) => void;

  // 配置
  outputPattern: string;
  setOutputPattern: (pattern: string) => void;
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;
}

/**
 * 编辑器状态 Store
 */
export const useEditorStore = create<EditorState>((set, get) => ({
  // 图片
  image: null,
  setImage: (image) => {
    set({ image, annotations: [], selectedIds: [], history: [], historyIndex: -1 });
    // 工具栏始终保持横向排列
  },

  // 当前工具
  currentTool: "select",
  setCurrentTool: (tool) => {
    set({ currentTool: tool });
    // 切换工具时清除选中
    if (tool !== "select") {
      set({ selectedIds: [] });
    }
  },

  // 工具配置
  toolConfig: defaultToolConfig,
  setToolConfig: (config) =>
    set((state) => ({
      toolConfig: { ...state.toolConfig, ...config },
    })),

  // 标注对象
  annotations: [],
  addAnnotation: (annotation) => {
    set((state) => ({
      annotations: [...state.annotations, annotation],
    }));
    get().pushHistory();
  },
  updateAnnotation: (id, updates) => {
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? ({ ...a, ...updates } as Annotation) : a
      ),
    }));
  },
  updateAnnotations: (ids, updates) => {
    set((state) => ({
      annotations: state.annotations.map((a) =>
        ids.includes(a.id) ? ({ ...a, ...updates } as Annotation) : a
      ),
    }));
  },
  deleteAnnotation: (id) => {
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
      selectedIds: state.selectedIds.filter((sid) => sid !== id),
    }));
    get().pushHistory();
  },
  clearAnnotations: () => {
    set({ annotations: [], selectedIds: [] });
    get().pushHistory();
  },

  // 选中状态
  selectedIds: [],
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: [] }),

  // 历史记录
  history: [],
  historyIndex: -1,
  pushHistory: () => {
    const { annotations, cropMask, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      annotations: JSON.parse(JSON.stringify(annotations)),
      cropMask: cropMask ? JSON.parse(JSON.stringify(cropMask)) : null,
      timestamp: Date.now(),
    });
    // 限制历史记录长度
    if (newHistory.length > MAX_HISTORY_LENGTH) {
      newHistory.shift();
    }
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      set({
        annotations: JSON.parse(JSON.stringify(prevState.annotations)),
        cropMask: prevState.cropMask ? JSON.parse(JSON.stringify(prevState.cropMask)) : null,
        historyIndex: historyIndex - 1,
        selectedIds: [],
      });
    } else if (historyIndex === 0) {
      // 撤销到初始状态（空）
      set({
        annotations: [],
        cropMask: null,
        historyIndex: -1,
        selectedIds: [],
      });
    }
  },
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      set({
        annotations: JSON.parse(JSON.stringify(nextState.annotations)),
        cropMask: nextState.cropMask ? JSON.parse(JSON.stringify(nextState.cropMask)) : null,
        historyIndex: historyIndex + 1,
        selectedIds: [],
      });
    }
  },
  canUndo: () => get().historyIndex >= 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  // 复制到剪贴板时的历史索引
  lastCopiedHistoryIndex: null,
  setLastCopiedHistoryIndex: (index) => set({ lastCopiedHistoryIndex: index }),
  // 复制时的状态快照
  lastCopiedSnapshot: null,
  setLastCopiedSnapshot: () => {
    const { annotations, cropMask } = get();
    const snapshot = JSON.stringify({ annotations, cropMask });
    set({ lastCopiedSnapshot: snapshot });
  },
  hasChangedSinceCopy: () => {
    const { lastCopiedSnapshot, annotations, cropMask } = get();
    // 如果从未复制过，则认为有改动
    if (lastCopiedSnapshot === null) return true;
    // 比较当前状态与复制时的快照
    const currentSnapshot = JSON.stringify({ annotations, cropMask });
    return currentSnapshot !== lastCopiedSnapshot;
  },

  // 视图状态
  viewState: {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  },
  setViewState: (state) =>
    set((prev) => ({
      viewState: { ...prev.viewState, ...state },
    })),
  resetView: () =>
    set({
      viewState: { scale: 1, offsetX: 0, offsetY: 0 },
    }),

  // 裁剪
  cropArea: null,
  setCropArea: (area) => set({ cropArea: area }),
  isCropping: false,
  setIsCropping: (cropping) => set({ isCropping: cropping }),
  
  // 裁剪蒙版（用于遮罩不需要的部分，保存时应用）
  cropMask: null,
  setCropMask: (mask) => set({ cropMask: mask }),
  applyCropMask: () => {
    // 应用裁剪蒙版时记录历史
    get().pushHistory();
  },

  // 序号标记计数器
  markerCounter: 1,
  incrementMarkerCounter: () =>
    set((state) => ({ markerCounter: state.markerCounter + 1 })),
  resetMarkerCounter: () => set({ markerCounter: 1 }),

  // 自定义动作
  customActions: [],
  setCustomActions: (actions) => {
    set({ customActions: actions });
    get().saveConfig();
  },

  // UI 状态
  toolbarOrientation: "horizontal",
  setToolbarOrientation: (orientation) => set({ toolbarOrientation: orientation }),
  theme: "auto",
  setTheme: (theme) => {
    set({ theme });
    // 应用主题
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      // auto
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
    get().saveConfig();
  },

  // 正在绘制
  isDrawing: false,
  setIsDrawing: (drawing) => set({ isDrawing: drawing }),

  // 正在编辑文字
  editingTextId: null,
  setEditingTextId: (id) => set({ editingTextId: id }),

  // 配置
  outputPattern: "{input_file_base}_{YYYY_MM_DD-hh-mm-ss}_markpix.png",
  setOutputPattern: (pattern) => {
    set({ outputPattern: pattern });
    get().saveConfig();
  },

  loadConfig: async () => {
    try {
      const config = await invoke<AppConfig>("get_config");
      set({ 
        theme: config.theme, 
        outputPattern: config.output_pattern,
        customActions: config.custom_actions 
      });
      
      // 应用加载的主题（但不触发 saveConfig）
      const root = document.documentElement;
      const theme = config.theme;
      if (theme === "dark") {
        root.classList.add("dark");
      } else if (theme === "light") {
        root.classList.remove("dark");
      } else {
        // auto
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (prefersDark) {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      }
    } catch (error) {
      console.error("加载配置失败:", error);
    }
  },

  saveConfig: async () => {
    const { theme, outputPattern, customActions } = get();
    try {
      await invoke("save_config", {
        config: {
          theme,
          output_pattern: outputPattern,
          custom_actions: customActions,
        }
      });
    } catch (error) {
      console.error("保存配置失败:", error);
    }
  },
}));

/**
 * 创建新的标注对象
 */
export function createAnnotation(
  type: ToolType,
  config: ToolConfig,
  position: { x: number; y: number },
  extra?: Record<string, unknown>
): Annotation {
  const id = generateId();
  const baseProps = {
    id,
    x: position.x,
    y: position.y,
    visible: true,
    locked: false,
  };

  switch (type) {
    case "rectangle": {
      const rect: Annotation = {
        ...baseProps,
        type: "rectangle" as const,
        width: 0,
        height: 0,
        stroke: config.strokeColor,
        strokeWidth: config.strokeWidth,
        fill: config.fillColor,
        fillOpacity: config.fillOpacity,
        cornerRadius: config.cornerRadius,
      };
      return extra ? { ...rect, ...extra } as Annotation : rect;
    }
    case "ellipse": {
      const ellipse: Annotation = {
        ...baseProps,
        type: "ellipse" as const,
        radiusX: 0,
        radiusY: 0,
        stroke: config.strokeColor,
        strokeWidth: config.strokeWidth,
        fill: config.fillColor,
        fillOpacity: config.fillOpacity,
      };
      return extra ? { ...ellipse, ...extra } as Annotation : ellipse;
    }
    case "arrow": {
      const arrow: Annotation = {
        ...baseProps,
        type: "arrow" as const,
        points: [0, 0, 0, 0],
        stroke: config.strokeColor,
        strokeWidth: config.strokeWidth,
        lineStyle: config.lineStyle,
        arrowStyle: config.arrowStyle,
        pointerLength: 15,
        pointerWidth: 12,
      };
      return extra ? { ...arrow, ...extra } as Annotation : arrow;
    }
    case "line": {
      const line: Annotation = {
        ...baseProps,
        type: "line" as const,
        points: [0, 0, 0, 0],
        stroke: config.strokeColor,
        strokeWidth: config.strokeWidth,
        lineStyle: config.lineStyle,
      };
      return extra ? { ...line, ...extra } as Annotation : line;
    }
    case "text": {
      const text: Annotation = {
        ...baseProps,
        type: "text" as const,
        text: "",
        fontSize: config.fontSize,
        fontFamily: config.fontFamily,
        fill: config.strokeColor,
        textStyle: config.textStyle,
        bubbleStroke: config.bubbleStroke || config.strokeColor,
        bubbleFill: config.bubbleFill,
        bubbleTailPosition: config.bubbleTailPosition,
        backgroundColor: config.textBackgroundColor,
        padding: 4,
      };
      return extra ? { ...text, ...extra } as Annotation : text;
    }
    case "brush": {
      const brush: Annotation = {
        ...baseProps,
        type: "brush" as const,
        points: [],
        stroke: config.strokeColor,
        strokeWidth: config.brushSize,
        tension: 0.5,
        lineCap: "round",
        lineJoin: "round",
      };
      return extra ? { ...brush, ...extra } as Annotation : brush;
    }
    case "marker": {
      const marker: Annotation = {
        ...baseProps,
        type: "marker" as const,
        value: 1,
        markerStyle: config.markerStyle,
        markerType: config.markerType,
        size: config.markerSize,
        fill: config.strokeColor,
        textColor: "#ffffff",
      };
      return extra ? { ...marker, ...extra } as Annotation : marker;
    }
    case "blur": {
      const blur: Annotation = {
        ...baseProps,
        type: "blur" as const,
        width: 0,
        height: 0,
        blurRadius: config.blurRadius,
        cornerRadius: config.blurCornerRadius,
      };
      return extra ? { ...blur, ...extra } as Annotation : blur;
    }
    case "magnifier": {
      const sourceRadius = 40; // 小圆（源区域）默认半径
      const targetRadius = sourceRadius * config.magnifierScale; // 大圆半径 = 小圆半径 * 放大倍率
      const magnifier: Annotation = {
        ...baseProps,
        type: "magnifier" as const,
        // 源区域（小圆）- 点击位置即为小圆位置
        sourceX: position.x,
        sourceY: position.y,
        sourceRadius: sourceRadius,
        // 显示区域（大圆）- 位置在小圆右下方偏移处
        x: position.x + 120,
        y: position.y + 80,
        targetRadius: targetRadius,
        scale: config.magnifierScale,
      };
      return extra ? { ...magnifier, ...extra } as Annotation : magnifier;
    }
    default:
      throw new Error(`未知的标注类型: ${type}`);
  }
}
