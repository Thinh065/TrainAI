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
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Chat History
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {isLoadingHistory && (
          <p className="px-2 py-2 text-sm text-zinc-500">Đang tải lịch sử…</p>
        )}
        {historyError && (
          <p className="mb-2 rounded-lg border border-red-900/50 bg-red-950/30 px-2 py-2 text-xs text-red-300">
            {historyError}
          </p>
        )}
        {!isLoadingHistory && historyGroups.length === 0 && !historyError && (
          <p className="px-2 text-sm text-zinc-500">Chưa có cuộc trò chuyện.</p>
        )}
        {historyGroups.map((group) => (
          <div key={group.key} className="mb-3">
            <p className="mb-1 px-2 text-[11px] font-medium text-zinc-500">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.conversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                const isRenaming = renamingId === conv.id;

                return (
                  <li key={conv.id} className="relative">
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => {
                          renameConversation(conv.id, renameValue);
                          setRenamingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            renameConversation(conv.id, renameValue);
                            setRenamingId(null);
                          }
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="w-full rounded-lg border border-accent/50 bg-surface-input px-3 py-2 text-sm outline-none"
                      />
                    ) : (
                      <div
                        className={cn(
                          "group flex items-center gap-1 rounded-lg pr-1 transition-colors",
                          isActive
                            ? "bg-surface-elevated"
                            : "hover:bg-surface-hover",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => selectConversation(conv.id)}
                          className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm text-zinc-300"
                        >
                          {conv.title}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMenuOpenId((id) =>
                              id === conv.id ? null : conv.id,
                            )
                          }
                          className={cn(
                            "rounded p-1.5 text-zinc-500 transition-colors hover:bg-surface-border hover:text-zinc-200",
                            "opacity-0 group-hover:opacity-100",
                            menuOpenId === conv.id && "opacity-100",
                          )}
                          aria-label="Tùy chọn"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {menuOpenId === conv.id && !isRenaming && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-lg border border-surface-border bg-surface-elevated py-1 shadow-lg"
                      >
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover"
                          onClick={() => {
                            setRenameValue(conv.title);
                            setRenamingId(conv.id);
                            setMenuOpenId(null);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Rename
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 hover:bg-surface-hover"
                          onClick={() => {
                            deleteConversation(conv.id);
                            setMenuOpenId(null);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
