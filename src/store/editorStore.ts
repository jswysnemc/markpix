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
  WhiteboardConfig,
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

  // CAD 尺寸标注（图纸线宽较细，独立于其他标注）
  cadStrokeWidth: 1.6,
  dimMode: "aligned",
  dimTermination: "arrow",
  dimTextPosition: "above",
  showExtensionLines: true,
  radialKind: "radius",
  balloonShape: "circle",
};

const defaultWhiteboardConfig: WhiteboardConfig = {
  width: 1280,
  height: 720,
  color: "#ffffff",
  texture: "none",
};

function serializeTextToolConfig(toolConfig: ToolConfig) {
  return {
    stroke_color: toolConfig.strokeColor,
    font_size: toolConfig.fontSize,
    font_family: toolConfig.fontFamily,
    text_background_color: toolConfig.textBackgroundColor,
    text_style: toolConfig.textStyle,
    bubble_stroke: toolConfig.bubbleStroke,
    bubble_fill: toolConfig.bubbleFill,
    bubble_tail_position: toolConfig.bubbleTailPosition,
  };
}

/**
 * 工具样式自动保存的防抖定时器
 */
let toolConfigSaveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleToolConfigSave(save: () => void) {
  if (toolConfigSaveTimer !== null) {
    clearTimeout(toolConfigSaveTimer);
  }
  toolConfigSaveTimer = setTimeout(() => {
    toolConfigSaveTimer = null;
    save();
  }, 300);
}

/**
 * 历史记录最大长度
 */
const MAX_HISTORY_LENGTH = 50;

/**
 * 非激活文档的状态快照
 */
interface DocumentSnapshot {
  image: ImageInfo;
  annotations: Annotation[];
  history: HistoryState[];
  historyIndex: number;
  cropMask: CropMask | null;
  markerCounter: number;
  viewState: ViewState;
}

/**
 * 文档标签页
 */
export interface DocumentTab {
  id: string;
  title: string;
  savePath: string | null;
  /** 最近一次保存/打开时的内容快照，用于判断未保存修改 */
  savedSnapshot: string;
  /** 非激活文档的状态快照；激活文档以顶层状态为准 */
  snapshot?: DocumentSnapshot;
}

/** 标注数组序列化缓存（标注数组不可变，可安全按引用缓存） */
const annotationsSnapshotCache = new WeakMap<Annotation[], string>();
const cropMaskSnapshotCache = new WeakMap<CropMask, string>();

function serializeAnnotations(annotations: Annotation[]): string {
  let cached = annotationsSnapshotCache.get(annotations);
  if (cached === undefined) {
    cached = JSON.stringify(annotations);
    annotationsSnapshotCache.set(annotations, cached);
  }
  return cached;
}

function serializeCropMask(cropMask: CropMask | null): string {
  if (!cropMask) return "null";
  let cached = cropMaskSnapshotCache.get(cropMask);
  if (cached === undefined) {
    cached = JSON.stringify(cropMask);
    cropMaskSnapshotCache.set(cropMask, cached);
  }
  return cached;
}

/** 文档内容快照（仅比较会写入文件的标注与裁剪信息） */
function contentSnapshot(annotations: Annotation[], cropMask: CropMask | null): string {
  return `${serializeAnnotations(annotations)}|${serializeCropMask(cropMask)}`;
}

/** 采集当前激活文档的状态快照 */
function snapshotActiveDocument(state: {
  image: ImageInfo | null;
  annotations: Annotation[];
  history: HistoryState[];
  historyIndex: number;
  cropMask: CropMask | null;
  markerCounter: number;
  viewState: ViewState;
}): DocumentSnapshot | undefined {
  if (!state.image) return undefined;
  return {
    image: state.image,
    annotations: JSON.parse(JSON.stringify(state.annotations)),
    history: JSON.parse(JSON.stringify(state.history)),
    historyIndex: state.historyIndex,
    cropMask: state.cropMask ? { ...state.cropMask } : null,
    markerCounter: state.markerCounter,
    viewState: { ...state.viewState },
  };
}

/**
 * 编辑器状态接口
 */
interface EditorState {
  // 图片
  image: ImageInfo | null;

  // 多文档标签
  documents: DocumentTab[];
  activeDocumentId: string | null;
  /** 当前激活文档最近保存/打开时的内容快照 */
  savedSnapshot: string;
  createDocument: (
    image: ImageInfo,
    options?: {
      annotations?: Annotation[];
      markerCounter?: number;
      savePath?: string | null;
    }
  ) => string;
  switchDocument: (id: string) => void;
  closeDocument: (id: string) => void;
  getActiveDocument: () => DocumentTab | undefined;
  markDocumentSaved: (path: string) => void;
  markContentSaved: () => void;
  isDocumentDirty: (id: string) => boolean;
  hasUnsavedChanges: () => boolean;

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
  setMarkerCounter: (value: number) => void;
  incrementMarkerCounter: () => void;
  resetMarkerCounter: () => void;

