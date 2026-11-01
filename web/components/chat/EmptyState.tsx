"use client";

import { useState, type FormEvent } from "react";
import { FileUp, ListChecks } from "lucide-react";
import { MAX_PDF_MB, useChatApp } from "@/context/ChatAppContext";
import { usePdfPicker } from "@/components/documents/usePdfPicker";
import { displayFileName } from "@/lib/utils";

/** First run of a conversation: the first action sits where the answers will appear. */
export function EmptyState() {
  const { documents, sendMessage, isSending } = useChatApp();
  const { openPicker, input } = usePdfPicker();
  const ready = documents.filter((d) => d.status === "ready");
  const busy = documents.some((d) => d.status === "processing" || d.status === "uploading");
  const first = ready[0] ? displayFileName(ready[0].fileName) : null;

  const suggestions = first
    ? [
        `Tóm tắt nội dung chính của “${first}”`,
        `Những con số và mốc thời gian quan trọng trong “${first}” là gì?`,
        `Liệt kê các điều kiện hoặc yêu cầu được nêu trong “${first}”`,
      ]
    : [];

  return (
    <div className="flex flex-1 flex-col justify-center py-10 md:py-16">
      <h2 className="text-2xl font-semibold tracking-[-0.01em]">
        {first ? "Hỏi gì về tài liệu này?" : "Hỏi đáp trên tài liệu PDF"}
      </h2>
      <p className="mt-2 max-w-[56ch] text-[15px] leading-6 text-muted">
        {first
          ? `TrainAI chỉ trả lời từ ${ready.length} PDF trong cuộc trò chuyện này, và ghi rõ trang nguồn dưới mỗi câu trả lời.`
          : "Thêm PDF vào cuộc trò chuyện rồi đặt câu hỏi. Mỗi câu trả lời ghi rõ nó lấy từ trang nào."}
      </p>

      {first ? (
        <ul className="mt-6 space-y-2">
          {suggestions.map((q) => (
            <li key={q}>
              <button
                type="button"
                disabled={isSending}
                onClick={() => sendMessage(q)}
                className="w-full rounded-card bg-raised px-4 py-3 text-left text-sm leading-5 transition-colors hover:bg-active disabled:opacity-60"
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          {input}
          <button
            type="button"
            onClick={openPicker}
            aria-describedby="empty-limit"
            className="mt-6 flex w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-control px-6 py-10 text-center transition-colors hover:border-ink hover:bg-ground"
          >
            <FileUp className="h-6 w-6 text-muted" aria-hidden="true" />
            <span className="text-[15px] font-medium">
              {busy ? "Đang đọc PDF…" : "Chọn PDF hoặc kéo thả vào đây"}
            </span>
            <span id="empty-limit" className="text-xs text-muted">
              PDF có chữ (không phải ảnh quét), tối đa {MAX_PDF_MB} MB
            </span>
          </button>
          <p className="mt-4 text-sm text-muted">
            Hoặc hỏi ngay ở ô bên dưới; TrainAI sẽ nói rõ nếu chưa có tài liệu để trả lời.
          </p>
          <LinkCheck />
        </>
      )}
    </div>
  );
}

/** Second way in: paste a deck's link to find places where it contradicts itself. */
function LinkCheck() {
  const { checkConsistency, isSending } = useChatApp();
  const [url, setUrl] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    const value = url;
    setUrl("");
    if (!(await checkConsistency(value))) setUrl(value);
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 rounded-card bg-raised p-5">
      <h3 className="text-[15px] font-semibold">Kiểm tra bài nhóm có nói trước sau như một</h3>
      <p className="mt-1 text-sm leading-6 text-muted" id="link-check-help">
        Dán link bài đang để chế độ xem công khai: Canva, Google Slides, Google Docs, hoặc file
        .docx, .pptx, .pdf. TrainAI đọc hết bài và chỉ ra slide nào nói ngược slide nào.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="link-check" className="sr-only">
          Link bài cần kiểm tra
        </label>
        <input
          id="link-check"
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.canva.com/design/…"
          aria-describedby="link-check-help"
          className="h-10 min-w-0 flex-1 rounded-control border border-control bg-surface px-3 text-sm outline-none placeholder:text-faint focus:border-ink"
        />
        <button
          type="submit"
          disabled={!url.trim() || isSending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-active disabled:text-faint"
        >
          <ListChecks className="h-4 w-4" aria-hidden="true" />
          Kiểm tra
        </button>
      </div>
    </form>
  );
}
