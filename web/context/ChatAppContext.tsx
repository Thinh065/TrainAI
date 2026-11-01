"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createConversationApi,
  deleteConversationApi,
  deleteDocumentApi,
  fetchConsistencyProgressApi,
  fetchConversations,
  fetchCurrentUser,
  fetchDocumentsApi,
  fetchMessages,
  sendMessageApi,
  startConsistencyCheckApi,
  updateConversationApi,
  uploadPdfApi,
} from "@/lib/api-client";
import { groupConversationsByDate } from "@/lib/history";
import type {
  Conversation,
  Document,
  HistoryGroup,
  Message,
  User,
} from "@/lib/types";
import { errorMessage, generateId, shortTitle } from "@/lib/utils";

/** Must match MAX_UPLOAD_MB in app/server.py. */
export const MAX_PDF_MB = 16;

export interface ChatError {
  message: string;
}

interface ChatAppContextValue {
  user: User | null;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  docsOpen: boolean;
  activeConversationId: string | null;
  conversations: Conversation[];
  documents: Document[];
  historyGroups: HistoryGroup[];
  activeMessages: Message[];
  activeConversation: Conversation | null;
  /** Waiting for an answer in some conversation; blocks sending another question. */
  isSending: boolean;
  /** The question waiting for an answer in the conversation on screen. */
  pendingQuestion: string | null;
  /** What the pending request is doing right now, shown under it. */
  pendingStatus: string | null;
  isLoadingHistory: boolean;
  isLoadingMessages: boolean;
  isLoadingDocuments: boolean;
  historyError: string | null;
  chatError: ChatError | null;
  documentsError: string | null;
  highlightedDocId: string | null;
  showSource: (fileId: string) => void;
  toggleSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setDocsOpen: (open: boolean) => void;
  createNewChat: () => void;
  selectConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<boolean>;
  checkConsistency: (url: string) => Promise<boolean>;
  dismissChatError: () => void;
  uploadPdf: (file: File) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  dismissDocument: (id: string) => void;
}

const ChatAppContext = createContext<ChatAppContextValue | null>(null);

