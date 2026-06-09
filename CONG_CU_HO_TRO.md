# Bộ công cụ hỗ trợ Claude Code — Nên dùng cái nào cho dự án này?

> Đánh giá thẳng thắn 4 công cụ bạn đưa: **RTK, Caveman, Hermes Agent** (và đối chiếu với repo best-practice ở file PROMPTS_THUC_THI). Điều quan trọng phải hiểu trước: **không cái nào sửa code 5 tool của bạn**. Chúng tối ưu *cách bạn vận hành agent* (tiết kiệm token, bộ nhớ, hạ tầng). Đó là lý do phải phân loại kỹ kẻo cài nhầm thứ không cần.

---

## Phân loại theo "lớp" tác động

```
LỚP CODE (sửa 5 tool)          ← các PROMPT 0-7 trong PROMPTS_THUC_THI.md làm việc này
        │
LỚP VẬN HÀNH AGENT (tiết kiệm token, bộ nhớ)  ← RTK, Caveman, Hermes nằm ở đây
        │
LỚP HẠ TẦNG (chạy agent ở đâu)               ← Hermes (nếu muốn self-hosted)
```

Bạn đang ở giai đoạn **sửa code**. Lớp vận hành chỉ là gia vị — dùng đúng thì session dài hơn, rẻ hơn; dùng sai thì thêm phức tạp không cần thiết.

---

## 1. RTK (Rust Token Killer) — ✅ NÊN DÙNG NGAY

**Nó là gì:** proxy CLI lọc rác từ output lệnh terminal (`git status`, `npm test`...) trước khi vào context Claude Code. Cài 1 hook `PreToolUse`, hoàn toàn trong suốt.

**Vì sao hợp dự án này:** bạn sẽ chạy `npm run dev`, `git status`, `npm install`… liên tục khi Claude Code build/test 5 tool + backend Tool 5. Mỗi lệnh "ăn" token vô ích. RTK cắt ~80-90% phần đó → **session kéo dài gấp ~3 lần** trước khi chạm giới hạn.

**Rủi ro:** thấp. MIT, single binary, không cần key/account. Gỡ dễ (`rtk init -g --uninstall`).

**Khuyến nghị:** cài **trước** khi bắt đầu Prompt 1. Lệnh:
```bash
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
rtk init -g          # cho Claude Code
# restart Claude Code
```
Sau đó `rtk gain` để xem đã tiết kiệm bao nhiêu.

> ⚠️ Lưu ý nhỏ: hook RTK **chỉ chạy trên lệnh Bash**. Các tool Read/Grep/Glob built-in của Claude Code không qua RTK. Không sao — phần lệnh terminal mới là phần ngốn token nhất.

---

## 2. Caveman — ⚠️ DÙNG CÓ CHỌN LỌC

**Nó là gì:** skill ép AI trả lời kiểu "người nguyên thủy", cắt 65-75% token *output* của AI. Có chế độ, sub-agent, thống kê.

**Vì sao cân nhắc, không cài mặc định:**
- Bạn là người **mới dùng Claude Code**. Giai đoạn này bạn CẦN agent giải thích đầy đủ kế hoạch trước khi sửa — đúng cái Caveman cắt đi. Trả lời cụt lủn dễ khiến bạn không kiểm soát được nó đang làm gì.
- Caveman tự nhận giữ nguyên code block, commit, cảnh báo bảo mật — nên về kỹ thuật khá an toàn. Nhưng giá trị thật của nó là khi bạn **đã quen** và muốn agent bớt lải nhải.

**Khuyến nghị:** **chưa cài ở giai đoạn đầu.** Khi đã làm xong vài Prompt và thấy thoải mái, có thể bật theo phiên bằng cách gõ `"be brief"` hoặc cài skill:
```bash
npx skills add JuliusBrussee/caveman
```
Hai skill con đáng giá độc lập (có thể dùng mà không cần caveman-mode toàn cục): `caveman-commit` (commit message gọn, đúng Conventional Commits) và `caveman-review` (review diff 1 dòng). Hợp với quy ước "một thay đổi một commit" của dự án.

> RTK + Caveman bổ trợ nhau: RTK cắt token *input* (output lệnh), Caveman cắt token *output* (lời AI). Nhưng cắt cả hai ngay từ đầu khi đang học là quá tay.

