"use client";

import { useRef, useCallback, KeyboardEvent } from "react";
import { ArrowUp, Paperclip } from "lucide-react";
import { useChatApp } from "@/context/ChatAppContext";
import { cn } from "@/lib/utils";

export function ChatInput() {
  const { sendMessage, isAssistantTyping } = useChatApp();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  const submit = useCallback(() => {
    const el = textareaRef.current;
    if (!el || isAssistantTyping) return;
    const value = el.value;
    if (!value.trim()) return;
    sendMessage(value);
    el.value = "";
    el.style.height = "auto";
  }, [sendMessage, isAssistantTyping]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="shrink-0 border-t border-surface-border/40 bg-gradient-to-t from-surface-chat via-surface-chat to-transparent px-3 pb-4 pt-2 md:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="relative flex items-end gap-2 rounded-2xl border border-surface-border bg-surface-input p-2 shadow-lg shadow-black/20 transition-colors focus-within:border-zinc-500">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="application/pdf,image/*"
            onChange={() => {
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mb-1 rounded-lg p-2 text-zinc-500 transition-colors hover:bg-surface-hover hover:text-zinc-300"
            aria-label="Đính kèm file"
            title="Đính kèm (UI — chưa kết nối backend)"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Nhập tin nhắn… (Enter gửi, Shift+Enter xuống dòng)"
            disabled={isAssistantTyping}
            onInput={adjustHeight}
            onKeyDown={onKeyDown}
            className="max-h-[200px] min-h-[44px] flex-1 resize-none bg-transparent py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none disabled:opacity-50"
          />

          <button
            type="button"
            onClick={submit}
            disabled={isAssistantTyping}
            className={cn(
              "mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-all hover:bg-accent-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
            )}
            aria-label="Gửi tin nhắn"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-zinc-600">
          TrainAI có thể mắc lỗi. Kiểm tra thông tin quan trọng trong tài liệu
          chính thức.
        </p>
      </div>
    </div>
  );
}
