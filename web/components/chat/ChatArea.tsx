"use client";

import { useRef, useState, type DragEvent } from "react";
import { FileUp } from "lucide-react";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { useChatApp } from "@/context/ChatAppContext";

function hasFiles(e: DragEvent) {
  return Array.from(e.dataTransfer.types).includes("Files");
}

export function ChatArea() {
  const { uploadPdf } = useChatApp();
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  return (
    <div
      className="relative flex h-full min-h-0 flex-col"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        depth.current += 1;
        setDragging(true);
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      }}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        Array.from(e.dataTransfer.files).forEach((file) => uploadPdf(file));
      }}
    >
      <ChatHeader />
      <MessageList />
      <ChatInput />

      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-30 flex flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-cite bg-surface/95 text-center">
          <FileUp className="h-6 w-6 text-cite" aria-hidden="true" />
          <p className="text-base font-semibold">Thả PDF để thêm vào cuộc trò chuyện</p>
          <p className="text-sm text-muted">Tài liệu chỉ dùng cho cuộc trò chuyện này.</p>
        </div>
      )}
    </div>
  );
}
