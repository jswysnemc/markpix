// CAD 标注文字：居中渲染，双击可内联编辑（尺寸值、角度值、引线注释均为手工输入）
import { useEffect, useRef } from "react";
import { Text } from "react-konva";
import Konva from "konva";
import { measureTextWidth } from "@/lib/cad";

interface CadTextLabelProps {
  ownerId: string;
  text: string;
  placeholder: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  x: number;
  y: number;
  rotation?: number;
  editing: boolean;
  onChange: (text: string) => void;
  onEndEdit: () => void;
}

export function CadTextLabel({
  ownerId,
  text,
  placeholder,
  fontSize,
  fontFamily,
  fill,
  x,
  y,
  rotation = 0,
  editing,
  onChange,
  onEndEdit,
}: CadTextLabelProps) {
  const nodeRef = useRef<Konva.Text>(null);
  const display = text || placeholder;
  const width = Math.max(
    measureTextWidth(display, fontSize, fontFamily),
    fontSize * 0.6
  );
  const height = fontSize * 1.25;

  // 进入编辑状态时，在文字位置覆盖一个输入框
  useEffect(() => {
    if (!editing) return;
    const node = nodeRef.current;
    if (!node) return;

    const stage = node.getStage();
    if (!stage) return;

    const matrix = node.getAbsoluteTransform().decompose();
    const nodeScale = matrix.scaleX || 1;
    const stageBox = stage.container().getBoundingClientRect();
    const abs = node.getAbsolutePosition();

    // 文字节点已通过 offsetX/offsetY 居中，绝对锚点即为文字中心
    const centerX = abs.x;
    const centerY = abs.y;
    const boxW = Math.max(width * nodeScale, 72);
    const boxH = height * nodeScale;

    const input = document.createElement("input");
    input.type = "text";
    input.value = text;
    input.placeholder = placeholder;
    input.style.position = "absolute";
    input.style.left = `${stageBox.left + centerX - boxW / 2}px`;
    input.style.top = `${stageBox.top + centerY - boxH / 2}px`;
    input.style.width = `${boxW}px`;
    input.style.height = `${boxH}px`;
    input.style.fontSize = `${Math.max(fontSize * nodeScale, 10)}px`;
    input.style.fontFamily = fontFamily;
    input.style.color = fill;
    input.style.textAlign = "center";
    input.style.background = "rgba(255,255,255,0.95)";
    input.style.border = "2px solid #3b82f6";
    input.style.borderRadius = "3px";
    input.style.outline = "none";
    input.style.padding = "0 4px";
    input.style.zIndex = "1000";
    input.style.boxSizing = "border-box";
    document.body.appendChild(input);
    input.focus();
    input.select();

    let removed = false;
    const finish = (commit: boolean) => {
      if (removed) return;
      removed = true;
      if (commit) onChange(input.value.trim());
      input.remove();
      // 无论提交还是取消，都要退出编辑态，否则画布会被编辑守卫阻塞
      onEndEdit();
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    });
    input.addEventListener("blur", () => finish(true));

    return () => finish(true);
    // 依赖 ownerId/editing：文字内容变化不应重建输入框
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, ownerId]);

  return (
    <Text
      ref={nodeRef}
      text={display}
      width={width}
      height={height}
      fontSize={fontSize}
      fontFamily={fontFamily}
      fill={text ? fill : "#9ca3af"}
      align="center"
      verticalAlign="middle"
      x={x}
      y={y}
      offsetX={width / 2}
      offsetY={height / 2}
      rotation={rotation}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}
