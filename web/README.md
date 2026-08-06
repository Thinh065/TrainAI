# TrainAI Web — Chat UI

Giao diện chat kiểu ChatGPT (Next.js + TypeScript + Tailwind).

## Chạy dự án

```bash
cd web
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

## Cấu trúc

- `app/` — layout và trang chính
- `components/sidebar/` — Sidebar, PDF, lịch sử, profile
- `components/chat/` — vùng chat, tin nhắn, input
- `context/ChatAppContext.tsx` — state toàn app (sau này thay bằng API + MongoDB)
- `lib/types.ts` — schema dữ liệu
- `lib/mock-data.ts` — dữ liệu mẫu

## MongoDB Atlas (lịch sử chat)

1. Copy `.env.example` → `.env.local`
2. Dán `MONGODB_URI` từ Atlas (Network Access: IP của bạn; Database User có quyền read/write)
3. `npm run dev` — mọi cuộc trò chuyện và tin nhắn lưu qua `app/api/*`

Collections: `users`, `conversations`, `messages`.

Tùy chọn: `PYTHON_API_URL=http://localhost:8501` để câu trả lời assistant gọi Flask/Gemini.

