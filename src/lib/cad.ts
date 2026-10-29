// CAD 标注几何计算：欧美图纸（ASME Y14.5 / ISO 3098）常用尺寸线样式
// 所有布局函数均以标注自身的 x, y 为原点返回局部坐标，供渲染器与包围盒共用。
import type {
  Annotation,
  BalloonAnnotation,
  DimAngularAnnotation,
  DimLinearAnnotation,
  DimRadialAnnotation,
  LeaderAnnotation,
} from "@/types";

export interface Pt {
  x: number;
  y: number;
}

export interface LocalBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 文字宽度测量（复用单个离屏 canvas 上下文） */
let measureCtx: CanvasRenderingContext2D | null = null;
export function measureTextWidth(
  text: string,
  fontSize: number,
  fontFamily: string
): number {
  if (!text) return 0;
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  if (!measureCtx) return text.length * fontSize * 0.6;
  measureCtx.font = `${fontSize}px ${fontFamily}`;
  return measureCtx.measureText(text).width;
}

/** 尺寸界线起点与图形之间的间隙（CAD 惯例约 1mm，这里随字号缩放） */
export const cadExtensionGap = (fontSize: number) => fontSize * 0.3;

/** 尺寸界线超出尺寸线的长度 */
export const cadOvershoot = (fontSize: number) => fontSize * 0.5;

/** 端点符号长度：箭头约为线宽的 5 倍，且不小于字号的 0.65 倍 */
export function cadMarkLength(strokeWidth: number, fontSize: number): number {
  return Math.max(strokeWidth * 5, fontSize * 0.65);
}

/** ASME/ISO 实心箭头（细长闭合三角形），tip 为尖端，dir 为箭头指向单位向量 */
export function cadArrowPolygon(
  tip: Pt,
  dir: Pt,
  length: number
): number[] {
  const halfWidth = length * 0.13; // 约 15° 夹角
  const px = -dir.y;
  const py = dir.x;
  const bx = tip.x - dir.x * length;
  const by = tip.y - dir.y * length;
  return [
    tip.x,
    tip.y,
    bx + px * halfWidth * 2,
    by + py * halfWidth * 2,
    bx - px * halfWidth * 2,
    by - py * halfWidth * 2,
  ];
}

/** ISO 45° 斜线端符：以 point 为中心，与尺寸线成 45° 的短划 */
export function cadSlashPoints(
  point: Pt,
  dir: Pt,
  length: number
): number[] {
  const half = length * 0.4;
  const angle = Math.atan2(dir.y, dir.x) + Math.PI / 4;
  const dx = Math.cos(angle) * half;
  const dy = Math.sin(angle) * half;
  return [point.x - dx, point.y - dy, point.x + dx, point.y + dy];
}

/** 圆点端符半径 */
export function cadDotRadius(strokeWidth: number, fontSize: number): number {
  return Math.max(strokeWidth * 1.1, fontSize * 0.14);
}

/** 把角度归一化到 (-90°, 90°]，保证文字始终可读 */
export function readableAngle(rad: number): number {
  let deg = (rad * 180) / Math.PI;
  while (deg > 90) deg -= 180;
  while (deg <= -90) deg += 180;
  return deg;
}

