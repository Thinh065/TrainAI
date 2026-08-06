"use client";

import { AppShell } from "@/components/layout/AppShell";
import { ChatAppProvider } from "@/context/ChatAppContext";

export default function HomePage() {
  return (
    <ChatAppProvider>
      <AppShell />
    </ChatAppProvider>
  );
}
