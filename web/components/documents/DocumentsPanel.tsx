"use client";

import { useState } from "react";
import { FileText, Loader2, Plus, Trash2, X } from "lucide-react";
import { MAX_PDF_MB, useChatApp } from "@/context/ChatAppContext";
import type { Document } from "@/lib/types";
import { cn, displayFileName, formatShortTime } from "@/lib/utils";
import { usePdfPicker } from "@/components/documents/usePdfPicker";

interface DocumentsPanelProps {
  className?: string;
}

export function DocumentsPanel({ className }: DocumentsPanelProps) {
  const {
    documents,
    documentsError,
    isLoadingDocuments,
    activeConversationId,
    setDocsOpen,
  } = useChatApp();
  const { openPicker, input } = usePdfPicker();
  const ready = documents.filter((d) => d.status === "ready").length;

  return (
    <aside
      aria-labelledby="docs-title"
      className={cn("flex h-full flex-col bg-ground", className)}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 pl-5 pr-3">
        <h2 id="docs-title" className="flex-1 text-[15px] font-semibold">
          Tài liệu
          {ready > 0 && (
            <span className="ml-2 font-normal tabular-nums text-muted">
              {ready}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setDocsOpen(false)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-control text-muted hover:bg-active hover:text-ink xl:hidden"
          aria-label="Đóng tài liệu"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {documentsError && (
          <p
            role="alert"
            className="mb-2 rounded-control bg-danger-soft px-3 py-2 text-xs leading-5 text-danger-ink"
          >
            {documentsError}
          </p>
        )}

        {isLoadingDocuments && documents.length === 0 ? (
          <div className="space-y-1" aria-label="Đang tải tài liệu">
            {[0, 1].map((i) => (
              <div key={i} className="flex gap-3 rounded-card px-2.5 py-2.5">
                <div className="h-4 w-4 rounded bg-active" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-4/5 rounded bg-active" />
                  <div className="h-3 w-1/3 rounded bg-raised" />
                </div>
              </div>
            ))}
          </div>
        ) : documents.length > 0 ? (
          <ul className="space-y-0.5">
            {documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} />
            ))}
          </ul>
        ) : (
          <p className="px-2.5 py-1 text-[13px] leading-5 text-muted">
            {activeConversationId
              ? "Cuộc trò chuyện này chưa có PDF. Câu trả lời chỉ dựa trên tài liệu bạn thêm vào đây."
              : "Mỗi cuộc trò chuyện có bộ tài liệu riêng. Thêm PDF để bắt đầu."}
          </p>
        )}

        <button
          type="button"
          onClick={openPicker}
          aria-describedby="docs-limit"
          className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-card border border-dashed border-control text-sm font-medium transition-colors hover:border-ink hover:bg-surface"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Thêm PDF
        </button>
        <p id="docs-limit" className="mt-2 px-1 text-xs text-faint">
          PDF có chữ, tối đa {MAX_PDF_MB} MB. Có thể kéo thả vào khung chat.
        </p>
        {input}
      </div>
    </aside>
  );
}

function DocumentRow({ doc }: { doc: Document }) {
  const { removeDocument, dismissDocument, highlightedDocId } = useChatApp();
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const busy = doc.status === "uploading" || doc.status === "processing";
  const failed = doc.status === "error";
  const highlighted = highlightedDocId === doc.id;

  return (
    <li
      className={cn(
        "group relative flex gap-3 rounded-card px-2.5 py-2.5 transition-colors duration-300",
        highlighted ? "bg-cite-soft" : "hover:bg-raised",
      )}
      onMouseLeave={() => setConfirming(false)}
    >
      {busy ? (
        <Loader2
          className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted"
          aria-hidden="true"
        />
      ) : (
        <FileText
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            highlighted ? "text-cite" : failed ? "text-danger" : "text-muted",
          )}
          aria-hidden="true"
        />
      )}
      <div className="min-w-0 flex-1 pr-7">
        <p className="line-clamp-2 break-words text-sm leading-5" title={doc.fileName}>
          {displayFileName(doc.fileName)}
        </p>
        <p
          className={cn(
            "mt-0.5 text-xs leading-4",
            failed ? "text-danger" : "text-muted",
          )}
        >
          {busy && "Đang đọc và lập chỉ mục…"}
          {failed && (doc.error ?? "Không xử lý được")}
          {doc.status === "ready" && `Thêm lúc ${formatShortTime(doc.uploadedAt)}`}
        </p>
      </div>

      {!busy && (
        <button
          type="button"
          disabled={removing}
          onClick={async () => {
            if (failed) {
              dismissDocument(doc.id);
              return;
            }
            if (!confirming) {
              setConfirming(true);
              return;
            }
            setRemoving(true);
            await removeDocument(doc.id);
            setRemoving(false);
            setConfirming(false);
          }}
          onBlur={() => setConfirming(false)}
          aria-label={
            failed
              ? `Bỏ ${doc.fileName}`
              : confirming
                ? `Xác nhận xóa ${doc.fileName}`
                : `Xóa ${doc.fileName}`
          }
          className={cn(
            "absolute right-2 top-2 inline-flex h-7 items-center justify-center gap-1 rounded text-muted transition-opacity",
            confirming
              ? "bg-danger-soft px-2 text-xs font-medium text-danger opacity-100"
              : "w-7 opacity-0 hover:bg-active hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
            failed && "opacity-100",
          )}
        >
          {failed ? (
            <X className="h-3.5 w-3.5" />
          ) : removing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : confirming ? (
            "Xóa?"
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </li>
  );
}
