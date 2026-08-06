"use client";

import { useEffect, useRef } from "react";
import { Bot, Sparkles } from "lucide-react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { useChatApp } from "@/context/ChatAppContext";

export function MessageList() {
  const { activeMessages, isAssistantTyping } = useChatApp();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, isAssistantTyping]);

  const isEmpty = activeMessages.length === 0 && !isAssistantTyping;

  return (
    <div className="flex-1 overflow-y-auto">
      {isEmpty ? (
        <div className="flex h-full flex-col items-center justify-center px-4 pb-24 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-elevated ring-1 ring-surface-border">
            <Sparkles className="h-7 w-7 text-accent" />
          </div>
          <h2 className="text-xl font-semibold text-zinc-100">
            Bạn cần hỗ trợ gì hôm nay?
          </h2>
          <p className="mt-2 max-w-md text-sm text-zinc-500">
            Hỏi về tuyển sinh, học phí hoặc nội dung trong PDF đã tải lên.
            Giao diện sẵn sàng để tích hợp MongoDB và RAG.
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-1 px-3 py-6 md:px-6">
          {activeMessages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isAssistantTyping && (
            <div className="flex gap-3 px-2 py-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-muted">
                <Bot className="h-4 w-4 text-accent" />
              </div>
              <div className="flex items-center gap-1 pt-2">
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:300ms]" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
