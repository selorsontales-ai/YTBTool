# CLAUDE.md — YouTube Tool Suite

> File này Claude Code tự đọc mỗi phiên. Là "bộ nhớ dự án". Giữ ngắn gọn, cập nhật khi kiến trúc đổi.

## 1. Mục tiêu hệ thống

Một bộ 5 công cụ (React/JSX) hỗ trợ sản xuất nội dung YouTube **đa ngách, đa ngôn ngữ (global)**, từ định hướng kênh → nghiên cứu SEO bằng data thật → sinh prompt hàng loạt → sản xuất nội dung → rà soát chất lượng. Mỗi tool xuất/nhập JSON để nối thành pipeline.

**Không giới hạn ngách, không chỉ tiếng Việt.** Mọi mặc định ngôn ngữ/ngách phải có thể đổi qua tham số.

## 2. Bối cảnh chạy

- Tool 1-4 hiện chạy trong **Claude Artifact** (gọi `https://api.anthropic.com/v1/messages` zero-key — môi trường Artifact tự lo auth).
- Khi chạy ngoài Artifact (dự án này), **dùng API key riêng** qua biến môi trường. Lớp đổi auth do chủ dự án tự xử lý — **không sửa logic gọi model trừ khi được yêu cầu**.
- Việc model nào phân tích KHÔNG quan trọng. **Tập trung vào tính năng tool, không tinh chỉnh model.**

## 3. Năm tool & vai trò

| Tool | File | Vai trò | Xuất | Nhập |
|---|---|---|---|---|
| 1 | `ChannelBlueprint_Tool1.jsx` | Định hướng kênh (cây gợi ý + AI tạo blueprint) | blueprint JSON | freeform + .md + lựa chọn |
| 2 | `ChannelPromptStudio_Tool2.jsx` | "Máy đẻ prompt" hàng loạt theo loại/bộ | prompts JSON, MD | blueprint (T1), checkpoint, **SEO data (T5) — CẦN XÂY** |
| 3 | `ContentStudio_Tool3.jsx` | Thực thi prompt → nội dung cuối | checkpoint JSON, MD | prompts JSON (T2) |
| 4 | `ReviewStudio_Tool4.jsx` | Rà soát (anti-AI, fact-check) → bài duyệt | bài đã sửa MD | MD / checkpoint (T3) |
| 5 | `Tool5_SEO.jsx` | Nghiên cứu SEO/đối thủ bằng **data thật** (YouTube API) | seo-data JSON | (độc lập) |

## 4. Contract dữ liệu giữa các tool (QUAN TRỌNG — đừng phá)

**T1 → T2:** blueprint object. Khoá chính: `channel_name_suggestions[]`, `tagline`, `core_concept`, `target_audience`, `content_pillars[]{title,description,example_topics[]}`, `first_10_video_ideas[]`, `growth_strategy{hook_formula,...}`, `monetization_roadmap[]`, `upload_schedule{frequency}`, `production_setup{style}`.

**T2 → T3:** `{ tool, version, channel, prompts: [{id, setId, type, category, categoryLabel, title, prompt}] }`.
- `type` ∈ `text_generation` | `image_generation` (T3 định tuyến theo trường này — bất biến).
- `setId`: prompt cùng 1 video (chế độ đồng bộ) chia sẻ `setId`.

**T3 → T4:** checkpoint `{ tool:"tool3-content-studio", prompts: [{..., result, controls, truncated, research}] }`, hoặc MD tách bài. T4 đọc `p.result` cho text. **MD separator hiện là `---` (dễ cắt nhầm — kế hoạch đổi sang `<!-- ARTICLE_BREAK -->`).**

**T5 → T2:** `seo-data-*.json` `{ tool:"tool5-seo-research", version, topic, market, lang, opportunity{score,level,metrics}, savedKeywords[], keywordCandidates[], realTags[], ai{titlePatterns,tags,extraKeywords,descriptionTemplate} }`. **Hiện T2 CHƯA có đường nạp file này — đây là việc trọng tâm.**

## 5. Quy tắc văn phong (áp cho mọi text sinh ra)

- Viết hoa câu chuẩn theo ngôn ngữ đích, **KHÔNG Title Case kiểu tiếng Anh** cho nội dung tiếng Việt.
- **KHÔNG em-dash `—`**; dùng `-` có dấu cách hai bên.
- Hạn chế dấu hai chấm trong tiêu đề.
- Giữ thuật ngữ phổ biến (AI, SEO, CEO...) nguyên dạng.

## 6. Ràng buộc kỹ thuật đã xác minh (đừng đề xuất sai)

- **YouTube `search.list` = 100 units/call**, quota mặc định 10.000/ngày → ~100 search/ngày. Phải đếm quota + cache.
- **`commentThreads.list` = 1 unit/call** → đào comment rất rẻ, ưu tiên.
- **Transcript video người khác KHÔNG lấy được qua YouTube Data API** (cần OAuth + chỉ video của mình). Phải dùng `youtube-transcript-api` (Python, không cần key) → **cần backend**.
- **Reddit / Google Trends / YouTube autocomplete**: CORS + không có API key công khai → **cần backend proxy**.
- Vì vậy Tool 5 nâng cấp = **app có server** (Node hoặc Python), không còn là artifact thuần.

## 7. Quy ước làm việc trong dự án này

- **Một thay đổi = một commit.** Commit trước khi sửa lớn để dễ hoàn tác.
- Giữ từng tool **độc lập import/export được** (không hard-couple); pipeline nối qua file JSON.
- Khi thêm trường vào contract, **giữ tương thích ngược** (đọc được cả file cũ).
- Trước khi sửa hàng loạt file, **liệt kê kế hoạch + xin xác nhận**.
- Tài liệu nguồn: file `PHAN_TICH_5_TOOL_v2.md` (phân tích chi tiết các hạng mục cần cải thiện) và `PROMPTS_THUC_THI.md` (bộ prompt thực thi).

## 8. Trạng thái hạng mục cải thiện (cập nhật khi xong)

- [x] T3/T4: đổi separator MD `---` → `<!-- ARTICLE_BREAK -->` (T4 fallback `---` cho file cũ)
- [x] T2: nút Import SEO data (T5) + nhúng seoContext vào system prompt
- [ ] T2: bộ lọc 2 lớp + nút "Lọc & chuẩn hoá theo SEO"
- [x] T1→T2: map đầy đủ blueprint (ideas, hooks) thay vì chỉ title pillar (buildBlueprintExtras vào system prompt)
- [ ] T2: chống trùng theo keyword cốt lõi (không chỉ norm(title))
- [ ] T3: chế độ sản xuất theo setId (script trước → title/desc bám script)
- [ ] T5 Tầng 1: comments mining + duration sweet-spot (client-side)
- [ ] T5 Tầng 2: backend transcript + autocomplete
- [ ] T5 Tầng 3: Reddit + Trends + thumbnail vision
- [ ] T4: thêm vai phản biện; vòng lặp về T2/T3
