# TrainAI

Trợ lý hỏi đáp trên tài liệu, tiếng Việt.

- **Hỏi đáp trên PDF:** mỗi cuộc trò chuyện có bộ PDF riêng. Câu trả lời chỉ dựa trên các PDF đó và ghi rõ trang nguồn (`tr. 3`). Bấm vào nguồn để xem đó là file nào.
- **Kiểm tra độ nhất quán của bài:** dán link bài (Canva, Google Slides, Google Docs, file `.docx`/`.pptx`/`.pdf`). App đọc hết bài và chỉ ra slide nào nói ngược slide nào: số liệu lệch, nhận định trái nhau, kết luận không khớp phân tích. Mỗi chỗ có trích dẫn nguyên văn và gợi ý cách sửa.
- **Tài khoản riêng:** đăng ký, đăng nhập. Mỗi người chỉ thấy dữ liệu của mình.

## Kiến trúc

```
Trình duyệt ──► Next.js (web/, cổng 3000) ──► Python Flask (app/, cổng 8501) ──► Gemini
                 │  đăng nhập, cuộc trò chuyện,      │  đọc PDF và link, tìm đoạn văn,
                 │  tin nhắn (MongoDB)               │  Chroma (vector), MongoDB (file)
```

- Trình duyệt chỉ nói chuyện với Next.js. Python chỉ nhận request từ Next.js: mặc định nó chỉ nghe trên `127.0.0.1`, và mọi request phải kèm khóa `INTERNAL_API_KEY`.
- **Tìm đoạn văn:** kết hợp tìm theo nghĩa (vector, model `paraphrase-multilingual-MiniLM-L12-v2` chạy trên máy) với tìm theo từ khóa (BM25), rồi đưa 8 đoạn tốt nhất cho Gemini.
- **Kiểm tra độ nhất quán:** chạy nền vì bài dài có thể mất vài phút. Giao diện hiện tiến độ. Kết quả được nhớ theo nội dung bài: kiểm tra lại bài chưa sửa thì có ngay, không tốn lượt Gemini.

## Yêu cầu

- Python 3.10 trở lên, Node.js 20 trở lên
- MongoDB (Atlas hoặc chạy trên máy)
- API key Google Gemini (lấy ở Google AI Studio)
- Tùy chọn: Chroma Cloud. Không có thì app lưu vector vào thư mục `chroma_db/`.

## Cài đặt

```powershell
# Backend Python
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd web
npm install
```

Lần chạy đầu, Python tải model tìm kiếm khoảng 470 MB về máy.

## Cấu hình

Copy hai file mẫu rồi điền giá trị:

```powershell
copy .env.example .env
copy web\.env.example web\.env.local
```

| Biến | File | Ý nghĩa |
|---|---|---|
| `MONGODB_URI` | cả hai | Chuỗi kết nối MongoDB. Python và Next dùng **cùng một** database. |
| `MONGODB_DATABASE` | cả hai | Tên database, ví dụ `Train`. |
| `INTERNAL_API_KEY` | cả hai | Khóa bí mật dùng chung giữa Next và Python, **phải giống nhau** ở hai file. Tạo bằng `python -c "import secrets;print(secrets.token_urlsafe(32))"`. |
| `AI_API_KEY` | `.env` | API key Gemini. |
| `AI_MODEL_NAME` | `.env` | Model Gemini, mặc định `gemini-3.6-flash`. |
| `CHROMA_API_KEY`, `CHROMA_TENANT`, `CHROMA_DATABASE` | `.env` | Chroma Cloud. Bỏ trống thì dùng thư mục `chroma_db/`. |
| `MAX_UPLOAD_MB` | `.env` | Giới hạn dung lượng PDF, mặc định 16. |
| `AI_CHAT_TIMEOUT`, `AI_REVIEW_TIMEOUT` | `.env` | Số giây tối đa chờ Gemini: hỏi đáp mặc định 120, kiểm tra độ nhất quán mặc định 600. Gemini quá tải tạm thời (503) thì app tự thử lại 2 lần. |
| `HOST`, `PORT` | `.env` | Nơi Python nghe, mặc định `127.0.0.1:8501`. |
| `PYTHON_API_URL` | `web/.env.local` | Địa chỉ Python, mặc định `http://localhost:8501`. |
| `AUTH_SECRET` | `web/.env.local` | Khóa ký phiên đăng nhập, ít nhất 32 ký tự. Đổi khóa này thì mọi người phải đăng nhập lại. |

**MongoDB Atlas:** vào *Network Access*, thêm IP máy chạy app. Vào *Database Access*, tạo user có quyền đọc và ghi. Tên user trong `MONGODB_URI` phải đúng tên user ở đây.

## Chạy

Cả hai cùng lúc (Windows):

```powershell
.\scripts\dev.ps1
```

Hoặc chạy riêng từng phần, mỗi lệnh một terminal:

```powershell
.\.venv\Scripts\python.exe app\server.py
```

```powershell
cd web; npm run dev
```

Mở http://localhost:3000, tạo tài khoản rồi dùng.

**Chạy thật (production):**

```powershell
cd web; npm run build; npm run start
```

Python dùng `gunicorn` (Linux):

```bash
gunicorn -w 1 --threads 8 -b 127.0.0.1:8501 app.server:app
```

Dùng **1 worker**, vì tiến độ kiểm tra độ nhất quán được giữ trong bộ nhớ của tiến trình.

## Test

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -t .
cd web; npx tsc --noEmit; npm run build
```

Trên GitHub, CI tự chạy các lệnh này mỗi lần push (`.github/workflows/ci.yml`).

## Giới hạn cần biết

- **Lượt Gemini:** gói miễn phí giới hạn số lượt mỗi ngày (với `gemini-3.6-flash` là 20 lượt/ngày). Hết lượt thì app báo rõ. Có thể đổi `AI_MODEL_NAME` sang model khác (mỗi model có hạn mức riêng) hoặc bật thanh toán.
- **PDF dạng ảnh quét** không đọc được, vì app chưa có OCR.
- **Bảng phức tạp trong PDF** có thể bị dính số khi tách chữ.
- **Canva:** app đọc chữ từ trang xem công khai. Nếu Canva đổi cách hiển thị, app sẽ báo lỗi và hướng dẫn tải bài về dạng PDF rồi kéo vào.
- **Kiểm tra độ nhất quán** dùng AI nên mỗi lần chạy có thể khác nhau đôi chút: lỗi lớn lần nào cũng thấy, lỗi nhỏ thì lúc có lúc không.

## Cấu trúc thư mục

```
app/                  Python
  server.py           API Flask
  rag_service.py      nạp PDF, tìm đoạn văn, trả lời
  keyword_search.py   BM25 và gộp kết quả
  link_reader.py      đọc Canva, Google, docx, pptx, pdf từ link
  consistency.py      kiểm tra độ nhất quán bằng Gemini
  consistency_jobs.py chạy kiểm tra ở nền
  chroma_store.py     lưu và tìm vector
  mongo_store.py      lưu file PDF đã nạp
tests/                test Python
web/                  Next.js
  app/api/            API cho trình duyệt (đăng nhập, trò chuyện, tài liệu, kiểm tra)
  app/login/          trang đăng nhập
  components/         giao diện
  lib/server/         đăng nhập, gọi Python
scripts/dev.ps1       chạy cả app
```
