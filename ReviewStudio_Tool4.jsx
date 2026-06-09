import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Upload, Download, Sparkles, Cpu, Brain, ChevronDown, ChevronRight, Check, X, Trash2,
  RefreshCw, Loader2, AlertTriangle, FileJson, FileText, Wand2, ShieldCheck, ShieldAlert,
  Play, Pause, FolderInput, ClipboardCheck, ScrollText, Layers, Save, Copy, Edit3,
  CheckCircle2, XCircle, Clock, AlertCircle, FileCheck2, Eye, EyeOff, ListChecks,
  SlidersHorizontal,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════════
   TOOL 4 — REVIEW STUDIO  (Module 4 / 5)
   Nhận bài từ Tool 3 → chạy 6 reviewer song song → phiếu DUYỆT/TỪ CHỐI.
   • Nguồn luật: skill "viet-chuyen-nghiep" — review/ (6 file md đã ngấm).
   • 6 reviewer: punctuation, capitalization, natural, anti-ai, consistency, fact-check.
   • Tất cả chạy song song (Promise.allSettled) — mỗi cái 1 callClaude riêng.
   • Auto-fix: tổng hợp issues → 1 prompt sửa toàn bài → diff hiển thị.
   • Checkpoint 3 lớp:
       1) Auto-save window.storage (debounce 800ms) — luôn chạy.
       2) Export JSON checkpoint thủ công — đề phòng mất storage.
       3) Granular save từng reviewer xong → resume chỉ chạy reviewer pending.
   API tuân Claude.md: output_config.effort + adaptive thinking + beta header.
   ════════════════════════════════════════════════════════════════════ */

const FONT = '"Söhne", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO = 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace';

const DEFAULT_MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5",  badge: "Nhanh",       color: "#d97706" },
  { id: "claude-sonnet-4-6",         label: "Sonnet 4.6", badge: "Khuyên dùng", color: "#0d9488" },
  { id: "claude-opus-4-6",           label: "Opus 4.6",   badge: "",            color: "#7c3aed" },
  { id: "claude-opus-4-7",           label: "Opus 4.7",   badge: "",            color: "#7c3aed" },
  { id: "claude-opus-4-8",           label: "Opus 4.8",   badge: "Mạnh nhất",   color: "#6d28d9" },
];

