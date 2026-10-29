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
  | "callout" // 序号引导箭头
  | "blur" // 马赛克/模糊
  | "crop" // 裁剪
  | "image" // 图片贴图
  | "magnifier" // 放大镜
  | "dim_linear" // 线性尺寸标注（CAD/ASME-ISO）
  | "dim_angular" // 角度尺寸标注
  | "dim_radial" // 半径/直径尺寸标注
  | "center_mark" // 中心线标记
  | "leader" // 引线标注
  | "balloon"; // 件号气泡

/**
 * 白板纹理类型
 */
export type WhiteboardTexture = "none" | "grid" | "dot";

/**
 * 白板配置
 */
export interface WhiteboardConfig {
  width: number;
  height: number;
  color: string;
  texture: WhiteboardTexture;
}

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
 * CAD 尺寸线端点符号
 * - arrow: ASME/ISO 闭合实心箭头（细长三角）
 * - slash: ISO 45° 斜线（欧洲图纸常用）
 * - dot: 圆点（密集空间常用）
 */
export type CadTermination = "arrow" | "slash" | "dot";

/**
 * 线性尺寸测量方向
 */
export type DimMode = "aligned" | "horizontal" | "vertical";

/**
 * 尺寸文字位置
 * - above: 文字位于尺寸线上方（ASME 默认）
 * - inline: 文字居中并打断尺寸线（ISO 常用）
 */
export type DimTextPosition = "above" | "inline";

/**
 * 径向尺寸类型
 */
export type RadialKind = "radius" | "diameter";

/**
 * 件号气泡外形
 */
export type BalloonShape = "circle" | "rect" | "none";

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
 * 序号引导箭头标注（序号圆标记 + 指向目标的箭头）
 */
export interface CalloutAnnotation extends BaseAnnotation {
  type: "callout";
  value: number | string;
  targetX: number; // 箭头尖端相对标记中心的水平偏移
  targetY: number; // 箭头尖端相对标记中心的垂直偏移
  markerStyle: MarkerStyle;
  markerType: MarkerType;
  size: number;
  fill: string;
  textColor: string;
  strokeWidth: number;
  lineStyle: LineStyle;
  arrowStyle: ArrowStyle;
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
 * 放大镜标注
 */
export interface MagnifierAnnotation extends BaseAnnotation {
  type: "magnifier";
  // 源区域（小圆）- 要放大的区域
  sourceX: number;
  sourceY: number;
  sourceRadius: number;
  // 显示区域（大圆）- x, y 来自 BaseAnnotation
  targetRadius: number;
  // 放大倍率 = targetRadius / sourceRadius（可手动调节，会同步更新 targetRadius）
  scale: number;
}

/**
 * CAD 标注通用样式属性（尺寸线、尺寸界线、文字共用）
 */
export interface CadStyleFields {
  stroke: string;
  strokeWidth: number;
  fontSize: number;
  fontFamily: string;
}

/**
 * 线性尺寸标注（对齐 / 水平 / 垂直）
 * x, y 为第一测量点，其余坐标均相对该点
 */
export interface DimLinearAnnotation extends BaseAnnotation, CadStyleFields {
  type: "dim_linear";
  p2x: number; // 第二测量点相对偏移
  p2y: number;
  placeX: number; // 尺寸线定位点相对偏移
  placeY: number;
  mode: DimMode;
  termination: CadTermination;
  textPosition: DimTextPosition;
  showExtension: boolean; // 是否绘制尺寸界线
  text: string; // 标注值（手工输入）
}

/**
 * 角度尺寸标注：x, y 为顶点，a/b 为两条边上的点
 */
export interface DimAngularAnnotation extends BaseAnnotation, CadStyleFields {
  type: "dim_angular";
  ax: number;
  ay: number;
  bx: number;
  by: number;
  arcRadius: number;
  text: string;
}

/**
 * 半径 / 直径尺寸标注：x, y 为圆心，e 为圆周点（定义半径向量）
 */
export interface DimRadialAnnotation extends BaseAnnotation, CadStyleFields {
  type: "dim_radial";
  ex: number;
  ey: number;
  kind: RadialKind;
  text: string;
  termination: CadTermination;
}

/**
 * 中心线标记（孔心十字）
 */
export interface CenterMarkAnnotation extends BaseAnnotation, CadStyleFields {
  type: "center_mark";
  size: number;
}

/**
 * 引线标注：x, y 为指向对象的端点，折点后接水平基准线
 */
export interface LeaderAnnotation extends BaseAnnotation, CadStyleFields {
  type: "leader";
  elbowX: number;
  elbowY: number;
  shelfDir: 1 | -1; // 水平基准线方向
  shelfLength: number;
  text: string;
  termination: CadTermination;
}

/**
 * 件号气泡：x, y 为气泡中心，target 为指引线指向的目标点
 */
export interface BalloonAnnotation extends BaseAnnotation, CadStyleFields {
  type: "balloon";
  value: number | string;
  shape: BalloonShape;
  targetX: number;
  targetY: number;
  termination: CadTermination;
  size: number;
  background: string;
  textColor: string;
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
  | CalloutAnnotation
  | BlurAnnotation
  | ImageAnnotation
  | MagnifierAnnotation
  | DimLinearAnnotation
  | DimAngularAnnotation
  | DimRadialAnnotation
  | CenterMarkAnnotation
  | LeaderAnnotation
  | BalloonAnnotation;

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

  // 放大镜
  magnifierScale: number; // 放大倍率

  // CAD 尺寸标注
  cadStrokeWidth: number; // 尺寸线线宽（图纸用细线）
  dimMode: DimMode;
  dimTermination: CadTermination;
  dimTextPosition: DimTextPosition;
  showExtensionLines: boolean;
  radialKind: RadialKind;
  balloonShape: BalloonShape;
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
 * 保存在 PNG 中的 MarkPix 标注元数据
 */
export interface MarkpixFileMeta {
  app: "markpix";
  version: number;
  createdAt: number;
  imageWidth: number;
  imageHeight: number;
  markerCounter: number;
  annotations: Annotation[];
}

/**
 * 从 PNG 中读取到的 MarkPix 内嵌数据
 */
export interface MarkpixFilePayload {
  meta: string;
  base: string | null;
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
  text_tool_config?: {
    stroke_color?: string;
    font_size?: number;
    font_family?: string;
    text_style?: TextStyle;
    text_background_color?: string;
    bubble_stroke?: string;
    bubble_fill?: string;
    bubble_tail_position?: BubbleTailPosition;
  };
  tool_config?: Partial<ToolConfig>;
}
