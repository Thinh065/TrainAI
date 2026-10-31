"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useChatApp } from "@/context/ChatAppContext";
import { cn } from "@/lib/utils";

export function ChatHistory() {
  const {
    historyGroups,
    activeConversationId,
    selectConversation,
    renameConversation,
    deleteConversation,
    isLoadingHistory,
    historyError,
  } = useChatApp();

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpenId) return;
    function close() {
      setMenuOpenId(null);
      setConfirmDeleteId(null);
    }
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpenId]);

  function commitRename(id: string) {
    renameConversation(id, renameValue);
    setRenamingId(null);
  }

  return (
    <nav aria-label="Lịch sử trò chuyện" className="h-full overflow-y-auto px-3 pb-3">
      {historyError && (
        <p
          role="alert"
          className="mb-3 rounded-control bg-danger-soft px-3 py-2 text-xs leading-5 text-danger-ink"
        >
          {historyError}
        </p>
      )}

      {isLoadingHistory && (
        <div className="space-y-1" aria-label="Đang tải lịch sử">
          {[72, 56, 84, 64, 48].map((w) => (
            <div key={w} className="flex h-8 items-center px-2.5">
              <div className="h-3.5 rounded bg-active" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      )}

      {!isLoadingHistory && historyGroups.length === 0 && !historyError && (
        <p className="px-2.5 py-2 text-[13px] leading-5 text-muted">
          Các cuộc trò chuyện sẽ nằm ở đây.
        </p>
      )}

      {historyGroups.map((group) => (
        <section key={group.key} className="mb-4">
          <h2 className="mb-1 px-2.5 text-xs font-medium text-faint">
            {group.label}
          </h2>
          <ul>
            {group.conversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              const isMenuOpen = menuOpenId === conv.id;

              if (renamingId === conv.id) {
                return (
                  <li key={conv.id} className="py-px">
                    <input
                      autoFocus
                      aria-label="Tên cuộc trò chuyện"
                      value={renameValue}
                      maxLength={120}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      onBlur={() => commitRename(conv.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(conv.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="h-8 w-full rounded-control border border-control bg-surface px-2.5 text-sm outline-none focus:border-ink"
                    />
                  </li>
                );
              }

              return (
                <li key={conv.id} className="group relative py-px">
                  <button
                    type="button"
                    onClick={() => selectConversation(conv.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex h-8 w-full items-center rounded-control pl-2.5 pr-9 text-left text-sm transition-colors",
                      isActive
                        ? "bg-active font-medium"
                        : "hover:bg-raised",
                    )}
                  >
                    <span className="truncate">{conv.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDeleteId(null);
                      setMenuOpenId(isMenuOpen ? null : conv.id);
                    }}
                    aria-label={`Tùy chọn cho “${conv.title}”`}
                    aria-haspopup="menu"
                    aria-expanded={isMenuOpen}
                    className={cn(
                      "absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-muted transition-opacity hover:bg-active hover:text-ink",
                      "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
                      (isMenuOpen || isActive) && "opacity-100",
                    )}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>

                  {isMenuOpen && (
                    <div
                      ref={menuRef}
                      role="menu"
                      className="absolute right-0 top-full z-20 mt-1 w-48 rounded-card border border-line bg-surface p-1 shadow-float"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        autoFocus
                        className="flex h-8 w-full items-center gap-2 rounded-control px-2.5 text-left text-sm hover:bg-raised"
                        onClick={() => {
                          setRenameValue(conv.title);
                          setRenamingId(conv.id);
                          setMenuOpenId(null);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted" />
                        Đổi tên
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={cn(
                          "flex h-8 w-full items-center gap-2 rounded-control px-2.5 text-left text-sm text-danger hover:bg-danger-soft",
                          confirmDeleteId === conv.id && "bg-danger-soft font-medium",
                        )}
                        onClick={() => {
                          if (confirmDeleteId !== conv.id) {
                            setConfirmDeleteId(conv.id);
                            return;
                          }
                          deleteConversation(conv.id);
                          setMenuOpenId(null);
                          setConfirmDeleteId(null);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {confirmDeleteId === conv.id
                          ? "Bấm lần nữa để xóa"
                          : "Xóa cùng tài liệu"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
