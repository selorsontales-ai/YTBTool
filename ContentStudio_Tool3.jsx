import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Upload, Download, Sparkles, Cpu, Brain, ChevronDown, Check, X, Trash2,
  RefreshCw, Loader2, AlertTriangle, FileJson, FileText, Image as ImageIcon,
  Copy, SlidersHorizontal, Play, FolderInput, BookOpen, ScrollText, FileCheck2,
  Layers, Wand2, Ban, ClipboardCheck, ChevronRight, Globe,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════════
   TOOL 3 — CONTENT PRODUCTION STUDIO  (Module 3 / 3)
   Nhận JSON từ Tool 2 → thực thi tạo nội dung cuối cùng.
   • text_generation  → gom payload (prompt + sliders/toggles + Rules/Reference)
                         → gọi Claude API stream → nội dung hoàn chỉnh.
   • image_generation → Clipboard Manager, copy prompt mang đi MJ/Leonardo.
   • Bảng điều khiển động: render slider/toggle/dropdown theo `category`.
   • Context Injection: nạp file Rules (.md/.txt) + Reference (.md/.txt).
   • Checkpoint Import/Export JSON + auto-save window.storage.
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
  // Giá theo tài liệu Anthropic chính thức (Claude Code _base.py). USD / 1M token.
  "claude-haiku-4-5-20251001": { input: 1.00,  output: 5.00  },
  "claude-sonnet-4-6":         { input: 3.00,  output: 15.00 },
  "claude-opus-4-6":           { input: 15.00, output: 75.00 },
  "claude-opus-4-7":           { input: 5.00,  output: 25.00 },
  "claude-opus-4-8":           { input: 15.00, output: 75.00 }, // chưa có trong bảng chính thức — giữ thận trọng
};

const CHECKPOINT_VERSION = "tool3-contentstudio-v1";
const STORAGE_KEY = "tool3_contentstudio_autosave";

/* ─── BẢNG ĐIỀU KHIỂN ĐỘNG: schema control theo category ──────────────
   Mỗi category map ra một bộ control. Khi render, đọc CONTROL_SCHEMA[cat].
   - slider: { type, key, label, min, max, step, default, marks:[lo,mid,hi] }
   - toggle: { type, key, label, default }
   - select: { type, key, label, options:[{v,label}], default }
   Hàm buildDirectives() biến giá trị control → chỉ dẫn ngôn ngữ tự nhiên
   để chèn vào payload gửi Claude (chỉ áp dụng cho text_generation). */
const CONTROL_SCHEMA = {
  video_script: [
    { type: "slider", key: "depth",  label: "Độ chuyên sâu",  min: 1, max: 5, step: 1, default: 3,
      marks: ["Phổ thông", "Cân bằng", "Học thuật"] },
    { type: "slider", key: "pace",   label: "Nhịp điệu",      min: 1, max: 5, step: 1, default: 3,
      marks: ["Chậm rãi", "Vừa phải", "Dồn dập"] },
    { type: "slider", key: "humor",  label: "Độ hài hước",    min: 0, max: 5, step: 1, default: 1,
      marks: ["Nghiêm túc", "Thi thoảng", "Rất hài"] },
    { type: "slider", key: "words",  label: "Độ dài (từ)",    min: 500, max: 6000, step: 250, default: 2000,
      unit: "từ" },
    { type: "select", key: "hook",   label: "Kiểu mở đầu",    default: "question",
      options: [{ v: "question", label: "Câu hỏi gây tò mò" }, { v: "shock", label: "Sự thật gây sốc" },
                { v: "story", label: "Mẩu chuyện" }, { v: "stat", label: "Con số ấn tượng" }] },
    { type: "toggle", key: "cta",    label: "Có Call-to-action cuối video", default: true },
    { type: "toggle", key: "timestamp", label: "Chèn gợi ý chia đoạn/timestamp", default: false },
  ],
  seo_title: [
    { type: "slider", key: "clickbait", label: "Mức độ Clickbait", min: 1, max: 5, step: 1, default: 3,
      marks: ["An toàn", "Hấp dẫn", "Giật tít"] },
    { type: "slider", key: "count",     label: "Số tiêu đề tạo ra", min: 3, max: 20, step: 1, default: 8,
      unit: "tiêu đề" },
    { type: "toggle", key: "number",    label: "Bắt buộc chứa số liệu", default: true },
    { type: "toggle", key: "caps",      label: "Dùng CAPS LOCK nhấn mạnh", default: false },
    { type: "toggle", key: "emoji",     label: "Cho phép emoji", default: false },
  ],
  description: [
    { type: "slider", key: "length",  label: "Độ dài mô tả", min: 1, max: 5, step: 1, default: 3,
      marks: ["Ngắn gọn", "Vừa", "Chi tiết"] },
    { type: "slider", key: "kwd",     label: "Mật độ từ khoá", min: 1, max: 5, step: 1, default: 3,
      marks: ["Tự nhiên", "Cân bằng", "Dày đặc"] },
    { type: "toggle", key: "hashtags",  label: "Kèm hashtag", default: true },
    { type: "toggle", key: "chapters",  label: "Kèm khung chapter/timestamp", default: true },
    { type: "toggle", key: "links",     label: "Chừa chỗ link MXH/affiliate", default: false },
  ],
  thumbnail: [
    { type: "select", key: "ratio",   label: "Tỷ lệ ảnh", default: "16:9",
      options: [{ v: "16:9", label: "16:9 (Ngang)" }, { v: "9:16", label: "9:16 (Dọc/Shorts)" },
                { v: "1:1", label: "1:1 (Vuông)" }] },
    { type: "slider", key: "stylize", label: "Stylize", min: 0, max: 1000, step: 50, default: 250 },
    { type: "slider", key: "chaos",   label: "Chaos",   min: 0, max: 100,  step: 5,  default: 10 },
    { type: "select", key: "mood",    label: "Tông màu", default: "vibrant",
      options: [{ v: "vibrant", label: "Rực rỡ, tương phản cao" }, { v: "dark", label: "Tối, bí ẩn" },
                { v: "warm", label: "Ấm, hoài niệm" }, { v: "clean", label: "Sạch, tối giản" }] },
    { type: "toggle", key: "facetext", label: "Có khuôn mặt biểu cảm + text overlay", default: true },
  ],
  broll: [
    { type: "select", key: "ratio",  label: "Tỷ lệ ảnh", default: "16:9",
      options: [{ v: "16:9", label: "16:9" }, { v: "9:16", label: "9:16" }, { v: "1:1", label: "1:1" }] },
    { type: "slider", key: "stylize", label: "Stylize", min: 0, max: 1000, step: 50, default: 150 },
    { type: "select", key: "look",   label: "Phong cách", default: "cinematic",
      options: [{ v: "cinematic", label: "Điện ảnh" }, { v: "photoreal", label: "Ảnh thực" },
                { v: "illustration", label: "Minh hoạ" }, { v: "3d", label: "3D render" }] },
  ],
};
/* Control mặc định cho category lạ (text) */
const FALLBACK_TEXT_CONTROLS = [
  { type: "slider", key: "depth", label: "Độ chuyên sâu", min: 1, max: 5, step: 1, default: 3,
    marks: ["Phổ thông", "Cân bằng", "Chuyên sâu"] },
  { type: "slider", key: "words", label: "Độ dài (từ)", min: 300, max: 5000, step: 250, default: 1500, unit: "từ" },
];

const isImageType = (p) => p?.type === "image_generation" || p?.category === "thumbnail" || p?.category === "broll";

function controlsFor(p) {
  if (CONTROL_SCHEMA[p?.category]) return CONTROL_SCHEMA[p.category];
  return isImageType(p) ? (CONTROL_SCHEMA.broll) : FALLBACK_TEXT_CONTROLS;
}

/* ─── Biến giá trị control → chỉ dẫn ngôn ngữ tự nhiên (text_generation) ── */
function buildDirectives(category, vals) {
  const sch = CONTROL_SCHEMA[category] || FALLBACK_TEXT_CONTROLS;
  const lines = [];
  const markOf = (c, v) => {
    if (!c.marks) return String(v);
    const idx = Math.round(((v - c.min) / (c.max - c.min)) * (c.marks.length - 1));
    return c.marks[Math.max(0, Math.min(c.marks.length - 1, idx))];
  };
  for (const c of sch) {
    const v = vals[c.key] ?? c.default;
    if (c.type === "slider") {
      lines.push(`- ${c.label}: ${c.marks ? `${markOf(c, v)} (mức ${v}/${c.max})` : `${v}${c.unit ? " " + c.unit : ""}`}`);
    } else if (c.type === "toggle") {
      lines.push(`- ${c.label}: ${v ? "CÓ" : "KHÔNG"}`);
    } else if (c.type === "select") {
      const opt = c.options.find(o => o.v === v);
      lines.push(`- ${c.label}: ${opt ? opt.label : v}`);
    }
  }
  return lines.join("\n");
}

