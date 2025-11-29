// 设置对话框
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { X, Sun, Moon, Monitor, FolderOpen, RefreshCw } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { theme, setTheme, setCustomActions } = useEditorStore();
  const [configPath, setConfigPath] = useState<string>("");

  // 获取配置文件路径
  useEffect(() => {
    if (open) {
      invoke<string>("get_config_path").then(setConfigPath);
    }
  }, [open]);

  // 重新加载配置
  const handleReloadConfig = async () => {
    try {
      await invoke("reload_config");
      const actions = await invoke<{ name: string; command: string; icon?: string }[]>(
        "get_custom_actions"
      );
      setCustomActions(actions);
      alert("配置已重新加载！");
    } catch (error) {
      alert(`加载配置失败: ${error}`);
    }
  };

  // 打开配置文件目录
  const handleOpenConfigDir = async () => {
    try {
      if (!configPath) {
        alert("配置文件路径未找到");
        return;
      }
      const dir = configPath.substring(0, configPath.lastIndexOf("/"));
      // 使用 shell:open 打开目录
      await invoke("open_directory", { path: dir });
    } catch (error) {
      console.error("打开目录失败:", error);
      alert(`打开目录失败: ${error}`);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 对话框 */}
      <div
        className={cn(
          "relative z-10 w-full max-w-md p-6 rounded-lg",
          "bg-background border border-border shadow-xl",
          "animate-in fade-in-0 zoom-in-95"
        )}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">设置</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        {/* 设置内容 */}
        <div className="space-y-6">
          {/* 主题设置 */}
          <div>
            <h3 className="text-sm font-medium mb-3">主题</h3>
            <div className="flex gap-2">
              <ThemeButton
                icon={<Sun size={16} />}
                label="浅色"
                active={theme === "light"}
                onClick={() => setTheme("light")}
              />
              <ThemeButton
                icon={<Moon size={16} />}
                label="深色"
                active={theme === "dark"}
                onClick={() => setTheme("dark")}
              />
              <ThemeButton
                icon={<Monitor size={16} />}
                label="跟随系统"
                active={theme === "system"}
                onClick={() => setTheme("system")}
              />
            </div>
          </div>

          {/* 自定义动作配置 */}
          <div>
            <h3 className="text-sm font-medium mb-3">自定义动作</h3>
            <p className="text-xs text-muted-foreground mb-3">
              配置文件路径：
              <code className="px-1 py-0.5 bg-muted rounded text-xs break-all">
                {configPath}
              </code>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenConfigDir}
                className="flex-1"
              >
                <FolderOpen size={14} className="mr-2" />
                打开配置目录
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReloadConfig}
                className="flex-1"
              >
                <RefreshCw size={14} className="mr-2" />
                重新加载
              </Button>
            </div>
          </div>

          {/* 关于 */}
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              MarkPix v0.1.0
              <br />
              一个现代化的图片标注工具
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 主题按钮
interface ThemeButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function ThemeButton({ icon, label, active, onClick }: ThemeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex flex-col items-center gap-2 p-4 rounded-lg",
        "border-2 transition-all duration-200",
        active
          ? "border-yellow-500 bg-yellow-500/20 text-yellow-500"
          : "border-gray-600 bg-gray-800/50 hover:bg-gray-700/50 hover:border-gray-500 text-gray-300"
      )}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
