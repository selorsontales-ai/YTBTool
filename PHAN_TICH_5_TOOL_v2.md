# Phân tích hệ thống 5 Tool — Bản v2 (đã hiệu chỉnh)

> **Hiệu chỉnh từ phản hồi của bạn:**
> 1. Tool 5 là **global, không giới hạn ngách** → bỏ mọi nhận xét kiểu "tối ưu cho tiếng Việt / sức khỏe".
> 2. Cú pháp API (`output_config.effort`, `thinking.adaptive`, beta header) **chạy thật trong Artifact (zero-key)** → tôi rút lại cảnh báo "cú pháp bịa" ở bản v1. Khi chuyển sang key API riêng (Claude Code) bạn tự lo phần đổi auth — phần đó không bàn ở đây.
> 3. Tool 1-2-3-4 chạy được trong Artifact. Trọng tâm bản này: **nâng cấp Tool 5** + **nối Tool 5 → Tool 2** + **hướng dẫn Claude Code từ con số 0**.

---

## Phần A — Tóm tắt đánh giá pipeline (giữ lại điểm còn đúng)

Xương sống **1 → 2 → 3 → 4 nối được**. Các vấn đề ăn khớp vẫn đúng nguyên:

| Cặp nối | Trạng thái | Vấn đề cốt lõi |
|---|---|---|
| Tool 1 → Tool 2 | ✅ | `mapBlueprintToChannel` bỏ rơi dữ liệu giàu: `first_10_video_ideas`, `content_pillars[].example_topics`, `growth_strategy.hook_formula` |
| **Tool 5 → Tool 2** | ❌ Đứt | **Tool 5 export `seo-data-*.json` nhưng Tool 2 không có đường nạp** — đây là việc chính |
| Tool 2 → Tool 3 | ✅ | Tool 3 giữ `setId` nhưng không sản xuất theo bộ → mất chế độ đồng bộ; title viết *mù* nội dung script |
| Tool 3 → Tool 4 | ✅ | Separator `---` dễ cắt nhầm bài nếu script có đường kẻ ngang markdown |
| Tool 4 → (?) | ❌ Ngõ cụt | Thiếu vai **phản biện**; bài đã sửa không quay lại được Tool 2/3 |

Ba điểm sửa nhanh, không liên quan Tool 5:
- **Tool 2:** chống trùng nên theo từ khoá cốt lõi, không chỉ `norm(title)` (trùng ý khác chữ vẫn lọt).
- **Tool 3:** đổi separator MD sang `<!-- ARTICLE_BREAK -->` để Tool 4 không cắt nhầm.
- **Tool 3:** thêm chế độ sản xuất theo `setId` (script trước → title/description đọc script vừa viết).

---

## Phần B — NÂNG CẤP TOOL 5 (trọng tâm)

### B.0. Sự thật kỹ thuật phải biết TRƯỚC khi thiết kế

Đề xuất của AI kia rất hay về mặt chiến lược, nhưng **phần lớn KHÔNG chạy được client-side bằng 1 API key** — đây là lý do quan trọng nhất để chuyển sang Claude Code. Cụ thể:

| Nguồn dữ liệu đề xuất | Chạy được trong Artifact/browser? | Sự thật |
|---|---|---|
| Comments (YouTube `commentThreads.list`) | ✅ Được | API key, **1 unit/call** (rẻ) |
| Video duration / format | ✅ Đã có sẵn | `contentDetails.duration` Tool 5 đã lấy |
| **Transcript / phụ đề (CC)** | ❌ **KHÔNG** | YouTube Data API **không** trả transcript video người khác (`captions.download` cần OAuth + chỉ video của chính mình). Phải dùng thư viện scraping (`youtube-transcript-api` Python / `youtube-caption-extractor` Node) — **cần backend, không chạy trong browser** |
| **Reddit API** | ❌ Khó | CORS chặn gọi trực tiếp từ browser; cần OAuth app + backend proxy |
| **Google Trends** | ❌ KHÔNG | Không có API chính thức; mọi thư viện đều là scraping → **cần backend** |
| **YouTube Autocomplete** | ⚠️ Vướng | Endpoint gợi ý không chính thức, browser bị CORS chặn → cần proxy |
| Thumbnail Vision AI | ✅ Một phần | Lấy link ảnh `https://i.ytimg.com/.../maxresdefault.jpg` thì dễ; gửi cho Claude phân tích vision được, nhưng nên qua backend để tránh lộ key |