const EFFORT_LEVELS = [
  { id: "low",    label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high",   label: "High", isDefault: true },
  { id: "max",    label: "Max" },
];

const PRICING = {
  "claude-haiku-4-5-20251001": { input: 1.00,  output: 5.00  },
  "claude-sonnet-4-6":         { input: 3.00,  output: 15.00 },
  "claude-opus-4-6":           { input: 15.00, output: 75.00 },
  "claude-opus-4-7":           { input: 5.00,  output: 25.00 },
  "claude-opus-4-8":           { input: 15.00, output: 75.00 },
};

const CHECKPOINT_VERSION = "tool4-reviewstudio-v1";
const STORAGE_KEY = "tool4_reviewstudio_autosave";

const ARTICLE_TYPES = [
  { v: "auto",         label: "Tự nhận diện" },
  { v: "storytelling", label: "Kể chuyện / Essay / Blog" },
  { v: "technical",    label: "Tài liệu / How-to / List" },
  { v: "social",       label: "Mạng xã hội (FB, post ngắn)" },
  { v: "voiceover",    label: "Kịch bản voice-over" },
];

const LANG_OPTIONS = [
  { v: "auto", label: "Tự nhận diện" },
  { v: "vi",   label: "Tiếng Việt" },
  { v: "en",   label: "English" },
];

/* ════════════════════════════════════════════════════════════════════
   2 REVIEWER AI — chỉ giữ Chống AI + Kiểm chứng (4 reviewer cơ học đã bỏ,
   thay bằng regex mechanicalCleanup chạy 0 token + luật nghiêm ngặt ở Tool 1/2/3).
   ════════════════════════════════════════════════════════════════════ */

const REVIEWERS = [
  {
    id: "antiAI",
    label: "Chống AI",
    icon: "ShieldAlert",
    color: "#f59e0b",
    required: true,
    description: "Pattern AI: từ cấm, over-format, transition overuse, hedge, uniformity",
  },
  {
    id: "factCheck",
    label: "Kiểm chứng",
    icon: "ShieldCheck",
    color: "#ef4444",
    required: true,
    description: "Số liệu, quote, claims — nghiêm ngặt hơn cho kênh y tế/sức khỏe",
  },
];

/* ─── SYSTEM PROMPTS cho từng reviewer ──
   Trả về JSON THUẦN. excerpt = đoạn lỗi NGUYÊN VĂN trong bài (để targeted-fix replace được). */

/* ════════════════════════════════════════════════════════════════════
   TỪ CẤM & CLICHÉ AI (chắt lọc từ meta-prompt-executor, áp cho kênh tiếng Việt)
   Dùng cho: (1) reviewer Chống AI tham chiếu, (2) regex cảnh báo dự phòng.
   ════════════════════════════════════════════════════════════════════ */
const BANNED_PHRASES_VI = [
  "trong thế giới ngày nay", "trong xã hội hiện đại", "ngày nay trong xã hội",
  "bạn có bao giờ", "hành trình", "khám phá", "bức tranh toàn cảnh",
  "bí mật", "thay đổi hoàn toàn", "chinh phục", "đồng hành", "nắm bắt cơ hội",
  "không thể phủ nhận rằng", "đáng kinh ngạc", "thay đổi cuộc chơi",
];
// Từ nối dễ bị lạm dụng (transition overuse)
const TRANSITION_WORDS_VI = ["tuy nhiên", "bên cạnh đó", "ngoài ra", "hơn nữa", "mặt khác", "đặc biệt là", "chính vì vậy"];

/* ─── SYSTEM PROMPTS — chỉ 2 reviewer AI ──
   excerpt PHẢI là đoạn NGUYÊN VĂN trong bài (copy chính xác) để targeted-fix replace được. */

const REVIEWER_PROMPTS = {
  antiAI: (lang, ctx = {}) => `Bạn là biên tập viên kỳ cựu chuyên PHÁT HIỆN VĂN AI. Ngôn ngữ bài: ${lang === "en" ? "tiếng Anh" : "tiếng Việt"}.

Bạn soi 3 nhóm dấu hiệu. Với mỗi lỗi, trích NGUYÊN VĂN đoạn lỗi (copy chính xác để người khác tìm và thay được) kèm đề xuất thay thế.

NHÓM 1 - CỤM TỪ CLICHÉ / SÁO RỖNG (nghiêm trọng nhất):
${lang === "vi" ? `Truy các cụm: "${BANNED_PHRASES_VI.join('", "')}". Mỗi cụm xuất hiện = 1 lỗi "banned_phrase" severity high. Đề xuất câu thay cụ thể, viết lại tự nhiên như người thật nói.` : `Hunt clichés: "in today's world", "have you ever", "journey", "unlock", "dive in", "game-changer", "it's no secret", "the world of". Each = "banned_phrase" high.`}

NHÓM 2 - PATTERN CẤU TRÚC AI:
- transition_overuse: ${lang === "vi" ? `đếm từ nối "${TRANSITION_WORDS_VI.join('", "')}". Nếu 1 từ lặp >3 lần → lỗi, nêu rõ số lần trong excerpt.` : `"However"/"Moreover"/"Furthermore" repeated >3 times.`}
- paragraph_uniformity: nhiều đoạn dài đều nhau (đều ~80-120 từ) liên tiếp → văn AI. Người thật có đoạn 1 câu, đoạn dài.
- cautious_hedging: ${lang === "vi" ? `lạm dụng "có thể", "thường", "đôi khi", "nhìn chung" ở mọi claim.` : `over-hedging "may/might/often/generally".`}
- over_formatting: bullet/heading/bold giữa văn kể chuyện; nhãn "Lưu ý:", "Tóm lại:", "Key:".
- balanced_structure: mọi ý phát triển đều y nhau 1 đoạn (người thật nói nhiều ý này, lướt ý kia).

NHÓM 3 - GIỌNG GIẢ:
- professional_smoothness: quá mượt, mọi câu cân đối, không có chỗ "gồ ghề" tự nhiên.
- generic_filler: câu đệm rỗng không thêm thông tin ("Điều này rất quan trọng", "Hãy cùng tìm hiểu").

QUAN TRỌNG: KHÔNG bắt lỗi dấu câu, viết hoa, em-dash, chính tả — đã có bộ phận khác lo. Chỉ tập trung CHẤT VĂN.

TRẢ LỜI BẰNG JSON THUẦN, KHÔNG BACKTICKS:
{
  "passed": boolean,
  "score": 0-10 (10 = đậm chất người, 0 = AI rõ),
  "summary": "1 câu nêu pattern AI nổi bật nhất",
  "issues": [
    {
      "type": "banned_phrase|transition_overuse|paragraph_uniformity|cautious_hedging|over_formatting|balanced_structure|professional_smoothness|generic_filler|other",
      "severity": "low|medium|high",
      "excerpt": "đoạn NGUYÊN VĂN trong bài (copy chính xác, ≤120 ký tự)",
      "fix": "đoạn viết lại để THAY THẾ trực tiếp excerpt (giữ ý, tự nhiên hơn). Nếu lỗi toàn cục không thay 1 đoạn được thì để chuỗi rỗng."
    }
  ]
}
passed=true khi score>=8 và không có lỗi high.`,

  factCheck: (lang, ctx = {}) => {
    const strict = ctx.verifyLevel === "strict";
    const niche = ctx.niche || "";
    return `Bạn là KIỂM CHỨNG VIÊN${strict ? " Y KHOA NGHIÊM NGẶT" : ""}. Ngôn ngữ: ${lang === "en" ? "tiếng Anh" : "tiếng Việt"}.${niche ? ` Lĩnh vực kênh: ${niche}.` : ""}

CHẾ ĐỘ: ${strict ? "NGHIÊM NGẶT (kênh y tế/sức khỏe/khoa học)" : "TIÊU CHUẨN (kênh phổ thông)"}.

NHIỆM VỤ: Tìm mọi CLAIM kiểm chứng được: số liệu/thống kê, trích dẫn, năm tháng, tên tổ chức/sản phẩm, claim mạnh ("luôn", "không bao giờ", "chứng minh rằng").

${strict ? `VÌ LÀ KÊNH Y TẾ/SỨC KHỎE — RẤT NGHIÊM:
- MỌI claim về sức khỏe, liều lượng, triệu chứng, cơ chế bệnh, tác dụng thuốc/thực phẩm PHẢI có cơ sở. Không có nguồn rõ → đánh dấu high.
- Claim kiểu "chữa được", "ngăn ngừa", "giảm X%" mà không nguồn uy tín (WHO, CDC, NIH, tạp chí bình duyệt, hướng dẫn bộ y tế) → high, yêu cầu bổ sung nguồn hoặc gỡ.
- Phân biệt rõ tương quan vs nhân quả. Claim nhân quả không bằng chứng → high.
- Cảnh báo nếu bài đưa lời khuyên y tế trực tiếp mà thiếu khuyến nghị "tham khảo bác sĩ".
- Trong "fix", đề xuất cách hedge an toàn HOẶC ghi rõ "[CẦN NGUỒN: ...]" để người viết tự bổ sung.` : `KÊNH PHỔ THÔNG — kiểm vừa phải:
- Đánh dấu số liệu quá "đẹp"/tròn trịa nghi bịa (100%, đúng 10 lần, "90% mọi người").
- Đánh dấu claim mạnh tuyệt đối thiếu dẫn chứng.
- Quote gán cho người nổi tiếng mà nghi không chính xác.
- KHÔNG cần soi từng con số nhỏ nếu bài chỉ mang tính minh hoạ/ví dụ ("giả sử", "ví dụ").`}

KHÔNG TỰ TRA WEB (không có quyền). Chỉ đánh dấu dựa trên kiến thức + tính hợp lý nội tại, và gắn cờ "cần người tự kiểm chứng" khi không chắc.

TRẢ LỜI BẰNG JSON THUẦN, KHÔNG BACKTICKS:
{
  "passed": boolean,
  "score": 0-10,
  "summary": "1 câu",
  "issues": [
    {
      "type": "unsourced_statistic|suspicious_number|unsourced_quote|causal_overreach|missing_disclaimer|overstated|other",
      "severity": "low|medium|high",
      "excerpt": "claim NGUYÊN VĂN trong bài (copy chính xác, ≤120 ký tự)",
      "fix": "đoạn viết lại để THAY THẾ (hedge an toàn / thêm '[CẦN NGUỒN]' / gỡ claim). Rỗng nếu không thể."
    }
  ]
}
${strict ? "passed=true CHỈ khi không còn claim high nào chưa có nguồn." : "passed=true khi score>=7 và không có lỗi high."}
Nếu bài không có claim: passed:true, score:10, issues:[].`;
  },
};

/* ════════════════════════════════════════════════════════════════════
   MECHANICAL CLEANUP — regex DỰ PHÒNG (0 token, deterministic)
   Quét + tự sửa lỗi cơ học mà Tool 1/2/3 lẽ ra đã chặn. An toàn cho tiếng Việt.
   Trả về { cleaned, changes: [{type, count}] }. KHÔNG đụng nếu lang=en (em-dash hợp lệ).
   ════════════════════════════════════════════════════════════════════ */
function mechanicalCleanup(text, lang) {
  if (!text) return { cleaned: text, changes: [] };
  let s = text;
  const changes = [];
  const track = (type, before) => { if (before !== s) { changes.push({ type, count: 1 }); } };

  // 1. Em-dash / en-dash → " - " (chỉ tiếng Việt; tiếng Anh giữ em-dash)
  if (lang === "vi") {
    let b = s;
    // "—" hoặc "–" có thể dính chữ hai bên → chuẩn hoá thành " - "
    const emCount = (s.match(/[—–]/g) || []).length;
    if (emCount) {
      s = s.replace(/\s*[—–]\s*/g, " - ");
      changes.push({ type: "em_dash → ' - '", count: emCount });
    }
    track("normalize", b);
  }

  // 2. Khoảng trắng thừa trước dấu câu . , ! ? ; : (mọi ngôn ngữ)
  const spaceBefore = (s.match(/\s+[.,!?;:]/g) || []).length;
  if (spaceBefore) {
    s = s.replace(/\s+([.,!?;:])/g, "$1");
    changes.push({ type: "xoá cách trước dấu câu", count: spaceBefore });
  }

  // 3. Double space → single (giữ xuống dòng)
  const dbl = (s.match(/[^\S\n]{2,}/g) || []).length;
  if (dbl) {
    s = s.replace(/[^\S\n]{2,}/g, " ");
    changes.push({ type: "gộp khoảng trắng kép", count: dbl });
  }

  // 4. Oxford comma tiếng Việt: ", và " / ", hoặc " → " và " / " hoặc "
  if (lang === "vi") {
    const ox = (s.match(/,\s+(và|hoặc)\s/g) || []).length;
    if (ox) {
      s = s.replace(/,(\s+(?:và|hoặc)\s)/g, "$1");
      changes.push({ type: "bỏ phẩy trước 'và/hoặc'", count: ox });
    }
  }

  // 5. Title Case ở HEADING tiếng Việt (dòng bắt đầu bằng #) → sentence case
  if (lang === "vi") {
    let headingFixed = 0;
    s = s.split("\n").map(line => {
      const m = line.match(/^(#{1,6}\s+)(.*)$/);
      if (!m) return line;
      const prefix = m[1];
      let title = m[2];
      // đếm số từ viết hoa chữ đầu (>=3 từ hoa liên tiếp → nghi Title Case)
      const words = title.split(/\s+/);
      const capWords = words.filter(w => /^[A-ZÀ-Ỹ]/.test(w)).length;
      if (words.length >= 3 && capWords >= Math.ceil(words.length * 0.6)) {
        // hạ về sentence case: giữ hoa chữ đầu tiên + từ sau dấu câu, hạ phần còn lại
        const lowered = words.map((w, i) => {
          if (i === 0) return w; // giữ chữ đầu
          // giữ nguyên từ viết HOA TOÀN BỘ (acronym: AI, SEO, CEO...) hoặc có số
          if (/^[A-Z0-9]+$/.test(w) || /\d/.test(w)) return w;
          // hạ chữ cái đầu
          return w.charAt(0).toLowerCase() + w.slice(1);
        }).join(" ");
        if (lowered !== title) { headingFixed++; title = lowered; }
      }
      return prefix + title;
    }).join("\n");
    if (headingFixed) changes.push({ type: "heading Title Case → sentence case", count: headingFixed });
  }

  return { cleaned: s, changes };
}

/* Đếm cụm từ cấm còn sót (để hiển thị cảnh báo dự phòng, KHÔNG tự sửa) */
function scanBannedPhrases(text, lang) {
  if (lang !== "vi" || !text) return [];
  const lower = text.toLowerCase();
  return BANNED_PHRASES_VI.filter(p => lower.includes(p));
}


/* ─── AUTO-FIX SYSTEM PROMPT ──
   Nhận bài gốc + tổng hợp issues từ các reviewer fail → viết lại bài sửa hết. */
const AUTOFIX_PROMPT = (lang, articleType, issuesByReviewer) => `Bạn là Biên tập viên TỔNG. Bài viết dưới đây vừa qua kiểm duyệt và bị từ chối. Nhiệm vụ: viết lại bài, SỬA HẾT các lỗi được liệt kê, GIỮ NGUYÊN ý gốc và độ dài tương đương.

NGÔN NGỮ: ${lang === "en" ? "tiếng Anh" : "tiếng Việt"}
LOẠI BÀI: ${articleType}

LỖI CẦN SỬA (tổng hợp từ ${Object.keys(issuesByReviewer).length} reviewer):

${Object.entries(issuesByReviewer).map(([rev, issues]) => `── ${rev.toUpperCase()} ──
${issues.map((it, i) => `${i + 1}. [${it.severity}] ${it.type}: "${it.excerpt}"
   → ${it.suggestion}`).join("\n")}`).join("\n\n")}

YÊU CẦU:
1. Sửa hết các lỗi trên, ĐẶC BIỆT các lỗi "high" severity.
2. Giữ nguyên nội dung, ý nghĩa, luận điểm gốc.
3. KHÔNG thêm thông tin/fact mới.
4. KHÔNG giải thích, KHÔNG nói "Đã sửa..." — chỉ TRẢ VỀ BÀI ĐÃ SỬA hoàn chỉnh.
5. KHÔNG wrap trong markdown backticks.

TRẢ VỀ DUY NHẤT BÀI VIẾT ĐÃ SỬA, không có gì khác.`;

/* ════════════════════════════════════════════════════════════════════
   UTILITIES
   ════════════════════════════════════════════════════════════════════ */

function modelSupportsThinking(id) {
  if (!id) return false;
  const lower = id.toLowerCase();
  if (lower.includes("haiku")) return false;
  const m = lower.match(/-(\d+)-(\d+)/);
  if (m) { const M = +m[1], n = +m[2]; return M > 4 || (M === 4 && n >= 6); }
  return true;
}

function detectLanguage(text) {
  if (!text || text.length < 20) return "vi";
  // đếm ký tự có dấu tiếng Việt
  const viChars = (text.match(/[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]/g) || []).length;
  const ratio = viChars / text.length;
  return ratio > 0.03 ? "vi" : "en";
}

function detectArticleType(text) {
  const lower = (text || "").toLowerCase().slice(0, 3000);
  const hasHeaders = /^#{1,6}\s/m.test(text || "");
  const hasBullets = /^[\s]*[-*]\s/m.test(text || "");
  const hasNumbered = /^\d+\.\s/m.test(text || "");
  const hasCodeBlock = /```/.test(text || "");
  const techMarkers = ["bước 1", "bước 2", "cài đặt", "hướng dẫn", "step 1", "install", "tutorial", "how to"];
  const hasTechWords = techMarkers.some(w => lower.includes(w));
  if (hasCodeBlock || (hasHeaders && hasBullets && hasTechWords)) return "technical";
  if (text && text.length < 800 && (hasBullets || /[#@]\w/.test(text))) return "social";
  if (hasHeaders && hasNumbered) return "technical";
  return "storytelling";
}

/* Dò niche y tế/sức khỏe để tự bật chế độ kiểm chứng nghiêm ngặt */
function detectHealthNiche(text) {
  if (!text) return false;
  const lower = text.toLowerCase().slice(0, 8000);
  const healthWords = [
    "sức khỏe", "y tế", "y học", "bệnh ", "thuốc", "dinh dưỡng", "triệu chứng",
    "điều trị", "bác sĩ", "vaccine", "vắc-xin", "ung thư", "tiểu đường", "huyết áp",
    "liều lượng", "tác dụng phụ", "phòng bệnh", "chữa", "khám bệnh", "dược",
    "health", "medical", "medicine", "disease", "symptom", "treatment", "doctor",
    "nutrition", "diabetes", "cancer", "dosage", "clinical",
  ];
  let hits = 0;
  for (const w of healthWords) { if (lower.includes(w)) hits++; if (hits >= 3) return true; }
  return false;
}


function parseReviewerJSON(raw) {
  if (!raw || typeof raw !== "string") return null;
  let s = raw.trim();
  // strip markdown code fences
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  // tìm JSON object đầu tiên { ... }
  const firstBrace = s.indexOf("{");
  const lastBrace = s.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < 0) return null;
  s = s.slice(firstBrace, lastBrace + 1);
  try {
    const obj = JSON.parse(s);
    // validate schema cơ bản
    if (typeof obj.passed !== "boolean") obj.passed = false;
    if (typeof obj.score !== "number") obj.score = 0;
    if (!Array.isArray(obj.issues)) obj.issues = [];
    if (typeof obj.summary !== "string") obj.summary = "";
    // normalize issues
    obj.issues = obj.issues.map(it => ({
      type: String(it.type || "other"),
      severity: ["low", "medium", "high"].includes(it.severity) ? it.severity : "medium",
      excerpt: String(it.excerpt || "").slice(0, 300),
      fix: String(it.fix || "").slice(0, 600),
      suggestion: String(it.suggestion || it.fix || ""),
    }));
    return obj;
  } catch (e) {
    return null;
  }
}

function costOf(modelId, usage) {
  if (!usage) return 0;
  const p = PRICING[modelId];
  if (!p) return 0;
  const inp = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) * 0.1;
  const out = (usage.output_tokens || 0);
  return (inp * p.input + out * p.output) / 1_000_000;
}

/* ─── CLAUDE API (zero-key, streaming) ──
   Tuân Claude.md: output_config.effort + adaptive thinking (4.6+) + beta header. */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* Đọc lỗi 429 → tính số giây cần chờ + thông báo tiếng Việt. */
function parse429(errText) {
  let resetsAt = null;
  try {
    const j = JSON.parse(errText);
    let msg = j?.error?.message;
    // message đôi khi là chuỗi JSON lồng
    if (typeof msg === "string" && msg.trim().startsWith("{")) {
      try { const inner = JSON.parse(msg); resetsAt = inner?.resetsAt || null; } catch {}
    } else if (msg && typeof msg === "object") {
      resetsAt = msg.resetsAt || null;
    }
    if (!resetsAt) {
      const m = errText.match(/resetsAt\\?":\s*(\d{9,})/);
      if (m) resetsAt = +m[1];
    }
  } catch {}
  let waitMs = null;
  if (resetsAt) {
    const w = resetsAt * 1000 - Date.now();
    if (w > 0) waitMs = w;
  }
  const resetTime = resetsAt ? new Date(resetsAt * 1000).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : null;
  return { waitMs, resetTime };
}

async function callClaude(system, user, onChunk, cfg = {}) {
  const { model = "claude-sonnet-4-6", thinkingOn = false, effortId = "high",
          maxTokens = 8000, timeoutMs = 150000, signal = null, maxRetries = 2 } = cfg;
  const body = {
    model, max_tokens: maxTokens, stream: true, system,
    messages: [{ role: "user", content: user }],
    output_config: { effort: effortId },
  };
  if (thinkingOn && modelSupportsThinking(model)) body.thinking = { type: "adaptive" };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Timeout riêng cho mỗi call + tôn trọng signal hủy từ ngoài (nút Dừng)
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    if (signal) { if (signal.aborted) ctrl.abort(); else signal.addEventListener("abort", onAbort); }
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "anthropic-beta": "effort-2025-11-24" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const err = await res.text();
        // 429 rate limit → thử chờ rồi retry nếu thời gian chờ hợp lý
        if (res.status === 429) {
          const { waitMs, resetTime } = parse429(err);
          // chờ theo resetsAt (nếu có) hoặc backoff luỹ tiến; chỉ retry nếu chờ ngắn
          const backoff = waitMs != null ? waitMs : (5000 * (attempt + 1));
          if (attempt < maxRetries && backoff <= 45000 && !ctrl.signal.aborted) {
            clearTimeout(timer);
            if (signal) signal.removeEventListener("abort", onAbort);
            await sleep(backoff + Math.random() * 1500); // jitter tránh dồn cùng lúc
            continue;
          }
          throw new Error(`Hết hạn mức (rate limit)${resetTime ? ` — quota reset lúc ${resetTime}` : ""}. Hãy chờ rồi bấm "Tiếp tục", hoặc đổi sang model khác (Sonnet/Haiku).`);
        }
        throw new Error(`API ${res.status}: ${err.slice(0, 160)}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "", usage = null, stopReason = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data:")) continue;
          const d = line.slice(5).trim();
          if (d === "[DONE]") continue;
          try {
            const j = JSON.parse(d);
            if (j?.type === "message_start" && j?.message?.usage) usage = { ...j.message.usage };
            if (j?.type === "message_delta") {
              if (j?.usage) usage = { ...usage, ...j.usage };
              if (j?.delta?.stop_reason) stopReason = j.delta.stop_reason;
            }
            if (j?.delta?.type === "text_delta") { full += j.delta.text || ""; onChunk && onChunk(full); }
          } catch {}
        }
      }
      return { text: full, usage, stopReason };
    } catch (e) {
      if (e?.name === "AbortError") {
        throw new Error(signal?.aborted ? "Đã hủy" : `Quá thời gian chờ (${Math.round(timeoutMs / 1000)}s) — thử Effort thấp hơn hoặc model nhanh hơn`);
      }
      throw e;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    }
  }
}

