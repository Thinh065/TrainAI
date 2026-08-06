"use client";

import { FileText, Loader2, Trash2 } from "lucide-react";
import { useChatApp } from "@/context/ChatAppContext";
import type { DocumentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

function statusLabel(status: DocumentStatus): string {
  switch (status) {
    case "uploading":
      return "Đang tải lên…";
    case "processing":
      return "Đang xử lý…";
    case "ready":
      return "Sẵn sàng";
    case "error":
      return "Lỗi";
    default:
      return status;
  }
}

export function PDFList() {
  const { documents, removeDocument } = useChatApp();

  if (documents.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-zinc-500">
        Chưa có PDF. Thêm tài liệu để chuẩn bị RAG.
      </p>
    );
  }

  return (
    <ul className="max-h-32 space-y-0.5 overflow-y-auto px-1 py-1 scrollbar-thin">
      {documents.map((doc) => {
        const busy = doc.status === "uploading" || doc.status === "processing";
        return (
          <li
            key={doc.id}
            className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-hover"
          >
            <FileText className="h-4 w-4 shrink-0 text-red-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-200">
                {doc.fileName}
              </p>
              <p
                className={cn(
                  "flex items-center gap-1 text-[10px]",
                  doc.status === "ready" ? "text-emerald-500/90" : "text-zinc-500",
                )}
              >
                {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                {statusLabel(doc.status)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeDocument(doc.id)}
              className="rounded p-1 text-zinc-500 opacity-0 transition-all hover:bg-surface-border hover:text-red-400 group-hover:opacity-100"
              aria-label={`Xóa ${doc.fileName}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