  // 自定义动作
  customActions: CustomAction[];
  setCustomActions: (actions: CustomAction[]) => void;

  // 字体列表
  systemFonts: string[];
  setSystemFonts: (fonts: string[]) => void;
  loadSystemFonts: () => Promise<void>;

  // 白板配置
  whiteboardConfig: WhiteboardConfig;
  setWhiteboardConfig: (config: Partial<WhiteboardConfig>) => void;

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

  // 正在编辑 CAD 标注文字
  editingCadTextId: string | null;
  setEditingCadTextId: (id: string | null) => void;

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

  // 多文档标签
  documents: [],
  activeDocumentId: null,
  savedSnapshot: "",
  createDocument: (image, options) => {
    const state = get();
    const annotations = options?.annotations
      ? JSON.parse(JSON.stringify(options.annotations))
      : [];
    const markerCounter = Math.max(1, Math.floor(options?.markerCounter ?? 1));
    const savedSnapshot = contentSnapshot(annotations, null);
    const id = generateId();

    // 切换前先把当前激活文档的状态快照存入标签
    const documents = state.activeDocumentId
      ? state.documents.map((doc) =>
          doc.id === state.activeDocumentId
            ? { ...doc, snapshot: snapshotActiveDocument(state), savedSnapshot: state.savedSnapshot }
            : doc
        )
      : state.documents;

    set({
      documents: [
        ...documents,
        {
          id,
          title: image.name || "未命名图片",
          savePath: options?.savePath ?? image.path ?? null,
          savedSnapshot,
        },
      ],
      activeDocumentId: id,
      image,
      annotations,
      selectedIds: [],
      history: [],
      historyIndex: -1,
      cropArea: null,
      cropMask: null,
      markerCounter,
      viewState: { scale: 1, offsetX: 0, offsetY: 0 },
      savedSnapshot,
    });
    // 以打开时的状态作为历史起点，便于继续撤销/重做
    get().pushHistory();
    return id;
  },
  switchDocument: (id) => {
    const state = get();
    if (state.activeDocumentId === id) return;
    const target = state.documents.find((doc) => doc.id === id);
    if (!target?.snapshot) return;

    // 保存当前激活文档快照
    const documents = state.activeDocumentId
      ? state.documents.map((doc) =>
          doc.id === state.activeDocumentId
            ? { ...doc, snapshot: snapshotActiveDocument(state), savedSnapshot: state.savedSnapshot }
            : doc
        )
      : state.documents;

    const snapshot = target.snapshot;
    set({
      documents,
      activeDocumentId: id,
      image: snapshot.image,
      annotations: JSON.parse(JSON.stringify(snapshot.annotations)),
      selectedIds: [],
      history: JSON.parse(JSON.stringify(snapshot.history)),
      historyIndex: snapshot.historyIndex,
      cropArea: null,
      cropMask: snapshot.cropMask ? { ...snapshot.cropMask } : null,
      markerCounter: snapshot.markerCounter,
      viewState: { ...snapshot.viewState },
      savedSnapshot: target.savedSnapshot,
    });
  },
  closeDocument: (id) => {
    const state = get();
    const index = state.documents.findIndex((doc) => doc.id === id);
    if (index === -1) return;

    // 关闭非激活标签，直接移除即可
    if (state.activeDocumentId !== id) {
      set({ documents: state.documents.filter((doc) => doc.id !== id) });
      return;
    }

    const remaining = state.documents.filter((doc) => doc.id !== id);
    if (remaining.length === 0) {
      set({
        documents: [],
        activeDocumentId: null,
        image: null,
        annotations: [],
        selectedIds: [],
        history: [],
        historyIndex: -1,
        cropArea: null,
        cropMask: null,
        markerCounter: 1,
        viewState: { scale: 1, offsetX: 0, offsetY: 0 },
        savedSnapshot: "",
      });
      return;
    }

    // 激活相邻标签（优先左侧）
    const next = remaining[Math.min(index, remaining.length - 1)];
    const snapshot = next.snapshot;
    if (!snapshot) return;
    set({
      documents: remaining,
      activeDocumentId: next.id,
      image: snapshot.image,
      annotations: JSON.parse(JSON.stringify(snapshot.annotations)),
      selectedIds: [],
      history: JSON.parse(JSON.stringify(snapshot.history)),
      historyIndex: snapshot.historyIndex,
      cropArea: null,
      cropMask: snapshot.cropMask ? { ...snapshot.cropMask } : null,
      markerCounter: snapshot.markerCounter,
      viewState: { ...snapshot.viewState },
      savedSnapshot: next.savedSnapshot,
    });
  },
  getActiveDocument: () => {
    const state = get();
    return state.documents.find((doc) => doc.id === state.activeDocumentId);
  },
  markDocumentSaved: (path) => {
    const state = get();
    const savedSnapshot = contentSnapshot(state.annotations, state.cropMask);
    set({
      image: state.image ? { ...state.image, path } : null,
      savedSnapshot,
      documents: state.documents.map((doc) =>
        doc.id === state.activeDocumentId ? { ...doc, savePath: path, savedSnapshot } : doc
      ),
    });
  },
  markContentSaved: () => {
    const state = get();
    const savedSnapshot = contentSnapshot(state.annotations, state.cropMask);
    set({
      savedSnapshot,
      documents: state.documents.map((doc) =>
        doc.id === state.activeDocumentId ? { ...doc, savedSnapshot } : doc
      ),
    });
  },
  isDocumentDirty: (id) => {
    const state = get();
    if (id === state.activeDocumentId) {
      return contentSnapshot(state.annotations, state.cropMask) !== state.savedSnapshot;
    }
    const doc = state.documents.find((item) => item.id === id);
    if (!doc?.snapshot) return false;
    return contentSnapshot(doc.snapshot.annotations, doc.snapshot.cropMask) !== doc.savedSnapshot;
  },
  hasUnsavedChanges: () => {
    const state = get();
    if (
      state.activeDocumentId &&
      contentSnapshot(state.annotations, state.cropMask) !== state.savedSnapshot
    ) {
      return true;
    }
    return state.documents.some((doc) =>
      doc.id !== state.activeDocumentId && doc.snapshot
        ? contentSnapshot(doc.snapshot.annotations, doc.snapshot.cropMask) !== doc.savedSnapshot
        : false
    );
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
  setToolConfig: (config) => {
    set((state) => ({
      toolConfig: { ...state.toolConfig, ...config },
    }));
    // 字体下拉展开时会清空 fontFamily，此时不写入配置
    if (config.fontFamily === "") return;
    // 修改任意工具样式后自动保存到配置文件
    scheduleToolConfigSave(() => get().saveConfig());
  },

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
  setMarkerCounter: (value) =>
    set({ markerCounter: Math.max(1, Math.floor(value)) }),
  incrementMarkerCounter: () =>
    set((state) => ({ markerCounter: state.markerCounter + 1 })),
  resetMarkerCounter: () => set({ markerCounter: 1 }),

  // 自定义动作
  customActions: [],
  setCustomActions: (actions) => {
    set({ customActions: actions });
    get().saveConfig();
  },

  // 字体列表
  systemFonts: [],
  setSystemFonts: (fonts) => set({ systemFonts: fonts }),
  loadSystemFonts: async () => {
    try {
      const fonts = await invoke<string[]>("list_system_fonts");
      set({ systemFonts: fonts });
    } catch {}
  },

  // 白板配置
  whiteboardConfig: defaultWhiteboardConfig,
  setWhiteboardConfig: (config) =>
    set((state) => ({
      whiteboardConfig: { ...state.whiteboardConfig, ...config },
    })),

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

  // 正在编辑 CAD 标注文字
  editingCadTextId: null,
  setEditingCadTextId: (id) => set({ editingCadTextId: id }),

  // 配置
  outputPattern: "{input_file_base}_{YYYY_MM_DD-hh-mm-ss}_markpix.png",
  setOutputPattern: (pattern) => {
    set({ outputPattern: pattern });
    get().saveConfig();
  },

  loadConfig: async () => {
    try {
      const config = await invoke<AppConfig>("get_config");
      const currentToolConfig = get().toolConfig;
      const persistedToolConfig = config.tool_config ?? {};
      const persistedTextToolConfig = config.text_tool_config;
      set({ 
        theme: config.theme, 
        outputPattern: config.output_pattern,
        customActions: config.custom_actions,
        toolConfig: {
          ...currentToolConfig,
          ...persistedToolConfig,
          ...(persistedTextToolConfig?.stroke_color !== undefined
            ? { strokeColor: persistedTextToolConfig.stroke_color }
            : {}),
          ...(persistedTextToolConfig?.font_size !== undefined
            ? { fontSize: persistedTextToolConfig.font_size }
            : {}),
          ...(persistedTextToolConfig?.font_family !== undefined
            ? { fontFamily: persistedTextToolConfig.font_family }
            : {}),
          ...(persistedTextToolConfig?.text_background_color !== undefined
            ? { textBackgroundColor: persistedTextToolConfig.text_background_color }
            : {}),
          ...(persistedTextToolConfig?.text_style !== undefined
            ? { textStyle: persistedTextToolConfig.text_style }
            : {}),
          ...(persistedTextToolConfig?.bubble_stroke !== undefined
            ? { bubbleStroke: persistedTextToolConfig.bubble_stroke }
            : {}),
          ...(persistedTextToolConfig?.bubble_fill !== undefined
            ? { bubbleFill: persistedTextToolConfig.bubble_fill }
            : {}),
          ...(persistedTextToolConfig?.bubble_tail_position !== undefined
            ? { bubbleTailPosition: persistedTextToolConfig.bubble_tail_position }
            : {}),
        },
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
    } catch {}
  },

  saveConfig: async () => {
    const { theme, outputPattern, customActions, toolConfig } = get();
    try {
      await invoke("save_config", {
        config: {
          theme,
          output_pattern: outputPattern,
          custom_actions: customActions,
          text_tool_config: serializeTextToolConfig(toolConfig),
          tool_config: toolConfig,
        }
      });
    } catch {}
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
    case "callout": {
      const callout: Annotation = {
        ...baseProps,
        type: "callout" as const,
        value: 1,
        targetX: 0,
        targetY: 0,
        markerStyle: config.markerStyle,
        markerType: config.markerType,
        size: config.markerSize,
        fill: config.strokeColor,
        textColor: "#ffffff",
        strokeWidth: config.strokeWidth,
        lineStyle: config.lineStyle,
        arrowStyle: config.arrowStyle,
      };
      return extra ? { ...callout, ...extra } as Annotation : callout;
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
    case "dim_linear": {
      const dim: Annotation = {
        ...baseProps,
        type: "dim_linear" as const,
        p2x: 0,
        p2y: 0,
        placeX: 0,
        placeY: 0,
        mode: config.dimMode,
        termination: config.dimTermination,
        textPosition: config.dimTextPosition,
        showExtension: config.showExtensionLines,
        text: "",
        stroke: config.strokeColor,
        strokeWidth: config.cadStrokeWidth,
        fontSize: config.fontSize,
        fontFamily: config.fontFamily,
      };
      return extra ? { ...dim, ...extra } as Annotation : dim;
    }
    case "dim_angular": {
      const dim: Annotation = {
        ...baseProps,
        type: "dim_angular" as const,
        ax: 0,
        ay: 0,
        bx: 0,
        by: 0,
        arcRadius: 40,
        text: "",
        stroke: config.strokeColor,
        strokeWidth: config.cadStrokeWidth,
        fontSize: config.fontSize,
        fontFamily: config.fontFamily,
      };
      return extra ? { ...dim, ...extra } as Annotation : dim;
    }
    case "dim_radial": {
      const dim: Annotation = {
        ...baseProps,
        type: "dim_radial" as const,
        ex: 0,
        ey: 0,
        kind: config.radialKind,
        text: "",
        termination: config.dimTermination,
        stroke: config.strokeColor,
        strokeWidth: config.cadStrokeWidth,
        fontSize: config.fontSize,
        fontFamily: config.fontFamily,
      };
      return extra ? { ...dim, ...extra } as Annotation : dim;
    }
    case "center_mark": {
      const mark: Annotation = {
        ...baseProps,
        type: "center_mark" as const,
        size: config.markerSize,
        stroke: config.strokeColor,
        strokeWidth: config.cadStrokeWidth,
        fontSize: config.fontSize,
        fontFamily: config.fontFamily,
      };
      return extra ? { ...mark, ...extra } as Annotation : mark;
    }
    case "leader": {
      const leader: Annotation = {
        ...baseProps,
        type: "leader" as const,
        elbowX: 0,
        elbowY: 0,
        shelfDir: 1 as const,
        shelfLength: 60,
        text: "",
        termination: config.dimTermination,
        stroke: config.strokeColor,
        strokeWidth: config.cadStrokeWidth,
        fontSize: config.fontSize,
        fontFamily: config.fontFamily,
      };
      return extra ? { ...leader, ...extra } as Annotation : leader;
    }
    case "balloon": {
      const balloon: Annotation = {
        ...baseProps,
        type: "balloon" as const,
        value: 1,
        shape: config.balloonShape,
        targetX: 0,
        targetY: 0,
        termination: config.dimTermination,
        size: config.markerSize,
        background: "#ffffff",
        textColor: config.strokeColor,
        stroke: config.strokeColor,
        strokeWidth: config.cadStrokeWidth,
        fontSize: config.fontSize,
        fontFamily: config.fontFamily,
      };
      return extra ? { ...balloon, ...extra } as Annotation : balloon;
    }
    default:
      throw new Error(`未知的标注类型: ${type}`);
  }
}