/* ─── Build prompt Midjourney từ control (image_generation) ──────────── */
function buildImagePrompt(p, vals) {
  const c = controlsFor(p);
  let suffix = "";
  const ratio = vals.ratio ?? "16:9";
  suffix += ` --ar ${ratio}`;
  if (vals.stylize != null) suffix += ` --stylize ${vals.stylize}`;
  if (vals.chaos != null && vals.chaos > 0) suffix += ` --chaos ${vals.chaos}`;
  const moodMap = { dark: "dark moody lighting", warm: "warm nostalgic tones",
    clean: "clean minimal background", vibrant: "vibrant high-contrast colors" };
  const lookMap = { cinematic: "cinematic film still", photoreal: "photorealistic",
    illustration: "digital illustration", "3d": "3D render, octane" };
  const extra = [moodMap[vals.mood], lookMap[vals.look],
    vals.facetext ? "expressive face, bold text overlay space" : ""].filter(Boolean).join(", ");
  return `${p.prompt}${extra ? ", " + extra : ""}${suffix}`.trim();
}

/* model nào hỗ trợ thinking (adaptive). Haiku KHÔNG hỗ trợ. Nguồn: llm.py Claude Code. */
function modelSupportsThinking(id) {
  if (!id) return false;
  const lower = id.toLowerCase();
  if (lower.includes("haiku")) return false;          // Haiku 4.5 & cũ hơn: không adaptive
  const m = lower.match(/-(\d+)-(\d+)/);
  if (m) { const M = +m[1], n = +m[2]; return M > 4 || (M === 4 && n >= 6); }
  return true;                                         // model mới chưa biết → ưu tiên bật
}

/* ─── CLAUDE API (zero-key, streaming) — theo tài liệu Anthropic (llm.py) ──
   • Model 4.6+ : thinking adaptive → { type:"adaptive" } + output_config.effort
   • Model cũ   : KHÔNG gửi thinking (tool này chỉ dùng 4.5+; Haiku không thinking)
   • effort luôn gửi qua output_config; beta header effort-2025-11-24 */
async function callClaude(system, user, onChunk, cfg = {}) {
  const { model = "claude-sonnet-4-6", thinkingOn = false, effortId = "high", maxTokens = 16000, prefill = "", webSearch = false } = cfg;
  const messages = [{ role: "user", content: user }];
  // prefill: mồi sẵn phần đã có để model VIẾT TIẾP (dùng khi resume nội dung dang dở)
  if (prefill) messages.push({ role: "assistant", content: prefill });

  const body = {
    model, max_tokens: maxTokens, stream: true, system,
    messages,
    output_config: { effort: effortId },
  };
  // chỉ bật thinking khi model hỗ trợ (tránh lỗi với Haiku)
  if (thinkingOn && modelSupportsThinking(model)) body.thinking = { type: "adaptive" };
  // web_search: server tool của Anthropic — bám nguồn uy tín khi cần dữ kiện
  if (webSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "anthropic-beta": "effort-2025-11-24" },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`API ${res.status}: ${err.slice(0, 200)}`); }

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
}

/* ════════════════════════════════════════════════════════════════════
   EDITORIAL DNA — chắt lọc từ "viet-chuyen-nghiep". TỰ THÍCH ỨNG theo kênh.
   • Phần A (anti-AI): luật phổ quát, áp cho MỌI kênh/ngôn ngữ.
   • Phần B (storytelling): kỹ thuật essay, CHỈ áp khi kênh hợp giọng kể chuyện.
   Đọc toneVoice + videoFormat từ channel để quyết định và điều chỉnh ngôn ngữ.
   ════════════════════════════════════════════════════════════════════ */
