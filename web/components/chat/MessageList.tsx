"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { EmptyState } from "@/components/chat/EmptyState";
import { useChatApp } from "@/context/ChatAppContext";

export function MessageList() {
  const {
    activeMessages,
    pendingQuestion,
    isLoadingMessages,
    chatError,
    dismissChatError,
  } = useChatApp();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "end",
    });
  }, [activeMessages.length, pendingQuestion, chatError]);

  const isEmpty =
    activeMessages.length === 0 && !pendingQuestion && !isLoadingMessages;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite" aria-busy={pendingQuestion !== null}>
      <div className="mx-auto flex min-h-full max-w-[760px] flex-col px-4 md:px-5">
        {isLoadingMessages ? (
          <div className="space-y-8 py-8" aria-label="Đang tải tin nhắn">
            <div className="ml-auto h-10 w-2/5 rounded-card bg-raised" />
            <div className="space-y-2.5">
              <div className="h-4 w-11/12 rounded bg-raised" />
              <div className="h-4 w-4/5 rounded bg-raised" />
              <div className="h-4 w-3/5 rounded bg-raised" />
            </div>
          </div>
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <div className="space-y-8 py-8">
            {activeMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {pendingQuestion && (
              <MessageBubble
                message={{
                  id: "pending",
                  conversationId: "",
                  role: "user",
                  content: pendingQuestion,
                  createdAt: "",
                }}
              />
            )}
            {pendingQuestion && (
              <div className="flex items-center gap-2 text-sm text-muted" role="status">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-faint" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-faint [animation-delay:200ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-faint [animation-delay:400ms]" />
                </span>
                Đang tìm trong tài liệu…
              </div>
            )}
          </div>
        )}

        {chatError && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-card bg-danger-soft px-4 py-3 text-sm text-danger-ink"
          >
            <p className="flex-1 leading-5">
              {chatError.message}
              <span className="mt-0.5 block text-xs opacity-80">
                Câu hỏi vẫn nằm trong ô nhập, bạn có thể gửi lại.
              </span>
            </p>
            <button
              type="button"
              onClick={dismissChatError}
              className="-mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-surface/60"
              aria-label="Đóng thông báo lỗi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
