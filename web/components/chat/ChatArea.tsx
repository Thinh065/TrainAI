"use client";

import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";

export function ChatArea() {
  return (
    <div className="flex h-full flex-col">
      <ChatHeader />
      <MessageList />
      <ChatInput />
    </div>
  );
}
