// 设置对话框
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { X, Sun, Moon, Monitor, FolderOpen, Github, Plus, Trash2, Edit2, Check } from "lucide-react";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import type { CustomAction } from "@/types";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { theme, setTheme, customActions, setCustomActions, outputPattern, setOutputPattern, saveConfig, loadConfig } = useEditorStore();
  const [configPath, setConfigPath] = useState<string>("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CustomAction>({ name: "", command: "", icon: "" });
  const [isAdding, setIsAdding] = useState(false);

  // 获取配置文件路径并加载配置
  useEffect(() => {
    if (open) {
      invoke<string>("get_config_path").then(setConfigPath);
      loadConfig();
    }
  }, [open, loadConfig]);

  // 添加新动作
  const handleAddAction = () => {
    setIsAdding(true);
    setEditForm({ name: "", command: "", icon: "" });
    setEditingIndex(null);
  };

  // 编辑动作
  const handleEditAction = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...customActions[index] });
    setIsAdding(false);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editForm.name || !editForm.command) {
      alert("名称和命令不能为空");
      return;
    }

    let newActions: CustomAction[];
    if (isAdding) {
      newActions = [...customActions, editForm];
    } else if (editingIndex !== null) {
      newActions = customActions.map((a, i) => i === editingIndex ? editForm : a);
    } else {
      return;
    }

    setCustomActions(newActions);
    await saveConfig();
    setEditingIndex(null);
    setIsAdding(false);
    setEditForm({ name: "", command: "", icon: "" });
  };

  // 删除动作
  const handleDeleteAction = async (index: number) => {
    const newActions = customActions.filter((_, i) => i !== index);
    setCustomActions(newActions);
    await saveConfig();
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingIndex(null);
    setIsAdding(false);
    setEditForm({ name: "", command: "", icon: "" });
  };

  // 打开配置文件目录
  const handleOpenConfigDir = async () => {
    try {
      if (!configPath) {
        alert("配置文件路径未找到");
        return;
      }
      const dir = configPath.substring(0, configPath.lastIndexOf("/"));
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
          "relative z-10 w-full max-w-lg p-6 rounded-xl max-h-[90vh] overflow-y-auto",
          "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700",
          "shadow-2xl",
          "animate-in fade-in-0 zoom-in-95",
          "text-gray-900 dark:text-gray-100"
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
            <h3 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">主题</h3>
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
                label="自动"
                active={theme === "auto"}
                onClick={() => setTheme("auto")}
              />
            </div>
          </div>

          {/* 输出设置 */}
          <div>
            <h3 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">默认输出文件名</h3>
            <input
              type="text"
              value={outputPattern}
              onChange={(e) => setOutputPattern(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="{input_file_base}_{YYYY_MM_DD-hh-mm-ss}_markpix.png"
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1">
              <p>可用变量：</p>
              <p><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{`{input_file_base}`}</code>: 基础文件名</p>
              <p><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{`{input_file}`}</code>: 完整路径</p>
              <p><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{`{YYYY_MM_DD-hh-mm-ss}`}</code>: 时间戳</p>
            </div>
          </div>

          {/* 自定义动作配置 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">自定义动作</h3>
              <Button variant="ghost" size="icon-sm" onClick={handleAddAction}>
                <Plus size={16} />
              </Button>
            </div>

            {/* 动作列表 */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {customActions.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                  暂无自定义动作，点击 + 添加
                </p>
              ) : (
                customActions.map((action, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    {editingIndex === index ? (
                      // 编辑模式
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          placeholder="名称"
                          className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                        <input
                          type="text"
                          value={editForm.command}
                          onChange={(e) => setEditForm({ ...editForm, command: e.target.value })}
                          placeholder="命令 (使用 {file} 代表文件路径)"
                          className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                        <input
                          type="text"
                          value={editForm.icon || ""}
                          onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                          placeholder="图标 (可选: scan, upload, terminal, folder)"
                          className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                        <div className="flex gap-1">
                          <Button variant="default" size="sm" onClick={handleSaveEdit} className="flex-1 h-7 text-xs">
                            <Check size={12} className="mr-1" /> 保存
                          </Button>
                          <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="flex-1 h-7 text-xs">
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // 显示模式
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{action.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{action.command}</p>
                        </div>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleEditAction(index)}>
                          <Edit2 size={14} />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteAction(index)} className="text-red-500 hover:text-red-600">
                          <Trash2 size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}

              {/* 添加新动作表单 */}
              {isAdding && (
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-2">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="名称"
                    className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                  <input
                    type="text"
                    value={editForm.command}
                    onChange={(e) => setEditForm({ ...editForm, command: e.target.value })}
                    placeholder="命令 (使用 {file} 代表文件路径)"
                    className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                  <input
                    type="text"
                    value={editForm.icon || ""}
                    onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                    placeholder="图标 (可选: scan, upload, terminal, folder)"
                    className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                  <div className="flex gap-1">
                    <Button variant="default" size="sm" onClick={handleSaveEdit} className="flex-1 h-7 text-xs">
                      <Plus size={12} className="mr-1" /> 添加
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="flex-1 h-7 text-xs">
                      取消
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* 配置文件路径 */}
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                配置文件：<code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs break-all">{configPath}</code>
              </p>
              <Button variant="outline" size="sm" onClick={handleOpenConfigDir} className="w-full">
                <FolderOpen size={14} className="mr-2" />
                打开配置目录
              </Button>
            </div>
          </div>

          {/* 关于 */}
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center mb-3">
              MarkPix v0.1.0
              <br />
              一个现代化的图片标注工具
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => openUrl("https://github.com/jswysnemc/markpix")}
            >
              <Github size={14} className="mr-2" />
              GitHub 项目主页
            </Button>
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
          ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400"
          : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-500 text-gray-600 dark:text-gray-300"
      )}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