**Kết luận quan trọng:**
- **Quota là rào lớn nhất.** `search.list` = **100 units/call**, mặc định **10.000 units/ngày** → chỉ ~**100 lượt search/ngày**. Mỗi "lượt nghiên cứu hoàn chỉnh" của bạn (search + videos + channels + comments nhiều video) ăn vài trăm units. Thực tế ~**20-40 nghiên cứu/ngày/project**. Phải có lớp đếm quota + cache.
- Vì transcript / Reddit / Trends / autocomplete đều **cần backend**, Tool 5 không thể là một Artifact đơn thuần nữa. Nó phải thành **app có server** (Node/Python) — đây chính là việc Claude Code làm tốt mà Artifact không làm được.

### B.1. Kiến trúc Tool 5 mới (phân tầng theo độ khả thi)

Đề xuất chia làm **3 tầng**, làm từ dễ tới khó, mỗi tầng đều ra giá trị độc lập:

**TẦNG 1 — Mở rộng trong khả năng YouTube API hiện có (làm trước, rẻ):**
- **Comments mining:** với top 5-8 video, gọi `commentThreads.list` (1 unit/call) lấy 100 top comment mỗi video → gộp → đưa Claude phân tích: câu hỏi chưa được trả lời, lời phàn nàn, "content gap". Đây là phần **giá trị cao nhất / chi phí thấp nhất** trong toàn bộ đề xuất.
- **Duration sweet-spot:** Tool 5 đã lấy `duration`, chỉ cần parse ISO8601 → histogram độ dài video top → tìm điểm ngọt.
- **Upload cadence của kênh top:** từ `channelId` đã có, gọi thêm để ước lượng tần suất.
- **Thumbnail URL của top 5:** lấy link ảnh sẵn (không tốn quota) → để dành cho tầng 3.

**TẦNG 2 — Cần backend nhẹ (Claude Code dựng được trong 1 buổi):**
- **Transcript top 3:** server endpoint `/transcript?videoId=` dùng `youtube-transcript-api`. Claude đọc transcript → phân tích cấu trúc kịch bản + content gap. **Đây là phần "reverse engineering" mạnh nhất.**
- **Autocomplete:** server proxy gọi endpoint gợi ý → trả 50-100 long-tail keyword. Né CORS.

**TẦNG 3 — Tích hợp ngoài (làm sau, cần đăng ký riêng):**
- **Reddit:** OAuth app + backend → top post nhiều upvote về chủ đề → "ngôn ngữ mạng" + nỗi đau thật.
- **Google Trends:** thư viện scraping qua backend → đường cong quan tâm 3-12 tháng (trend lên hay sắp chết).
- **Thumbnail Vision:** gửi 5 link ảnh top cho Claude (vision) → phân tích màu/bố cục chung → đề xuất concept tương phản.

### B.2. Schema export mới của Tool 5 (để Tool 2 tiêu thụ)

Mở rộng `seo-data-*.json` hiện tại thành:

```jsonc
{
  "tool": "tool5-seo-research", "version": "tool5-seo-v2",
  "topic": "...", "market": "...", "lang": "...",
  "opportunity": { "score": 0, "level": "...", "metrics": {...} },

  // --- đã có ---
  "savedKeywords": [...], "keywordCandidates": [...], "realTags": [...],
  "ai": { "titlePatterns": [], "tags": [], "extraKeywords": [], "descriptionTemplate": "" },

  // --- TẦNG 1 ---
  "audiencePain": ["câu hỏi/nỗi đau rút từ comments"],
  "contentGaps": ["chủ đề top chưa nhắc tới"],
  "durationSweetSpot": { "minSec": 0, "maxSec": 0, "medianSec": 0 },

  // --- TẦNG 2 ---
  "autocompleteLongTail": ["..."],
  "transcriptInsights": { "commonStructure": "...", "gaps": ["..."] },

  // --- TẦNG 3 ---
  "trend": { "direction": "rising|falling|stable", "data": [...] },
  "redditSignals": ["..."],
  "thumbnailConcept": { "commonPatterns": "...", "differentiationIdea": "..." }
}
```