/* ════════════════════════════════════════════════════════════════════
   PARSER cho file import từ Tool 3
   - MD: file 1 hoặc nhiều bài cách nhau bằng "<!-- ARTICLE_BREAK -->" (cũ: "---")
   - JSON: checkpoint Tool 3, có prompts[].result
   ════════════════════════════════════════════════════════════════════ */

function parseMDImport(content) {
  // Ưu tiên tách theo marker mới "<!-- ARTICLE_BREAK -->" (Tool 3 v2).
  // Tương thích ngược: file cũ không có marker thì fallback tách theo "---".
  const hasMarker = content.includes("<!-- ARTICLE_BREAK -->");
  const sections = hasMarker
    ? content.split(/\s*<!--\s*ARTICLE_BREAK\s*-->\s*/)
    : content.split(/\n---+\n/);
  const articles = [];
  sections.forEach((sec, i) => {
    const trimmed = sec.trim();
    if (!trimmed) return;
    // tìm dòng tiêu đề đầu tiên dạng "# ..." hoặc "## ..."
    const titleMatch = trimmed.match(/^#{1,3}\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : `Bài ${i + 1}`;
    articles.push({ id: `md_${Date.now()}_${i}`, title, text: trimmed, category: "imported_md" });
  });
  return articles;
}

function parseJSONImport(content) {
  try {
    const obj = JSON.parse(content);
    // Tool 3 checkpoint: { prompts: [{ id, title, category, result, type, ... }] }
    if (Array.isArray(obj.prompts)) {
      return obj.prompts
        .filter(p => p?.result && (p?.type === "text_generation" || !p?.type))
        .map(p => ({
          id: p.id || `json_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          title: p.title || p.category || "Bài không tên",
          text: p.result,
          category: p.category || "imported_json",
          setId: p.setId,
        }));
    }
    // Tool 4 checkpoint của chính nó: trả về cấu trúc đặc biệt
    if (obj.tool === "tool4-review-studio") {
      return { _isTool4Checkpoint: true, data: obj };
    }
    return null;
  } catch (e) {
    return null;
  }
}

/* ════════════════════════════════════════════════════════════════════
   MAIN COMPONENT — REVIEW STUDIO
   ════════════════════════════════════════════════════════════════════ */
export default function ReviewStudio() {
  /* ── STATE: INPUT bài viết ── */
  const [inputText, setInputText]     = useState("");
  const [inputTitle, setInputTitle]   = useState("");
  const [langChoice, setLangChoice]   = useState("auto"); // auto | vi | en
  const [articleType, setArticleType] = useState("auto"); // ARTICLE_TYPES.v
  const [sourceType, setSourceType]   = useState("paste"); // paste | md | json

  /* ── STATE: nhiều bài từ JSON Tool 3 ── */
  const [importedArticles, setImportedArticles]     = useState([]); // [{id, title, text, category}]
  const [selectedImportId, setSelectedImportId]     = useState(null);

  /* ── STATE: CONFIG model & reviewer ── */
  const [modelId, setModelId]         = useState("claude-sonnet-4-6");
  const [effortId, setEffortId]       = useState("high");
  const [thinkingOn, setThinkingOn]   = useState(false);
  const [maxTokens, setMaxTokens]     = useState(8000);
  // map reviewerId → bool bật/tắt. fact-check mặc định TẮT.
  const [reviewersOn, setReviewersOn] = useState(() => {
    const m = {};
    REVIEWERS.forEach(r => { m[r.id] = true; }); // cả Chống AI + Kiểm chứng bật mặc định
    return m;
  });
  // Mức kiểm chứng: "standard" (phổ thông) | "strict" (y tế/sức khỏe). Tự dò theo niche.
  const [verifyLevel, setVerifyLevel] = useState("standard");
  const [nicheHint, setNicheHint]     = useState(""); // gợi ý lĩnh vực kênh (từ import hoặc tự nhập)

  /* ── STATE: KẾT QUẢ review ── */
  // results[reviewerId] = { status, passed, score, summary, issues, raw, cost, error }
  // status: "pending" | "running" | "done" | "error"
  const [results, setResults]         = useState({});
  const [verdict, setVerdict]         = useState("PENDING"); // PENDING | PASSED | REJECTED | PARTIAL
  const [runId, setRunId]             = useState(null);
  const [runRound, setRunRound]       = useState(0); // số vòng đã chạy (1, 2, 3...)
  const [history, setHistory]         = useState([]); // [{runId, round, verdict, ts, ...}]

  /* ── STATE: AUTO-FIX ── */
  const [fixedText, setFixedText]     = useState("");
  const [fixBusy, setFixBusy]         = useState(false);
  const [fixStream, setFixStream]     = useState("");
  const [showDiff, setShowDiff]       = useState(false);

  /* ── STATE: UI ── */
  const [err, setErr]                 = useState("");
  const [toast, setToast]             = useState("");
  const [openCards, setOpenCards]     = useState({}); // {reviewerId: bool} — collapsible cards
  const [showStorageBadge, setShowStorageBadge] = useState(false);
  const [totalCost, setTotalCost]     = useState(0);
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);
  const [forceEditor, setForceEditor] = useState(false); // cho nút "Paste bài viết" chuyển ra main view
  const [clearArmed, setClearArmed]   = useState(false); // xác nhận 2 bước cho nút Xoá phiên

  /* ── REFS ── */
  const fileRef = useRef(null);
  const cpRef   = useRef(null);
  const saveTimeoutRef = useRef(null);
  const abortRef = useRef(false); // cờ huỷ run giữa chừng
  const abortCtrlRef = useRef(null); // AbortController hiện hành để hủy fetch thật

  /* ── DERIVED ── */
  const effectiveLang = useMemo(() => {
    if (langChoice !== "auto") return langChoice;
    return detectLanguage(inputText);
  }, [langChoice, inputText]);

  const effectiveArticleType = useMemo(() => {
    if (articleType !== "auto") return articleType;
    return detectArticleType(inputText);
  }, [articleType, inputText]);

  const enabledReviewerIds = useMemo(
    () => REVIEWERS.filter(r => reviewersOn[r.id]).map(r => r.id),
    [reviewersOn]
  );

  const totalIssues = useMemo(() => {
    let n = 0;
    Object.values(results).forEach(r => { if (r?.issues) n += r.issues.length; });
    return n;
  }, [results]);

  const highIssues = useMemo(() => {
    let n = 0;
    Object.values(results).forEach(r => {
      if (r?.issues) n += r.issues.filter(i => i.severity === "high").length;
    });
    return n;
  }, [results]);

  const allDone = useMemo(() => {
    if (enabledReviewerIds.length === 0) return false;
    return enabledReviewerIds.every(id => results[id]?.status === "done" || results[id]?.status === "error");
  }, [enabledReviewerIds, results]);

  const anyRunning = useMemo(() => {
    return Object.values(results).some(r => r?.status === "running");
  }, [results]);

  /* ════════════════════════════════════════════════════════════════════
     AUTO-SAVE & LOAD — checkpoint Lớp 1 (window.storage)
     ════════════════════════════════════════════════════════════════════ */

  // Build snapshot từ state hiện tại
  const buildSnapshot = useCallback(() => ({
    version: CHECKPOINT_VERSION,
    timestamp: Date.now(),
    input: { text: inputText, title: inputTitle, lang: langChoice, articleType, sourceType },
    imported: { articles: importedArticles, selectedId: selectedImportId },
    config: { modelId, effortId, thinkingOn, maxTokens, reviewersOn, verifyLevel, nicheHint },
    review: { results, verdict, runId, runRound, totalCost },
    autofix: { fixedText },
    history,
  }), [inputText, inputTitle, langChoice, articleType, sourceType, importedArticles,
      selectedImportId, modelId, effortId, thinkingOn, maxTokens, reviewersOn,
      verifyLevel, nicheHint,
      results, verdict, runId, runRound, totalCost, fixedText, history]);

  // Apply snapshot → state
  const applySnapshot = useCallback((snap) => {
    if (!snap || snap.version !== CHECKPOINT_VERSION) return false;
    try {
      const i = snap.input || {};
      setInputText(i.text || "");
      setInputTitle(i.title || "");
      setLangChoice(i.lang || "auto");
      setArticleType(i.articleType || "auto");
      setSourceType(i.sourceType || "paste");
      const im = snap.imported || {};
      setImportedArticles(im.articles || []);
      setSelectedImportId(im.selectedId || null);
      const c = snap.config || {};
      if (c.modelId) setModelId(c.modelId);
      if (c.effortId) setEffortId(c.effortId);
      if (typeof c.thinkingOn === "boolean") setThinkingOn(c.thinkingOn);
      if (typeof c.maxTokens === "number") setMaxTokens(c.maxTokens);
      if (c.reviewersOn) setReviewersOn(c.reviewersOn);
      if (c.verifyLevel) setVerifyLevel(c.verifyLevel);
      if (typeof c.nicheHint === "string") setNicheHint(c.nicheHint);
      const r = snap.review || {};
      setResults(r.results || {});
      setVerdict(r.verdict || "PENDING");
      setRunId(r.runId || null);
      setRunRound(r.runRound || 0);
      setTotalCost(r.totalCost || 0);
      const a = snap.autofix || {};
      setFixedText(a.fixedText || "");
      setHistory(snap.history || []);
      return true;
    } catch (e) {
      return false;
    }
  }, []);

  // Load on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage?.get(STORAGE_KEY);
        if (r?.value) {
          const snap = JSON.parse(r.value);
          if (applySnapshot(snap)) {
            setLoadedFromStorage(true);
            setShowStorageBadge(true);
            setTimeout(() => setShowStorageBadge(false), 3500);
          }
        }
      } catch (e) { /* key chưa tồn tại — bình thường */ }
    })();
  // eslint-disable-next-line
  }, []);

  // Auto-save debounce 800ms — KEY: ghi state ngay sau mọi thay đổi
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const snap = buildSnapshot();
        await window.storage?.set(STORAGE_KEY, JSON.stringify(snap));
      } catch (e) { /* storage có thể đầy — bỏ qua */ }
    }, 800);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [buildSnapshot]);

  /* ── Toast helper ── */
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }, []);

  /* ════════════════════════════════════════════════════════════════════
     SAFE DOWNLOAD — đề phòng crash khi revoke ngay
     ════════════════════════════════════════════════════════════════════ */
  function safeDownload(name, content, mime) {
    try {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setErr("Tải file thất bại: " + String(e.message || e));
    }
  }

  /* ════════════════════════════════════════════════════════════════════
     IMPORT — MD hoặc JSON (Tool 3 checkpoint hoặc Tool 4 checkpoint)
     ════════════════════════════════════════════════════════════════════ */
  function importFile(file) {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = (e) => {
      const content = e.target.result;
      const fname = (file.name || "").toLowerCase();
      try {
        if (fname.endsWith(".json")) {
          const parsed = parseJSONImport(content);
          if (!parsed) throw new Error("File JSON không hợp lệ");
          // Tool 4 checkpoint của chính nó
          if (parsed._isTool4Checkpoint) {
            if (applySnapshot(parsed.data)) {
              setErr("");
              showToast("Đã khôi phục checkpoint Tool 4");
            } else {
              throw new Error("Checkpoint Tool 4 lỗi");
            }
            return;
          }
          // JSON từ Tool 3 → import bài
          if (Array.isArray(parsed) && parsed.length > 0) {
            setImportedArticles(parsed);
            setSelectedImportId(parsed[0].id);
            setInputText(parsed[0].text);
            setInputTitle(parsed[0].title);
            setSourceType("json");
            setErr("");
            // tự dò niche y tế từ toàn bộ bài → bật kiểm chứng nghiêm ngặt
            const allText = parsed.map(p => `${p.title} ${p.text}`).join(" ");
            if (detectHealthNiche(allText)) {
              setVerifyLevel("strict");
              setNicheHint("y tế / sức khỏe");
              showToast(`Đã nhập ${parsed.length} bài · phát hiện nội dung y tế → bật kiểm chứng nghiêm ngặt`);
            } else {
              showToast(`Đã nhập ${parsed.length} bài từ Tool 3 — chọn bài để rà soát`);
            }
          } else {
            throw new Error("JSON không có bài nào hợp lệ");
          }
        } else if (fname.endsWith(".md") || fname.endsWith(".txt")) {
          const arts = parseMDImport(content);
          if (arts.length === 0) throw new Error("File MD trống");
          if (arts.length === 1) {
            setImportedArticles([]);
            setSelectedImportId(null);
            setInputText(arts[0].text);
            setInputTitle(arts[0].title);
            setSourceType("md");
            showToast("Đã nhập 1 bài từ MD");
          } else {
            setImportedArticles(arts);
            setSelectedImportId(arts[0].id);
            setInputText(arts[0].text);
            setInputTitle(arts[0].title);
            setSourceType("md");
            showToast(`Đã nhập ${arts.length} bài — chọn bài để rà soát`);
          }
          // tự dò niche y tế
          if (detectHealthNiche(arts.map(a => `${a.title} ${a.text}`).join(" "))) {
            setVerifyLevel("strict");
            setNicheHint("y tế / sức khỏe");
          }
          setErr("");
        } else {
          throw new Error("Chỉ hỗ trợ .md, .txt, .json");
        }
      } catch (e2) {
        setErr("Lỗi import: " + e2.message);
      }
    };
    fr.readAsText(file);
  }

  function selectImportedArticle(id) {
    const art = importedArticles.find(a => a.id === id);
    if (!art) return;
    setSelectedImportId(id);
    setInputText(art.text);
    setInputTitle(art.title);
    // reset kết quả review cho bài mới
    resetReviewState();
    showToast(`Đã chọn: ${art.title}`);
  }

  function resetReviewState() {
    setResults({});
    setVerdict("PENDING");
    setRunId(null);
    setFixedText("");
    setShowDiff(false);
  }

  /* ════════════════════════════════════════════════════════════════════
     EXPORT — 4 loại
     ════════════════════════════════════════════════════════════════════ */

  // 1. Bài đã sửa (MD thuần)
  function exportFixedMD() {
    try {
      const text = fixedText || inputText;
      if (!text) { setErr("Chưa có nội dung để export"); return; }
      const head = inputTitle ? `# ${inputTitle}\n\n` : "";
      safeDownload(`bai-da-duyet-${Date.now()}.md`, head + text, "text/markdown");
      showToast("Đã tải bài MD");
    } catch (e) { setErr("Export MD lỗi: " + e.message); }
  }

  // 2. Phiếu review (MD có comment)
  function exportReviewReportMD() {
    try {
      if (Object.keys(results).length === 0) { setErr("Chưa có kết quả review"); return; }
      let md = `# Phiếu review — ${inputTitle || "Bài viết"}\n\n`;
      md += `**Verdict:** ${verdict === "PASSED" ? "✅ DUYỆT" : verdict === "REJECTED" ? "❌ TỪ CHỐI" : "⏳ ĐANG XỬ LÝ"}\n`;
      md += `**Vòng:** ${runRound}\n`;
      md += `**Ngôn ngữ:** ${effectiveLang}\n`;
      md += `**Loại bài:** ${effectiveArticleType}\n`;
      md += `**Model:** ${modelId} · effort: ${effortId} · thinking: ${thinkingOn ? "on" : "off"}\n`;
      md += `**Tổng lỗi:** ${totalIssues} (high: ${highIssues})\n`;
      md += `**Chi phí:** $${totalCost.toFixed(4)}\n\n`;
      md += `---\n\n`;
      REVIEWERS.forEach(rev => {
        const r = results[rev.id];
        if (!r || r.status === "pending") return;
        md += `## ${rev.label} — ${r.passed ? "✅ PASS" : "❌ FAIL"} (score: ${r.score}/10)\n\n`;
        if (r.summary) md += `> ${r.summary}\n\n`;
        if (r.error) { md += `⚠️ Lỗi: ${r.error}\n\n`; return; }
        if (r.issues && r.issues.length > 0) {
          r.issues.forEach((it, i) => {
            md += `${i + 1}. **[${it.severity}] ${it.type}**\n`;
            md += `   - Trích: \`${it.excerpt}\`\n`;
            md += `   - Gợi ý: ${it.suggestion}\n\n`;
          });
        } else {
          md += `*Không có vấn đề.*\n\n`;
        }
      });
      safeDownload(`phieu-review-${Date.now()}.md`, md, "text/markdown");
      showToast("Đã tải phiếu review");
    } catch (e) { setErr("Export phiếu lỗi: " + e.message); }
  }

  // 3. JSON checkpoint (full state, có thể nhập lại Tool 4)
  function exportCheckpoint() {
    try {
      const snap = buildSnapshot();
      snap.tool = "tool4-review-studio";
      safeDownload(`checkpoint-tool4-${Date.now()}.json`, JSON.stringify(snap, null, 2), "application/json");
      showToast("Đã tải checkpoint");
    } catch (e) { setErr("Export checkpoint lỗi: " + e.message); }
  }

  // 4. JSON kết quả cho Tool 5 (NeuroForge)
  function exportForTool5() {
    try {
      const out = {
        tool: "tool4-review-output",
        timestamp: Date.now(),
        title: inputTitle,
        text: fixedText || inputText,
        lang: effectiveLang,
        articleType: effectiveArticleType,
        verdict,
        runRound,
        reviewSummary: REVIEWERS.reduce((acc, rev) => {
          const r = results[rev.id];
          if (r && r.status === "done") {
            acc[rev.id] = { passed: r.passed, score: r.score, issuesCount: r.issues?.length || 0 };
          }
          return acc;
        }, {}),
      };
      safeDownload(`tool4-output-${Date.now()}.json`, JSON.stringify(out, null, 2), "application/json");
      showToast(verdict === "PASSED" ? "Đã tải file cho Tool 5" : "Đã tải (bài chưa DUYỆT — kiểm tra lại)");
    } catch (e) { setErr("Export Tool 5 lỗi: " + e.message); }
  }

  /* ════════════════════════════════════════════════════════════════════
     CLEAR / RESET — xác nhận 2 bước (window.confirm bị sandbox chặn)
     ════════════════════════════════════════════════════════════════════ */
  function clearAll() {
    // bấm lần 1 → "vũ trang"; bấm lần 2 trong 4s → thực sự xoá
    if (!clearArmed) {
      setClearArmed(true);
      setTimeout(() => setClearArmed(false), 4000);
      showToast("Bấm 'Xoá phiên' lần nữa để xác nhận");
      return;
    }
    setClearArmed(false);
    setInputText(""); setInputTitle("");
    setLangChoice("auto"); setArticleType("auto"); setSourceType("paste");
    setImportedArticles([]); setSelectedImportId(null);
    resetReviewState();
    setHistory([]);
    setTotalCost(0);
    setForceEditor(false);
    setErr("");
    showToast("Đã xoá phiên");
  }

  /* ════════════════════════════════════════════════════════════════════
     RUN REVIEW — chạy song song qua Promise.allSettled
     CHECKPOINT KEY: mỗi reviewer xong → setResults NGAY → auto-save ngay → resume được
     ════════════════════════════════════════════════════════════════════ */

  async function runOneReviewer(reviewerId, articleText, lang, artType, signal) {
    // đánh dấu RUNNING ngay → state reflect liền
    setResults(prev => ({
      ...prev,
      [reviewerId]: { ...(prev[reviewerId] || {}), status: "running", issues: [], error: null }
    }));
    try {
      const promptFn = REVIEWER_PROMPTS[reviewerId];
      if (!promptFn) throw new Error("Reviewer không tồn tại");
      const system = promptFn(lang, { articleType: artType, verifyLevel, niche: nicheHint });
      const user = `BÀI VIẾT CẦN RÀ SOÁT:\n\n${articleText}`;
      const { text: raw, usage } = await callClaude(system, user, null, {
        model: modelId, thinkingOn, effortId, maxTokens, signal, timeoutMs: 180000
      });
      const parsed = parseReviewerJSON(raw);
      const cost = costOf(modelId, usage);
      if (!parsed) {
        // không parse được — coi như error nhưng vẫn lưu raw để debug
        setResults(prev => ({
          ...prev,
          [reviewerId]: {
            status: "error", passed: false, score: 0, summary: "Không parse được JSON",
            issues: [], raw, cost, error: "Response không đúng JSON schema"
          }
        }));
        setTotalCost(c => c + cost);
        return { reviewerId, ok: false, error: "Parse JSON failed" };
      }
      setResults(prev => ({
        ...prev,
        [reviewerId]: {
          status: "done",
          passed: parsed.passed,
          score: parsed.score,
          summary: parsed.summary,
          issues: parsed.issues,
          raw,
          cost,
          error: null,
        }
      }));
      setTotalCost(c => c + cost);
      return { reviewerId, ok: true, parsed };
    } catch (e) {
      setResults(prev => ({
        ...prev,
        [reviewerId]: {
          status: "error", passed: false, score: 0, summary: "Lỗi gọi API",
          issues: [], raw: null, cost: 0, error: String(e.message || e)
        }
      }));
      return { reviewerId, ok: false, error: String(e.message || e) };
    }
  }

  // Chạy ALL reviewer đang bật, SONG SONG. Nếu skipDone=true → chỉ chạy pending/error.
  async function runReview({ skipDone = false } = {}) {
    if (!inputText.trim()) { setErr("Chưa có bài viết để rà soát"); return; }
    if (enabledReviewerIds.length === 0) { setErr("Chưa bật reviewer nào"); return; }
    setErr("");
    abortRef.current = false;
    const newRunId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setRunId(newRunId);
    if (!skipDone) {
      setRunRound(r => r + 1);
      setVerdict("PENDING");
    }
    const lang = effectiveLang;
    const artType = effectiveArticleType;

    // Chọn reviewer cần chạy
    const toRun = enabledReviewerIds.filter(id => {
      if (!skipDone) return true;
      const r = results[id];
      return !r || r.status === "pending" || r.status === "error";
    });
    if (toRun.length === 0) { setErr("Không có reviewer nào cần chạy"); return; }

    // đánh dấu pending cho các reviewer SẼ chạy → user thấy ngay
    setResults(prev => {
      const next = { ...prev };
      toRun.forEach(id => { next[id] = { ...(next[id] || {}), status: "pending" }; });
      return next;
    });

    // AbortController cho phép nút Dừng huỷ fetch thật
    const ctrl = new AbortController();
    abortCtrlRef.current = ctrl;

    // POOL giới hạn concurrency — tránh nghẽn proxy zero-key + giảm rate limit khi nhiều call song song
    const CONCURRENCY = 2;
    const settled = [];
    const queue = [...toRun];
    async function worker() {
      while (queue.length && !abortRef.current) {
        const id = queue.shift();
        try {
          const r = await runOneReviewer(id, inputText, lang, artType, ctrl.signal);
          settled.push({ status: "fulfilled", value: r });
        } catch (e) {
          settled.push({ status: "rejected", reason: e });
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, toRun.length) }, () => worker()));
    abortCtrlRef.current = null;

    if (abortRef.current) {
      showToast("Đã dừng");
      return;
    }

    // Tính verdict cuối cùng dựa trên TẤT CẢ reviewer đang bật (kể cả cái đã done từ trước)
    // Cần wait state update — dùng setResults callback để có kết quả mới nhất
    setResults(currentResults => {
      let allPass = true;
      let anyError = false;
      enabledReviewerIds.forEach(id => {
        const r = currentResults[id];
        if (!r || r.status === "pending" || r.status === "running") allPass = false;
        else if (r.status === "error") { anyError = true; allPass = false; }
        else if (!r.passed) allPass = false;
      });
      const v = allPass ? "PASSED" : (anyError ? "PARTIAL" : "REJECTED");
      setVerdict(v);
      // ghi history
      setHistory(prev => [...prev, {
        runId: newRunId,
        round: skipDone ? runRound : runRound + 1,
        ts: Date.now(),
        verdict: v,
        reviewers: toRun,
        totalIssues: Object.values(currentResults).reduce((s, r) => s + (r?.issues?.length || 0), 0),
      }]);
      if (v === "PASSED") showToast("🎉 Bài viết đã DUYỆT");
      else if (v === "REJECTED") showToast(`❌ TỪ CHỐI — ${Object.values(currentResults).reduce((s, r) => s + (r?.issues?.length || 0), 0)} lỗi`);
      else showToast(`⚠️ Hoàn thành với lỗi gọi API ở ${settled.filter(s => s.status === "rejected" || (s.value && !s.value.ok)).length} reviewer`);
      return currentResults;
    });
  }

  // Dừng giữa chừng (best-effort: không cancel HTTP, chỉ set cờ → bỏ qua kết quả khi nhận về)
  function stopRun() {
    abortRef.current = true;
    if (abortCtrlRef.current) abortCtrlRef.current.abort();
    // dọn các reviewer còn đang chờ/chạy → đánh dấu để có thể "Tiếp tục" sau
    setResults(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        if (next[id]?.status === "running" || next[id]?.status === "pending") {
          next[id] = { ...next[id], status: "error", error: "Đã dừng — bấm Tiếp tục để chạy lại reviewer này" };
        }
      });
      return next;
    });
    showToast("Đã dừng");
  }

  /* ════════════════════════════════════════════════════════════════════
     TARGETED FIX — chỉ sửa ĐÚNG đoạn lỗi, KHÔNG viết lại toàn bài.
     Reviewer đã trả sẵn cặp {excerpt → fix} nên targeted fix chạy 0 TOKEN.
     ════════════════════════════════════════════════════════════════════ */

  // Gom mọi issue có thể fix bằng replace (excerpt + fix không rỗng, khác nhau)
  const fixableIssues = useMemo(() => {
    const out = [];
    REVIEWERS.forEach(rev => {
      const r = results[rev.id];
      if (r?.status === "done" && Array.isArray(r.issues)) {
        r.issues.forEach(it => {
          if (it.excerpt && it.fix && it.excerpt.trim() !== it.fix.trim()) {
            out.push({ reviewer: rev.id, ...it });
          }
        });
      }
    });
    return out;
  }, [results]);

  // Lỗi toàn cục (fix rỗng) — cần AI viết lại, không replace được
  const globalIssues = useMemo(() => {
    const out = [];
    REVIEWERS.forEach(rev => {
      const r = results[rev.id];
      if (r?.status === "done" && Array.isArray(r.issues)) {
        r.issues.forEach(it => { if (it.excerpt && !it.fix) out.push({ reviewer: rev.id, ...it }); });
      }
    });
    return out;
  }, [results]);

  // FIX CHÍNH — 0 token: replace từng excerpt → fix ngay trong bài
  function applyTargetedFix() {
    try {
      if (!inputText.trim()) { setErr("Chưa có bài"); return; }
      if (fixableIssues.length === 0) {
        setErr(globalIssues.length > 0
          ? "Các lỗi còn lại là lỗi toàn cục (đoạn văn đều nhau, cấu trúc) — cần dùng 'AI viết lại' bên dưới."
          : "Không có lỗi nào sửa được bằng thay đoạn.");
        return;
      }
      let text = inputText;
      let applied = 0;
      const failed = [];
      // sắp xếp excerpt dài trước → tránh đoạn ngắn nằm trong đoạn dài bị thay nhầm
      const sorted = [...fixableIssues].sort((a, b) => b.excerpt.length - a.excerpt.length);
      for (const it of sorted) {
        if (text.includes(it.excerpt)) {
          text = text.split(it.excerpt).join(it.fix); // replace tất cả lần xuất hiện
          applied++;
        } else {
          failed.push(it.excerpt.slice(0, 50));
        }
      }
      // dọn cơ học sau khi thay (đề phòng fix lỡ tạo lỗi spacing/em-dash)
      const { cleaned } = mechanicalCleanup(text, effectiveLang);
      setFixedText(cleaned);
      setShowDiff(true);
      let msg = `Đã sửa ${applied}/${fixableIssues.length} đoạn (0 token)`;
      if (failed.length) msg += ` · ${failed.length} đoạn không khớp nguyên văn`;
      showToast(msg);
      if (failed.length) {
        setErr(`${failed.length} đoạn không tìm thấy nguyên văn trong bài (có thể reviewer trích hơi lệch). Kiểm tra thủ công: "${failed[0]}…"`);
      }
    } catch (e) {
      setErr("Targeted fix lỗi: " + String(e.message || e));
    }
  }

  // PHƯƠNG ÁN PHỤ — AI viết lại CHỈ các đoạn lỗi toàn cục (vẫn tiết kiệm: gửi đoạn, không gửi cả bài khi có thể)
  async function runAIRewrite() {
    try {
      if (!inputText.trim()) { setErr("Chưa có bài"); return; }
      const allIssues = [...fixableIssues, ...globalIssues];
      if (allIssues.length === 0) { setErr("Không có lỗi để sửa"); return; }
      setFixBusy(true); setFixStream(""); setErr("");
      const issueList = allIssues.map((it, i) =>
        `${i + 1}. [${it.severity}] ${it.type}: "${it.excerpt}"${it.fix ? `\n   gợi ý: ${it.fix}` : it.suggestion ? `\n   gợi ý: ${it.suggestion}` : ""}`
      ).join("\n");
      const system = `Bạn là biên tập viên. Sửa bài theo phiếu lỗi, GIỮ NGUYÊN ý và độ dài, giọng tự nhiên như người thật.
Ngôn ngữ: ${effectiveLang === "en" ? "tiếng Anh" : "tiếng Việt"}. Loại bài: ${effectiveArticleType}.
QUY TẮC: không em-dash (tiếng Việt dùng " - "), viết hoa chuẩn (không Title Case), không bullet trong văn kể, không thêm thông tin mới.
TRẢ VỀ DUY NHẤT bài đã sửa hoàn chỉnh, KHÔNG giải thích, KHÔNG markdown fence.

PHIẾU LỖI:
${issueList}`;
      const user = `BÀI GỐC:\n\n${inputText}`;
      const { text, usage } = await callClaude(system, user, (chunk) => setFixStream(chunk), {
        model: modelId, thinkingOn, effortId, maxTokens: Math.max(maxTokens, 12000)
      });
      let cleaned = (text || "").trim().replace(/^```(?:markdown|md|text)?\s*/i, "").replace(/\s*```\s*$/, "");
      cleaned = mechanicalCleanup(cleaned, effectiveLang).cleaned;
      setFixedText(cleaned);
      setFixStream("");
      setShowDiff(true);
      const cost = costOf(modelId, usage);
      setTotalCost(c => c + cost);
      showToast(`AI đã viết lại (+$${cost.toFixed(4)})`);
    } catch (e) {
      setErr("AI viết lại lỗi: " + String(e.message || e));
      setFixStream("");
    } finally {
      setFixBusy(false);
    }
  }

  // Dọn cơ học thủ công (nút riêng) — fix em-dash/spacing/Title Case heading, 0 token
  function runMechanicalCleanup() {
    if (!inputText.trim()) { setErr("Chưa có bài"); return; }
    const { cleaned, changes } = mechanicalCleanup(inputText, effectiveLang);
    if (changes.length === 0) { showToast("Bài đã sạch lỗi cơ học ✓"); return; }
    setInputText(cleaned);
    const total = changes.reduce((s, c) => s + c.count, 0);
    showToast(`Đã dọn ${total} lỗi cơ học: ${changes.map(c => c.type).join(", ")}`);
  }

  // Áp dụng bài đã sửa làm bài input mới → có thể chạy review lại
  function applyFix() {
    if (!fixedText) return;
    setInputText(fixedText);
    setFixedText("");
    setShowDiff(false);
    resetReviewState();
    showToast("Đã áp dụng bản sửa — chạy review lại để xác nhận");
  }

  function discardFix() {
    setFixedText("");
    setFixStream("");
    setShowDiff(false);
    showToast("Đã bỏ bản sửa");
  }

  /* ════════════════════════════════════════════════════════════════════
     RENDER — palette + sections
     ════════════════════════════════════════════════════════════════════ */
  const C = {
    bg: "#0a0e14", panel: "#0f1620", panel2: "#131c28", border: "#1e2a3a",
    teal: "#2dd4bf", tealDim: "#0d9488",
    violet: "#a78bfa", violetDim: "#7c3aed",
    amber: "#f59e0b", amberDim: "#d97706",
    text: "#e6f0f5", textDim: "#7d8fa3",
    danger: "#f87171", success: "#34d399",
    blue: "#60a5fa", blueDim: "#3b82f6",
    cyan: "#22d3ee", red: "#ef4444",
  };

  const inputWordCount = useMemo(() => {
    const t = (inputText || "").trim();
    if (!t) return 0;
    return t.split(/\s+/).length;
  }, [inputText]);


  return (
    <div style={{ fontFamily: FONT, background: C.bg, color: C.text, minHeight: "100vh", overflowX: "hidden", width: "100%",
      backgroundImage: `radial-gradient(900px 500px at 88% -8%, rgba(167,139,250,0.10), transparent 60%),
        radial-gradient(800px 480px at 8% 108%, rgba(45,212,191,0.08), transparent 60%)` }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 9px; height: 9px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 9px; }
        ::-webkit-scrollbar-track { background: transparent; }
        input[type=range]{ -webkit-appearance:none; appearance:none; height:5px; border-radius:5px; outline:none; background:${C.border}; }
        input[type=range]::-webkit-slider-thumb{ -webkit-appearance:none; width:16px; height:16px; border-radius:50%;
          background:${C.teal}; cursor:pointer; border:2px solid ${C.bg}; box-shadow:0 0 0 1px ${C.tealDim}; }
        textarea, input[type=text] { font-family: inherit; }
        textarea::placeholder, input::placeholder { color: ${C.textDim}; }
        .t4-fade { animation: t4fade .35s ease both; }
        @keyframes t4fade { from{opacity:0; transform:translateY(6px)} to{opacity:1; transform:none} }
        .t4-spin { animation: t4spin 1s linear infinite; }
        @keyframes t4spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        .t4-pulse { animation: t4pulse 1.6s ease-in-out infinite; }
        @keyframes t4pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .t4-card:hover { border-color: ${C.tealDim}55 !important; }
      `}</style>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "26px 22px 80px" }}>

        {/* ═══════════ HEADER ═══════════ */}
        <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, display: "grid", placeItems: "center",
            background: `linear-gradient(135deg, ${C.blueDim}, ${C.violetDim})`,
            boxShadow: "0 8px 28px rgba(124,58,237,0.25)" }}>
            <ClipboardCheck size={24} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 style={{ margin: 0, fontSize: 21, letterSpacing: -0.4 }}>Review Studio</h1>
            <div style={{ fontSize: 12.5, color: C.textDim, fontFamily: MONO }}>
              Tool 4 · Module 4/5 — cửa kiểm duyệt cuối cùng trước khi sang Tool 5
            </div>
          </div>
          {inputText && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill C={C} icon={<FileText size={13} />} text={`${inputWordCount.toLocaleString()} từ`} />
              <Pill C={C} icon={<Layers size={13} />} text={`Vòng ${runRound || 0}`} />
              {totalIssues > 0 && (
                <Pill C={C} icon={<AlertCircle size={13} />}
                  text={`${totalIssues} lỗi${highIssues > 0 ? ` (${highIssues} high)` : ""}`}
                  color={highIssues > 0 ? C.danger : C.amber} />
              )}
              {totalCost > 0 && <Pill C={C} icon={<Sparkles size={13} />} text={`$${totalCost.toFixed(4)}`} color={C.amber} />}
              {showStorageBadge && <Pill C={C} icon={<Save size={13} />} text="Đã khôi phục phiên" color={C.teal} />}
            </div>
          )}
        </header>

        {/* ═══════════ ERROR BOX ═══════════ */}
        {err && (
          <div className="t4-fade" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 14px",
            background: "rgba(248,113,113,0.08)", border: `1px solid ${C.danger}55`, borderRadius: 11, marginBottom: 16, fontSize: 13.5 }}>
            <AlertTriangle size={16} color={C.danger} style={{ marginTop: 1, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{err}</span>
            <X size={15} color={C.textDim} style={{ cursor: "pointer" }} onClick={() => setErr("")} />
          </div>
        )}

        {/* ═══════════ EMPTY STATE — IMPORT ═══════════ */}
        {!inputText.trim() && importedArticles.length === 0 && !forceEditor ? (
          <div className="t4-fade" style={{ border: `1.5px dashed ${C.border}`, borderRadius: 18, padding: "54px 24px",
            textAlign: "center", marginTop: 30 }}>
            <ClipboardCheck size={42} color={C.violetDim} style={{ marginBottom: 14 }} />
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 600 }}>Sẵn sàng rà soát bài viết</h2>
            <p style={{ margin: "0 0 22px", color: C.textDim, fontSize: 13.5, maxWidth: 540, marginLeft: "auto", marginRight: "auto" }}>
              Paste bài hoặc import file MD/JSON từ Tool 3. Tool sẽ chạy 6 reviewer song song
              (Dấu câu, Viết hoa, Tự nhiên, Chống AI, Nhất quán, Kiểm chứng) rồi trả phiếu DUYỆT/TỪ CHỐI.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <BigBtn C={C} icon={<Edit3 size={16} />} label="Paste bài viết"
                primary onClick={() => setForceEditor(true)} />
              <BigBtn C={C} icon={<FolderInput size={16} />} label="Import file (MD / JSON)"
                onClick={() => fileRef.current?.click()} />
              <BigBtn C={C} icon={<FileJson size={16} />} label="Khôi phục checkpoint"
                onClick={() => cpRef.current?.click()} />
            </div>
            <input ref={fileRef} type="file" accept=".md,.txt,.json,application/json,text/markdown,text/plain"
              style={{ display: "none" }}
              onChange={e => { e.target.files[0] && importFile(e.target.files[0]); e.target.value = ""; }} />
            <input ref={cpRef} type="file" accept=".json,application/json" style={{ display: "none" }}
              onChange={e => { e.target.files[0] && importFile(e.target.files[0]); e.target.value = ""; }} />
            <div style={{ marginTop: 26, fontSize: 11.5, color: C.textDim, fontFamily: MONO }}>
              Hỗ trợ: .md · .txt · .json (Tool 3 checkpoint hoặc Tool 4 checkpoint)
            </div>
          </div>
        ) : (
          // ═══════════ MAIN WORKSPACE — 2 cột: SIDEBAR + MAIN ═══════════
          <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gap: 18, alignItems: "start" }}>

            {/* ─── LEFT SIDEBAR ─── */}
            <aside style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 14 }}>

              {/* MODEL CARD */}
              <Card C={C} title="Mô hình" icon={<Cpu size={15} color={C.teal} />}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {DEFAULT_MODELS.map(m => (
                    <button key={m.id} onClick={() => setModelId(m.id)} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, cursor: "pointer",
                      background: modelId === m.id ? C.panel2 : "transparent",
                      border: `1px solid ${modelId === m.id ? m.color : C.border}`,
                      color: C.text, textAlign: "left", fontSize: 13, fontFamily: FONT }}>
                      <span style={{ width: 8, height: 8, borderRadius: 8, background: m.color }} />
                      <span style={{ flex: 1, fontWeight: modelId === m.id ? 600 : 400 }}>{m.label}</span>
                      {m.badge && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6,
                        background: m.color + "22", color: m.color }}>{m.badge}</span>}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 12, fontSize: 11.5, color: C.textDim, marginBottom: 5 }}>Effort</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 5 }}>
                  {EFFORT_LEVELS.map(e => (
                    <button key={e.id} onClick={() => setEffortId(e.id)} style={{
                      padding: "6px 0", borderRadius: 7, fontSize: 11.5, cursor: "pointer",
                      background: effortId === e.id ? C.tealDim : "transparent",
                      border: `1px solid ${effortId === e.id ? C.tealDim : C.border}`,
                      color: effortId === e.id ? "#03100e" : C.textDim,
                      fontWeight: effortId === e.id ? 600 : 400, fontFamily: FONT }}>{e.label}</button>
                  ))}
                </div>
                {(() => {
                  const canThink = modelSupportsThinking(modelId);
                  return (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12,
                      cursor: canThink ? "pointer" : "not-allowed", fontSize: 13, opacity: canThink ? 1 : 0.45 }}>
                      <Switch on={canThink && thinkingOn} onClick={() => { if (canThink) setThinkingOn(v => !v); }} C={C} />
                      <Brain size={14} color={canThink && thinkingOn ? C.violet : C.textDim} />
                      <span style={{ color: canThink && thinkingOn ? C.text : C.textDim }}>Thinking</span>
                      {!canThink && <span style={{ fontSize: 10.5, color: C.textDim }}>(Haiku không hỗ trợ)</span>}
                    </label>
                  );
                })()}
                <div style={{ marginTop: 12, fontSize: 11.5, color: C.textDim }}>
                  Max tokens: <b style={{ color: C.text }}>{maxTokens.toLocaleString()}</b>
                </div>
                <input type="range" min={2000} max={32000} step={1000} value={maxTokens}
                  onChange={e => setMaxTokens(+e.target.value)} style={{ width: "100%", marginTop: 5 }} />
              </Card>

              {/* DANH SÁCH BÀI IMPORT (nếu có) */}
              {importedArticles.length > 0 && (
                <Card C={C} title={`Bài đã nhập (${importedArticles.length})`} icon={<Layers size={15} color={C.violet} />}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                    {importedArticles.map(art => {
                      const sel = art.id === selectedImportId;
                      return (
                        <button key={art.id} onClick={() => selectImportedArticle(art.id)} className="t4-card" style={{
                          display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 9px", borderRadius: 9,
                          background: sel ? C.panel2 : "transparent",
                          border: `1px solid ${sel ? C.violetDim : C.border}`,
                          color: C.text, textAlign: "left", fontSize: 12.5, cursor: "pointer", fontFamily: FONT,
                          transition: "border-color .15s" }}>
                          <FileText size={13} color={sel ? C.violet : C.textDim} style={{ marginTop: 1, flexShrink: 0 }} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontWeight: sel ? 600 : 400,
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{art.title}</span>
                            <span style={{ display: "block", fontSize: 10.5, color: C.textDim }}>
                              {art.category} · {(art.text || "").split(/\s+/).length} từ
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* TOOLBAR */}
              <Card C={C} title="Hành động" icon={<SlidersHorizontal size={15} color={C.teal} />}>
                <SmallBtn C={C} icon={<Wand2 size={12} />} label="Dọn cơ học (regex, 0 token)"
                  onClick={runMechanicalCleanup} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
                  <SmallBtn C={C} icon={<FolderInput size={12} />} label="Import"
                    onClick={() => fileRef.current?.click()} />
                  <SmallBtn C={C} icon={<FileJson size={12} />} label="Checkpoint"
                    onClick={exportCheckpoint} />
                  <SmallBtn C={C} icon={<RefreshCw size={12} />} label="Reset review"
                    onClick={resetReviewState} />
                  <SmallBtn C={C} icon={<Trash2 size={12} />}
                    label={clearArmed ? "Bấm lần nữa!" : "Xoá phiên"} danger
                    onClick={clearAll} />
                </div>
                <input ref={fileRef} type="file" accept=".md,.txt,.json" style={{ display: "none" }}
                  onChange={e => { e.target.files[0] && importFile(e.target.files[0]); e.target.value = ""; }} />
              </Card>
            </aside>

            {/* ─── MAIN COLUMN ─── */}
            <main style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

              {/* SECTION 1: INPUT BÀI VIẾT */}
              <Card C={C} title="Bài viết cần rà soát" icon={<Edit3 size={15} color={C.blue} />}>
                <input type="text" value={inputTitle} onChange={e => setInputTitle(e.target.value)}
                  placeholder="Tiêu đề bài (tuỳ chọn)"
                  style={{ width: "100%", padding: "9px 12px", marginBottom: 10, fontSize: 14,
                    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, color: C.text, outline: "none" }} />
                <textarea value={inputText} onChange={e => setInputText(e.target.value)}
                  placeholder="Paste bài viết vào đây… (Tool sẽ tự nhận diện ngôn ngữ và loại bài)"
                  style={{ width: "100%", minHeight: 220, padding: "11px 13px", fontSize: 13.5, lineHeight: 1.65,
                    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text,
                    resize: "vertical", outline: "none", fontFamily: FONT }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginTop: 8, fontSize: 11.5, color: C.textDim, fontFamily: MONO }}>
                  <span>{inputWordCount.toLocaleString()} từ · ~{Math.ceil(inputText.length / 4).toLocaleString()} tokens</span>
                  <span>Nhận diện: {effectiveLang === "vi" ? "🇻🇳 Việt" : "🇬🇧 Anh"} · {effectiveArticleType}</span>
                </div>
              </Card>

              {/* SECTION 2: CẤU HÌNH */}
              <Card C={C} title="Cấu hình rà soát" icon={<SlidersHorizontal size={15} color={C.teal} />}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 5 }}>Ngôn ngữ</div>
                    <select value={langChoice} onChange={e => setLangChoice(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", fontSize: 13, background: C.bg,
                        border: `1px solid ${C.border}`, borderRadius: 9, color: C.text,
                        outline: "none", fontFamily: FONT }}>
                      {LANG_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 5 }}>Loại bài</div>
                    <select value={articleType} onChange={e => setArticleType(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", fontSize: 13, background: C.bg,
                        border: `1px solid ${C.border}`, borderRadius: 9, color: C.text,
                        outline: "none", fontFamily: FONT }}>
                      {ARTICLE_TYPES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 7 }}>Reviewer kích hoạt</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                  {REVIEWERS.map(rev => (
                    <label key={rev.id} style={{ display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12.5,
                      background: reviewersOn[rev.id] ? C.panel2 : "transparent",
                      border: `1px solid ${reviewersOn[rev.id] ? rev.color : C.border}` }}>
                      <Switch on={reviewersOn[rev.id]}
                        onClick={() => setReviewersOn(prev => ({ ...prev, [rev.id]: !prev[rev.id] }))} C={C} />
                      <span style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, color: reviewersOn[rev.id] ? C.text : C.textDim }}>{rev.label}</span>
                        <span style={{ fontSize: 10.5, color: C.textDim, whiteSpace: "nowrap",
                          overflow: "hidden", textOverflow: "ellipsis" }}>{rev.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {/* Mức kiểm chứng — chỉ hiện khi Kiểm chứng bật */}
                {reviewersOn.factCheck && (
                  <div style={{ marginTop: 14, padding: "11px 12px", borderRadius: 9,
                    background: C.panel2, border: `1px solid ${verifyLevel === "strict" ? C.red : C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Mức kiểm chứng</span>
                      <div style={{ display: "flex", gap: 5 }}>
                        {[["standard", "Tiêu chuẩn"], ["strict", "Nghiêm ngặt (y tế)"]].map(([v, lbl]) => (
                          <button key={v} onClick={() => setVerifyLevel(v)} style={{
                            padding: "5px 10px", borderRadius: 7, fontSize: 11.5, cursor: "pointer", fontFamily: FONT,
                            background: verifyLevel === v ? (v === "strict" ? C.red : C.tealDim) : "transparent",
                            border: `1px solid ${verifyLevel === v ? (v === "strict" ? C.red : C.tealDim) : C.border}`,
                            color: verifyLevel === v ? "#fff" : C.textDim,
                            fontWeight: verifyLevel === v ? 600 : 400 }}>{lbl}</button>
                        ))}
                      </div>
                    </div>
                    <input type="text" value={nicheHint} onChange={e => setNicheHint(e.target.value)}
                      placeholder="Lĩnh vực kênh (vd: sức khỏe, tài chính, công nghệ...) — tự dò khi import"
                      style={{ width: "100%", padding: "7px 10px", fontSize: 12, background: C.bg,
                        border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: "none", fontFamily: FONT }} />
                    {verifyLevel === "strict" && (
                      <div style={{ marginTop: 7, fontSize: 11, color: C.textDim, lineHeight: 1.5 }}>
                        ⚕️ Chế độ nghiêm: mọi claim y tế phải có nguồn uy tín. Lưu ý — không tự tra web được nên claim sẽ được <b style={{ color: C.text }}>gắn cờ để bạn tự kiểm chứng</b>.
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {/* SECTION 3: RUN BUTTONS */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <BigBtn C={C} primary
                  icon={anyRunning ? <Loader2 size={16} className="t4-spin" /> : <Play size={16} />}
                  label={anyRunning ? "Đang rà soát…" : (runRound > 0 ? `Rà soát lại (vòng ${runRound + 1})` : "Rà soát toàn bộ")}
                  onClick={() => runReview({ skipDone: false })}
                  disabled={anyRunning || !inputText.trim() || enabledReviewerIds.length === 0} />
                {Object.values(results).some(r => r?.status === "pending" || r?.status === "error") && !anyRunning && (
                  <BigBtn C={C} icon={<RefreshCw size={16} />} label="Tiếp tục reviewer còn lại"
                    onClick={() => runReview({ skipDone: true })} disabled={anyRunning} />
                )}
                {anyRunning && (
                  <BigBtn C={C} icon={<Pause size={16} />} label="Dừng" onClick={stopRun} />
                )}
              </div>

              {/* SECTION 4: REVIEWER RESULTS (6 cards) */}
              {(Object.keys(results).length > 0 || anyRunning) && (
                <Card C={C} title="Kết quả từng reviewer" icon={<ListChecks size={15} color={C.cyan} />}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {REVIEWERS.filter(rev => reviewersOn[rev.id]).map(rev => (
                      <ReviewerCard key={rev.id} C={C} rev={rev}
                        result={results[rev.id]}
                        open={!!openCards[rev.id]}
                        onToggle={() => setOpenCards(p => ({ ...p, [rev.id]: !p[rev.id] }))}
                        onRerun={() => {
                          // chạy lại 1 reviewer cụ thể
                          (async () => {
                            await runOneReviewer(rev.id, inputText, effectiveLang, effectiveArticleType);
                            // tính lại verdict sau khi 1 reviewer rerun
                            setResults(currentResults => {
                              let allPass = true, anyErr = false;
                              enabledReviewerIds.forEach(id => {
                                const r = currentResults[id];
                                if (!r || r.status === "pending" || r.status === "running") allPass = false;
                                else if (r.status === "error") { anyErr = true; allPass = false; }
                                else if (!r.passed) allPass = false;
                              });
                              setVerdict(allPass ? "PASSED" : (anyErr ? "PARTIAL" : "REJECTED"));
                              return currentResults;
                            });
                          })();
                        }}
                      />
                    ))}
                  </div>
                </Card>
              )}

              {/* SECTION 5: VERDICT */}
              {allDone && verdict !== "PENDING" && (
                <div className="t4-fade" style={{
                  padding: "18px 20px", borderRadius: 14,
                  background: verdict === "PASSED" ? `linear-gradient(135deg, ${C.success}15, ${C.teal}10)`
                            : verdict === "REJECTED" ? `linear-gradient(135deg, ${C.danger}15, ${C.amber}10)`
                            : `linear-gradient(135deg, ${C.amber}15, ${C.danger}10)`,
                  border: `1px solid ${verdict === "PASSED" ? C.success : verdict === "REJECTED" ? C.danger : C.amber}55`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {verdict === "PASSED" ? <CheckCircle2 size={36} color={C.success} />
                      : verdict === "REJECTED" ? <XCircle size={36} color={C.danger} />
                      : <AlertTriangle size={36} color={C.amber} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>
                        {verdict === "PASSED" ? "DUYỆT" : verdict === "REJECTED" ? "TỪ CHỐI" : "HOÀN THÀNH (có lỗi gọi API)"}
                      </div>
                      <div style={{ fontSize: 13, color: C.textDim }}>
                        Vòng {runRound} ·
                        {" "}{enabledReviewerIds.filter(id => results[id]?.passed).length}/{enabledReviewerIds.length} reviewer PASS ·
                        {" "}{totalIssues} lỗi {highIssues > 0 && `(${highIssues} high)`}
                      </div>
                    </div>
                    {verdict === "PASSED" && (
                      <BigBtn C={C} primary icon={<Download size={15} />} label="Export cho Tool 5"
                        onClick={exportForTool5} />
                    )}
                    {(verdict === "REJECTED" || verdict === "PARTIAL") && totalIssues > 0 && !fixedText && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {fixableIssues.length > 0 && (
                          <BigBtn C={C} primary icon={<Wand2 size={15} />}
                            label={`Sửa ${fixableIssues.length} đoạn (0 token)`}
                            onClick={applyTargetedFix} disabled={fixBusy} />
                        )}
                        <BigBtn C={C} violet primary={fixableIssues.length === 0}
                          icon={fixBusy ? <Loader2 size={15} className="t4-spin" /> : <RefreshCw size={15} />}
                          label={fixBusy ? "Đang viết lại…" : "AI viết lại"}
                          onClick={runAIRewrite} disabled={fixBusy} />
                      </div>
                    )}
                  </div>
                  {/* GỢI Ý fix */}
                  {(verdict === "REJECTED" || verdict === "PARTIAL") && totalIssues > 0 && !fixedText && (
                    <div style={{ marginTop: 12, padding: "9px 12px", borderRadius: 9,
                      background: C.panel2, border: `1px solid ${C.border}`, fontSize: 12, color: C.textDim }}>
                      💡 <b style={{ color: C.text }}>Sửa {fixableIssues.length} đoạn (0 token)</b>: thay trực tiếp đoạn lỗi reviewer đã chỉ ra, không tốn API.
                      {globalIssues.length > 0 && <> Còn <b style={{ color: C.text }}>{globalIssues.length}</b> lỗi toàn cục (đoạn đều, cấu trúc) cần "AI viết lại".</>}
                    </div>
                  )}
                  {/* CẢNH BÁO 2 VÒNG vẫn fail */}
                  {verdict === "REJECTED" && runRound >= 2 && (
                    <div style={{ marginTop: 12, padding: "9px 12px", borderRadius: 9,
                      background: C.amber + "15", border: `1px solid ${C.amber}55`, fontSize: 12.5 }}>
                      ⚠️ Đã rà soát {runRound} vòng vẫn còn lỗi. Cân nhắc viết lại thủ công hoặc đổi model mạnh hơn.
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 6: AUTO-FIX OUTPUT */}
              {(fixBusy || fixedText) && (
                <Card C={C} title="Bản sửa đề xuất (AI)" icon={<Wand2 size={15} color={C.violet} />}>
                  {fixBusy && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                      background: C.bg, borderRadius: 9, fontSize: 13, marginBottom: 10 }}>
                      <Loader2 size={15} color={C.violet} className="t4-spin" />
                      <span style={{ color: C.textDim }}>
                        Đang sửa toàn bài… ({(fixStream || "").length.toLocaleString()} ký tự đã nhận)
                      </span>
                    </div>
                  )}
                  {(fixedText || fixStream) && (
                    <>
                      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                        <button onClick={() => setShowDiff(s => !s)} style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 7,
                          background: showDiff ? C.panel2 : "transparent",
                          border: `1px solid ${C.border}`, color: C.text, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>
                          {showDiff ? <EyeOff size={12} /> : <Eye size={12} />}
                          {showDiff ? "Ẩn so sánh" : "Hiện so sánh"}
                        </button>
                        {fixedText && !fixBusy && (
                          <>
                            <button onClick={() => { navigator.clipboard?.writeText(fixedText); showToast("Đã copy bản sửa"); }} style={{
                              display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 7,
                              background: "transparent", border: `1px solid ${C.border}`,
                              color: C.text, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>
                              <Copy size={12} /> Copy
                            </button>
                            <button onClick={applyFix} style={{
                              display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 7,
                              background: C.tealDim, border: `1px solid ${C.tealDim}`,
                              color: "#03100e", fontSize: 12, cursor: "pointer", fontWeight: 600, fontFamily: FONT }}>
                              <CheckCircle2 size={12} /> Áp dụng bản sửa
                            </button>
                            <button onClick={discardFix} style={{
                              display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 7,
                              background: "transparent", border: `1px solid ${C.danger}55`,
                              color: C.danger, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>
                              <Trash2 size={12} /> Bỏ
                            </button>
                          </>
                        )}
                      </div>
                      {showDiff ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>BẢN GỐC</div>
                            <pre style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9,
                              padding: 11, fontSize: 12, lineHeight: 1.6, maxHeight: 400, overflowY: "auto",
                              whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: FONT, color: C.textDim, margin: 0 }}>
                              {inputText}
                            </pre>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: C.violet, marginBottom: 4 }}>BẢN SỬA</div>
                            <pre style={{ background: C.bg, border: `1px solid ${C.violetDim}`, borderRadius: 9,
                              padding: 11, fontSize: 12, lineHeight: 1.6, maxHeight: 400, overflowY: "auto",
                              whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: FONT, color: C.text, margin: 0 }}>
                              {fixedText || fixStream}
                            </pre>
                          </div>
                        </div>
                      ) : (
                        <pre style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9,
                          padding: 12, fontSize: 13, lineHeight: 1.65, maxHeight: 450, overflowY: "auto",
                          whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: FONT, color: C.text, margin: 0 }}>
                          {fixedText || fixStream}
                        </pre>
                      )}
                    </>
                  )}
                </Card>
              )}

              {/* SECTION 7: EXPORT */}
              {(allDone || fixedText) && (
                <Card C={C} title="Xuất file" icon={<Download size={15} color={C.teal} />}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <SmallBtn C={C} icon={<FileText size={12} />} label="Bài đã duyệt (MD)"
                      onClick={exportFixedMD} />
                    <SmallBtn C={C} icon={<ClipboardCheck size={12} />} label="Phiếu review (MD)"
                      onClick={exportReviewReportMD} />
                    <SmallBtn C={C} icon={<FileJson size={12} />} label="Checkpoint (JSON)"
                      onClick={exportCheckpoint} />
                    <SmallBtn C={C} icon={<Download size={12} />} label="Output cho Tool 5"
                      onClick={exportForTool5} />
                  </div>
                </Card>
              )}

              {/* SECTION 8: LỊCH SỬ VÒNG */}
              {history.length > 0 && (
                <Card C={C} title={`Lịch sử rà soát (${history.length})`} icon={<Clock size={15} color={C.textDim} />}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontFamily: MONO }}>
                    {history.slice().reverse().map((h, i) => (
                      <div key={h.runId} style={{ display: "flex", gap: 10, padding: "5px 8px", borderRadius: 6,
                        background: i === 0 ? C.panel2 : "transparent",
                        color: h.verdict === "PASSED" ? C.success : h.verdict === "REJECTED" ? C.danger : C.amber }}>
                        <span>Vòng {h.round}</span>
                        <span style={{ color: C.textDim }}>·</span>
                        <span>{h.verdict}</span>
                        <span style={{ color: C.textDim }}>·</span>
                        <span style={{ color: C.textDim }}>{h.totalIssues} lỗi</span>
                        <span style={{ color: C.textDim, marginLeft: "auto" }}>
                          {new Date(h.ts).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </main>
          </div>
        )}

        {/* TOAST */}
        {toast && (
          <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
            padding: "10px 18px", borderRadius: 11, background: C.panel, color: C.text,
            border: `1px solid ${C.tealDim}`, fontSize: 13.5, zIndex: 99,
            boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }} className="t4-fade">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ════════════════════════════════════════════════════════════════════ */

function Card({ C, title, icon, children }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12,
        fontSize: 12.5, color: C.textDim, fontWeight: 600 }}>
        {icon}{title}
      </div>
      {children}
    </div>
  );
}

function Switch({ on, onClick, C }) {
  return (
    <span onClick={onClick} style={{ width: 36, height: 20, borderRadius: 20, flexShrink: 0,
      cursor: "pointer", background: on ? C.tealDim : C.border, position: "relative", transition: ".18s" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: 16,
        background: "#fff", transition: ".18s" }} />
    </span>
  );
}

function Pill({ C, icon, text, color }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 9,
      background: C.panel, border: `1px solid ${C.border}`, fontSize: 12, color: color || C.textDim, fontFamily: MONO }}>
      {icon}{text}
    </span>
  );
}

function BigBtn({ C, label, icon, onClick, primary, violet, full, disabled }) {
  const bg = primary ? (violet ? C.violetDim : C.tealDim) : "transparent";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      padding: "11px 17px", borderRadius: 11, cursor: disabled ? "not-allowed" : "pointer",
      width: full ? "100%" : "auto", opacity: disabled ? 0.55 : 1,
      background: bg, border: `1px solid ${primary ? bg : C.border}`,
      color: primary ? (violet ? "#fff" : "#03100e") : C.text,
      fontSize: 13.5, fontWeight: 600, fontFamily: FONT }}>
      {icon}{label}
    </button>
  );
}

