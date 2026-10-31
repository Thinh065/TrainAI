"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Loader2, Paperclip } from "lucide-react";
import { useChatApp } from "@/context/ChatAppContext";
import { usePdfPicker } from "@/components/documents/usePdfPicker";
import { cn } from "@/lib/utils";

export function ChatInput() {
  const { sendMessage, isSending, activeConversationId } = useChatApp();
  const { openPicker, input } = usePdfPicker();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Empty: let CSS decide (one row). Measuring the placeholder at mount gave 200px.
    el.style.height = "";
    if (!el.value) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(resize, [value, resize]);

  useEffect(() => {
    // Not on touch screens: focusing would pop the keyboard over the answers.
    if (window.matchMedia("(hover: hover)").matches) {
      textareaRef.current?.focus();
    }
  }, [activeConversationId]);

  const canSend = value.trim().length > 0 && !isSending;

  const submit = useCallback(async () => {
    if (!canSend) return;
    const text = value;
    setValue("");
    const sent = await sendMessage(text);
    // Keep the question when sending failed, so it can be sent again.
    if (!sent) setValue((current) => current || text);
  }, [canSend, sendMessage, value]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="shrink-0 px-3 pb-3 md:px-5 md:pb-4">
      <div className="mx-auto max-w-[760px]">
        <div className="flex items-end gap-1 rounded-card border border-control bg-surface p-1.5 shadow-composer transition-colors focus-within:border-ink">
          {input}
          <button
            type="button"
            onClick={openPicker}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-raised hover:text-ink"
            aria-label="Thêm PDF"
            title="Thêm PDF"
          >
            <Paperclip className="h-[18px] w-[18px]" />
          </button>

          <label htmlFor="composer" className="sr-only">
            Câu hỏi
          </label>
          <textarea
            id="composer"
            ref={textareaRef}
            rows={1}
            value={value}
            placeholder="Hỏi về tài liệu của bạn…"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            className="max-h-[200px] min-h-10 flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] leading-5 outline-none placeholder:text-faint"
          />

          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className={cn(
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary text-primary-ink transition-colors hover:bg-primary-hover active:translate-y-px",
              "disabled:cursor-not-allowed disabled:bg-active disabled:text-faint",
            )}
            aria-label={isSending ? "Đang trả lời" : "Gửi câu hỏi"}
          >
            {isSending ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin" />
            ) : (
              <ArrowUp className="h-[18px] w-[18px]" />
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-faint">
          Enter để gửi, Shift + Enter để xuống dòng. Câu trả lời có thể sai, hãy
          đối chiếu trang nguồn.
        </p>
      </div>
    </div>
  );
}
