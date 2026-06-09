# PROMPTS THỰC THI — Dán lần lượt vào Claude Code

> Cách dùng: mở `claude` trong thư mục dự án (đã có 5 file .jsx + `CLAUDE.md` + `PHAN_TICH_5_TOOL_v2.md`). Dán từng PROMPT theo thứ tự. Mỗi prompt là một việc gọn. Sau mỗi việc xong, `git commit` rồi mới sang prompt sau.
>
> Tất cả URL repo bên dưới đã được kiểm chứng là có thật (06/2026).

---

## PROMPT 0 — Bootstrap: clone repo tham khảo + setup môi trường

```
Đây là dự án nâng cấp một bộ 5 công cụ React/JSX cho sản xuất nội dung YouTube. Hãy đọc CLAUDE.md và PHAN_TICH_5_TOOL_v2.md trong thư mục này để nắm bối cảnh trước.

Sau đó setup môi trường tham khảo:

1. Tạo thư mục `_reference/` (thêm vào .gitignore — đây chỉ là tài liệu tham khảo, không thuộc dự án).

2. Clone các repo sau vào `_reference/`. Đây là các nguồn best-practice Claude Code đã được kiểm chứng:
   - git clone --depth 1 https://github.com/anthropics/claude-cookbooks.git
     (CHÍNH THỨC của Anthropic — recipe API: tool use, JSON mode, vision, prompt caching, skills. Đây là nguồn ưu tiên số 1.)
   - git clone --depth 1 https://github.com/hesreallyhim/awesome-claude-code.git
     (danh mục curated: skills, hooks, slash-commands, subagents — để tra cứu pattern.)
   - git clone --depth 1 https://github.com/MuhammadUsmanGM/claude-code-best-practices.git
     (wiki: CLAUDE.md templates, permission modes, hooks, cost optimization.)
   - git clone --depth 1 https://github.com/ChrisWiles/claude-code-showcase.git
     (ví dụ cấu hình .claude/ hoàn chỉnh: hooks, skills, agents, commands.)

3. Đọc lướt README của từng repo. Rút ra: (a) cấu trúc thư mục .claude/ nên có, (b) pattern hooks hữu ích cho dự án này (vd chặn commit secret, format-on-write), (c) cách viết slash-command tái dùng. KHÔNG copy nguyên xi — chỉ học pattern.

4. Đề xuất cho riêng dự án này: một cấu trúc .claude/ tối thiểu (settings + 1-2 hook an toàn) phù hợp với một dự án React/JSX nhiều file độc lập. Trình bày kế hoạch, CHỜ tôi xác nhận trước khi tạo file.

Đừng cài gì nặng. Repo tham khảo chỉ để đọc.
```

> *Ghi chú: nếu sau này làm Tool 5 backend bằng Python, prompt riêng sẽ thêm: `pip install youtube-transcript-api` (thư viện jdepoix — lấy transcript không cần API key) và `google-api-python-client`. Chưa cần ở bước này.*

### Trước Prompt 0 — cài RTK (tiết kiệm token, làm 1 lần, ngoài Claude Code)

RTK lọc rác output lệnh terminal trước khi vào context → session dài gấp ~3 lần. Chạy trong terminal thường (không phải trong claude):
```bash
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
rtk init -g          # gắn hook cho Claude Code
# restart Claude Code sau bước này
```
Kiểm tra sau vài phiên: `rtk gain`. Chi tiết + lý do không dùng Caveman/Hermes lúc này: xem `CONG_CU_HO_TRO.md`.

---

## PROMPT 1 — Việc khởi động (nhỏ, làm quen): sửa separator MD

```
Mục tiêu: T3 và T4 đang dùng "---" làm ranh giới giữa các bài trong file Markdown. Nếu nội dung bài (script) có chứa đường kẻ ngang markdown "---", T4 sẽ cắt nhầm 1 bài thành nhiều bài.

Việc cần làm:
1. Trong ContentStudio_Tool3.jsx, hàm exportMarkdown(): đổi separator giữa các bài từ "\n---\n" sang "\n\n<!-- ARTICLE_BREAK -->\n\n".
2. Trong ReviewStudio_Tool4.jsx, hàm parseMDImport(): tách bài theo "<!-- ARTICLE_BREAK -->". Nhưng PHẢI tương thích ngược: nếu file không có marker đó thì fallback về tách theo "---" như cũ.
3. Không đổi gì khác. Chạy thử lint nếu có. Tóm tắt diff cho tôi.
```

---

