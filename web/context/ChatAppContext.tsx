"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createConversationApi,
  deleteConversationApi,
  fetchConversations,
  fetchCurrentUser,
  fetchMessages,
  sendMessageApi,
  updateConversationApi,
  uploadPdfApi,
} from "@/lib/api-client";
import { groupConversationsByDate, mockDocuments, mockUser } from "@/lib/mock-data";
import type {
  Conversation,
  Document,
  DocumentStatus,
  HistoryGroup,
  Message,
  User,
} from "@/lib/types";
import { generateId } from "@/lib/utils";

interface ChatAppContextValue {
  user: User;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  selectedModel: string;
  activeConversationId: string | null;
  conversations: Conversation[];
  documents: Document[];
  historyGroups: HistoryGroup[];
  activeMessages: Message[];
  activeConversation: Conversation | null;
  isAssistantTyping: boolean;
  isLoadingHistory: boolean;
  historyError: string | null;
  toggleSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setSelectedModel: (model: string) => void;
  createNewChat: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  uploadPdf: (file: File) => Promise<void>;
  removeDocument: (id: string) => void;
}

const ChatAppContext = createContext<ChatAppContextValue | null>(null);

export function ChatAppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(mockUser);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("TrainAI GPT");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<Document[]>(mockDocuments);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [isAssistantTyping, setIsAssistantTyping] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoadingHistory(true);
      setHistoryError(null);
      try {
        const [userData, convList] = await Promise.all([
          fetchCurrentUser(),
          fetchConversations(),
        ]);
        if (cancelled) return;
        setUser(userData);
        setConversations(convList);
      } catch (e) {
        if (!cancelled) {
          setHistoryError(
            e instanceof Error ? e.message : "Không kết nối được MongoDB",
          );
        }
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  const historyGroups = useMemo(
    () => groupConversationsByDate(conversations),
    [conversations],
  );

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const createNewChat = useCallback(async () => {
    try {
      const conversation = await createConversationApi();
      setConversations((prev) => [conversation, ...prev]);
      setActiveConversationId(conversation.id);
      setActiveMessages([]);
      setMobileSidebarOpen(false);
      setHistoryError(null);
    } catch (e) {
      setHistoryError(
        e instanceof Error ? e.message : "Không tạo được cuộc trò chuyện",
      );
    }
  }, []);

  const selectConversation = useCallback(async (id: string) => {
    setActiveConversationId(id);
    setMobileSidebarOpen(false);
    setHistoryError(null);
    try {
      const messages = await fetchMessages(id);
      setActiveMessages(messages);
    } catch (e) {
      setActiveMessages([]);
      setHistoryError(
        e instanceof Error ? e.message : "Không tải được tin nhắn",
      );
    }
  }, []);

  const renameConversation = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      const updated = await updateConversationApi(id, trimmed);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? updated : c)),
      );
      setHistoryError(null);
    } catch (e) {
      setHistoryError(
        e instanceof Error ? e.message : "Không đổi tên được",
      );
    }
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await deleteConversationApi(id);
        setConversations((prev) => {
          const next = prev.filter((c) => c.id !== id);
          setActiveConversationId((current) => {
            if (current !== id) return current;
            setActiveMessages([]);
            return null;
          });
          return next;
        });
        setHistoryError(null);
      } catch (e) {
        setHistoryError(
          e instanceof Error ? e.message : "Không xóa được cuộc trò chuyện",
        );
      }
    },
    [],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isAssistantTyping) return;

      setHistoryError(null);
      setIsAssistantTyping(true);

      try {
        let conversationId = activeConversationId;

        if (!conversationId) {
          const conversation = await createConversationApi(
            trimmed.slice(0, 48) + (trimmed.length > 48 ? "…" : ""),
          );
          setConversations((prev) => [conversation, ...prev]);
          conversationId = conversation.id;
          setActiveConversationId(conversation.id);
        }

        const { userMessage, assistantMessage, conversation } =
          await sendMessageApi(conversationId, trimmed);

        setActiveMessages((prev) => [...prev, userMessage, assistantMessage]);
        setConversations((prev) =>
          prev.map((c) => (c.id === conversation.id ? conversation : c)),
        );
      } catch (e) {
        setHistoryError(
          e instanceof Error ? e.message : "Không gửi được tin nhắn",
        );
      } finally {
        setIsAssistantTyping(false);
      }
    },
    [activeConversationId, isAssistantTyping],
  );

  const uploadPdf = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf") return;

      let conversationId = activeConversationId;
      if (!conversationId) {
        const conversation = await createConversationApi(
          file.name.slice(0, 48) + (file.name.length > 48 ? "…" : ""),
        );
        setConversations((prev) => [conversation, ...prev]);
        conversationId = conversation.id;
        setActiveConversationId(conversation.id);
      }

      const docId = generateId("doc");
      const uploading: Document = {
        id: docId,
        userId: user.id,
        fileName: file.name,
        fileUrl: URL.createObjectURL(file),
        uploadedAt: new Date().toISOString(),
        status: "uploading",
      };
      setDocuments((prev) => [uploading, ...prev]);

      try {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === docId ? { ...d, status: "processing" as DocumentStatus } : d,
          ),
        );

        await uploadPdfApi(conversationId, user.id, file);

        setDocuments((prev) =>
          prev.map((d) =>
            d.id === docId ? { ...d, status: "ready" as DocumentStatus } : d,
          ),
        );
      } catch (e) {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === docId ? { ...d, status: "error" as DocumentStatus } : d,
          ),
        );
        setHistoryError(
          e instanceof Error
            ? `Upload PDF thất bại: ${e.message}`
            : "Upload PDF thất bại",
        );
      }
    },
    [activeConversationId, createConversationApi, setConversations, setActiveConversationId, user.id],
  );

  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => {
      const doc = prev.find((d) => d.id === id);
      if (doc?.fileUrl.startsWith("blob:")) {
        URL.revokeObjectURL(doc.fileUrl);
      }
      return prev.filter((d) => d.id !== id);
    });
  }, []);

  const value: ChatAppContextValue = {
    user,
    sidebarCollapsed,
    mobileSidebarOpen,
    selectedModel,
    activeConversationId,
    conversations,
    documents,
    historyGroups,
    activeMessages,
    activeConversation,
    isAssistantTyping,
    isLoadingHistory,
    historyError,
    toggleSidebar,
    setMobileSidebarOpen,
    setSelectedModel,
    createNewChat,
    selectConversation,
    renameConversation,
    deleteConversation,
    sendMessage,
    uploadPdf,
    removeDocument,
  };

  return (
    <ChatAppContext.Provider value={value}>{children}</ChatAppContext.Provider>
  );
}

export function useChatApp() {
  const ctx = useContext(ChatAppContext);
  if (!ctx) {
    throw new Error("useChatApp must be used within ChatAppProvider");
  }
  return ctx;
}
