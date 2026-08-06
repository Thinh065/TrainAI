# TrainAI

Ứng dụng TrainAI gồm backend Python (Flask + ChromaDB + MongoDB) và frontend Next.js.

## 1. Yêu cầu

- Python 3.11+ hoặc tương đương
- Node.js 20+ (cho frontend)
- MongoDB Atlas hoặc MongoDB cục bộ
- Một API key cho Google Gemini / Google GenAI nếu muốn dùng AI

## 2. Cài đặt backend

1. Mở terminal tại `C:\Code\TrainAI`
2. Tạo và kích hoạt virtual environment:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\activate
   ```
3. Cài dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

## 3. Cấu hình môi trường backend

Tạo file `.env` ở thư mục gốc `C:\Code\TrainAI` với các biến sau:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority
MONGODB_DATABASE=trainai

AI_API_KEY=<your_google_genai_api_key>
# hoặc
GOOGLE_API_KEY=<your_google_genai_api_key>

AI_MODEL_NAME=gemini-3.6-flash

EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2

CHROMA_API_KEY=<your_chroma_cloud_api_key>
CHROMA_TENANT=<your_chroma_tenant>
CHROMA_DATABASE=Train
```

### Giải thích biến môi trường

- `MONGODB_URI`: chuỗi kết nối đến MongoDB. Bắt buộc.
- `MONGODB_DATABASE`: tên database MongoDB, mặc định `trainai`.
- `AI_API_KEY` hoặc `GOOGLE_API_KEY`: API key để gọi Google Gemini qua thư viện `google-genai`.
- `AI_MODEL_NAME`: tên model AI; mặc định `gemini-3.6-flash`.
- `EMBEDDING_MODEL`: model embeddings dùng `sentence-transformers`.
- `CHROMA_API_KEY` và `CHROMA_TENANT`: nếu dùng Chroma Cloud.
- `CHROMA_DATABASE`: tên database Chroma Cloud; mặc định `Train`.

Nếu không có `CHROMA_API_KEY` và `CHROMA_TENANT`, ứng dụng sẽ dùng ChromaDB local tại `chroma_db`.

## 4. Chạy backend

```powershell
cd C:\Code\TrainAI\app
python server.py
```

Sau khi chạy, backend lắng nghe tại:

- `http://127.0.0.1:8501`

## 5. Chạy frontend

1. Mở terminal tại thư mục `C:\Code\TrainAI\web`
2. Cài npm packages:
   ```powershell
   npm install
   ```
3. Chạy frontend:
   ```powershell
   npm run dev
   ```
4. Mở trình duyệt tại:
   ```text
   http://localhost:3000
   ```

## 6. Cấu hình thêm frontend (nếu cần)

- `web/README.md` có hướng dẫn cơ bản cho phía giao diện.
- Nếu frontend cần gọi API backend, hãy đảm bảo URL tới Python server đúng.

## 7. Kiểm tra lỗi thường gặp

- `ModuleNotFoundError: No module named 'google.genai'` → cài `google-genai` trong `.venv`.
- Lỗi MongoDB truy vấn → kiểm tra `MONGODB_URI` và database.
- Lỗi ChromaDB query với `$and` → đã sửa trong `app/chroma_store.py`.

## 8. Test nhanh bằng dòng lệnh

```powershell
cd C:\Code\TrainAI\app
python main.py
```

Nó sẽ hỏi `user_id`, `conversation_id` và câu hỏi rồi trả kết quả đơn giản.