---

## 3. Hermes Agent — ❌ KHÔNG DÙNG CHO DỰ ÁN NÀY (giải thích vì sao)

**Nó là gì:** một **AI agent độc lập, riêng biệt** của NousResearch — KHÔNG phải plugin cho Claude Code. Nó tự build "skill document" (markdown tích luỹ theo thời gian), có bộ nhớ bền, chạy local/Docker/SSH, nối Telegram/Discord/Slack, dùng model qua OpenRouter/vLLM.

**Vì sao KHÔNG hợp lúc này:**
- Nó **thay thế** Claude Code, không bổ sung. Bạn vừa quyết định học Claude Code — thêm một agent thứ hai với triết lý vận hành khác sẽ phân tán, không giúp dự án 5 tool tiến nhanh hơn.
- Giá trị cốt lõi của Hermes (bộ nhớ tự tích luỹ qua nhiều tháng) là dành cho người vận hành agent **lâu dài, đa dự án, đa kênh chat**. Dự án của bạn hiện là một codebase cụ thể, hữu hạn — `CLAUDE.md` + git đã lo phần "bộ nhớ" đủ tốt rồi.
- Cài đặt nặng hơn nhiều (uv, Python 3.11, gateway service...). Chi phí học gấp đôi.

**Khi nào quay lại Hermes:** nếu sau này bạn muốn một "trợ lý thường trực" nhớ toàn bộ hệ sinh thái công việc của bạn qua nhiều tháng và điều khiển qua Telegram — lúc đó Hermes rất đáng. **Không phải bây giờ.**

> Một ý hay có thể mượn từ Hermes mà KHÔNG cần cài nó: ý tưởng **skill document tự tích luỹ**. Bạn có thể bắt Claude Code làm điều tương tự thủ công — xem mục "Mẹo" cuối file.

---

## 4. Đối chiếu với repo best-practice (đã đề xuất ở PROMPTS_THUC_THI)

| Công cụ | Lớp | Dùng cho dự án này? | Khi nào |
|---|---|---|---|
| **RTK** | Vận hành (token input) | ✅ Có | Cài ngay, trước Prompt 1 |
| **Caveman** (skill con) | Vận hành (token output) | ⚠️ Một phần | `caveman-commit` / `caveman-review` khi đã quen |
| **Hermes Agent** | Hạ tầng (agent riêng) | ❌ Không | Để dành cho nhu cầu "trợ lý thường trực" tương lai |
| **claude-cookbooks** (Anthropic) | Tham khảo code | ✅ Có | Clone ở Prompt 0 — pattern gọi API thật |
| **awesome-claude-code** | Tham khảo | ✅ Có | Tra cứu khi cần skill/hook |
| **claude-code-best-practices** | Tham khảo | ✅ Có | Học CLAUDE.md/hooks |

**Kết luận một câu:** với dự án 5 tool, **chỉ cần thêm RTK** vào quy trình. Caveman để sau. Hermes không liên quan giai đoạn này.

---

## Mẹo: mượn ý "skill tự tích luỹ" của Hermes mà không cài Hermes

Cuối mỗi phiên Claude Code làm xong việc khó, gõ:
```
Việc vừa rồi có pattern/cách giải nào đáng lưu để lần sau không phải mò lại không?
Nếu có, ghi ngắn gọn vào file _learnings/<tên-ngắn>.md (tạo thư mục nếu chưa có),
và thêm 1 dòng tham chiếu vào cuối CLAUDE.md mục 7.
```
Đây là phiên bản thủ công, nhẹ, của "skill document" — đủ cho một codebase, không cần cả hệ thống Hermes.

---

## Tóm tắt hành động

1. **Cài RTK trước tiên** → session dài gấp 3, rẻ hơn ngay từ Prompt 1.
2. **Bỏ qua Caveman + Hermes lúc này.** Quay lại Caveman (`caveman-commit`, `caveman-review`) khi đã quen tay.
3. Tiến hành Prompt 0 → 7 trong `PROMPTS_THUC_THI.md` như kế hoạch.
4. Dùng mẹo `_learnings/` để tích luỹ kinh nghiệm — thay cho Hermes.
