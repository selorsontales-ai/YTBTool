"""
Tool 5 backend — FastAPI tối giản cho 2 việc browser KHÔNG làm được:
  GET /transcript?videoId=...&lang=vi,en  → phụ đề video (youtube-transcript-api, không cần key)
  GET /autocomplete?q=...&lang=vi         → gợi ý YouTube (proxy né CORS)

Chạy:  uvicorn main:app --reload --port 8000   (xem README.md)
Mọi endpoint bật CORS để Tool 5 (chạy trong browser) gọi được khi dev cục bộ.
"""
import os
from typing import List

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Tool 5 SEO Backend", version="1.0")

# Dev cục bộ: cho phép mọi origin. Khi deploy thật hãy thu hẹp danh sách này.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True, "service": "tool5-backend"}


# ──────────────────────────────────────────────────────────────────────────
# TRANSCRIPT — youtube-transcript-api (jdepoix). Tương thích cả API cũ (<1.0,
# static get_transcript) lẫn mới (>=1.0, instance .fetch). Không cần API key.
# ──────────────────────────────────────────────────────────────────────────
def _fetch_transcript(video_id: str, languages: List[str]):
    from youtube_transcript_api import YouTubeTranscriptApi

    # API mới (>=1.0): instance.fetch(...) trả object có .to_raw_data()
    if hasattr(YouTubeTranscriptApi, "fetch") or not hasattr(YouTubeTranscriptApi, "get_transcript"):
        try:
            api = YouTubeTranscriptApi()
            fetched = api.fetch(video_id, languages=languages)
            try:
                return fetched.to_raw_data()
            except AttributeError:
                return [{"text": s.text, "start": s.start, "duration": s.duration} for s in fetched]
        except TypeError:
            pass  # rơi xuống API cũ nếu chữ ký khác

    # API cũ (<1.0): static get_transcript(...)
    return YouTubeTranscriptApi.get_transcript(video_id, languages=languages)


@app.get("/transcript")
def transcript(
    videoId: str = Query(..., min_length=5),
    lang: str = Query("vi,en", description="Danh sách mã ngôn ngữ ưu tiên, cách nhau bằng dấu phẩy"),
):
    languages = [x.strip() for x in lang.split(",") if x.strip()] or ["en"]
    try:
        segments = _fetch_transcript(videoId, languages)
    except ImportError:
        raise HTTPException(500, "Chưa cài youtube-transcript-api. Chạy: pip install -r requirements.txt")
    except Exception as e:  # noqa: BLE001 — gom mọi lỗi của thư viện thành 404 rõ ràng
        name = type(e).__name__
        msg = str(e).splitlines()[0] if str(e) else name
        # Các lỗi thường gặp: TranscriptsDisabled, NoTranscriptFound, VideoUnavailable
        raise HTTPException(404, f"Không lấy được phụ đề ({name}): {msg}")

    text = " ".join(s.get("text", "").replace("\n", " ") for s in segments).strip()
    if not text:
        raise HTTPException(404, "Video không có phụ đề khả dụng.")
    return {"videoId": videoId, "lang": languages, "segmentCount": len(segments), "text": text}


# ──────────────────────────────────────────────────────────────────────────
# AUTOCOMPLETE — proxy endpoint gợi ý YouTube (client=firefox → JSON sạch).
# Browser bị CORS chặn gọi trực tiếp, nên đi qua server này.
# ──────────────────────────────────────────────────────────────────────────
@app.get("/autocomplete")
async def autocomplete(
    q: str = Query(..., min_length=1),
    lang: str = Query("vi"),
):
    url = "https://suggestqueries.google.com/complete/search"
    params = {"client": "firefox", "ds": "yt", "hl": lang, "q": q}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            data = r.json()  # dạng [query, [suggestions...], ...]
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Không gọi được autocomplete: {type(e).__name__}: {e}")

    suggestions = data[1] if isinstance(data, list) and len(data) > 1 and isinstance(data[1], list) else []
    suggestions = [s for s in suggestions if isinstance(s, str)]
    return {"q": q, "lang": lang, "suggestions": suggestions}


# ──────────────────────────────────────────────────────────────────────────
# REDDIT (Tầng 3) — top post công khai theo chủ đề. Dùng endpoint .json công
# khai (read-only, không cần OAuth), chỉ cần User-Agent. Rate-limit nhẹ.
# Độc lập: lỗi ở đây không ảnh hưởng các endpoint khác.
# ──────────────────────────────────────────────────────────────────────────
@app.get("/reddit")
async def reddit(
    q: str = Query(..., min_length=1),
    limit: int = Query(15, ge=1, le=50),
):
    url = "https://www.reddit.com/search.json"
    params = {"q": q, "sort": "top", "t": "year", "limit": limit}
    headers = {"User-Agent": "tool5-seo-research/1.0 (read-only)"}
    try:
        async with httpx.AsyncClient(timeout=10, headers=headers) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Không gọi được Reddit: {type(e).__name__}: {e}")

    posts = []
    for child in (data.get("data", {}).get("children", []) or []):
        d = child.get("data", {})
        posts.append({
            "title": d.get("title", ""),
            "subreddit": d.get("subreddit", ""),
            "score": d.get("score", 0),
            "numComments": d.get("num_comments", 0),
            "url": f"https://reddit.com{d.get('permalink', '')}",
        })
    posts.sort(key=lambda p: p["score"], reverse=True)
    return {"q": q, "posts": posts}


# ──────────────────────────────────────────────────────────────────────────
# GOOGLE TRENDS (Tầng 3) — hướng quan tâm qua pytrends (scraping, có thể gãy).
# Optional: nếu chưa cài pytrends → trả lỗi rõ ràng, không crash server.
# ──────────────────────────────────────────────────────────────────────────
@app.get("/trends")
def trends(
    q: str = Query(..., min_length=1),
    geo: str = Query("", description="Mã quốc gia, vd VN, US. Rỗng = toàn cầu."),
):
    try:
        from pytrends.request import TrendReq
    except ImportError:
        raise HTTPException(501, "Chưa cài pytrends (optional). Chạy: pip install pytrends")
    try:
        py = TrendReq(hl="en-US", tz=0)
        py.build_payload([q], timeframe="today 12-m", geo=geo)
        df = py.interest_over_time()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Trends lỗi: {type(e).__name__}: {e}")

    if df is None or df.empty or q not in df:
        return {"q": q, "direction": "unknown", "data": []}
    series = [int(x) for x in df[q].tolist()]
    # so trung bình nửa cuối với nửa đầu để suy hướng
    half = max(1, len(series) // 2)
    first, second = series[:half], series[half:]
    avg_first = sum(first) / len(first) if first else 0
    avg_second = sum(second) / len(second) if second else 0
    if avg_second > avg_first * 1.15:
        direction = "rising"
    elif avg_second < avg_first * 0.85:
        direction = "falling"
    else:
        direction = "stable"
    return {"q": q, "direction": direction, "data": series}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=True)