const TECHNICAL_FORMATS = ["tài liệu", "kỹ thuật", "documentary", "tutorial", "hướng dẫn", "how-to", "review", "phân tích", "top list", "top-list", "list"];
function isStorytellingChannel(channel) {
  const fmt = []
    .concat(channel?.videoFormat || [], channel?.toneVoice || [])
    .join(" ").toLowerCase();
  // nếu kênh thiên tài liệu/list/tutorial → KHÔNG ép kỹ thuật storytelling
  if (TECHNICAL_FORMATS.some(t => fmt.includes(t))) return false;
  return true; // mặc định coi là kể chuyện (hợp đa số kênh YouTube)
}
function detectLanguage(channel) {
  const blob = [channel?.channelName, channel?.tagline, channel?.description,
    ...(channel?.contentPillars || []), ...(channel?.targetAudience || [])].join(" ");
  // đếm ký tự có dấu tiếng Việt — nhiều → kênh Việt
  const viet = (blob.match(/[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/gi) || []).length;
  return viet >= 3 ? "vi" : "unknown";
}

function buildEditorialDNA(channel) {
  const lang = detectLanguage(channel);
  const story = isStorytellingChannel(channel);
  const tone = [].concat(channel?.toneVoice || []).join(", ");

  // điều chỉnh giọng theo kênh (nếu có)
  const toneLine = tone ? `\n## Giọng kênh (bám sát)\n- Viết đúng giọng kênh đã định: ${tone}.\n` : "";

  // luật ngôn ngữ — chỉ ép thuần Việt khi phát hiện kênh Việt
  const langRule = lang === "vi"
    ? `- KHÔNG trộn tiếng Anh giữa câu (trừ thuật ngữ phổ biến: AI, CEO, KPI...). "deliver results" → "mang lại kết quả".\n- Viết hoa: chỉ đầu câu + tên riêng. CẤM Viết Hoa Kiểu Tiếng Anh (Title Case).\n- CẤM dấu gạch dài em-dash "—" và "–". Dùng gạch ngang "-" có dấu cách hai bên, hoặc tách thành câu riêng. Đây là lỗi tố cáo văn AI rõ nhất trong tiếng Việt.\n- Hạn chế dấu hai chấm ":" — chỉ cho liệt kê thật sự, trích dẫn trực tiếp, hoặc giờ giấc. KHÔNG dùng ":" để nối ý giữa câu kể ("Luật quy định: không..." → "Luật quy định là không...").\n- Dấu câu sát từ trước, cách từ sau. KHÔNG đặt phẩy trước "và" (Oxford comma): "nhanh, gọn và đúng" chứ không phải "nhanh, gọn, và đúng".\n`
    : `- Viết đúng ngôn ngữ chủ đạo của kênh (suy từ thông tin kênh). Giữ nhất quán ngôn ngữ, không trộn lẫn tuỳ tiện.\n- Tránh lạm dụng em-dash "—" để nối ý lan man; ưu tiên câu gọn. Dùng dấu câu nhất quán.\n`;

  // Phần A — anti-AI, luôn áp
  const antiAI =
`# CHUẨN BIÊN TẬP — áp cho kênh này
${toneLine}
## LUẬT CHỐNG VĂN AI (phổ quát — vi phạm = hỏng bài)
${langRule}- KHÔNG over-format: không bôi đậm nhãn, không "Điểm 1:/Điểm 2:".
- KHÔNG nhãn kiểu AI: "Key insights:", "Note:", "Summary:" → viết thành câu văn thường.
- KHÔNG lạm dụng một từ nối (mỗi từ nối ≤2-3 lần/bài). Đa dạng cách nối câu.
- KHÔNG hedge quá mức ("có thể", "thường" ở mọi câu) — dám khẳng định.
- KHÔNG quá mượt mà đều đặn — văn người thật có chỗ gồ ghề, ý nói nhiều ý lướt qua.
- Độ dài đoạn biến thiên, tránh mọi đoạn dài bằng nhau.`;

  if (!story) {
    // kênh tài liệu/list/tutorial — cho phép cấu trúc rõ ràng, KHÔNG ép essay
    return antiAI + `

## Thể loại: thông tin/hướng dẫn (KHÔNG phải kể chuyện)
- Cấu trúc rõ ràng theo mạch nội dung; được phép dùng cấu trúc liệt kê nếu phù hợp thể loại.
- Ưu tiên chính xác, dễ theo dõi hơn là kịch tính. Vẫn tránh dấu vết AI ở trên.`;
  }

  // kênh kể chuyện — áp đầy đủ kỹ thuật essay
  return antiAI + `

## Cốt lõi nội dung (kênh kể chuyện)
- Mỗi bài xoay quanh MỘT insight, đặt gần đầu, đừng chôn.
- Logic chain tự nhiên A→B→C, không nhảy cóc, không liệt kê rời rạc.
- SHOW, không TELL: thay vì "mất nhiều thời gian" → "6 tháng chờ, 2.400 USD". Người đọc không hình dung được = đang tell.

## Mở bài (chọn 1, nối thẳng insight)
- Hành vi quen thuộc / dự đoán táo bạo / con số sốc / mẩu chuyện chứng kiến.
- CẤM mở "Trong bài viết này...", "Hôm nay chúng ta...".

## Nhịp văn (chống đều đều kiểu AI)
- 70-20-10: ~70% đoạn vừa (3-7 câu), ~20% đoạn ngắn (1-2 câu), ~10% câu đơn cho insight then chốt.
- Câu đơn tách dòng tối đa 3-4 lần/bài, chỉ cho insight mạnh.
- KHÔNG bullet/gạch đầu dòng trong văn kể chuyện — chuyển thành câu văn liền mạch.

## Kết bài (chọn 1)
- Câu hỏi khiến suy nghĩ / câu chốt cô đọng / callback hình ảnh mở đầu.
- CẤM kết bằng tóm tắt.`;
}

function costOf(modelId, usage) {
  if (!usage) return 0;
  const p = PRICING[modelId] ||
    (modelId.includes("haiku") ? PRICING["claude-haiku-4-5-20251001"]
      : modelId.includes("sonnet") ? PRICING["claude-sonnet-4-6"] : PRICING["claude-opus-4-8"]);
  return ((usage.input_tokens || 0) * p.input + (usage.output_tokens || 0) * p.output) / 1e6;
}

/* Lớp bảo hiểm: xoá nhãn sản xuất nếu model lỡ chèn (phần hình ảnh do Tool 5 lo).
   Bắt các dòng/cụm dạng [VISUAL: ...], [TIMESTAMP ...], [SCENE], [B-ROLL], [CUT], [HÌNH ẢNH]... */
function stripProductionTags(text) {
  if (!text) return text;
  const TAGS = "VISUAL|TIMESTAMP|SCENE|B-?ROLL|CUT|SHOT|HÌNH ẢNH|HINH ANH|CẢNH|CANH|ÂM THANH|AM THANH|SFX|MUSIC|NHẠC|NHAC|VOICE|VO|CAPTION|TEXT";
  const re = new RegExp(`\\[\\s*(?:${TAGS})\\b[^\\]]*\\]`, "gi");
  return text
    .split("\n")
    .map(line => line.replace(re, "").replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")   // gộp dòng trống thừa do xoá nhãn
    .trim();
}

/* ════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function ContentStudioTool3() {
  // model config
  const [modelId, setModelId]       = useState("claude-sonnet-4-6");
  const [thinkingOn, setThinkingOn] = useState(false);
  const [effortId, setEffortId]     = useState("high");
  const [maxTokens, setMaxTokens]   = useState(16000);

  // data
  const [channel, setChannel]   = useState(null);   // context từ Tool 2
  const [prompts, setPrompts]   = useState([]);      // [{...prompt, _result, _vals, _busy, _stream, _usage}]
  const [activeId, setActiveId] = useState(null);

  // advanced panel
  const [advancedOn, setAdvancedOn] = useState(false);
  // Editorial DNA — bộ kỹ thuật viết + luật anti-AI (chắt lọc từ viet-chuyen-nghiep)
  const [editorialOn, setEditorialOn] = useState(true);

  // context injection
  const [rulesText, setRulesText]   = useState("");
  const [rulesName, setRulesName]   = useState("");
  // đa-file tham chiếu: [{id, name, content, role:"source"|"style"|"data", on:bool}]
  const [refFiles, setRefFiles]     = useState([]);
  const [webSearchOn, setWebSearchOn] = useState(false); // bật web_search khi có source.md

  // ui
  const [toast, setToast]   = useState({ msg: "", vis: false });
  const [err, setErr]       = useState("");
  const [totalCost, setTotalCost] = useState(0);
  const importRef = useRef(null);
  const cpRef     = useRef(null);
  const rulesRef  = useRef(null);
  const refRef    = useRef(null);

  const showToast = useCallback((msg) => {
    setToast({ msg, vis: true });
    setTimeout(() => setToast(t => ({ ...t, vis: false })), 2200);
  }, []);

  const active = useMemo(() => prompts.find(p => p.id === activeId) || null, [prompts, activeId]);

  /* ── AUTO-SAVE ── */
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        if (!window.storage) return;
        await window.storage.set(STORAGE_KEY, JSON.stringify({
          channel, prompts: prompts.map(p => ({ ...p, _busy: false, _stream: "" })),
          activeId, rulesText, rulesName, refFiles, webSearchOn, advancedOn, editorialOn,
        }));
      } catch {}
    }, 1200);
    return () => clearTimeout(t);
  }, [channel, prompts, activeId, rulesText, rulesName, refFiles, webSearchOn, advancedOn, editorialOn]);

  useEffect(() => {
    (async () => {
      try {
        if (!window.storage) return;
        const r = await window.storage.get(STORAGE_KEY);
        if (r?.value) {
          const s = JSON.parse(r.value);
          if (s.prompts?.length) {
            setChannel(s.channel || null);
            setPrompts(s.prompts);
            setActiveId(s.activeId || s.prompts[0]?.id || null);
            setRulesText(s.rulesText || ""); setRulesName(s.rulesName || "");
            // tương thích: checkpoint cũ có refText/refName đơn lẻ → chuyển thành 1 refFile
            if (Array.isArray(s.refFiles)) setRefFiles(s.refFiles);
            else if (s.refText) setRefFiles([{ id: "legacy", name: s.refName || "reference.md", content: s.refText, role: "data", on: true }]);
            setWebSearchOn(!!s.webSearchOn);
            setAdvancedOn(!!s.advancedOn); if (s.editorialOn !== undefined) setEditorialOn(!!s.editorialOn);
          }
        }
      } catch {}
    })();
  }, []);

  /* ── Khởi tạo control values mặc định cho 1 prompt ── */
  function initVals(p) {
    const sch = controlsFor(p);
    const v = {};
    for (const c of sch) v[c.key] = c.default;
    return v;
  }

  /* ── IMPORT JSON từ Tool 2 ── */
  function importFromTool2(file) {
    const fr = new FileReader();
    fr.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const list = Array.isArray(data) ? data : data.prompts;
        if (!Array.isArray(list) || !list.length) throw new Error("Không tìm thấy mảng prompts");
        const norm = list.map((p, i) => ({
          id: p.id || `p_${Date.now()}_${i}`,
          setId: p.setId || null,
          type: p.type || (isImageType(p) ? "image_generation" : "text_generation"),
          category: p.category || "video_script",
          categoryLabel: p.categoryLabel || p.category || "Prompt",
          title: p.title || `Mục ${i + 1}`,
          prompt: p.prompt || "",
          _result: "", _vals: null, _busy: false, _stream: "", _usage: null,
        }));
        norm.forEach(p => { p._vals = initVals(p); });
        setChannel(data.channel || null);
        setPrompts(norm);
        setActiveId(norm[0].id);
        setErr("");
        showToast(`Đã nạp ${norm.length} prompt từ Tool 2`);
      } catch (e2) { setErr("File không hợp lệ: " + e2.message); }
    };
    fr.readAsText(file);
  }

  /* ── Đọc file Rules / Reference ── */
  // tự nhận vai trò file theo tên: source* → nguồn dữ kiện; mau*/style* → bài mẫu văn phong
  function roleOfName(name) {
    const n = (name || "").toLowerCase();
    if (n.includes("source") || n.includes("nguon")) return "source";
    if (n.includes("mau") || n.includes("style") || n.includes("sample")) return "style";
    return "data";
  }
  function readContextFile(file, which) {
    const fr = new FileReader();
    fr.onload = (e) => {
      const txt = String(e.target.result || "");
      if (which === "rules") { setRulesText(txt); setRulesName(file.name); showToast(`Đã nạp Rules: ${file.name}`); }
      else {
        const role = roleOfName(file.name);
        setRefFiles(prev => {
          const without = prev.filter(f => f.name !== file.name); // ghi đè nếu trùng tên
          return [...without, { id: Math.random().toString(36).slice(2, 9), name: file.name, content: txt, role, on: true }];
        });
        if (role === "source") setWebSearchOn(true); // có source.md → mặc định bật web_search
        showToast(`Đã nạp ${role === "source" ? "Nguồn (source)" : role === "style" ? "Bài mẫu (style)" : "Tài liệu"}: ${file.name}`);
      }
    };
    fr.readAsText(file);
  }
  function toggleRefFile(id) { setRefFiles(prev => prev.map(f => f.id === id ? { ...f, on: !f.on } : f)); }
  function removeRefFile(id) { setRefFiles(prev => prev.filter(f => f.id !== id)); }

  /* ── Cập nhật giá trị control của prompt đang active ── */
  function setVal(key, value) {
    setPrompts(ps => ps.map(p => p.id === activeId ? { ...p, _vals: { ...p._vals, [key]: value } } : p));
  }

  /* ── NGHIÊN CỨU: web_search 1 lần trước khi viết → chắt lọc thành kho
     dữ kiện riêng của prompt (_research). Khi viết sẽ KHÔNG search lại. ── */
  async function runResearch(p) {
    if (p._researchBusy) return;
    setErr("");
    setPrompts(ps => ps.map(x => x.id === p.id ? { ...x, _researchBusy: true } : x));

    const activeRefs = refFiles.filter(f => f.on && f.content.trim());
    const sources = activeRefs.filter(f => f.role === "source");
    const srcBlock = sources.length
      ? `# NGUỒN ƯU TIÊN (chỉ tra cứu/đối chiếu trong các trang/nguồn này)\n` +
        sources.map(f => `## ${f.name}\n${f.content.trim()}`).join("\n\n") + "\n\n"
      : "";

    const system =
      `Bạn là trợ lý nghiên cứu. Dùng web_search để thu thập DỮ KIỆN CHÍNH XÁC, mới, liên quan ` +
      `phục vụ việc viết nội dung theo prompt bên dưới.\n` +
      (sources.length ? `Ưu tiên dữ kiện từ các nguồn người dùng liệt kê; nếu mâu thuẫn, nêu rõ.\n` : "") +
      `Trả về GHI CHÚ DỮ KIỆN đã chắt lọc (tiếng Việt), dạng gạch đầu dòng ngắn gọn: số liệu, mốc thời gian, ` +
      `tên riêng, trích dẫn ngắn kèm nguồn. CHỈ ghi dữ kiện dùng được — KHÔNG viết thành bài, KHÔNG lan man. ` +
      `Loại bỏ thông tin trùng lặp.`;
    const user =
      srcBlock +
      (channel ? `# Bối cảnh kênh\n${JSON.stringify(channel)}\n\n` : "") +
      `# Prompt sẽ viết (nghiên cứu phục vụ bài này)\n${p.prompt}\n\n` +
      `Hãy tra cứu và trả về ghi chú dữ kiện chắt lọc.`;

    try {
      const { text, usage } = await callClaude(
        system, user, null,
        { model: modelId, thinkingOn, effortId, maxTokens, webSearch: true }
      );
      const cost = costOf(modelId, usage);
      setTotalCost(c => c + cost);
      setPrompts(ps => ps.map(x => x.id === p.id ? { ...x, _researchBusy: false, _research: text.trim() } : x));
      showToast("Đã thu thập dữ kiện — sẽ dùng khi viết (không search lại)");
    } catch (e) {
      setErr("Nghiên cứu lỗi: " + String(e.message || e));
      setPrompts(ps => ps.map(x => x.id === p.id ? { ...x, _researchBusy: false } : x));
    }
  }
  function clearResearch(p) {
    setPrompts(ps => ps.map(x => x.id === p.id ? { ...x, _research: "" } : x));
    showToast("Đã xoá kho dữ kiện");
  }

  /* ── THỰC THI: text_generation → gọi Claude.
     resume=true: viết TIẾP phần dang dở (prefill _result cũ), không làm lại từ đầu. ── */
  async function runText(p, resume = false) {
    if (p._busy) return;
    setErr("");
    setPrompts(ps => ps.map(x => x.id === p.id ? { ...x, _busy: true, _stream: resume ? (x._result || "") : "" } : x));

    const ctxParts = [];
    if (channel) ctxParts.push(`# Bối cảnh kênh\n${JSON.stringify(channel)}`);
    if (rulesText.trim())
      ctxParts.push(`# QUY TẮC VĂN PHONG (BẮT BUỘC tuân thủ tuyệt đối)\n${rulesText.trim()}`);
    // kho dữ kiện đã nghiên cứu (nếu có) — viết bám vào đây, KHÔNG search lại
    if (p._research && p._research.trim())
      ctxParts.push(`# DỮ KIỆN ĐÃ NGHIÊN CỨU (bám sát; KHÔNG bịa ngoài; KHÔNG lặp lại cùng một ý ở nhiều đoạn trừ khi là thủ pháp nhắc lại có chủ ý)\n${p._research.trim()}`);

    // đa-file tham chiếu: chỉ dùng file đang BẬT (tiết kiệm token)
    const activeRefs = refFiles.filter(f => f.on && f.content.trim());
    const sources = activeRefs.filter(f => f.role === "source");
    const styles  = activeRefs.filter(f => f.role === "style");
    const datas   = activeRefs.filter(f => f.role === "data");

    for (const f of sources)
      ctxParts.push(`# NGUỒN UY TÍN ("${f.name}" — định hướng nguồn; chỉ dùng dữ kiện đã có, KHÔNG bịa)\n${f.content.trim()}`);
    for (const f of styles)
      ctxParts.push(`# BÀI MẪU VĂN PHONG ("${f.name}" — bắt chước giọng văn, nhịp, cấu trúc; KHÔNG sao chép nội dung)\n${f.content.trim()}`);
    for (const f of datas)
      ctxParts.push(`# TÀI LIỆU THAM KHẢO ("${f.name}" — chỉ bám dữ kiện ở đây, KHÔNG bịa)\n${f.content.trim()}`);

    const directives = advancedOn ? buildDirectives(p.category, p._vals || initVals(p)) : "";

    const system =
      `Bạn là chuyên gia sản xuất nội dung YouTube tiếng Việt. ` +
      `Thực thi yêu cầu trong prompt và TRẢ VỀ THẲNG nội dung cuối cùng — ` +
      `không lời dẫn, không giải thích, không markdown fences bao ngoài.\n` +
      // KỊCH BẢN SẠCH: cấm nhãn sản xuất — phần hình ảnh/video do Tool 5 (NeuroForge) lo
      `TUYỆT ĐỐI KHÔNG chèn nhãn sản xuất hay chú thích kỹ thuật: không [VISUAL], [TIMESTAMP], [SCENE], ` +
      `[B-ROLL], [CUT], [HÌNH ẢNH], gợi ý hình ảnh, mô tả cảnh quay, mốc thời gian, hay bất kỳ ký hiệu nào trong ngoặc vuông. ` +
      `Chỉ viết NỘI DUNG LỜI ĐỌC thuần — văn xuôi liền mạch, tự nhiên như người Việt viết, không markdown headers.\n` +
      `Chia bài thành nhiều phần theo mạch ý, mỗi phần tập trung MỘT trọng tâm rõ ràng, chuyển ý bằng câu văn tự nhiên ` +
      `(không tiêu đề "Phần 1", không gạch đầu dòng). Mỗi phần phân tách bằng một dòng trống.\n` +
      (editorialOn ? buildEditorialDNA(channel) + "\n" : "") +
      (rulesText.trim()
        ? `Văn phong PHẢI khớp tuyệt đối với phần "QUY TẮC VĂN PHONG".\n` : "") +
      (styles.length
        ? `Bắt chước văn phong của "BÀI MẪU VĂN PHONG" (giọng, nhịp, cách mở/kết) nhưng nội dung phải mới.\n` : "") +
      (p._research && p._research.trim()
        ? `Bám sát "DỮ KIỆN ĐÃ NGHIÊN CỨU"; không bịa thông tin ngoài; tránh lặp lại cùng một ý ở nhiều đoạn.\n` : "") +
      (datas.length
        ? `Chỉ dùng dữ kiện trong "TÀI LIỆU THAM KHẢO"; nếu thiếu, nói rõ thay vì bịa.\n` : "");

    const user =
      (ctxParts.length ? ctxParts.join("\n\n") + "\n\n" : "") +
      `# Prompt cần thực thi\n${p.prompt}\n\n` +
      (directives
        ? `# Tham số điều khiển (áp dụng nghiêm túc)\n${directives}\n`
        : "");

    // resume: mồi phần đã có để model viết tiếp; kết quả mới = cũ + phần sinh thêm
    const base = resume ? (p._result || "") : "";

    try {
      const { text, usage, stopReason } = await callClaude(
        system, user,
        (acc) => setPrompts(ps => ps.map(x => x.id === p.id ? { ...x, _stream: base + acc } : x)),
        { model: modelId, thinkingOn, effortId, maxTokens, prefill: base }  // KHÔNG web_search lúc viết
      );
      const cost = costOf(modelId, usage);
      setTotalCost(c => c + cost);
      const finalText = stripProductionTags(base + text);
      const truncated = stopReason === "max_tokens";
      setPrompts(ps => ps.map(x => x.id === p.id
        ? { ...x, _busy: false, _result: finalText, _stream: "", _truncated: truncated,
            _usage: usage ? { ...usage, cost } : null } : x));
      if (truncated)
        setErr('⚠ Nội dung chạm max_tokens và bị cắt. Bấm "Viết tiếp" để nối phần còn lại (không tốn token làm lại từ đầu).');
      else showToast(resume ? "Đã viết tiếp xong" : "Đã tạo nội dung");
    } catch (e) {
      setErr(String(e.message || e));
      setPrompts(ps => ps.map(x => x.id === p.id ? { ...x, _busy: false } : x));
    }
  }

  /* ── COPY (image_generation hoặc copy kết quả text) ── */
  function copyText(txt) {
    navigator.clipboard?.writeText(txt).then(
      () => showToast("Đã copy vào clipboard"),
      () => setErr("Không copy được — trình duyệt chặn clipboard.")
    );
  }

  /* ── EXPORT checkpoint ── */
  function exportCheckpoint() {
    try {
      const json = JSON.stringify({
        tool: "tool3-content-studio", version: CHECKPOINT_VERSION,
        savedAt: new Date().toISOString(),
        channel, rulesName, refFiles, webSearchOn, advancedOn, editorialOn,
        prompts: prompts.map(p => ({
          id: p.id, setId: p.setId, type: p.type, category: p.category,
          categoryLabel: p.categoryLabel, title: p.title, prompt: p.prompt,
          controls: p._vals, result: p._result, truncated: !!p._truncated, research: p._research || "",
        })),
      }, null, 2);
      safeDownload(`tool3-checkpoint-${Date.now()}.json`, json, "application/json");
      showToast("Đã export checkpoint");
    } catch (e) {
      setErr("Không tạo được checkpoint: " + String(e.message || e));
    }
  }

  /* ── EXPORT nội dung đã tạo ra Markdown ── */
  function exportMarkdown() {
    try {
      const done = prompts.filter(p => p._result || isImageType(p));
      if (!done.length) { setErr("Chưa có nội dung nào để export."); return; }
      let md = `# Nội dung sản xuất — ${channel?.channelName || "Kênh"}\n\n`;
      md += `> Xuất từ Tool 3 · ${new Date().toLocaleString("vi-VN")}\n\n`;
      for (const p of done) {
        md += `## ${p.title}\n\n*${p.categoryLabel}*\n\n`;
        if (isImageType(p)) md += "```\n" + buildImagePrompt(p, p._vals || initVals(p)) + "\n```\n\n";
        else md += (p._result || "") + "\n\n---\n\n";
      }
      safeDownload(`noi-dung-${Date.now()}.md`, md, "text/markdown");
      showToast("Đã export Markdown");
    } catch (e) {
      setErr("Không tạo được Markdown: " + String(e.message || e));
    }
  }
  // tải file an toàn — append DOM, revoke trễ, bọc lỗi (tránh trắng màn hình)
  function safeDownload(name, content, mime) {
    try {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) { setErr("Tải file thất bại: " + String(e.message || e)); }
  }

  function importCheckpoint(file) {
    const fr = new FileReader();
    fr.onload = (e) => {
      try {
        const s = JSON.parse(e.target.result);
        if (!Array.isArray(s.prompts)) throw new Error("Thiếu mảng prompts");
        const norm = s.prompts.map(p => ({
          ...p, _vals: p.controls || null, _result: p.result || "",
          _truncated: !!p.truncated, _research: p.research || "", _researchBusy: false,
          _busy: false, _stream: "", _usage: null,
        }));
        norm.forEach(p => { if (!p._vals) p._vals = initVals(p); });
        setChannel(s.channel || null);
        setPrompts(norm);
        setActiveId(norm[0]?.id || null);
        if (Array.isArray(s.refFiles)) setRefFiles(s.refFiles);
        else if (s.refText) setRefFiles([{ id: "legacy", name: s.refName || "reference.md", content: s.refText, role: "data", on: true }]);
        setWebSearchOn(!!s.webSearchOn);
        setAdvancedOn(!!s.advancedOn); if (s.editorialOn !== undefined) setEditorialOn(!!s.editorialOn);
        setErr("");
        showToast("Đã khôi phục checkpoint");
      } catch (e2) { setErr("Checkpoint lỗi: " + e2.message); }
    };
    fr.readAsText(file);
  }

  function clearAll() {
    if (!window.confirm("Xoá toàn bộ phiên làm việc hiện tại?")) return;
    setPrompts([]); setChannel(null); setActiveId(null);
    setRulesText(""); setRulesName(""); setRefFiles([]); setWebSearchOn(false);
    setTotalCost(0);
    showToast("Đã xoá phiên làm việc");
  }

  /* ════════════════════════ RENDER ════════════════════════ */
  const C = {
    bg: "#0a0f0e", panel: "#0f1716", panel2: "#13201e", border: "#1e302d",
    teal: "#2dd4bf", tealDim: "#0d9488", violet: "#a78bfa", violetDim: "#7c3aed",
    amber: "#f59e0b", text: "#e6f0ee", textDim: "#7d918d", danger: "#f87171",
  };

  const counts = useMemo(() => ({
    total: prompts.length,
    text: prompts.filter(p => !isImageType(p)).length,
    img: prompts.filter(isImageType).length,
    done: prompts.filter(p => p._result).length,
  }), [prompts]);

  return (
    <div style={{ fontFamily: FONT, background: C.bg, color: C.text, minHeight: "100vh",
      backgroundImage: `radial-gradient(900px 500px at 88% -8%, rgba(167,139,250,0.10), transparent 60%),
        radial-gradient(800px 480px at 8% 108%, rgba(45,212,191,0.08), transparent 60%)` }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 9px; height: 9px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 9px; }
        input[type=range]{ -webkit-appearance:none; appearance:none; height:5px; border-radius:5px; outline:none; }
        input[type=range]::-webkit-slider-thumb{ -webkit-appearance:none; width:16px; height:16px; border-radius:50%;
          background:${C.teal}; cursor:pointer; border:2px solid ${C.bg}; box-shadow:0 0 0 1px ${C.tealDim}; }
        .t3-fade { animation: t3fade .35s ease both; }
        @keyframes t3fade { from{opacity:0; transform:translateY(6px)} to{opacity:1; transform:none} }
        .t3-card:hover { border-color:${C.tealDim} !important; }
      `}</style>

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "26px 22px 80px" }}>
        {/* HEADER */}
        <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, display: "grid", placeItems: "center",
            background: `linear-gradient(135deg, ${C.tealDim}, ${C.violetDim})`, boxShadow: "0 8px 28px rgba(45,212,191,0.25)" }}>
            <ScrollText size={24} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 style={{ margin: 0, fontSize: 21, letterSpacing: -0.4 }}>Content Production Studio</h1>
            <div style={{ fontSize: 12.5, color: C.textDim, fontFamily: MONO }}>Tool 3 · Module 3/3 — thực thi nội dung từ Tool 2</div>
          </div>
          {prompts.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill C={C} icon={<Layers size={13} />} text={`${counts.total} mục`} />
              <Pill C={C} icon={<FileCheck2 size={13} />} text={`${counts.done}/${counts.text} text xong`} />
              <Pill C={C} icon={<ImageIcon size={13} />} text={`${counts.img} ảnh`} color={C.violet} />
              {totalCost > 0 && <Pill C={C} icon={<Sparkles size={13} />} text={`$${totalCost.toFixed(4)}`} color={C.amber} />}
            </div>
          )}
        </header>

        {err && (
          <div className="t3-fade" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 14px",
            background: "rgba(248,113,113,0.08)", border: `1px solid ${C.danger}55`, borderRadius: 11, marginBottom: 16, fontSize: 13.5 }}>
            <AlertTriangle size={16} color={C.danger} style={{ marginTop: 1, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{err}</span>
            <X size={15} color={C.textDim} style={{ cursor: "pointer" }} onClick={() => setErr("")} />
          </div>
        )}

        {/* EMPTY STATE — IMPORT */}
        {prompts.length === 0 ? (
          <div className="t3-fade" style={{ border: `1.5px dashed ${C.border}`, borderRadius: 18, padding: "54px 24px",
            textAlign: "center", background: C.panel }}>
            <FolderInput size={42} color={C.tealDim} style={{ marginBottom: 14 }} />
            <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Nạp gói prompt từ Tool 2</h2>
            <p style={{ margin: "0 auto 20px", maxWidth: 460, color: C.textDim, fontSize: 14, lineHeight: 1.6 }}>
              Chọn file JSON đã export từ Prompt Factory. Studio sẽ tự định tuyến: prompt văn bản gọi Claude tạo nội dung,
              prompt ảnh chuyển sang trình copy để mang đi Midjourney/Leonardo.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <BigBtn C={C} primary icon={<Upload size={16} />} label="Nạp JSON từ Tool 2"
                onClick={() => importRef.current?.click()} />
              <BigBtn C={C} icon={<RefreshCw size={16} />} label="Khôi phục checkpoint"
                onClick={() => cpRef.current?.click()} />
            </div>
            <input ref={importRef} type="file" accept=".json,application/json" style={{ display: "none" }}
              onChange={e => e.target.files[0] && importFromTool2(e.target.files[0])} />
            <input ref={cpRef} type="file" accept=".json,application/json" style={{ display: "none" }}
              onChange={e => e.target.files[0] && importCheckpoint(e.target.files[0])} />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "start" }}>
            {/* ── LEFT: queue + model + toolbar ── */}
            <aside style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 14 }}>
              {/* model card */}
              <Card C={C} title="Mô hình" icon={<Cpu size={15} color={C.teal} />}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {DEFAULT_MODELS.map(m => (
                    <button key={m.id} onClick={() => setModelId(m.id)} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, cursor: "pointer",
                      background: modelId === m.id ? C.panel2 : "transparent",
                      border: `1px solid ${modelId === m.id ? m.color : C.border}`, color: C.text, textAlign: "left", fontSize: 13 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 8, background: m.color }} />
                      <span style={{ flex: 1, fontWeight: modelId === m.id ? 600 : 400 }}>{m.label}</span>
                      {m.badge && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6,
                        background: m.color + "22", color: m.color }}>{m.badge}</span>}
                    </button>
                  ))}
                </div>
                {/* effort */}
                <div style={{ marginTop: 12, fontSize: 11.5, color: C.textDim, marginBottom: 5 }}>Effort</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 5 }}>
                  {EFFORT_LEVELS.map(e => (
                    <button key={e.id} onClick={() => setEffortId(e.id)} style={{
                      padding: "6px 0", borderRadius: 7, fontSize: 11.5, cursor: "pointer",
                      background: effortId === e.id ? C.tealDim : "transparent",
                      border: `1px solid ${effortId === e.id ? C.tealDim : C.border}`,
                      color: effortId === e.id ? "#03100e" : C.textDim, fontWeight: effortId === e.id ? 600 : 400 }}>{e.label}</button>
                  ))}
                </div>
                {/* thinking — chặn khi model không hỗ trợ (Haiku) */}
                {(() => {
                  const canThink = modelSupportsThinking(modelId);
                  return (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12,
                      cursor: canThink ? "pointer" : "not-allowed", fontSize: 13, opacity: canThink ? 1 : 0.45 }}>
                      <Switch on={canThink && thinkingOn} onClick={() => { if (canThink) setThinkingOn(v => !v); }} C={C} />
                      <Brain size={14} color={canThink && thinkingOn ? C.violet : C.textDim} />
                      <span style={{ color: canThink && thinkingOn ? C.text : C.textDim }}>Thinking</span>
                      {!canThink && <span style={{ fontSize: 10.5, color: C.textDim }}>(không hỗ trợ trên Haiku)</span>}
                    </label>
                  );
                })()}
                {/* max tokens */}
                <div style={{ marginTop: 12, fontSize: 11.5, color: C.textDim }}>
                  Max tokens: <b style={{ color: C.text }}>{maxTokens.toLocaleString()}</b>
                </div>
                <input type="range" min={2000} max={32000} step={1000} value={maxTokens}
                  onChange={e => setMaxTokens(+e.target.value)} style={{ width: "100%", marginTop: 5 }} />
              </Card>

              {/* queue */}
              <Card C={C} title="Hàng đợi" icon={<Layers size={15} color={C.teal} />}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto" }}>
                  {prompts.map(p => {
                    const img = isImageType(p);
                    const sel = p.id === activeId;
                    return (
                      <button key={p.id} onClick={() => setActiveId(p.id)} className="t3-card" style={{
                        display: "flex", gap: 9, alignItems: "flex-start", padding: "9px 10px", borderRadius: 9, cursor: "pointer",
                        background: sel ? C.panel2 : "transparent", border: `1px solid ${sel ? (img ? C.violetDim : C.tealDim) : C.border}`,
                        color: C.text, textAlign: "left", transition: "border-color .15s" }}>
                        <span style={{ marginTop: 1 }}>{img ? <ImageIcon size={14} color={C.violet} /> : <FileText size={14} color={C.teal} />}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 12.8, fontWeight: sel ? 600 : 400,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</span>
                          <span style={{ display: "block", fontSize: 10.5, color: C.textDim }}>{p.categoryLabel}</span>
                        </span>
                        {p._result && <Check size={13} color={C.teal} style={{ marginTop: 2 }} />}
                        {p._busy && <Loader2 size={13} color={C.teal} className="t3-spin" style={{ marginTop: 2, animation: "spin 1s linear infinite" }} />}
                      </button>
                    );
                  })}
                </div>
              </Card>

              {/* toolbar */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <SmallBtn C={C} icon={<Download size={13} />} label="Checkpoint" onClick={exportCheckpoint} />
                <SmallBtn C={C} icon={<FileText size={13} />} label="Export MD" onClick={exportMarkdown} />
                <SmallBtn C={C} icon={<Upload size={13} />} label="Nạp lại" onClick={() => importRef.current?.click()} />
                <SmallBtn C={C} icon={<Trash2 size={13} />} label="Xoá hết" danger onClick={clearAll} />
              </div>
              <input ref={importRef} type="file" accept=".json" style={{ display: "none" }}
                onChange={e => e.target.files[0] && importFromTool2(e.target.files[0])} />
            </aside>

            {/* ── RIGHT: workspace ── */}
            <main style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
              {active && <Workspace
                key={active.id} p={active} C={C}
                advancedOn={advancedOn} setAdvancedOn={setAdvancedOn}
                editorialOn={editorialOn} setEditorialOn={setEditorialOn}
                controls={controlsFor(active)} setVal={setVal}
                rulesName={rulesName}
                refFiles={refFiles}
                onPickRules={() => rulesRef.current?.click()}
                onPickRef={() => refRef.current?.click()}
                onClearRules={() => { setRulesText(""); setRulesName(""); }}
                onToggleRef={toggleRefFile}
                onRemoveRef={removeRefFile}
                onRun={() => runText(active, false)}
                onResume={() => runText(active, true)}
                onResearch={() => runResearch(active)}
                onClearResearch={() => clearResearch(active)}
                onCopy={copyText}
                buildImagePrompt={buildImagePrompt}
              />}
            </main>
          </div>
        )}

        <input ref={rulesRef} type="file" accept=".md,.txt,text/plain,text/markdown" style={{ display: "none" }}
          onChange={e => e.target.files[0] && readContextFile(e.target.files[0], "rules")} />
        <input ref={refRef} type="file" multiple accept=".md,.txt,text/plain,text/markdown" style={{ display: "none" }}
          onChange={e => { Array.from(e.target.files || []).forEach(f => readContextFile(f, "ref")); e.target.value = ""; }} />
      </div>

      {toast.vis && (
        <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)",
          background: C.panel2, border: `1px solid ${C.tealDim}`, color: C.text, padding: "10px 18px",
          borderRadius: 11, fontSize: 13.5, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", zIndex: 50 }}
          className="t3-fade">{toast.msg}</div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ════════════════════════ WORKSPACE ════════════════════════ */
function Workspace({ p, C, advancedOn, setAdvancedOn, editorialOn, setEditorialOn, controls, setVal, rulesName, refFiles,
  onPickRules, onPickRef, onClearRules, onToggleRef, onRemoveRef,
  onRun, onResume, onResearch, onClearResearch, onCopy, buildImagePrompt }) {
  const img = isImageType(p);
  const vals = p._vals || {};
  const imgPrompt = img ? buildImagePrompt(p, vals) : "";

  return (
    <>
      {/* prompt header */}
      <div className="t3-fade" style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
          <span style={{ padding: "3px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600,
            background: img ? C.violetDim + "22" : C.tealDim + "22", color: img ? C.violet : C.teal }}>
            {img ? "IMAGE" : "TEXT"} · {p.categoryLabel}
          </span>
          {p.setId && <span style={{ fontSize: 10.5, color: C.textDim, fontFamily: MONO }}>set {String(p.setId).slice(0, 6)}</span>}
        </div>
        <h2 style={{ margin: "0 0 10px", fontSize: 17.5, letterSpacing: -0.3 }}>{p.title}</h2>
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px",
          fontSize: 13, lineHeight: 1.6, color: C.textDim, whiteSpace: "pre-wrap", maxHeight: 160, overflowY: "auto",
          fontFamily: MONO }}>{p.prompt}</div>
      </div>

      {/* ── ADVANCED PANEL TOGGLE ── */}
      <div style={{ background: C.panel, border: `1px solid ${advancedOn ? C.tealDim : C.border}`, borderRadius: 14, overflow: "hidden" }}>
        <button onClick={() => setAdvancedOn(v => !v)} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 16px",
          background: "transparent", border: "none", color: C.text, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
          <SlidersHorizontal size={16} color={advancedOn ? C.teal : C.textDim} />
          <span style={{ flex: 1, textAlign: "left" }}>Cài đặt nâng cao</span>
          <Switch on={advancedOn} onClick={(e) => { e.stopPropagation(); setAdvancedOn(v => !v); }} C={C} />
          <ChevronDown size={16} color={C.textDim} style={{ transform: advancedOn ? "rotate(180deg)" : "none", transition: ".2s" }} />
        </button>

        {advancedOn && (
          <div className="t3-fade" style={{ padding: "4px 16px 18px", borderTop: `1px solid ${C.border}` }}>
            {/* DYNAMIC CONTROLS */}
            <div style={{ fontSize: 11.5, color: C.textDim, margin: "14px 0 10px", display: "flex", alignItems: "center", gap: 6 }}>
              <Wand2 size={13} color={C.teal} /> Tham số cho <b style={{ color: C.text }}>{p.categoryLabel}</b>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 22px" }}>
              {controls.map(c => <Control key={c.key} c={c} val={vals[c.key] ?? c.default} onChange={v => setVal(c.key, v)} C={C} />)}
            </div>

            {/* CONTEXT INJECTION — chỉ ý nghĩa với text_generation */}
            {!img && (
              <>
                <div style={{ height: 1, background: C.border, margin: "18px 0 14px" }} />
                {/* Editorial DNA — preset kỹ thuật viết + chống văn AI */}
                <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer",
                  padding: "10px 12px", borderRadius: 10, marginBottom: 12,
                  background: editorialOn ? C.tealDim + "22" : C.bg, border: `1px solid ${editorialOn ? C.tealDim : C.border}` }}>
                  <Switch on={editorialOn} onClick={() => setEditorialOn(v => !v)} C={C} />
                  <Wand2 size={15} color={editorialOn ? C.teal : C.textDim} />
                  <span style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: editorialOn ? C.text : C.textDim }}>Chuẩn biên tập (Editorial DNA)</span>
                    <span style={{ fontSize: 11, color: C.textDim }}>Tự thích ứng theo kênh · kỹ thuật viết + luật chống văn AI · khuyên BẬT</span>
                  </span>
                </label>
                <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <BookOpen size={13} color={C.violet} /> Nạp tài liệu (Context Injection)
                </div>
                {/* hướng dẫn dùng — đặt tên file để tự nhận vai trò */}
                <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6, marginBottom: 10,
                  background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 11px" }}>
                  Đặt tên file để tool tự nhận vai trò: tên chứa <b style={{ color: C.teal }}>source</b> → nguồn web uy tín (bật web_search để bám nguồn);
                  chứa <b style={{ color: C.violet }}>mau</b>/<b style={{ color: C.violet }}>style</b> → bài mẫu để bắt chước văn phong; còn lại → tài liệu dữ kiện.
                  Tắt file không cần để tiết kiệm token. <i>VD: source.md, mau_bai_don_gian.md</i>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <FileSlot C={C} label="Rules — văn phong (ép giọng tuyệt đối)" hint="Quy tắc văn phong bắt buộc"
                    name={rulesName} onPick={onPickRules} onClear={onClearRules} color={C.teal} />

                  {/* danh sách file tham chiếu đa-file */}
                  {refFiles.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {refFiles.map(f => {
                        const rc = f.role === "source" ? C.teal : f.role === "style" ? C.violet : C.textDim;
                        const rlabel = f.role === "source" ? "NGUỒN" : f.role === "style" ? "BÀI MẪU" : "DỮ LIỆU";
                        return (
                          <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px",
                            borderRadius: 9, background: C.bg, border: `1px solid ${f.on ? rc + "55" : C.border}`, opacity: f.on ? 1 : 0.5 }}>
                            <Switch on={f.on} onClick={() => onToggleRef(f.id)} C={C} />
                            <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 5,
                              background: rc + "22", color: rc, letterSpacing: "0.04em" }}>{rlabel}</span>
                            <span style={{ flex: 1, fontSize: 12.5, color: C.text, overflow: "hidden",
                              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                            <span style={{ fontSize: 10.5, color: C.textDim, fontFamily: MONO }}>{f.content.length}c</span>
                            <X size={14} color={C.textDim} style={{ cursor: "pointer" }} onClick={() => onRemoveRef(f.id)} />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button onClick={onPickRef} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "9px", borderRadius: 9, cursor: "pointer", background: "transparent",
                    border: `1px dashed ${C.border}`, color: C.textDim, fontSize: 12.5, fontFamily: FONT }}>
                    <Upload size={14} /> Nạp tài liệu tham chiếu (chọn nhiều file)
                  </button>

                  {/* nguồn uy tín giờ dùng ở bước "Nghiên cứu" (web_search 1 lần) bên dưới */}
                  {refFiles.some(f => f.role === "source" && f.on) && (
                    <div style={{ fontSize: 11, color: C.textDim, padding: "4px 2px", display: "flex", alignItems: "center", gap: 6 }}>
                      <Globe size={12} color={C.teal} /> Có nguồn uy tín — dùng nút "Nghiên cứu" bên dưới để tra cứu dữ kiện trước khi viết.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── EXECUTION ── */}
      {img ? (
        /* CLIPBOARD MANAGER cho image_generation */
        <div className="t3-fade" style={{ background: C.panel, border: `1px solid ${C.violetDim}55`, borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <ImageIcon size={16} color={C.violet} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Prompt ảnh — mang đi Midjourney / Leonardo / DALL·E</span>
          </div>
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "13px 15px",
            fontFamily: MONO, fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap", color: C.text }}>{imgPrompt}</div>
          <div style={{ display: "flex", gap: 9, marginTop: 13 }}>
            <BigBtn C={C} primary violet icon={<Copy size={15} />} label="Copy prompt" onClick={() => onCopy(imgPrompt)} />
            <span style={{ fontSize: 11.5, color: C.textDim, alignSelf: "center" }}>
              Bật "Cài đặt nâng cao" để chỉnh tỷ lệ, stylize, mood — prompt tự cập nhật.
            </span>
          </div>
        </div>
      ) : (
        /* TEXT GENERATION */
        <>
          {/* NGHIÊN CỨU — web_search 1 lần, chắt lọc dữ kiện trước khi viết */}
          <div className="t3-fade" style={{ background: C.panel, border: `1px solid ${p._research ? C.tealDim : C.border}`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: p._research ? 12 : 0 }}>
              <Globe size={16} color={C.teal} />
              <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Nghiên cứu dữ kiện</span>
              {p._research && <span style={{ fontSize: 10.5, color: C.teal, fontFamily: MONO }}>{p._research.length}c · đã lưu</span>}
              <button onClick={onResearch} disabled={p._researchBusy} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9,
                cursor: p._researchBusy ? "not-allowed" : "pointer", background: C.tealDim, border: "none",
                color: "#03100e", fontSize: 12.5, fontWeight: 600, fontFamily: FONT, opacity: p._researchBusy ? 0.6 : 1 }}>
                {p._researchBusy ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Globe size={14} />}
                {p._researchBusy ? "Đang tra cứu…" : (p._research ? "Nghiên cứu lại" : "Nghiên cứu")}
                <span style={{ fontSize: 9, color: "#7a1d1d" }}>TỐN API</span>
              </button>
              {p._research && !p._researchBusy &&
                <X size={15} color={C.textDim} style={{ cursor: "pointer" }} onClick={onClearResearch} />}
            </div>
            {!p._research && !p._researchBusy && (
              <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 8, lineHeight: 1.55 }}>
                Tra cứu web 1 lần để thu thập dữ kiện chính xác (ưu tiên file <b style={{ color: C.teal }}>source</b> nếu có), chắt lọc và lưu lại.
                Khi viết sẽ bám kho này, <b>không search lại</b> — tiết kiệm token. Kho được lưu trong checkpoint.
              </div>
            )}
            {p._research && (
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px",
                fontSize: 12.5, lineHeight: 1.6, color: C.text, whiteSpace: "pre-wrap", maxHeight: 220, overflowY: "auto" }}>{p._research}</div>
            )}
          </div>

          <div style={{ display: "flex", gap: 9 }}>
            <BigBtn C={C} primary full
              icon={p._busy ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={16} />}
              label={p._busy ? "Đang tạo nội dung…" : (p._result ? "Tạo lại từ đầu" : "Tạo nội dung")}
              onClick={onRun} disabled={p._busy} />
            {p._truncated && !p._busy && (
              <BigBtn C={C} primary icon={<Play size={16} />} label="Viết tiếp" onClick={onResume} disabled={p._busy} />
            )}
          </div>
          {p._truncated && !p._busy && (
            <div style={{ fontSize: 11.5, color: "#f0b429", marginTop: 8 }}>
              ⚠ Nội dung bị cắt do chạm max_tokens. "Viết tiếp" sẽ nối phần còn lại (không làm lại từ đầu); "Tạo lại từ đầu" sẽ viết mới hoàn toàn.
            </div>
          )}

          {(p._busy && p._stream) || p._result ? (
            <div className="t3-fade" style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <FileCheck2 size={16} color={C.teal} />
                <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Nội dung hoàn chỉnh</span>
                {p._usage && <span style={{ fontSize: 11, color: C.textDim, fontFamily: MONO }}>
                  {(p._usage.input_tokens || 0)}→{(p._usage.output_tokens || 0)} tok · ${(p._usage.cost || 0).toFixed(4)}
                </span>}
                {p._result && <ClipboardCheck size={15} color={C.textDim} style={{ cursor: "pointer" }} onClick={() => onCopy(p._result)} />}
              </div>
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "15px 17px",
                fontSize: 14, lineHeight: 1.72, whiteSpace: "pre-wrap", maxHeight: 540, overflowY: "auto" }}>
                {p._busy ? p._stream : p._result}
                {p._busy && <span style={{ animation: "spin 1s linear infinite", display: "inline-block", marginLeft: 4 }}>▌</span>}
              </div>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

/* ════════════════════════ CONTROL RENDERERS ════════════════════════ */
function Control({ c, val, onChange, C }) {
  if (c.type === "slider") {
    const markLabel = (() => {
      if (!c.marks) return `${val}${c.unit ? " " + c.unit : ""}`;
      const idx = Math.round(((val - c.min) / (c.max - c.min)) * (c.marks.length - 1));
      return c.marks[Math.max(0, Math.min(c.marks.length - 1, idx))];
    })();
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
          <span style={{ color: C.text }}>{c.label}</span>
          <span style={{ color: C.teal, fontFamily: MONO, fontSize: 12 }}>{markLabel}</span>
        </div>
        <input type="range" min={c.min} max={c.max} step={c.step} value={val}
          onChange={e => onChange(+e.target.value)} style={{ width: "100%",
            background: `linear-gradient(90deg, ${C.tealDim} ${((val - c.min) / (c.max - c.min)) * 100}%, ${C.border} 0%)` }} />
      </div>
    );
  }
  if (c.type === "toggle") {
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 12.8 }}>
        <Switch on={!!val} onClick={() => onChange(!val)} C={C} />
        <span style={{ color: val ? C.text : C.textDim }}>{c.label}</span>
      </label>
    );
  }
  if (c.type === "select") {
    return (
      <div>
        <div style={{ fontSize: 12.5, color: C.text, marginBottom: 6 }}>{c.label}</div>
        <div style={{ position: "relative" }}>
          <select value={val} onChange={e => onChange(e.target.value)} style={{
            width: "100%", appearance: "none", background: C.bg, color: C.text, border: `1px solid ${C.border}`,
            borderRadius: 9, padding: "8px 30px 8px 11px", fontSize: 12.8, cursor: "pointer", fontFamily: FONT }}>
            {c.options.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <ChevronDown size={14} color={C.textDim} style={{ position: "absolute", right: 10, top: 10, pointerEvents: "none" }} />
        </div>
      </div>
    );
  }
  return null;
}

/* ════════════════════════ SMALL UI PRIMITIVES ════════════════════════ */
function Card({ C, title, icon, children }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, fontSize: 12.5, color: C.textDim, fontWeight: 600 }}>
        {icon}{title}
      </div>
      {children}
    </div>
  );
}

function Switch({ on, onClick, C }) {
  return (
    <span onClick={onClick} style={{ width: 36, height: 20, borderRadius: 20, flexShrink: 0, cursor: "pointer",
      background: on ? C.tealDim : C.border, position: "relative", transition: ".18s" }}>
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

function FileSlot({ C, label, hint, name, onPick, onClear, color }) {
  return (
    <div style={{ border: `1px dashed ${name ? color : C.border}`, borderRadius: 10, padding: "11px 12px",
      background: name ? color + "10" : C.bg }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 2, color: C.text }}>{label}</div>
      <div style={{ fontSize: 10.8, color: C.textDim, marginBottom: 9 }}>{hint}</div>
      {name ? (
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
          <FileText size={13} color={color} />
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
          <X size={14} color={C.textDim} style={{ cursor: "pointer" }} onClick={onClear} />
        </div>
      ) : (
        <button onClick={onPick} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
          borderRadius: 8, background: "transparent", border: `1px solid ${C.border}`, color: C.text, cursor: "pointer", fontSize: 12 }}>
          <Upload size={12} /> Chọn .md / .txt
        </button>
      )}
    </div>
  );
}

function BigBtn({ C, label, icon, onClick, primary, violet, full, disabled }) {
  const bg = primary ? (violet ? C.violetDim : C.tealDim) : "transparent";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      padding: "12px 18px", borderRadius: 11, cursor: disabled ? "not-allowed" : "pointer",
      width: full ? "100%" : "auto", opacity: disabled ? 0.6 : 1,
      background: bg, border: `1px solid ${primary ? bg : C.border}`,
      color: primary ? "#fff" : C.text, fontSize: 14, fontWeight: 600, fontFamily: FONT }}>
      {icon}{label}
    </button>
  );
}

function SmallBtn({ C, label, icon, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      padding: "9px 8px", borderRadius: 9, cursor: "pointer", background: "transparent",
      border: `1px solid ${danger ? C.danger + "55" : C.border}`, color: danger ? C.danger : C.text,
      fontSize: 12, fontFamily: FONT }}>
      {icon}{label}
    </button>
  );
}