### B.3. NỐI Tool 5 → Tool 2 + bộ lọc/chuẩn hoá (yêu cầu chính, giữ nguyên từ v1)

**Bước 1 — Tool 2 thêm nút "Import SEO data (Tool 5)"** đọc file trên, giữ thành `seoContext`, nhúng vào system prompt khi sinh (giống `bpCtx`) → prompt bám từ khoá thật + title pattern thật + nỗi đau khán giả thật ngay từ đầu.

**Bước 2 — Bộ lọc 2 lớp, chạy SAU khi sinh, TRƯỚC khi vào kho:**

*Lớp 1 — cơ học (0 API):* loại prompt quá ngắn; loại `seo_title`/`description` không chứa keyword nào trong `savedKeywords ∪ keywordCandidates ∪ autocompleteLongTail`; loại trùng ý theo keyword cốt lõi.

*Lớp 2 — chấm điểm + chuẩn hoá bằng 1 call gộp Claude* (rẻ vì gộp cả lô 20 prompt vào 1 request):
> Cho danh sách prompt + SEO data thật. Mỗi prompt: chấm 0-100 độ bám SEO + chất lượng; < ngưỡng → loại kèm lý do; đạt → viết lại: nhồi keyword chính vào 40 ký tự đầu title, ép quy tắc văn phong, gắn tag thật. Trả JSON `[{id, keep, score, reason, normalizedTitle, normalizedPrompt}]`.

Tool 2 giữ `keep===true`, thay bằng bản normalized, hiển thị `score + reason` để bạn duyệt tay lần cuối. Nút **"Lọc & chuẩn hoá theo SEO"** đặt trong khu Kho Prompt, idempotent.

---

## Phần C — Hướng dẫn Claude Code cho dự án này (từ con số 0)

> Bạn nói chưa biết gì về Claude Code. Phần này đi từ "nó là gì" đến "chạy lệnh đầu tiên cho đúng dự án 5 tool của bạn".

### C.1. Claude Code là gì (1 đoạn)

Claude Code là **AI lập trình chạy trong terminal** (cửa sổ dòng lệnh). Khác với chat ở đây — nơi tôi không thấy file thật của bạn — Claude Code **đọc/sửa/tạo file trực tiếp trong thư mục dự án, chạy lệnh, cài thư viện, dựng server**. Đúng thứ bạn cần: Tool 5 mới có backend, nhiều file, cần chạy thử thật.

> *(Antigravity là IDE của Google, cũng tích hợp agent tương tự. Hướng dẫn dưới đây dùng Claude Code; ý tưởng tổ chức dự án áp dụng được cho cả hai.)*

### C.2. Cài đặt (theo docs chính thức, đã xác minh 2026)

**Yêu cầu:** một tài khoản trả phí (Claude Pro/Max hoặc Console API), và nếu cài qua npm thì **Node.js ≥ 18** (khuyên dùng 22 LTS).

Hai cách cài:

**Cách 1 — Native installer (Anthropic khuyên dùng, không cần Node):** xem lệnh tại trang chính thức `https://docs.claude.com/en/docs/claude-code/overview`.

**Cách 2 — npm (nếu đã có Node):**
```bash
node --version            # phải ≥ v18
npm install -g @anthropic-ai/claude-code@latest
claude --version          # kiểm tra cài xong
```
⚠️ **Không dùng `sudo npm install -g`** (gây lỗi quyền). Nếu vướng quyền, dùng `nvm` để quản Node.

**Đăng nhập:** chạy `claude` lần đầu, nó hỏi đăng nhập (tài khoản Claude) hoặc dùng `ANTHROPIC_API_KEY`. Phần key này bạn nói tự lo.

Tài liệu gốc (luôn mới hơn trí nhớ tôi):
- Tổng quan + cài đặt: `https://docs.claude.com/en/docs/claude-code/overview`
- Bản đồ docs: `https://docs.anthropic.com/en/docs/claude-code/claude_code_docs_map.md`

