# Gợi ý cải tiến Tool 5 — SEO Researcher
> Tài liệu này do Claude (chat) soạn để làm input cho Claude Code.
> Mọi quyết định implement, structure, và naming thuộc về Claude Code — đây chỉ là gợi ý.

---

## 1. Toggle nguồn data: Google API ↔ yt-dlp

### Bối cảnh
Tool 5 hiện dùng YouTube Data API v3 để lấy comments và transcript.
`yt-dlp` là Python CLI tool có thể làm việc tương tự nhưng không tiêu quota.

### Gợi ý
Cân nhắc thêm toggle cho phần **Comments** và **Transcript** — hai chỗ tốn quota nhiều nhất.

**Lý do nên làm:**
- Comments mining: 1 unit/call × 8 video = 8 units — nhỏ, nhưng khi chạy nhiều kênh nhiều chủ đề/ngày thì tích lũy
- Transcript: hiện cần backend riêng, `yt-dlp` đơn giản hóa setup vì backend đã có sẵn
- Toggle cho phép fallback linh hoạt mà không thay đổi UX

**Lý do có thể không cần ngay:**
- Hệ thống chưa có kênh nào đang chạy → quota chưa phải bottleneck thực sự
- `yt-dlp` phải chạy qua backend — nếu backend chưa ổn định thì toggle thêm complexity không cần thiết
- Google API trả về structured data (views, subs, tags cùng lúc) — yt-dlp không thay được phần này

**Nếu làm:**
- `yt-dlp` chỉ áp dụng cho Comments + Transcript, không áp dụng cho Search/Stats (vẫn cần Google API)
- Nếu chọn yt-dlp mà backend offline → tự fallback Google API + hiện toast thông báo
- State của toggle nên được lưu vào checkpoint/storage cùng với các settings khác

---

## 2. Channel Profile — context cho AI Suggest

### Bối cảnh
Tool 5 phục vụ nhiều kênh, nhiều chủ đề, cả VN lẫn Global.
AI Suggest hiện dùng system prompt generic → title patterns và tags ra na ná nhau bất kể chủ đề.

### Gợi ý
Cân nhắc thêm một **Channel Profile** input — user điền một lần cho mỗi phiên research.

Các field gợi ý (Claude Code tự quyết định structure):
- Target audience (vd: "phụ nữ VN 30-45, quan tâm sức khỏe")
- Tone/style kênh (vd: "khoa học nhưng gần gũi, không dùng jargon")
- Ngôn ngữ chính của kênh (VN / EN / song ngữ)
- Niche (vd: "circadian biology, nutrition, habit")

Profile này inject vào system prompt của `runAISuggest()`, `runCommentsMining()`, `runThumbnailVision()`.

**Lý do nên làm:**
- Impact cao nhất so với effort — chỉ thêm UI + 1 param, không cần API mới
- Khi phục vụ nhiều kênh, đây là thứ tạo ra sự khác biệt thực sự trong chất lượng output
- Profile có thể lưu vào checkpoint → không phải điền lại mỗi lần

**Lý do có thể không cần ngay:**
- Nếu workflow hiện tại là mỗi lần research một chủ đề mới thì user thay market (VN/Global) là đủ
- Thêm field có thể làm phức tạp UI với user mới

---

## 3. Regex filter câu hỏi cho keyword candidates

### Bối cảnh
Có một bài viết SEO blog chia sẻ kỹ thuật dùng regex để lọc câu hỏi từ GSC.
Regex tiếng Việt đã được validate:

```
(?i)^(ai|gì|cái gì|điều gì|đâu|ở đâu|chỗ nào|nơi nào|khi nào|lúc nào|bao giờ|bao nhiêu|bao lâu|bao xa|mấy|mấy giờ|tại sao|vì sao|do đâu|thế nào|như thế nào|ra sao|làm sao|làm thế nào|cách nào|bằng cách nào|là gì|nghĩa là gì|có phải|liệu|nên|có nên|có thể)(?=\s|$|[?!.,:;])
```

### Gợi ý
Cân nhắc thêm badge "❓ Câu hỏi" vào keyword candidates khi keyword match regex trên (VN) hoặc bắt đầu bằng who/what/how/why/when (EN).

**Lý do nên làm:**
- Keyword dạng câu hỏi = search intent rõ ràng = dễ viết title hook hơn = CTR thường cao hơn
- Chi phí implement thấp — chỉ là filter/badge, không thêm API call

**Lý do có thể không cần ngay:**
- Keyword candidates hiện tại đã được sort theo frequency — badge câu hỏi chỉ là thông tin thêm, không thay đổi ranking
- Có thể làm sau khi Channel Profile được implement xong

---

## 4. Search intent classification trong AI Suggest output

### Bối cảnh
AI Suggest hiện trả về: opportunitySummary, titlePatterns, tags, extraKeywords, descriptionTemplate.
Thiếu layer tâm lý/intent — Tool 2 nhận data nhưng không biết *tại sao* người ta tìm keyword này.

### Gợi ý
Cân nhắc thêm 2 field vào JSON output của `runAISuggest()`:

```json
"searchIntent": "informational | transactional | comparison | problem-solving",
"emotionalTrigger": "fear | curiosity | aspiration | social_proof | FOMO"
```

**Lý do nên làm:**
- Tool 2 ngay lập tức có thêm context để sinh prompt bám tâm lý hơn
- Không cần API call mới — chỉ mở rộng system prompt hiện tại
- Đặc biệt hữu ích khi kênh làm content sức khỏe/giáo dục — intent rất khác nhau giữa "tại sao mình mệt mỏi" (problem-solving + fear) vs "cách tăng năng lượng" (aspiration)

**Lý do có thể không cần ngay:**
- Nếu Tool 2 chưa được cập nhật để dùng 2 field này thì thêm vào cũng không có giá trị ngay
- Nên làm đồng thời với update Tool 2

---

## Thứ tự ưu tiên gợi ý (Claude Code tự quyết)

Nếu cần chọn thứ tự, mình gợi ý theo impact/effort:

1. **Channel Profile** — impact cao nhất, effort thấp, áp dụng ngay cho multi-channel workflow
2. **Search intent + emotional trigger** — làm cùng lúc với update Tool 2
3. **Regex câu hỏi badge** — nhỏ, làm được lúc rảnh
4. **yt-dlp toggle** — làm khi quota thực sự là vấn đề, hoặc khi backend đã ổn định

---

> Tất cả quyết định cuối cùng về có làm hay không, làm như thế nào, và thứ tự — thuộc về Claude Code, người đã nắm toàn bộ codebase và context kỹ thuật của hệ thống.