function isPdf(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

export function ChatAppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  // One question in flight at a time; it belongs to the conversation it was asked in.
  const [sending, setSending] = useState<{
    conversationId: string | null;
    content: string;
    status: string;
  } | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<ChatError | null>(null);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [highlightedDocId, setHighlightedDocId] = useState<string | null>(
    null,
  );
  const highlightTimer = useRef<number | undefined>(undefined);

  // The conversation the UI shows right now; async results for any other one are dropped.
  const activeIdRef = useRef<string | null>(null);
  // Bumped whenever the user moves to another chat.
  const navCountRef = useRef(0);
  const setActive = useCallback((id: string | null) => {
    activeIdRef.current = id;
    setActiveConversationId(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
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
          setHistoryError(errorMessage(e, "Không kết nối được MongoDB"));
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

  const loadDocuments = useCallback(async (conversationId: string) => {
    setIsLoadingDocuments(true);
    setDocumentsError(null);
    try {
      const next = await fetchDocumentsApi(conversationId);
      if (activeIdRef.current !== conversationId) return;
      // Keep rows still uploading or failed; the server does not know them yet.
      setDocuments((prev) => [
        ...prev.filter((d) => d.status !== "ready"),
        ...next,
      ]);
    } catch (e) {
      if (activeIdRef.current === conversationId) {
        setDocumentsError(errorMessage(e, "Không tải được danh sách PDF"));
      }
    } finally {
      if (activeIdRef.current === conversationId) setIsLoadingDocuments(false);
    }
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

  /** A blank chat; the conversation is created on the first question or PDF. */
  const createNewChat = useCallback(() => {
    navCountRef.current += 1;
    setActive(null);
    setActiveMessages([]);
    setDocuments([]);
    setChatError(null);
    setDocumentsError(null);
    setMobileSidebarOpen(false);
  }, [setActive]);

  // Several PDFs dropped on a blank chat must land in one new conversation, not one each.
  const creatingRef = useRef<Promise<string> | null>(null);
  const ensureConversation = useCallback(
    (title: string): Promise<string> => {
      if (activeIdRef.current) return Promise.resolve(activeIdRef.current);
      if (!creatingRef.current) {
        const navAtStart = navCountRef.current;
        creatingRef.current = createConversationApi(shortTitle(title))
          .then((conversation) => {
            setConversations((prev) => [conversation, ...prev]);
            // Only open it if the user has not moved to another chat meanwhile.
            if (navCountRef.current === navAtStart) setActive(conversation.id);
            return conversation.id;
          })
          .finally(() => {
            creatingRef.current = null;
          });
      }
      return creatingRef.current;
    },
    [setActive],
  );

  const selectConversation = useCallback(
    async (id: string) => {
      if (id === activeIdRef.current) {
        setMobileSidebarOpen(false);
        return;
      }
      navCountRef.current += 1;
      setActive(id);
      setActiveMessages([]);
      setDocuments([]);
      setChatError(null);
      setMobileSidebarOpen(false);
      setIsLoadingMessages(true);

      loadDocuments(id);
      try {
        const messages = await fetchMessages(id);
        if (activeIdRef.current === id) setActiveMessages(messages);
      } catch (e) {
        if (activeIdRef.current === id) {
          setChatError({ message: errorMessage(e, "Không tải được tin nhắn") });
        }
      } finally {
        if (activeIdRef.current === id) setIsLoadingMessages(false);
      }
    },
    [loadDocuments, setActive],
  );

  const renameConversation = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      const updated = await updateConversationApi(id, trimmed);
      setConversations((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setHistoryError(null);
    } catch (e) {
      setHistoryError(errorMessage(e, "Không đổi tên được"));
    }
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await deleteConversationApi(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeIdRef.current === id) {
          setActive(null);
          setActiveMessages([]);
          setDocuments([]);
          setChatError(null);
        }
        setHistoryError(null);
      } catch (e) {
        setHistoryError(errorMessage(e, "Không xóa được cuộc trò chuyện"));
      }
    },
    [setActive],
  );

  const sendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      const trimmed = content.trim();
      if (!trimmed || sending) return false;

      setChatError(null);
      setSending({
        conversationId: activeIdRef.current,
        content: trimmed,
        status: "Đang tìm trong tài liệu…",
      });

      let conversationId: string | null = null;
      try {
        conversationId = await ensureConversation(trimmed);
        const target = conversationId;
        setSending((prev) => prev && { ...prev, conversationId: target });
        const { userMessage, assistantMessage, conversation } =
          await sendMessageApi(conversationId, trimmed);

        setConversations((prev) => [
          conversation,
          ...prev.filter((c) => c.id !== conversation.id),
        ]);
        if (activeIdRef.current === conversationId) {
          setActiveMessages((prev) => [...prev, userMessage, assistantMessage]);
        }
        return true;
      } catch (e) {
        if (activeIdRef.current === conversationId) {
          setChatError({
            message: errorMessage(e, "Không gửi được tin nhắn"),
          });
        }
        return false;
      } finally {
        setSending(null);
      }
    },
    [ensureConversation, sending],
  );

  /** Đọc bài ở link và tìm chỗ nói không khớp nhau; chạy ở nền nên hỏi tiến độ định kỳ. */
  const checkConsistency = useCallback(
    async (url: string): Promise<boolean> => {
      const trimmed = url.trim();
      if (!trimmed || sending) return false;

      setChatError(null);
      setSending({
        conversationId: activeIdRef.current,
        content: `Kiểm tra độ nhất quán: ${trimmed}`,
        status: "Đang đọc bài từ link…",
      });

      let conversationId: string | null = null;
      try {
        conversationId = await ensureConversation(`Kiểm tra: ${trimmed}`);
        const target = conversationId;
        setSending((prev) => prev && { ...prev, conversationId: target });
        const jobId = await startConsistencyCheckApi(conversationId, trimmed);

        const deadline = Date.now() + 15 * 60 * 1000;
        while (Date.now() < deadline) {
          await new Promise((resolve) => window.setTimeout(resolve, 3000));
          const progress = await fetchConsistencyProgressApi(target, jobId);
          if (progress.status === "error") {
            throw new Error(progress.error || "Không kiểm tra được bài này");
          }
          if (progress.status === "done") {
            if (progress.conversation) {
              const updated = progress.conversation;
              setConversations((prev) => [
                updated,
                ...prev.filter((c) => c.id !== updated.id),
              ]);
            }
            if (activeIdRef.current === target) {
              if (progress.userMessage && progress.assistantMessage) {
                const { userMessage, assistantMessage } = progress;
                setActiveMessages((prev) => [...prev, userMessage, assistantMessage]);
              } else {
                setActiveMessages(await fetchMessages(target));
              }
            }
            return true;
          }
          setSending(
            (prev) =>
              prev && {
                ...prev,
                status:
                  progress.stage === "checking"
                    ? `Đang so sánh ${progress.sections ?? ""} phần của “${progress.title ?? "bài"}” với nhau… thường mất 1–5 phút`
                    : "Đang đọc bài từ link…",
              },
          );
        }
        throw new Error("Kiểm tra quá lâu (hơn 15 phút). Hãy thử lại.");
      } catch (e) {
        if (activeIdRef.current === conversationId) {
          setChatError({ message: errorMessage(e, "Không kiểm tra được bài này") });
        }
        return false;
      } finally {
        setSending(null);
      }
    },
    [ensureConversation, sending],
  );

  const dismissChatError = useCallback(() => setChatError(null), []);

  const uploadPdf = useCallback(
    async (file: File) => {
      const docId = generateId("doc");
      const base: Document = {
        id: docId,
        userId: user?.id ?? "",
        fileName: file.name,
        fileUrl: "",
        uploadedAt: new Date().toISOString(),
        status: "processing",
      };

      const reject = (error: string) =>
        setDocuments((prev) => [
          { ...base, status: "error", error },
          ...prev,
        ]);

      if (!isPdf(file)) {
        reject("Chỉ nhận file PDF");
        return;
      }
      if (file.size > MAX_PDF_MB * 1024 * 1024) {
        reject(`File lớn hơn ${MAX_PDF_MB} MB`);
        return;
      }

      setDocuments((prev) => [base, ...prev]);
      try {
        const conversationId = await ensureConversation(file.name);
        await uploadPdfApi(conversationId, file);
        if (activeIdRef.current !== conversationId) return;
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        await loadDocuments(conversationId);
      } catch (e) {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === docId
              ? {
                  ...d,
                  status: "error",
                  error: errorMessage(e, "Upload PDF thất bại"),
                }
              : d,
          ),
        );
      }
    },
    [ensureConversation, loadDocuments, user?.id],
  );

  /** A citation was clicked: reveal its PDF in the documents panel. */
  const showSource = useCallback((fileId: string) => {
    setDocsOpen(true);
    setHighlightedDocId(fileId);
    window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(
      () => setHighlightedDocId(null),
      1600,
    );
  }, []);

  const dismissDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const removeDocument = useCallback(async (id: string) => {
    const conversationId = activeIdRef.current;
    if (!conversationId) return;
    setDocumentsError(null);
    try {
      await deleteDocumentApi(conversationId, id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      setDocumentsError(errorMessage(e, "Không xóa được PDF"));
    }
  }, []);

  const value: ChatAppContextValue = {
    user,
    sidebarCollapsed,
    mobileSidebarOpen,
    docsOpen,
    activeConversationId,
    conversations,
    documents,
    historyGroups,
    activeMessages,
    activeConversation,
    isSending: sending !== null,
    pendingQuestion:
      sending && sending.conversationId === activeConversationId
        ? sending.content
        : null,
    pendingStatus:
      sending && sending.conversationId === activeConversationId
        ? sending.status
        : null,
    isLoadingHistory,
    isLoadingMessages,
    isLoadingDocuments,
    historyError,
    chatError,
    documentsError,
    highlightedDocId,
    showSource,
    toggleSidebar,
    setMobileSidebarOpen,
    setDocsOpen,
    createNewChat,
    selectConversation,
    renameConversation,
    deleteConversation,
    sendMessage,
    checkConsistency,
    dismissChatError,
    uploadPdf,
    removeDocument,
    dismissDocument,
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
