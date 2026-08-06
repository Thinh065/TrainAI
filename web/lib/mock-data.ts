import type {
  Conversation,
  Document,
  HistoryGroup,
  Message,
  User,
} from "./types";

export const mockUser: User = {
  id: "user_1",
  name: "Trần Nhật Thịnh",
  email: "thinh.tran@example.com",
  avatar: undefined,
};

const now = new Date();
const hoursAgo = (h: number) =>
  new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
const daysAgo = (d: number) =>
  new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

export const mockConversations: Conversation[] = [
  {
    id: "conv_1",
    userId: mockUser.id,
    title: "Phân tích biểu phí học phí 2025",
    createdAt: hoursAgo(2),
    updatedAt: hoursAgo(1),
  },
  {
    id: "conv_2",
    userId: mockUser.id,
    title: "So sánh chương trình đào tạo",
    createdAt: hoursAgo(5),
    updatedAt: hoursAgo(4),
  },
  {
    id: "conv_3",
    userId: mockUser.id,
    title: "Hỏi về học bổng và hỗ trợ tài chính",
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
  {
    id: "conv_4",
    userId: mockUser.id,
    title: "Tóm tắt PDF tuyển sinh",
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
  },
  {
    id: "conv_5",
    userId: mockUser.id,
    title: "Lộ trình học AI cơ bản",
    createdAt: daysAgo(10),
    updatedAt: daysAgo(9),
  },
  {
    id: "conv_6",
    userId: mockUser.id,
    title: "Cách upload tài liệu RAG",
    createdAt: daysAgo(30),
    updatedAt: daysAgo(29),
  },
];

export const mockMessages: Message[] = [
  {
    id: "msg_1",
    conversationId: "conv_1",
    role: "user",
    content: "Học phí năm 2025–2026 được tính như thế nào?",
    createdAt: hoursAgo(2),
  },
  {
    id: "msg_2",
    conversationId: "conv_1",
    role: "assistant",
    content: `Dựa trên tài liệu bạn đã tải lên, học phí thường được **chia theo từng học kỳ** và có thể thay đổi theo ngành.

Ví dụ cấu trúc trả lời:

| Hạng mục | Ghi chú |
|----------|---------|
| Học phí chính | Theo chương trình |
| Phí dịch vụ | Tùy cơ sở |

\`\`\`python
# Ví dụ tính học phí đơn giản
hoc_phi = 15_000_000
hoc_ky = 2
tong = hoc_phi * hoc_ky
print(f"Tổng: {tong:,} VND")
\`\`\`

> *Lưu ý:* Đây là dữ liệu mô phỏng. Khi tích hợp RAG, câu trả lời sẽ trích dẫn đúng đoạn trong PDF.`,
    createdAt: hoursAgo(1.9),
  },
  {
    id: "msg_3",
    conversationId: "conv_2",
    role: "user",
    content: "Khác biệt giữa chương trình tiêu chuẩn và nâng cao?",
    createdAt: hoursAgo(5),
  },
  {
    id: "msg_4",
    conversationId: "conv_2",
    role: "assistant",
    content:
      "Chương trình **tiêu chuẩn** tập trung nền tảng; **nâng cao** có thêm dự án thực tế và chuyên sâu hơn. (Mock response)",
    createdAt: hoursAgo(4.9),
  },
  {
    id: "msg_5",
    conversationId: "conv_3",
    role: "user",
    content: "Có những loại học bổng nào?",
    createdAt: daysAgo(1),
  },
  {
    id: "msg_6",
    conversationId: "conv_3",
    role: "assistant",
    content:
      "Thường có học bổng **học tập**, **tài năng** và **hỗ trợ hoàn cảnh**. Chi tiết sẽ lấy từ PDF sau khi bạn tích hợp backend.",
    createdAt: daysAgo(1),
  },
];

export const mockDocuments: Document[] = [
  {
    id: "doc_1",
    userId: mockUser.id,
    fileName: "bieu_phi_esh_2025_2026.pdf",
    fileUrl: "/mock/bieu_phi.pdf",
    uploadedAt: daysAgo(2),
    status: "ready",
  },
  {
    id: "doc_2",
    userId: mockUser.id,
    fileName: "huong_dan_tuyen_sinh.pdf",
    fileUrl: "/mock/huong_dan.pdf",
    uploadedAt: hoursAgo(6),
    status: "ready",
  },
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function groupConversationsByDate(
  conversations: Conversation[],
): HistoryGroup[] {
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const groups: Record<string, Conversation[]> = {
    today: [],
    yesterday: [],
    previous7Days: [],
    older: [],
  };

  const sorted = [...conversations].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  for (const conv of sorted) {
    const d = startOfDay(new Date(conv.updatedAt));
    if (d.getTime() === today.getTime()) {
      groups.today.push(conv);
    } else if (d.getTime() === yesterday.getTime()) {
      groups.yesterday.push(conv);
    } else if (d >= sevenDaysAgo) {
      groups.previous7Days.push(conv);
    } else {
      groups.older.push(conv);
    }
  }

  const labels: Record<string, string> = {
    today: "Hôm nay",
    yesterday: "Hôm qua",
    previous7Days: "7 ngày trước",
    older: "Cũ hơn",
  };

  return (["today", "yesterday", "previous7Days", "older"] as const)
    .filter((key) => groups[key].length > 0)
    .map((key) => ({
      key,
      label: labels[key],
      conversations: groups[key],
    }));
}