function SmallBtn({ C, label, icon, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      padding: "9px 8px", borderRadius: 9, cursor: "pointer", background: "transparent",
      border: `1px solid ${danger ? C.danger + "55" : C.border}`,
      color: danger ? C.danger : C.text, fontSize: 12, fontFamily: FONT }}>
      {icon}{label}
    </button>
  );
}

/* ── REVIEWER CARD: hiển thị status + score + issues list (collapsible) ── */
function ReviewerCard({ C, rev, result, open, onToggle, onRerun }) {
  const status = result?.status || "idle";
  const issueCount = result?.issues?.length || 0;
  const passed = !!result?.passed;
  const isDone = status === "done";

  // Màu theo status
  const borderColor =
    status === "running" ? rev.color :
    isDone ? (passed ? C.success : C.danger) :
    status === "error" ? C.danger :
    C.border;

  return (
    <div style={{ background: C.panel2, border: `1px solid ${borderColor}`,
      borderRadius: 11, overflow: "hidden", transition: "border-color .2s" }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px", cursor: "pointer", background: C.panel }}>
        <span style={{ width: 8, height: 8, borderRadius: 8, background: rev.color, flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text }}>{rev.label}</span>
          <span style={{ display: "block", fontSize: 10.5, color: C.textDim, whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis" }}>{rev.description}</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {status === "running" && <Loader2 size={14} color={rev.color} className="t4-spin" />}
          {status === "pending" && <Clock size={14} color={C.textDim} />}
          {isDone && (passed
            ? <CheckCircle2 size={16} color={C.success} />
            : <XCircle size={16} color={C.danger} />)}
          {status === "error" && <AlertCircle size={16} color={C.danger} />}
          {isDone && (
            <span style={{ fontSize: 11.5, color: C.textDim, fontFamily: MONO }}>
              {result.score}/10
              {issueCount > 0 && <span style={{ color: C.amber, marginLeft: 4 }}>· {issueCount}</span>}
            </span>
          )}
          {(isDone || status === "error") && (
            <button onClick={(e) => { e.stopPropagation(); onRerun(); }} style={{
              padding: "3px 5px", borderRadius: 6, background: "transparent",
              border: `1px solid ${C.border}`, color: C.textDim, cursor: "pointer", display: "flex" }}
              title="Chạy lại reviewer này">
              <RefreshCw size={11} />
            </button>
          )}
          <ChevronRight size={14} color={C.textDim}
            style={{ transform: open ? "rotate(90deg)" : "none", transition: ".15s" }} />
        </span>
      </div>
      {open && (
        <div className="t4-fade" style={{ padding: "10px 12px", fontSize: 12.5, color: C.text, lineHeight: 1.55 }}>
          {result?.summary && (
            <div style={{ marginBottom: 9, padding: "7px 10px", background: C.bg, borderRadius: 7,
              borderLeft: `2px solid ${rev.color}`, fontSize: 12, color: C.textDim, fontStyle: "italic" }}>
              {result.summary}
            </div>
          )}
          {result?.error && (
            <div style={{ marginBottom: 9, padding: "7px 10px", background: C.danger + "15",
              borderRadius: 7, fontSize: 12, color: C.danger }}>
              ⚠️ {result.error}
            </div>
          )}
          {issueCount === 0 && isDone && passed && (
            <div style={{ color: C.success, fontSize: 12.5 }}>✓ Không có vấn đề.</div>
          )}
          {issueCount > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {result.issues.map((it, i) => (
                <IssueRow key={i} C={C} issue={it} idx={i} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IssueRow({ C, issue, idx }) {
  const sevColor = issue.severity === "high" ? C.danger
                 : issue.severity === "medium" ? C.amber : C.textDim;
  return (
    <div style={{ padding: "8px 10px", background: C.bg, borderRadius: 7,
      border: `1px solid ${C.border}`, borderLeft: `3px solid ${sevColor}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, marginBottom: 5,
        fontFamily: MONO, color: sevColor, textTransform: "uppercase" }}>
        <span>{issue.severity}</span>
        <span style={{ color: C.textDim }}>·</span>
        <span style={{ color: C.textDim }}>{issue.type}</span>
        {issue.excerpt && issue.fix && issue.excerpt.trim() !== issue.fix.trim() && (
          <span style={{ marginLeft: "auto", fontSize: 9.5, padding: "1px 6px", borderRadius: 5,
            background: C.success + "22", color: C.success }}>sửa được 0 token</span>
        )}
      </div>
      {issue.excerpt && (
        <div style={{ fontSize: 12, padding: "5px 8px", background: C.danger + "11", borderRadius: 5,
          marginBottom: issue.fix ? 4 : 5, fontFamily: MONO, color: C.text, wordBreak: "break-word",
          borderLeft: `2px solid ${C.danger}66` }}>
          {issue.excerpt}
        </div>
      )}
      {issue.fix ? (
        <div style={{ fontSize: 12, padding: "5px 8px", background: C.success + "11", borderRadius: 5,
          fontFamily: MONO, color: C.text, wordBreak: "break-word", borderLeft: `2px solid ${C.success}66` }}>
          {issue.fix}
        </div>
      ) : issue.suggestion ? (
        <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>
          → {issue.suggestion}
        </div>
      ) : null}
    </div>
  );
}
