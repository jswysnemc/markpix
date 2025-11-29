// MarkPix - 图片标注工具
// 主应用入口

import { useEffect } from "react";
import { Editor } from "@/components/Editor";
import { useEditorStore } from "@/store/editorStore";

function App() {
  const { theme } = useEditorStore();

  // 初始化主题
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      // 跟随系统
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }, [theme]);

  return <Editor />;
}

export default App;
