# Tool 5 Backend (FastAPI)

Backend tối giản cho 2 nguồn dữ liệu mà browser KHÔNG lấy được:

- **`GET /transcript?videoId=<id>&lang=vi,en`** — phụ đề video qua [`youtube-transcript-api`](https://github.com/jdepoix/youtube-transcript-api) (không cần API key). Video tắt/không có phụ đề → trả lỗi 404 rõ ràng, không crash.
- **`GET /autocomplete?q=<từ khoá>&lang=vi`** — gợi ý YouTube (proxy né CORS), trả mảng `suggestions`.
- `GET /health` — kiểm tra server sống.

## Vì sao cần backend?

`captions.download` của YouTube Data API cần OAuth + chỉ lấy được video của chính mình. Reddit/Trends/autocomplete bị CORS chặn khi gọi từ browser. Nên phần này phải chạy server-side.

## Chạy

Yêu cầu Python ≥ 3.9.

```bash
cd server
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Kiểm tra: mở `http://localhost:8000/health` → `{"ok": true}`.
Thử transcript: `http://localhost:8000/transcript?videoId=dQw4w9WgXcQ&lang=en`

Đổi cổng: copy `.env.example` → `.env` rồi sửa `PORT`, hoặc `uvicorn main:app --port 9000`.

## Nối với Tool 5

Trong Tool 5, mục **Backend (transcript + autocomplete)**, dán Backend URL (mặc định `http://localhost:8000`) rồi bấm **Kiểm tra**. Khi server xanh, các nút "Lấy transcript" và "Autocomplete" sẽ bật. Server tắt thì các tính năng này tự ẩn, phần còn lại của Tool 5 vẫn chạy bình thường.

> Lưu ý dev: nếu mở Tool 5 qua `https://`, trình duyệt có thể chặn gọi `http://localhost` (mixed content). Chạy Tool 5 qua `http://localhost` khi dùng backend, hoặc cho phép nội dung không an toàn cho localhost.
