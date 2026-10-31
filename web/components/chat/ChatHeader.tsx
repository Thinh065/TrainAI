"use client";

import { FileText, Menu } from "lucide-react";
import { useChatApp } from "@/context/ChatAppContext";

export function ChatHeader() {
  const { setMobileSidebarOpen, setDocsOpen, activeConversation, documents } =
    useChatApp();
  const ready = documents.filter((d) => d.status === "ready").length;
  const busy = documents.some(
    (d) => d.status === "uploading" || d.status === "processing",
  );

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 px-3 md:px-5">
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-control text-muted hover:bg-raised hover:text-ink md:hidden"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label="Mở danh sách trò chuyện"
      >
        <Menu className="h-5 w-5" />
      </button>

      <h1 className="min-w-0 flex-1 truncate text-base font-semibold">
        {activeConversation?.title ?? "Cuộc trò chuyện mới"}
      </h1>

      <button
        type="button"
        onClick={() => setDocsOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-control px-3 text-sm text-muted hover:bg-raised hover:text-ink xl:hidden"
        aria-label={`Tài liệu, ${ready} PDF`}
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        <span>Tài liệu</span>
        <span className="tabular-nums text-ink">{busy ? "…" : ready}</span>
      </button>
    </header>
  );
}
