// MarkPix 类型定义

/**
 * 标注工具类型
 */
export type ToolType =
  | "select" // 选择工具
  | "pan" // 手型工具（平移）
  | "rectangle" // 矩形
  | "ellipse" // 椭圆
  | "arrow" // 箭头
  | "line" // 直线
  | "text" // 文字
  | "brush" // 画笔
  | "marker" // 序号标记
  | "blur" // 马赛克/模糊
  | "crop" // 裁剪
  | "image"; // 图片贴图

/**
 * 线条样式
 */
export type LineStyle = "solid" | "dashed";

/**
 * 序号标记样式
 */
export type MarkerStyle = "filled" | "outlined";

/**
 * 箭头样式
 */
export type ArrowStyle = "normal" | "filled";

/**
 * 文字样式
 */
export type TextStyle = "normal" | "bubble";

/**
 * 气泡尾巴位置
 */
export type BubbleTailPosition = "left" | "right";

/**
 * 序号标记类型
 */
export type MarkerType = "number" | "letter";

/**
 * 基础标注对象属性
 */
export interface BaseAnnotation {
  id: string;
  type: ToolType;
  x: number;
  y: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  visible?: boolean;
  locked?: boolean;
}

/**
 * 矩形标注
 */
export interface RectAnnotation extends BaseAnnotation {
  type: "rectangle";
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  fill: string;
  fillOpacity: number;
  cornerRadius?: number;
}

/**
 * 椭圆标注
 */
export interface EllipseAnnotation extends BaseAnnotation {
  type: "ellipse";
  radiusX: number;
  radiusY: number;
  stroke: string;
  strokeWidth: number;
  fill: string;
  fillOpacity: number;
}

/**
 * 箭头标注
 */
export interface ArrowAnnotation extends BaseAnnotation {
  type: "arrow";
  points: number[]; // [x1, y1, x2, y2]
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  arrowStyle: ArrowStyle;
  pointerLength?: number;
  pointerWidth?: number;
}

/**
 * 直线标注
 */
export interface LineAnnotation extends BaseAnnotation {
  type: "line";
  points: number[]; // [x1, y1, x2, y2]
  stroke: string;
  strokeWidth: number;
  lineStyle: LineStyle;
}

/**
 * 文字标注
 */
export interface TextAnnotation extends BaseAnnotation {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  textStyle: TextStyle;
  bubbleStroke?: string; // 气泡边框色（默认同文字色）
  bubbleFill?: string; // 气泡背景色（默认透明）
  bubbleTailPosition?: BubbleTailPosition; // 气泡尾巴位置
  backgroundColor?: string;
  padding?: number;
  width?: number;
}

/**
 * 画笔标注
 */
export interface BrushAnnotation extends BaseAnnotation {
  type: "brush";
  points: number[]; // [x1, y1, x2, y2, ...]
  stroke: string;
  strokeWidth: number;
  tension?: number;
  lineCap?: "butt" | "round" | "square";
  lineJoin?: "miter" | "round" | "bevel";
}

/**
 * 序号标记标注
 */
export interface MarkerAnnotation extends BaseAnnotation {
  type: "marker";
  value: number | string;
  markerStyle: MarkerStyle;
  markerType: MarkerType;
  size: number;
  fill: string;
  textColor: string;
  stroke?: string;
  strokeWidth?: number;
}

/**
 * 模糊区域标注
 */
export interface BlurAnnotation extends BaseAnnotation {
  type: "blur";
  width: number;
  height: number;
  blurRadius: number;
  cornerRadius: number;
}

/**
 * 图片贴图标注
 */
export interface ImageAnnotation extends BaseAnnotation {
  type: "image";
  width: number;
  height: number;
  src: string; // base64 或 URL
}

/**
 * 所有标注类型联合
 */
export type Annotation =
  | RectAnnotation
  | EllipseAnnotation
  | ArrowAnnotation
  | LineAnnotation
  | TextAnnotation
  | BrushAnnotation
  | MarkerAnnotation
  | BlurAnnotation
  | ImageAnnotation;

/**
 * 工具配置
 */
export interface ToolConfig {
  // 通用
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  fillOpacity: number;
  lineStyle: LineStyle;

  // 文字
  fontSize: number;
  fontFamily: string;
  textBackgroundColor: string;
  textStyle: TextStyle;
  bubbleStroke: string;
  bubbleFill: string;
  bubbleTailPosition: BubbleTailPosition;

  // 画笔
  brushSize: number;

  // 序号标记
  markerStyle: MarkerStyle;
  markerType: MarkerType;
  markerSize: number;

  // 模糊
  blurRadius: number;
  blurCornerRadius: number;
  
  // 矩形圆角
  cornerRadius: number;

  // 箭头
  arrowStyle: ArrowStyle;
}

/**
 * 裁剪蒙版（用于遮罩不需要的部分）
 */
export interface CropMask {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 历史记录项
 */
export interface HistoryState {
  annotations: Annotation[];
  cropMask: CropMask | null;
  timestamp: number;
}

/**
 * 裁剪区域
 */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 画布视图状态
 */
export interface ViewState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * 自定义动作
 */
export interface CustomAction {
  name: string;
  command: string;
  icon?: string;
}

/**
 * 图片信息
 */
export interface ImageInfo {
  src: string;
  width: number;
  height: number;
  name?: string;
  path?: string; // 原始文件路径
}

/**
 * 工具栏布局方向
 */
export type ToolbarOrientation = "horizontal" | "vertical";

/**
 * 主题模式
 */
export type ThemeMode = "light" | "dark" | "auto";

/**
 * 应用配置
 */
export interface AppConfig {
  theme: ThemeMode;
  output_pattern: string;
  custom_actions: CustomAction[];
}
