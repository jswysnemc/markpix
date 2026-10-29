// 文档标签栏 - 支持同时打开多张图片并单独关闭
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editorStore";

interface DocumentTabsProps {
  onOpenFile: () => void;
}

export function DocumentTabs({ onOpenFile }: DocumentTabsProps) {
  const { documents, activeDocumentId, switchDocument, closeDocument, isDocumentDirty } =
    useEditorStore();
  const [pendingClose, setPendingClose] = useState<{ id: string; title: string } | null>(null);

  if (documents.length === 0) return null;

  // 关闭标签：有未保存修改时先确认
  const requestClose = (doc: { id: string; title: string }) => {
    if (isDocumentDirty(doc.id)) {
      setPendingClose(doc);
    } else {
      closeDocument(doc.id);
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-1 px-2 h-9 shrink-0 select-none overflow-x-auto",
          "border-b border-[#d9d9d9] bg-[#f3f3f3] dark:border-gray-700 dark:bg-gray-900"
        )}
      >
        {
          documents.map((doc) => {
            const active = doc.id === activeDocumentId;
            const dirty = isDocumentDirty(doc.id);
            return (
              <div
                key={doc.id}
                role="tab"
                aria-selected={active}
                title={doc.title}
                onClick={() => switchDocument(doc.id)}
                className={cn(
                  "group flex items-center gap-1 h-6 pl-2 pr-1 rounded-md border text-xs cursor-pointer shrink-0 max-w-[200px] transition-colors",
                  active
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
              >
                {dirty && (
                  <span
                    title="有未保存的修改"
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      active ? "bg-amber-300" : "bg-amber-500"
                    )}
                  />
                )}
                <span className="truncate">{doc.title}</span>
                <button
                  type="button"
                  aria-label={`关闭 ${doc.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    requestClose(doc);
                  }}
                  className={cn(
                    "p-0.5 rounded shrink-0",
                    active
                      ? "hover:bg-white/20"
                      : "text-gray-400 hover:text-gray-700 hover:bg-gray-200 dark:hover:text-gray-200 dark:hover:bg-gray-600"
                  )}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })
        }
        <button
          type="button"
          aria-label="打开图片（新标签）"
          title="打开图片（新标签）"
          onClick={onOpenFile}
          className={cn(
            "ml-0.5 p-1 rounded-md shrink-0 transition-colors",
            "text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700"
          )}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* 关闭标签确认对话框 */}
      {pendingClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setPendingClose(null)}
          />
          <div className="relative z-10 w-full max-w-sm p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl">
            <h3 className="text-lg font-semibold mb-2">关闭标签</h3>
            <p className="text-sm text-muted-foreground mb-6">
              “{pendingClose.title}”有未保存的修改，确定关闭吗？
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPendingClose(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  closeDocument(pendingClose.id);
                  setPendingClose(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
              >
                不保存关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