## PROMPT 2 — Nối Tool 5 → Tool 2 (import SEO data)

```
Mục tiêu: Tool 2 hiện không nạp được file seo-data-*.json của Tool 5. Cần thêm đường nạp + dùng SEO data làm context khi sinh prompt.

Đọc trước: trong CLAUDE.md mục 4, contract T5 → T2 mô tả cấu trúc file seo-data. Trong Tool5_SEO.jsx, hàm exportForTool2() là nơi tạo file đó — đọc để biết schema chính xác.

Việc cần làm trong ChannelPromptStudio_Tool2.jsx:
1. Thêm state `seoContext` (mặc định null) + lưu vào checkpoint/auto-save như các state khác.
2. Thêm nút "Import SEO data (Tool 5)" trong khu Cấu hình (gần nút import blueprint). Click → đọc file JSON → validate có trường `tool === "tool5-seo-research"` → set seoContext. Báo lỗi rõ nếu sai định dạng. Hiện một thẻ tóm tắt khi đã nạp: topic, opportunity score/level, số savedKeywords, số realTags.
3. Cho phép xoá seoContext (nút ×).
4. Khi sinh prompt (cả runGenerateNormal và runGenerateSync): nếu có seoContext, chèn thêm một khối vào system prompt, đại ý:
   "# DỮ LIỆU SEO THẬT (từ nghiên cứu YouTube, bám sát thay vì bịa)
   - Từ khoá ưu tiên (đưa vào title/description): <savedKeywords + keywordCandidates>
   - Title pattern đã chứng minh hiệu quả: <ai.titlePatterns>
   - Tag thật nên dùng: <ai.tags + realTags>
   - Long-tail tiềm năng: <ai.extraKeywords>
   - Độ cạnh tranh: opportunity <score>/100 (<level>).
   Với loại seo_title và description, BẮT BUỘC nhồi ít nhất 1 từ khoá ưu tiên vào 40 ký tự đầu."
   Chỉ chèn các trường thực sự có; bỏ qua trường rỗng để tiết kiệm token.
5. Giữ tương thích ngược: không có seoContext thì hành vi y như cũ.

Trình bày kế hoạch sửa (hàm nào, thêm gì) rồi thực hiện. Sau đó tóm tắt diff.
```

---

## PROMPT 3 — Bộ lọc & chuẩn hoá prompt theo SEO (yêu cầu chính)

```
Mục tiêu: sau khi Tool 2 sinh prompt, cần lọc bỏ prompt chưa đạt và chuẩn hoá phần còn lại theo SEO data. Đây là tính năng "Lọc & chuẩn hoá theo SEO".

Bối cảnh: yêu cầu này mô tả chi tiết trong PHAN_TICH_5_TOOL_v2.md, Phần B.3, "Bộ lọc 2 lớp". Đọc kỹ trước.

Việc cần làm trong ChannelPromptStudio_Tool2.jsx:

1. Thêm nút "Lọc & chuẩn hoá theo SEO" trong khu Kho Prompt. Nút chỉ bật khi có prompt trong kho. Nếu chưa có seoContext, vẫn chạy được nhưng cảnh báo "chưa có SEO data, chỉ lọc cơ học".

2. LỚP 1 — lọc cơ học (không gọi API), chạy trên các prompt CHƯA được chuẩn hoá:
   - Loại prompt có nội dung quá ngắn (đặt ngưỡng hợp lý, vd < 40 ký tự cho prompt văn bản).
   - Với category seo_title và description: nếu seoContext có keyword, loại (đánh dấu "off-SEO") prompt không chứa BẤT KỲ keyword nào trong (savedKeywords ∪ keywordCandidates ∪ ai.extraKeywords), so khớp không phân biệt hoa thường + bỏ dấu.
   - Đánh dấu (không xoá vội) để tôi xem được cái gì sắp bị loại.

3. LỚP 2 — chấm điểm + chuẩn hoá bằng MỘT call Claude gộp cả lô (tiết kiệm chi phí):
   - Gom các prompt còn lại (sau lớp 1) thành 1 mảng, kèm seoContext, gửi 1 request.
   - System prompt yêu cầu Claude trả về DUY NHẤT một JSON array, mỗi phần tử:
     { "id": "<id gốc>", "keep": true/false, "score": 0-100, "reason": "<ngắn gọn>",
       "normalizedTitle": "<title đã chuẩn hoá>", "normalizedPrompt": "<prompt đã chuẩn hoá>" }
   - Tiêu chí: bám SEO data thật + chất lượng prompt; keep=false nếu score < ngưỡng (vd 60).
   - Chuẩn hoá: nhồi keyword chính vào 40 ký tự đầu title; ép quy tắc văn phong ở CLAUDE.md mục 5 (không Title Case, không em-dash); gắn tag thật phù hợp vào cuối prompt nếu là loại text.
   - Nếu lô lớn, chia batch ~15-20 prompt/call để tránh chạm token. Parse an toàn (dùng helper extractJSONArray sẵn có).

4. Áp kết quả: prompt keep=true → thay title/prompt bằng bản normalized, gắn cờ `_seoChecked = true` + lưu `_seoScore`, `_seoReason`. prompt keep=false → KHÔNG xoá ngay; chuyển vào một danh sách "Bị loại (chờ xác nhận)" hiển thị score + reason, có nút "Khôi phục" và "Xoá hẳn". Quyết định cuối thuộc về người dùng.

5. Idempotent: prompt đã `_seoChecked` thì lần chạy sau bỏ qua (trừ khi người dùng bấm "Chuẩn hoá lại").

6. Hiển thị: trong thẻ mỗi prompt, thêm badge điểm SEO khi đã check.

Trình bày kế hoạch chi tiết (state mới, hàm mới, thay đổi UI) rồi CHỜ tôi xác nhận trước khi code, vì đây là tính năng lớn.
```

