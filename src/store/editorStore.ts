// Zustand 状态管理 - 编辑器核心状态
import { create } from "zustand";
import { generateId } from "@/lib/utils";
import type {
  Annotation,
  ToolType,
  ToolConfig,
  HistoryState,
  ViewState,
  ImageInfo,
  CropArea,
  CustomAction,
  ToolbarOrientation,
  ThemeMode,
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
  brushSize: 4,
  markerStyle: "filled",
  markerType: "number",
  markerSize: 28,
  blurRadius: 10,
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

  // 视图状态
  viewState: ViewState;
  setViewState: (state: Partial<ViewState>) => void;
  resetView: () => void;

  // 裁剪
  cropArea: CropArea | null;
  setCropArea: (area: CropArea | null) => void;
  isCropping: boolean;
  setIsCropping: (cropping: boolean) => void;

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
}

/**
 * 编辑器状态 Store
 */
export const useEditorStore = create<EditorState>((set, get) => ({
  // 图片
  image: null,
  setImage: (image) => {
    set({ image, annotations: [], selectedIds: [], history: [], historyIndex: -1 });
    if (image) {
      // 根据图片比例设置工具栏方向
      const orientation: ToolbarOrientation =
        image.width > image.height ? "horizontal" : "vertical";
      set({ toolbarOrientation: orientation });
    }
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
    const { annotations, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      annotations: JSON.parse(JSON.stringify(annotations)),
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
        historyIndex: historyIndex - 1,
        selectedIds: [],
      });
    } else if (historyIndex === 0) {
      // 撤销到初始状态（空）
      set({
        annotations: [],
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
        historyIndex: historyIndex + 1,
        selectedIds: [],
      });
    }
  },
  canUndo: () => get().historyIndex >= 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

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

  // 序号标记计数器
  markerCounter: 1,
  incrementMarkerCounter: () =>
    set((state) => ({ markerCounter: state.markerCounter + 1 })),
  resetMarkerCounter: () => set({ markerCounter: 1 }),

  // 自定义动作
  customActions: [],
  setCustomActions: (actions) => set({ customActions: actions }),

  // UI 状态
  toolbarOrientation: "horizontal",
  setToolbarOrientation: (orientation) => set({ toolbarOrientation: orientation }),
  theme: "system",
  setTheme: (theme) => {
    set({ theme });
    // 应用主题
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      // system
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  },

  // 正在绘制
  isDrawing: false,
  setIsDrawing: (drawing) => set({ isDrawing: drawing }),

  // 正在编辑文字
  editingTextId: null,
  setEditingTextId: (id) => set({ editingTextId: id }),
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
      };
      return extra ? { ...blur, ...extra } as Annotation : blur;
    }
    default:
      throw new Error(`未知的标注类型: ${type}`);
  }
}