export function normalize(v: Pt): Pt {
  const len = Math.hypot(v.x, v.y);
  if (len === 0) return { x: 1, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/** 端点符号的通用布局结果 */
export interface EndMark {
  tip: Pt;
  dir: Pt; // 箭头指向（斜线/圆点时也用于取方向）
}

export interface LinearDimLayout {
  dimStart: Pt;
  dimEnd: Pt;
  dir: Pt;
  span: number;
  arrowLength: number;
  extLines: [Pt, Pt][];
  ends: EndMark[];
  textCenter: Pt;
  textAngle: number;
  gapHalf: number; // inline 模式下文字打断尺寸线的半宽
  marks: Pt[]; // 测量点标记位置
}

/**
 * 线性尺寸布局：x,y = 第一测量点 P1，P2 与尺寸线定位点均为相对偏移。
 * aligned 时尺寸线平行于 P1P2，horizontal / vertical 时尺寸线水平或垂直。
 */
export function linearDimLayout(ann: DimLinearAnnotation): LinearDimLayout {
  const p1: Pt = { x: 0, y: 0 };
  const p2: Pt = { x: ann.p2x, y: ann.p2y };
  const place: Pt = { x: ann.placeX, y: ann.placeY };
  const fontSize = ann.fontSize;
  const gap = cadExtensionGap(fontSize);
  const over = cadOvershoot(fontSize);

  let dimStart: Pt;
  let dimEnd: Pt;
  let dir: Pt;
  let textAngle = 0;
  let textNormal: Pt = { x: 0, y: -1 };
  const extLines: [Pt, Pt][] = [];

  if (ann.mode === "horizontal") {
    const y = place.y;
    dimStart = { x: Math.min(p1.x, p2.x), y };
    dimEnd = { x: Math.max(p1.x, p2.x), y };
    dir = { x: 1, y: 0 };
    textAngle = 0;
    textNormal = { x: 0, y: -1 };
    if (ann.showExtension) {
      for (const p of [p1, p2]) {
        const s = Math.sign(y - p.y);
        if (Math.abs(y - p.y) <= gap) continue;
        extLines.push([
          { x: p.x, y: p.y + s * gap },
          { x: p.x, y: y + s * over },
        ]);
      }
    }
  } else if (ann.mode === "vertical") {
    const x = place.x;
    dimStart = { x, y: Math.min(p1.y, p2.y) };
    dimEnd = { x, y: Math.max(p1.y, p2.y) };
    dir = { x: 0, y: 1 };
    textAngle = -90;
    textNormal = { x: -1, y: 0 };
    if (ann.showExtension) {
      for (const p of [p1, p2]) {
        const s = Math.sign(x - p.x);
        if (Math.abs(x - p.x) <= gap) continue;
        extLines.push([
          { x: p.x + s * gap, y: p.y },
          { x: x + s * over, y: p.y },
        ]);
      }
    }
  } else {
    // aligned：沿 P1P2 方向，尺寸线为测点的垂直投影外移
    const len = Math.hypot(p2.x, p2.y);
    dir = len > 1 ? { x: p2.x / len, y: p2.y / len } : { x: 1, y: 0 };
    const normal = { x: -dir.y, y: dir.x };
    const signed = place.x * normal.x + place.y * normal.y;
    const side = signed >= 0 ? 1 : -1;
    const dist = Math.abs(signed);
    const outer = { x: normal.x * side, y: normal.y * side };
    textNormal = outer;
    textAngle = readableAngle(Math.atan2(dir.y, dir.x));
    dimStart = { x: p1.x + outer.x * dist, y: p1.y + outer.y * dist };
    dimEnd = { x: p2.x + outer.x * dist, y: p2.y + outer.y * dist };
    if (ann.showExtension && dist > gap) {
      for (const p of [p1, p2]) {
        extLines.push([
          { x: p.x + outer.x * gap, y: p.y + outer.y * gap },
          {
            x: p.x + outer.x * (dist + over),
            y: p.y + outer.y * (dist + over),
          },
        ]);
      }
    }
  }

  const span = Math.hypot(dimEnd.x - dimStart.x, dimEnd.y - dimStart.y);
  const arrowLength = Math.min(cadMarkLength(ann.strokeWidth, fontSize), span * 0.32);
  const mid: Pt = { x: (dimStart.x + dimEnd.x) / 2, y: (dimStart.y + dimEnd.y) / 2 };
  const text = dimLinearText(ann);
  const textWidth = measureTextWidth(text, ann.fontSize, ann.fontFamily);
  const gapHalf =
    ann.textPosition === "inline" ? textWidth / 2 + ann.fontSize * 0.25 : 0;

  // 文字中心：above 位于尺寸线外侧，inline 居中于尺寸线上
  const lift = ann.fontSize * 0.2 + ann.fontSize * 0.5;
  const textCenter =
    ann.textPosition === "inline"
      ? mid
      : { x: mid.x + textNormal.x * lift, y: mid.y + textNormal.y * lift };

  // 箭头指向两端外侧（尖端贴合尺寸界线）
  const ends: EndMark[] = [
    { tip: dimStart, dir: { x: -dir.x, y: -dir.y } },
    { tip: dimEnd, dir },
  ];

  return {
    dimStart,
    dimEnd,
    dir,
    span,
    arrowLength,
    extLines,
    ends,
    textCenter,
    textAngle,
    gapHalf,
    marks: [p1, p2],
  };
}

/** 线性尺寸显示文字（无内容时回退为占位提示） */
export function dimLinearText(ann: DimLinearAnnotation): string {
  return ann.text || "尺寸值";
}

/** 直径符号 ⌀ / 半径前缀 R */
export function radialPrefix(kind: DimRadialAnnotation["kind"]): string {
  return kind === "diameter" ? "⌀" : "R";
}

export function radialDisplayText(ann: DimRadialAnnotation): string {
  const prefix = radialPrefix(ann.kind);
  const body = ann.text || "尺寸值";
  return body.startsWith(prefix) ? body : `${prefix}${body}`;
}

export interface RadialDimLayout {
  lineStart: Pt;
  tip: Pt;
  dir: Pt;
  textCenter: Pt;
  textAngle: number;
  arrowLength: number;
  centerMark: [Pt, Pt][];
  radius: number;
}

/** 半径 / 直径布局：x,y = 圆心，e = 圆周点（决定半径向量） */
export function radialDimLayout(ann: DimRadialAnnotation): RadialDimLayout {
  const e: Pt = { x: ann.ex, y: ann.ey };
  const radius = Math.max(Math.hypot(e.x, e.y), 4);
  const u = normalize(e);
  const isDiameter = ann.kind === "diameter";
  const lineStart: Pt = isDiameter
    ? { x: -e.x, y: -e.y }
    : { x: u.x * radius * 0.12, y: u.y * radius * 0.12 };
  const lift = ann.fontSize * 0.75;
  // 垂直于引出线的方向，优先取屏幕上方一侧，使文字始终位于线上方
  let perp: Pt = { x: -u.y, y: u.x };
  if (perp.y > 0) perp = { x: -perp.x, y: -perp.y };
  const anchor: Pt = { x: u.x * radius * 0.5, y: u.y * radius * 0.5 };
  const centerMarkSize = Math.min(radius * 0.34, ann.fontSize * 0.9);

  return {
    lineStart,
    tip: e,
    dir: u,
    textCenter: {
      x: anchor.x + perp.x * lift,
      y: anchor.y + perp.y * lift,
    },
    textAngle: readableAngle(Math.atan2(u.y, u.x)),
    arrowLength: Math.min(
      cadMarkLength(ann.strokeWidth, ann.fontSize),
      radius * 0.6
    ),
    centerMark: isDiameter
      ? [
          [
            { x: -centerMarkSize, y: 0 },
            { x: centerMarkSize, y: 0 },
          ],
          [
            { x: 0, y: -centerMarkSize },
            { x: 0, y: centerMarkSize },
          ],
        ]
      : [],
    radius,
  };
}

export interface AngularDimLayout {
  startAngle: number;
  sweep: number;
  radius: number;
  ends: EndMark[];
  textCenter: Pt;
  textAngle: number;
  arrowLength: number;
}

/** 角度标注布局：x,y = 顶点，a / b 为两条边上的取点 */
export function angularDimLayout(ann: DimAngularAnnotation): AngularDimLayout {
  const a1 = Math.atan2(ann.ay, ann.ax);
  const a2 = Math.atan2(ann.by, ann.bx);
  let delta = a2 - a1;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta <= -Math.PI) delta += Math.PI * 2;
  const radius = Math.max(ann.arcRadius, ann.fontSize * 0.8);

  const pointAt = (angle: number): Pt => ({
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  });

  // 箭头位于弧的两端，背离弧的中点（即指向两条边）
  const sgn = Math.sign(delta) || 1;
  const tangent = (angle: number): Pt => ({
    x: -Math.sin(angle) * sgn,
    y: Math.cos(angle) * sgn,
  });

  const midAngle = a1 + delta / 2;
  const textRadius = radius + ann.fontSize * 0.85;
  const arrowLength = Math.min(
    cadMarkLength(ann.strokeWidth, ann.fontSize),
    Math.abs(radius * delta) * 0.35
  );

  return {
    startAngle: (a1 * 180) / Math.PI,
    sweep: (delta * 180) / Math.PI,
    radius,
    ends: [
      { tip: pointAt(a1), dir: { x: -tangent(a1).x, y: -tangent(a1).y } },
      { tip: pointAt(a2), dir: tangent(a2) },
    ],
    textCenter: {
      x: Math.cos(midAngle) * textRadius,
      y: Math.sin(midAngle) * textRadius,
    },
    textAngle: readableAngle(midAngle),
    arrowLength,
  };
}

export interface LeaderLayout {
  anchor: Pt;
  elbow: Pt;
  shelfEnd: Pt;
  dir: Pt;
  ends: EndMark[];
  textCenter: Pt;
  textWidth: number;
  arrowLength: number;
}

/** 引线标注布局：x,y = 指向被标注对象的端点 */
export function leaderDimLayout(ann: LeaderAnnotation): LeaderLayout {
  const anchor: Pt = { x: 0, y: 0 };
  const elbow: Pt = { x: ann.elbowX, y: ann.elbowY };
  const shelfEnd: Pt = {
    x: ann.elbowX + ann.shelfDir * ann.shelfLength,
    y: ann.elbowY,
  };
  const dir = normalize({ x: anchor.x - elbow.x, y: anchor.y - elbow.y });
  const textWidth = measureTextWidth(
    ann.text || "注释",
    ann.fontSize,
    ann.fontFamily
  );
  const gap = ann.fontSize * 0.3;

  return {
    anchor,
    elbow,
    shelfEnd,
    dir,
    ends: [{ tip: anchor, dir }],
    textCenter: {
      x: shelfEnd.x + ann.shelfDir * (textWidth / 2 + gap),
      y: shelfEnd.y - (ann.fontSize * 0.5 + gap),
    },
    textWidth,
    arrowLength: cadMarkLength(ann.strokeWidth, ann.fontSize),
  };
}

export interface BalloonLayout {
  target: Pt;
  dir: Pt;
  start: Pt;
  boxW: number;
  boxH: number;
  radius: number;
  arrowLength: number;
}

/** 件号气泡布局：x,y = 气泡中心，target 为指引线指向的目标点 */
export function balloonLayout(ann: BalloonAnnotation): BalloonLayout {
  const target: Pt = { x: ann.targetX, y: ann.targetY };
  const dist = Math.hypot(target.x, target.y);
  const dir = dist > 0 ? { x: target.x / dist, y: target.y / dist } : { x: 1, y: 0 };
  const digits = String(ann.value ?? "").length;
  const radius = ann.size / 2;
  const boxH = ann.size;
  const boxW = ann.shape === "rect" ? Math.max(ann.size, digits * ann.size * 0.5 + ann.size * 0.4) : ann.size;
  // 指引线从气泡边界外开始
  const edge =
    ann.shape === "rect"
      ? Math.min(Math.abs(boxW / 2 / (Math.abs(dir.x) || 1e-6)), Math.abs(boxH / 2 / (Math.abs(dir.y) || 1e-6)))
      : radius;
  const startDist = Math.min(edge, dist);

  return {
    target,
    dir,
    start: { x: dir.x * startDist, y: dir.y * startDist },
    boxW,
    boxH,
    radius,
    arrowLength: cadMarkLength(ann.strokeWidth, ann.fontSize),
  };
}

/** 标注在局部坐标系下的包围盒（供命中区域与框选使用） */
export function cadLocalBounds(ann: Annotation): LocalBox | null {
  const pad = 4;
  const pts: Pt[] = [];
  const pushBox = (
    center: Pt,
    w: number,
    h: number
  ): void => {
    const half = Math.hypot(w, h) / 2;
    pts.push({ x: center.x - half, y: center.y - half });
    pts.push({ x: center.x + half, y: center.y + half });
  };

  switch (ann.type) {
    case "dim_linear": {
      const lay = linearDimLayout(ann);
      pts.push(lay.dimStart, lay.dimEnd, { x: 0, y: 0 }, { x: ann.p2x, y: ann.p2y });
      lay.extLines.forEach(([a, b]) => pts.push(a, b));
      const tw = measureTextWidth(
        dimLinearText(ann),
        ann.fontSize,
        ann.fontFamily
      );
      pushBox(lay.textCenter, tw, ann.fontSize * 1.3);
      break;
    }
    case "dim_angular": {
      const lay = angularDimLayout(ann);
      pts.push({ x: 0, y: 0 });
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const ang =
          ((lay.startAngle + (lay.sweep * i) / steps) * Math.PI) / 180;
        pts.push({
          x: Math.cos(ang) * lay.radius,
          y: Math.sin(ang) * lay.radius,
        });
      }
      const tw = measureTextWidth(
        ann.text || "角度",
        ann.fontSize,
        ann.fontFamily
      );
      pushBox(lay.textCenter, tw, ann.fontSize * 1.3);
      break;
    }
    case "dim_radial": {
      const lay = radialDimLayout(ann);
      pts.push(lay.lineStart, lay.tip);
      lay.centerMark.forEach(([a, b]) => pts.push(a, b));
      const tw = measureTextWidth(
        radialDisplayText(ann),
        ann.fontSize,
        ann.fontFamily
      );
      pushBox(lay.textCenter, tw, ann.fontSize * 1.3);
      break;
    }
    case "center_mark": {
      const half = ann.size / 2;
      pts.push({ x: -half, y: -half }, { x: half, y: half });
      break;
    }
    case "leader": {
      const lay = leaderDimLayout(ann);
      pts.push(lay.anchor, lay.elbow, lay.shelfEnd);
      pushBox(lay.textCenter, lay.textWidth, ann.fontSize * 1.3);
      break;
    }
    case "balloon": {
      const lay = balloonLayout(ann);
      pts.push({ x: -lay.boxW / 2 - lay.arrowLength, y: -lay.boxH / 2 - lay.arrowLength });
      pts.push({ x: lay.boxW / 2 + lay.arrowLength, y: lay.boxH / 2 + lay.arrowLength });
      pts.push(lay.target);
      break;
    }
    default:
      return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!isFinite(minX)) return null;

  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };
}

/** CAD 标注类型判定 */
export const CAD_ANNOTATION_TYPES = [
  "dim_linear",
  "dim_angular",
  "dim_radial",
  "center_mark",
  "leader",
  "balloon",
] as const;

export function isCadAnnotation(ann: Annotation): boolean {
  return (CAD_ANNOTATION_TYPES as readonly string[]).includes(ann.type);
}