---

## PROMPT 4 — Map đầy đủ blueprint T1 → T2

```
Mục tiêu: hàm mapBlueprintToChannel trong Tool 2 chỉ lấy title của content_pillars rồi bỏ phần còn lại. Blueprint của Tool 1 còn nhiều dữ liệu giá trị bị lãng phí.

Việc cần làm trong ChannelPromptStudio_Tool2.jsx:
1. Mở rộng mapBlueprintToChannel để tận dụng thêm: content_pillars[].example_topics, first_10_video_ideas, growth_strategy.hook_formula, competitive_advantages.
2. Các dữ liệu này không khớp 1-1 với CHANNEL_FIELDS, nên gom chúng vào một context phụ (vd state `blueprintExtras`) và CHÈN vào system prompt khi sinh — đặc biệt first_10_video_ideas làm seed cho loại video_script, hook_formula làm gợi ý mở bài.
3. Giữ tương thích ngược với blueprint thiếu trường.
Trình bày diff.
```

---

## PROMPT 5 — Nâng Tool 5 Tầng 1 (client-side, comments + duration)

```
Mục tiêu: nâng cấp Tool 5 với 2 tính năng giá trị cao mà vẫn chạy client-side (chỉ YouTube Data API key, không cần backend).

Đọc trước: PHAN_TICH_5_TOOL_v2.md Phần B.1 "Tầng 1" và B.0 (ràng buộc quota — commentThreads.list chỉ 1 unit/call, search.list 100 units/call).

Việc cần làm trong Tool5_SEO.jsx:

1. COMMENTS MINING:
   - Sau khi có top video, thêm bước (tuỳ chọn, có nút bật để không tốn quota ngoài ý muốn): với top 5-8 video, gọi commentThreads.list (part=snippet, maxResults=100, order=relevance) lấy top comment.
   - Đếm và hiển thị quota ước tính trước khi chạy (mỗi call ~1 unit).
   - Gộp comment → gửi Claude phân tích → trả về: câu hỏi chưa được giải đáp, lời phàn nàn lặp lại, mong muốn khán giả, "content gap". Lưu vào state `audiencePain` + `contentGaps`.

2. DURATION SWEET-SPOT:
   - Tool đã lấy contentDetails.duration (ISO8601). Parse sang giây, vẽ phân bố độ dài video top, tính median + khoảng phổ biến. Hiển thị "điểm ngọt độ dài". Lưu `durationSweetSpot`.

3. EXPORT: mở rộng exportForTool2() thêm các trường mới (audiencePain, contentGaps, durationSweetSpot), bump version sang "tool5-seo-v2". Giữ tương thích: Tool 2 đọc file v1 vẫn chạy.

4. Quản lý quota: thêm bộ đếm units tiêu thụ trong phiên + cảnh báo khi gần 10.000.

Trình bày kế hoạch rồi thực hiện. Lưu ý xử lý lỗi quota (403 quotaExceeded) như code hiện có.
```

---

## PROMPT 6 — Tool 5 Tầng 2 (backend transcript + autocomplete)