### C.3. Khởi động dự án 5 tool của bạn

```bash
# 1. Tạo / vào thư mục dự án
mkdir youtube-tool-suite && cd youtube-tool-suite

# 2. (khuyên) khởi tạo git để Claude Code theo dõi thay đổi, dễ hoàn tác
git init

# 3. Bỏ 5 file .jsx hiện tại vào thư mục này

# 4. Mở Claude Code ngay trong thư mục
claude
```

Khi `claude` chạy, bạn ở trong phiên trò chuyện với agent — gõ yêu cầu bằng tiếng Việt bình thường.

### C.4. Việc ĐẦU TIÊN nên làm: tạo file CLAUDE.md

Claude Code tự đọc file tên `CLAUDE.md` ở gốc dự án mỗi phiên — coi như "bộ nhớ dự án". Hãy nhờ nó tạo, nội dung gồm: mục tiêu hệ thống, mô tả 5 tool, các contract dữ liệu giữa tool (schema JSON xuất/nhập), và quy tắc văn phong. Câu lệnh mẫu:

> "Đọc 5 file .jsx trong thư mục này. Tạo file CLAUDE.md mô tả: kiến trúc 5 tool, luồng dữ liệu giữa chúng, và schema JSON mà mỗi tool xuất/nhập. Đây sẽ là tài liệu tham chiếu cho các phiên sau."

Lợi ích: các phiên sau không phải giải thích lại từ đầu.

### C.5. Thứ tự công việc đề xuất (chia nhỏ để mỗi việc Claude Code làm gọn)

1. **"Sửa Tool 3 export MD: đổi separator `---` thành `<!-- ARTICLE_BREAK -->`, và cập nhật parser Tool 4 đọc theo separator mới."** (việc nhỏ, làm quen công cụ)
2. **"Thêm vào Tool 2 nút Import SEO data từ Tool 5 + lưu thành seoContext + nhúng vào system prompt khi sinh prompt."**
3. **"Thêm bộ lọc 2 lớp + nút 'Lọc & chuẩn hoá theo SEO' vào Kho Prompt của Tool 2."** (đưa cho nó nguyên mục B.3 này)
4. **Nâng Tool 5 Tầng 1** (comments mining + duration sweet-spot) — vẫn client-side, chưa cần backend.
5. **Dựng backend Tool 5 Tầng 2** (transcript + autocomplete) — đây là lúc cần Node/Python server; Claude Code dựng được.
6. Tầng 3 (Reddit/Trends/Vision) khi sẵn sàng.

### C.6. Mẹo dùng Claude Code hiệu quả cho người mới

- **Mỗi yêu cầu một việc rõ ràng.** "Sửa X trong file Y để làm Z" tốt hơn "cải thiện toàn bộ hệ thống".
- **Dùng git làm lưới an toàn:** trước mỗi thay đổi lớn, `git commit`. Nếu Claude Code sửa hỏng, `git checkout .` để quay lại.
- **Bảo nó chạy thử:** "chạy `npm run dev` và sửa lỗi nếu có" — nó tự đọc lỗi và vá.
- **Xác nhận trước khi nó sửa hàng loạt file** — Claude Code thường hỏi quyền; đọc kỹ rồi mới đồng ý.
- **MCP GitHub** (tùy chọn): nếu muốn nó đọc thẳng repo, làm PR, có thể nối GitHub qua MCP (`claude mcp add github ...`) — khớp với ý "connect Claude tới GitHub repo" trong dự định của bạn.

---

## 3 việc ưu tiên (bản v2)

1. **Cài Claude Code + tạo `CLAUDE.md`** cho dự án — nền tảng cho mọi việc sau.
2. **Nối Tool 5 → Tool 2 + bộ lọc/chuẩn hoá** (yêu cầu chính, làm được ngay client-side, chưa cần backend).
3. **Nâng Tool 5 Tầng 1 (comments mining)** — giá trị cao nhất trên chi phí thấp nhất; rồi mới dựng backend cho Tầng 2 (transcript).