```
Mục tiêu: thêm các nguồn data cần backend mà browser không làm được (transcript, autocomplete). Đây là bước tách Tool 5 thành app có server.

Đọc trước: PHAN_TICH_5_TOOL_v2.md Phần B.1 "Tầng 2" và B.0 (transcript KHÔNG lấy được qua YouTube Data API — phải dùng youtube-transcript-api của jdepoix, không cần key; Reddit/Trends/autocomplete vướng CORS).

Việc cần làm:
1. Dựng một backend tối thiểu (đề xuất Python FastAPI hoặc Node Express — bạn chọn cái phù hợp rồi giải thích lý do) trong thư mục `server/`, với 2 endpoint:
   - GET /transcript?videoId=... → dùng youtube-transcript-api (pip install youtube-transcript-api) lấy phụ đề, trả text. Xử lý video không có phụ đề (trả lỗi rõ ràng, không crash).
   - GET /autocomplete?q=...&lang=... → proxy gọi endpoint gợi ý YouTube, né CORS, trả mảng gợi ý.
2. Thêm .env.example cho cấu hình (port, v.v.). README ngắn cách chạy server.
3. Sửa Tool5_SEO.jsx: thêm cấu hình "Backend URL" (mặc định http://localhost:8000). Khi có backend, thêm bước lấy transcript top 3 video → Claude phân tích cấu trúc kịch bản + content gap (lưu `transcriptInsights`); lấy autocomplete cho seed keyword (lưu `autocompleteLongTail`). Nếu backend không chạy, tính năng này ẩn/disable gọn gàng, phần còn lại của tool vẫn hoạt động.
4. Export bổ sung transcriptInsights + autocompleteLongTail.

Trình bày kế hoạch kiến trúc (server framework, cấu trúc thư mục, cách Tool 5 gọi) rồi CHỜ xác nhận trước khi tạo file. Tham khảo anthropics/claude-cookbooks trong _reference/ cho pattern gọi Claude API phía server nếu cần.
```

---

## PROMPT 7 — (tuỳ chọn, làm sau) Tầng 3 + đóng vòng lặp Review

```
Hai việc, làm khi các bước trên đã ổn định:

A. Tool 5 Tầng 3: thêm vào backend các nguồn Reddit (top post theo chủ đề — cần đăng ký Reddit app, OAuth), Google Trends (thư viện scraping), và thumbnail vision (lấy link maxresdefault của top 5 → gửi Claude vision phân tích màu/bố cục chung → đề xuất concept tương phản). Mỗi nguồn là một endpoint riêng, bật/tắt độc lập, hỏng một cái không kéo sập cả tool.

B. Tool 4 đóng vòng lặp: hiện Review là ngõ cụt. Thêm (1) một vai "phản biện" — reviewer thách thức luận điểm/độ chắc của lập luận (theo quy trình kiểm-duyệt → phản-biện → cải-thiện); (2) nút export bài đã duyệt theo đúng format mà Tool 2 hoặc Tool 3 nhập lại được, để tái sản xuất biến thể.

Trình bày kế hoạch từng phần, làm A và B tách biệt, mỗi phần commit riêng.
```

---

## Phụ lục — Repo tham khảo đã kiểm chứng (06/2026)

| Repo | URL | Dùng để |
|---|---|---|
| **claude-cookbooks** (CHÍNH THỨC Anthropic) | `github.com/anthropics/claude-cookbooks` | Recipe API thật: tool use, JSON mode, vision, prompt caching, skills. Nguồn ưu tiên. |
| **awesome-claude-code** | `github.com/hesreallyhim/awesome-claude-code` | Danh mục curated skills/hooks/commands/subagents. |
| **claude-code-best-practices** | `github.com/MuhammadUsmanGM/claude-code-best-practices` | CLAUDE.md templates, permission modes, hooks, cost optimization. |
| **claude-code-showcase** | `github.com/ChrisWiles/claude-code-showcase` | Ví dụ cấu hình `.claude/` đầy đủ (hooks/skills/agents/commands). |
| **awesome-claude-code-toolkit** | `github.com/rohitg00/awesome-claude-code-toolkit` | Toolkit cài đặt được: agents/skills/commands/hooks số lượng lớn (tham khảo nâng cao). |
| **youtube-transcript-api** (cho Tool 5 backend) | `github.com/jdepoix/youtube-transcript-api` | Lấy transcript YouTube không cần API key. `pip install youtube-transcript-api`. |

Tài liệu chính thức Claude Code: `https://docs.claude.com/en/docs/claude-code/overview`
Bản đồ docs (cho Claude Code tự tra): `https://docs.anthropic.com/en/docs/claude-code/claude_code_docs_map.md`
