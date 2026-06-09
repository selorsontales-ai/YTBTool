import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload, Download, Sparkles, Cpu, Brain, ChevronDown, Check, X, Trash2,
  RefreshCw, Factory, Loader2, AlertTriangle, FolderInput, FileJson,
  FileText, Image as ImageIcon, Copy, Plus, Minus, Package, Ban, Layers, BookCheck, Tags, Wand2,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════════
   TOOL 2 — PROMPT FACTORY  (Module 2 / 3)
   "Máy đẻ Prompt" — chức năng cốt lõi của Tool 2.
   - Import checkpoint từ Module 1 (channel + blueprint) làm context
   - Chọn loại + số lượng prompt → sinh hàng loạt (mỗi loại gắn sẵn `type`)
   - Chống trùng: import prompt cũ + lọc client-side
   - Sinh THEO LÔ (từng loại 1 lời gọi) để an toàn max_tokens + resume được
   - Export JSON (có `type` cho Tool 3) hoặc Markdown
   Cách gọi API tuân theo Claude.md: output_config.effort + adaptive thinking.
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

/* ─── LOẠI PROMPT — mỗi loại gắn sẵn `type` cho Tool 3 định tuyến ────
   text_generation → Tool 3 gọi Claude sinh nội dung.
   image_generation → Tool 3 chỉ hiện prompt + nút Copy cho Midjourney/...
   `brief` mô tả cho Claude biết loại prompt này cần sinh ra cái gì. */
const PROMPT_TYPES = [
  { key: "video_script", label: "Prompt Kịch bản Video", type: "text_generation", icon: "text", color: "#0d9488",
    brief: "Prompt để AI viết kịch bản voice-over hoàn chỉnh cho một video. Mỗi prompt là một ý tưởng video khác nhau, nêu rõ chủ đề, góc nhìn, và yêu cầu về cấu trúc/độ dài." },
  { key: "seo_title", label: "Prompt Tiêu đề SEO", type: "text_generation", icon: "text", color: "#0d9488",
    brief: "Prompt để AI tạo cụm tiêu đề YouTube tối ưu CTR cho một chủ đề. Mỗi prompt nhắm một chủ đề/video khác nhau." },
  { key: "description", label: "Prompt Mô tả SEO", type: "text_generation", icon: "text", color: "#0d9488",
    brief: "Prompt để AI viết phần mô tả video chuẩn SEO (hook, tóm tắt, từ khoá, CTA). Mỗi prompt cho một video khác nhau." },
  { key: "thumbnail", label: "Prompt Thumbnail", type: "image_generation", icon: "image", color: "#7c3aed",
    brief: "Prompt tạo ảnh thumbnail (dùng cho Midjourney/Leonardo/DALL-E). Mô tả bố cục, nhân vật, màu sắc, cảm xúc, text overlay gợi ý. Viết bằng tiếng Anh, chi tiết, sẵn sàng dán thẳng." },
  { key: "broll", label: "Prompt Ảnh/B-roll minh hoạ", type: "image_generation", icon: "image", color: "#7c3aed",
    brief: "Prompt tạo ảnh minh hoạ/b-roll cho video (dùng cho AI image). Mô tả cảnh, phong cách, ánh sáng. Viết bằng tiếng Anh, chi tiết." },
];

/* ─── PATTERN CATALOG — 42 kỹ thuật viết, 7 nhóm (từ viet-chuyen-nghiep).
   Nhúng vào prompt sinh ra để Tool 3 có blueprint kỹ thuật khi viết.
   Chỉ áp cho prompt VĂN BẢN (kịch bản/mô tả), không áp prompt ảnh. ── */
const PATTERN_CATALOG = `
MỞ BÀI: BEHAVIORAL_HOOK (hành vi quen thuộc ai cũng nhận ra) · ANECDOTE_OPEN (chuyện cá nhân chứng kiến) · SHOCK_DATA_OPEN (con số sốc dòng đầu) · PREDICTION_HOOK (dự đoán táo bạo) · METAPHOR_HEADLINE (ẩn dụ ngay tiêu đề)
CẤU TRÚC: PROGRESSIVE_ZOOM (micro→meso→macro) · PARALLEL_STRUCTURE (nhiều đối tượng cùng khung) · CHRONOLOGICAL_CASE (thuật theo thời gian) · ONE_IDEA_PER_PARAGRAPH · MULTI_CHARACTER (nhiều góc nhìn) · DAY_IN_THE_LIFE · MULTI_LENS (1 vấn đề nhiều lăng kính)
DẪN CHỨNG: DATA_ANCHOR (neo vào con số) · AUTHORITY_SOURCING (nguồn uy tín) · EXPERT_TRIANGULATION (2+ chuyên gia) · PAPER_MINING (đào paper gốc) · THEORY_ANCHOR (neo lý thuyết có tên) · SURVEY_BACKBONE (1 khảo sát làm xương sống) · SPECIFICITY_TRUST (chi tiết cụ thể tạo uy tín)
TƯƠNG PHẢN: CONTRAST_FRAMING · BINARY_FRAME (chia 2 cực) · SOFT_CONTRAST (bất lợi rồi "nhưng") · PARADOX_FLIP (đảo kỳ vọng) · METRIC_INVERSION (data tương phản cực đoan)
NGÔN NGỮ: CONCEPT_NAMING (đặt tên hiện tượng) · QUOTE_EMPHASIS · CONVERSATIONAL_FIRST_PERSON (giọng tôi-bạn) · CURRENCY_CONVERT (quy đổi đơn vị quen) · VERNACULAR (dịch thuật ngữ sang đời thường)
KẾT BÀI: QUESTION_CLOSE (câu hỏi chiến lược) · ONE_LINER_CLOSE (1 câu đáng nhớ) · SOCRATIC_PROBE · CALLBACK (quay lại hình ảnh mở đầu)
NÂNG CAO: SCIENCE+STORY (xen nghiên cứu + chuyện) · POP_CULTURE_BRIDGE · GENTLE_DEBUNK · HISTORICAL_RHYME (tiền lệ lịch sử) · CROSS_DOMAIN_BLEND (trộn lĩnh vực) · DELAYED_REVEAL (treo khái niệm, giải thích sau) · SELF_PROOF (kinh nghiệm bản thân làm bằng chứng) · CONCEPT_SYSTEM (nhiều concept liên kết)
`.trim();

/* ─── OUTPUT HYGIENE — luật văn phong tiếng Việt (cô đọng từ viet-chuyen-nghiep).
   Áp cho MỌI prompt sinh ra, ĐẶC BIỆT trường "title"/"videoTitle" (sẽ thành heading ở Tool 3).
   Mục tiêu: chặn lỗi Title Case + em-dash NGAY TỪ TOOL 2 để Tool 4 không phải bắt lại. ── */
const OUTPUT_HYGIENE = `

# QUY TẮC VĂN PHONG (BẮT BUỘC — áp cho mọi "title", "videoTitle" và văn bản tiếng Việt bạn tạo)
1. VIẾT HOA TIÊU ĐỀ: chỉ viết hoa chữ cái ĐẦU + tên riêng. TUYỆT ĐỐI KHÔNG Title Case kiểu tiếng Anh.
   SAI: "Tóm Tắt Cuộc Họp 1 Giờ Thành 1 Trang A4 Bằng AI"
   ĐÚNG: "Tóm tắt cuộc họp 1 giờ thành 1 trang A4 bằng AI"
2. CẤM dấu gạch dài em-dash "—" trong mọi title và nội dung tiếng Việt. Dùng gạch ngang "-" có dấu cách hai bên.
   SAI: "Review công cụ AI — Dùng hay bỏ?"  →  ĐÚNG: "Review công cụ AI - Dùng hay bỏ?"
3. CẤM dấu hai chấm ":" trong tiêu đề. Nếu cần phân tách, dùng " - ".
4. Khi prompt yêu cầu AI khác (Tool 3) viết bài tiếng Việt, LUÔN nhắc trong nội dung prompt: "Viết hoa chuẩn tiếng Việt (không Title Case), không dùng em-dash, hạn chế dấu hai chấm."`;



/* ─── CHANNEL FIELDS + suggestion chips (offline, no API) ──────────── */
const CHANNEL_FIELDS = [
  { key: "channelName",   label: "Tên kênh",        ph: "VD: Vùng Đất Tỉnh Thức",            multi: false, chips: [] },
  { key: "tagline",       label: "Tagline",         ph: "Một câu slogan ngắn gọn",           multi: false, chips: ["Kiến thức mỗi ngày", "Hiểu sâu, sống tỉnh", "Câu chuyện chưa kể", "Khoa học dễ hiểu"] },
  { key: "description",   label: "Mô tả kênh",      ph: "Mô tả 2-3 câu về kênh",             multi: false, area: true, chips: [] },
  { key: "targetAudience",label: "Đối tượng",       ph: "Khán giả mục tiêu",                 multi: true,  chips: ["18-24 tuổi", "25-34 tuổi", "35-44 tuổi", "Học sinh/SV", "Dân văn phòng", "Người yêu khoa học", "Người mê lịch sử"] },
  { key: "contentPillars",label: "Trụ cột nội dung",ph: "Các chủ đề chính",                  multi: true,  chips: ["Khoa học", "Lịch sử", "Tâm lý học", "Triết học", "Công nghệ", "Vũ trụ", "Self-help", "Bí ẩn"] },
  { key: "toneVoice",     label: "Giọng điệu",      ph: "Phong cách trình bày",              multi: true,  chips: ["Thông thái", "Gần gũi", "Kịch tính", "Hài hước", "Trang trọng", "Truyền cảm hứng", "Bí ẩn"] },
  { key: "videoFormat",   label: "Định dạng video", ph: "Kiểu video chủ đạo",                multi: true,  chips: ["Voice-over + b-roll", "Talking head", "Animation", "Documentary", "Top list", "Kể chuyện", "Phân tích"] },
  { key: "uploadCadence", label: "Tần suất đăng",   ph: "VD: 2 video/tuần",                  multi: false, chips: ["Hàng ngày", "3 video/tuần", "2 video/tuần", "1 video/tuần"] },
];

/* Map blueprint Tool 1 → field kênh (KHÔNG tốn AI). Chỉ điền field blueprint có. */
function mapBlueprintToChannel(bp) {
  if (!bp || typeof bp !== "object") return { values: {}, filledKeys: [] };
  const out = {};
  const firstStr = (v) => Array.isArray(v) ? (v[0] != null ? String(v[0]) : "") : (v != null ? String(v) : "");
  const name = firstStr(bp.channel_name_suggestions) || bp.channelName || bp.name;
  if (name) out.channelName = name;
  if (bp.tagline) out.tagline = String(bp.tagline);
  if (bp.core_concept || bp.description) out.description = String(bp.core_concept || bp.description);
  if (bp.target_audience) out.targetAudience = [String(bp.target_audience)];
  if (Array.isArray(bp.content_pillars) && bp.content_pillars.length) {
    const pillars = bp.content_pillars.map(p => (typeof p === "string" ? p : p?.title)).filter(Boolean);
    if (pillars.length) out.contentPillars = pillars;
  }
  const freq = bp.upload_schedule?.frequency || bp.uploadCadence;
  if (freq) out.uploadCadence = String(freq);
  const style = bp.production_setup?.style || bp.videoFormat;
  if (style) out.videoFormat = [String(style)];
  return { values: out, filledKeys: Object.keys(out) };
}

/* Ráp khối "DỮ LIỆU SEO THẬT" (từ Tool 5) để nhúng vào system prompt khi sinh.
   Chỉ chèn trường thực sự có dữ liệu → tiết kiệm token. Không có seo → "". */
function buildSeoBlock(seo) {
  if (!seo || typeof seo !== "object") return "";
  const lines = [];
  const ai = seo.ai || {};
  const prioKw = [...(seo.savedKeywords || []), ...(seo.keywordCandidates || [])].filter(Boolean);
  if (prioKw.length) lines.push(`- Từ khoá ưu tiên (đưa vào title/description): ${prioKw.join(", ")}`);
  if (Array.isArray(ai.titlePatterns) && ai.titlePatterns.length)
    lines.push(`- Title pattern đã chứng minh hiệu quả: ${ai.titlePatterns.join(" | ")}`);
  const tags = [...(ai.tags || []), ...(seo.realTags || [])].filter(Boolean);
  if (tags.length) lines.push(`- Tag thật nên dùng: ${tags.join(", ")}`);
  if (Array.isArray(ai.extraKeywords) && ai.extraKeywords.length)
    lines.push(`- Long-tail tiềm năng: ${ai.extraKeywords.join(", ")}`);
  if (seo.opportunity && typeof seo.opportunity.score === "number")
    lines.push(`- Độ cạnh tranh: opportunity ${seo.opportunity.score}/100 (${seo.opportunity.level || "?"}).`);
  if (!lines.length) return "";
  return `\n# DỮ LIỆU SEO THẬT (từ nghiên cứu YouTube${seo.topic ? `, chủ đề "${seo.topic}"` : ""} - bám sát thay vì bịa)\n` +
    lines.join("\n") +
    `\nVới loại seo_title và description, BẮT BUỘC nhồi ít nhất 1 từ khoá ưu tiên vào 40 ký tự đầu.\n`;
}

/* trích JSON OBJECT (cho AI Fill) */
function extractJSON(raw) {
  if (!raw) return null;
  let s = raw.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  try { return JSON.parse(s); } catch {}
  const first = s.indexOf("{"), last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) { try { return JSON.parse(s.slice(first, last + 1)); } catch {} }
  return null;
}

const CHECKPOINT_VERSION = "tool2-channelpromptstudio-v1";
const STORAGE_KEY = "tool2_channelpromptstudio_autosave";

/* ─── model nào hỗ trợ adaptive thinking (4.6+; Haiku KHÔNG) ───────── */
function modelSupportsThinking(id) {
  if (!id) return false;
  const lower = id.toLowerCase();
  if (lower.includes("haiku")) return false;
  const m = lower.match(/-(\d+)-(\d+)/);
  if (m) { const M = +m[1], n = +m[2]; return M > 4 || (M === 4 && n >= 6); }
  return true;
}

/* ─── CLAUDE API (zero-key, streaming) — theo Claude.md ─────────────── */
async function callClaude(system, user, onChunk, cfg = {}) {
  const { model = "claude-sonnet-4-6", thinkingOn = false, effortId = "high", maxTokens = 8000 } = cfg;
  const body = {
    model, max_tokens: maxTokens, stream: true, system,
    messages: [{ role: "user", content: user }],
    output_config: { effort: effortId },
  };
  // Thinking: model 4.6+ dùng adaptive; Haiku/model cũ KHÔNG gửi (tránh lỗi 400)
  if (thinkingOn && modelSupportsThinking(model)) body.thinking = { type: "adaptive" };

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

/* ─── CLAUDE + WEB SEARCH (non-stream) cho nút Cập nhật ─────────────── */
async function callClaudeWithSearch(system, user, model = "claude-sonnet-4-6") {
  const body = {
    model, max_tokens: 4000, system,
    messages: [{ role: "user", content: user }],
    tools: [{ type: "web_search_20250305", name: "web_search" }],
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`API ${res.status}: ${err.slice(0, 200)}`); }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "API error");
  return { text: (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n") };
}

/* ─── helpers ──────────────────────────────────────────────────────── */
function extractJSONArray(raw) {
  if (!raw) return null;
  let s = raw.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  try { const v = JSON.parse(s); if (Array.isArray(v)) return v; if (Array.isArray(v?.prompts)) return v.prompts; if (Array.isArray(v?.models)) return v.models; } catch {}
  const first = s.indexOf("["), last = s.lastIndexOf("]");
  if (first !== -1 && last !== -1 && last > first) { try { return JSON.parse(s.slice(first, last + 1)); } catch {} }
  return null;
}
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

/* Vớt vát: khi JSON array bị cắt giữa chừng (chạm token), quét từng object
   {...} cân bằng ngoặc ở tầng trên cùng và parse riêng. Trả về các bộ đọc được. */
function salvageSets(raw) {
  if (!raw) return null;
  const s = String(raw);
  const out = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") { if (depth === 0) start = i; depth++; }
    else if (c === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        try { out.push(JSON.parse(s.slice(start, i + 1))); } catch {}
        start = -1;
      }
    }
  }
  return out.length ? out : null;
}
const uid = () => Math.random().toString(36).slice(2, 9);
const SET_PALETTE = ["#7c3aed", "#0d9488", "#d97706", "#db2777", "#2563eb", "#65a30d", "#dc2626", "#0891b2"];
function setColor(setId) {
  let h = 0; for (let i = 0; i < setId.length; i++) h = (h * 31 + setId.charCodeAt(i)) >>> 0;
  return SET_PALETTE[h % SET_PALETTE.length];
}

/* ════════════════════════════════════════════════════════════════════
   MAIN
   ════════════════════════════════════════════════════════════════════ */
export default function ChannelPromptStudioTool2() {
  // model config
  const [models, setModels]         = useState(DEFAULT_MODELS);
  const [modelId, setModelId]       = useState("claude-sonnet-4-6");
  const [thinkingOn, setThinkingOn] = useState(false);
  const [effortId, setEffortId]     = useState("high");
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateNote, setUpdateNote] = useState("");

  // ── Channel context (quản lý trực tiếp — gộp từ Module 1) ──
  const [channel, setChannel]     = useState({});
  const [blueprint, setBlueprint] = useState(null);
  const [seoContext, setSeoContext] = useState(null); // SEO data từ Tool 5 (seo-data-*.json)
  const [cpName, setCpName]       = useState("channel-prompt-1");

  // AI Fill
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiBusy, setAiBusy]   = useState(false);
  const [aiStream, setAiStream] = useState("");
  const [channelOpen, setChannelOpen] = useState(true); // collapsible Channel Settings

  // cấu hình lô: { typeKey: quantity }
  const [quantities, setQuantities] = useState(() =>
    Object.fromEntries(PROMPT_TYPES.map(t => [t.key, t.key === "video_script" ? 5 : 0])));

  // ── Sync Mode (đồng bộ các loại theo bộ cùng chủ đề) ──
  const [syncMode, setSyncMode]         = useState(false);
  const [syncQty, setSyncQty]           = useState(5);
  const [syncSelected, setSyncSelected] = useState(() =>
    Object.fromEntries(PROMPT_TYPES.map(t => [t.key, ["video_script", "seo_title", "thumbnail"].includes(t.key)])));

  // ── Rules cá nhân (chỉ thị tối cao cho AI) ──
  const [customRules, setCustomRules] = useState(null); // { name, content }

  // ── Gợi ý Pattern (42 kỹ thuật viết, chỉ cho prompt văn bản) ──
  const [patternsOn, setPatternsOn] = useState(false);

  // kho prompt đã sinh: [{ id, type, category, categoryLabel, title, prompt, setId? }]
  const [prompts, setPrompts] = useState([]);
  // prompt cũ (CHỈ để chống trùng — KHÔNG tính mục tiêu, KHÔNG export): [{title}]
  const [refPrompts, setRefPrompts] = useState([]);

  // biến dẫn xuất để phần generate/export bên dưới dùng như cũ
  const context = { channel, blueprint };

  // generation runtime
  const [genBusy, setGenBusy]   = useState(false);
  const [genLog, setGenLog]     = useState("");      // dòng trạng thái lô hiện tại
  const [genStream, setGenStream] = useState("");
  const [lastUsage, setLastUsage] = useState(null);

  // ui
  const [toast, setToast] = useState({ msg: "", vis: false });
  const [err, setErr]     = useState("");
  const blueprintRef = useRef(null);
  const seoRef = useRef(null);
  const cpRef   = useRef(null);
  const dupRef  = useRef(null);
  const rulesRef = useRef(null);
  const cancelRef = useRef(false);

  const showToast = useCallback((msg) => {
    setToast({ msg, vis: true });
    setTimeout(() => setToast(t => ({ ...t, vis: false })), 2200);
  }, []);

  /* ── auto-save ── */
  useEffect(() => {
    const t = setTimeout(async () => {
      try { await window.storage?.set(STORAGE_KEY, JSON.stringify(buildCheckpoint())); } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [channel, blueprint, seoContext, prompts, refPrompts, quantities, syncMode, syncQty, syncSelected, customRules, patternsOn, models, modelId, thinkingOn, effortId, cpName]);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage?.get(STORAGE_KEY);
        if (r?.value) { applyCheckpoint(JSON.parse(r.value), true); showToast("Đã khôi phục phiên trước"); }
      } catch {}
    })();
    // eslint-disable-next-line
  }, []);

  function buildCheckpoint() {
    return {
      version: CHECKPOINT_VERSION, savedAt: new Date().toISOString(), name: cpName,
      config: { modelId, thinkingOn, effortId }, models,
      channel, blueprint, seoContext, quantities, prompts, refPrompts,
      sync: { syncMode, syncQty, syncSelected },
      customRules, patternsOn,
    };
  }
  function applyCheckpoint(cp, silent) {
    if (!cp) return;
    if (Array.isArray(cp.models) && cp.models.length) setModels(cp.models);
    if (cp.config) {
      setModelId(cp.config.modelId || "claude-sonnet-4-6");
      setThinkingOn(!!cp.config.thinkingOn);
      setEffortId(cp.config.effortId || "high");
    }
    // tương thích cả checkpoint cũ (có cp.context) lẫn mới (channel/blueprint phẳng)
    if (cp.channel !== undefined) setChannel(cp.channel || {});
    else if (cp.context?.channel !== undefined) setChannel(cp.context.channel || {});
    if (cp.blueprint !== undefined) setBlueprint(cp.blueprint);
    else if (cp.context?.blueprint !== undefined) setBlueprint(cp.context.blueprint);
    if (cp.seoContext !== undefined) setSeoContext(cp.seoContext); // tương thích ngược: file cũ không có → giữ null
    if (cp.quantities) setQuantities(q => ({ ...q, ...cp.quantities }));
    if (cp.sync) {
      setSyncMode(!!cp.sync.syncMode);
      if (typeof cp.sync.syncQty === "number") setSyncQty(cp.sync.syncQty);
      if (cp.sync.syncSelected) setSyncSelected(s => ({ ...s, ...cp.sync.syncSelected }));
    }
    if (cp.customRules !== undefined) setCustomRules(cp.customRules);
    if (cp.patternsOn !== undefined) setPatternsOn(!!cp.patternsOn);
    if (Array.isArray(cp.prompts)) setPrompts(cp.prompts);
    if (Array.isArray(cp.refPrompts)) setRefPrompts(cp.refPrompts);
    if (cp.name) setCpName(cp.name);
    if (!silent) showToast("Đã nạp checkpoint");
  }

  /* ── import context từ Module 1 (checkpoint của Channel Studio) ── */
  /* ── áp dụng blueprint Tool 1: tự điền field khớp (KHÔNG tốn AI) ── */
  function applyBlueprint(data) {
    setBlueprint(data); setErr("");
    const { values, filledKeys } = mapBlueprintToChannel(data);
    setChannel(c => {
      const next = { ...c };
      for (const k of filledKeys) {
        const cur = next[k];
        const empty = Array.isArray(cur) ? cur.length === 0 : !cur;
        if (empty) next[k] = values[k];
      }
      return next;
    });
    setChannelOpen(true);
    setTimeout(() => showToast(
      filledKeys.length
        ? `Đã tự điền ${filledKeys.length}/${CHANNEL_FIELDS.length} trường từ blueprint — phần còn lại dùng AI Điền nếu cần`
        : "Đã nạp Blueprint (không có trường nào khớp để tự điền)"
    ), 0);
  }
  function handleBlueprintImport(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { applyBlueprint(JSON.parse(ev.target.result)); }
      catch { setErr("File blueprint không phải JSON hợp lệ."); }
    };
    reader.readAsText(file); e.target.value = "";
  }

  /* ── import SEO data từ Tool 5 (seo-data-*.json) ── */
  function applySeoData(data) {
    if (!data || data.tool !== "tool5-seo-research")
      throw new Error('File không phải SEO data của Tool 5 (thiếu tool === "tool5-seo-research").');
    setSeoContext(data); setErr("");
    const kwCount = (data.savedKeywords?.length || 0) + (data.keywordCandidates?.length || 0);
    showToast(`Đã nạp SEO data: ${kwCount} từ khoá, ${data.realTags?.length || 0} tag thật`);
  }
  function handleSeoImport(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { applySeoData(JSON.parse(ev.target.result)); }
      catch (err) { setErr(err?.message?.includes("SEO data") ? err.message : "File SEO không phải JSON hợp lệ."); }
    };
    reader.readAsText(file); e.target.value = "";
  }

  /* ── Channel Settings: field + chip + AI Fill ── */
  function setField(key, val) { setChannel(c => ({ ...c, [key]: val })); }
  function toggleChip(key, chip, multi) {
    setChannel(c => {
      if (!multi) return { ...c, [key]: c[key] === chip ? "" : chip };
      const arr = Array.isArray(c[key]) ? c[key] : [];
      return { ...c, [key]: arr.includes(chip) ? arr.filter(x => x !== chip) : [...arr, chip] };
    });
  }
  function clearChannel() {
    if (!window.confirm("Xóa toàn bộ thông tin kênh hiện tại?")) return;
    setChannel({}); showToast("Đã xóa thông tin kênh");
  }
  async function runAIFill() {
    if (aiBusy) return;
    setAiBusy(true); setErr(""); setAiStream("");
    const fieldSpec = CHANNEL_FIELDS.map(f =>
      `- "${f.key}" (${f.label})${f.multi ? " — array of strings" : " — string"}`).join("\n");
    const system =
      `Bạn là chuyên gia chiến lược kênh YouTube. Nhiệm vụ: điền thông tin kênh dựa trên ` +
      `yêu cầu của người dùng và blueprint từ Tool 1.\n` +
      `Trả về DUY NHẤT một JSON object, KHÔNG giải thích, KHÔNG markdown fences.\n` +
      `Các trường cần điền:\n${fieldSpec}\n` +
      `Trường array trả về mảng string ngắn gọn. Tiếng Việt. Nhất quán với blueprint.`;
    const user =
      `# Yêu cầu của người dùng\n${aiInstruction || "(không có — suy từ blueprint)"}\n\n` +
      `# Blueprint từ Tool 1\n${blueprint ? JSON.stringify(blueprint) : "(chưa có blueprint)"}\n\n` +
      `# Thông tin kênh hiện có (giữ nếu hợp lý, bổ sung phần thiếu)\n${JSON.stringify(channel)}`;
    try {
      const { text, usage } = await callClaude(system, user, (p) => setAiStream(p), {
        model: modelId, thinkingOn, effortId, maxTokens: 8000,
      });
      const parsed = extractJSON(text);
      if (!parsed) { setErr("AI trả về không phải JSON đọc được. Xem stream bên dưới."); return; }
      setChannel(c => {
        const next = { ...c };
        for (const f of CHANNEL_FIELDS) {
          if (parsed[f.key] == null) continue;
          next[f.key] = f.multi
            ? (Array.isArray(parsed[f.key]) ? parsed[f.key] : [String(parsed[f.key])])
            : String(parsed[f.key]);
        }
        return next;
      });
      if (usage) {
        const p = PRICING[modelId] || PRICING["claude-sonnet-4-6"];
        const cost = ((usage.input_tokens || 0) * p.input + (usage.output_tokens || 0) * p.output) / 1e6;
        setLastUsage({ ...usage, cost });
      }
      showToast("AI đã điền thông tin kênh");
    } catch (e) { setErr(String(e.message || e)); }
    finally { setAiBusy(false); }
  }

  /* ── import checkpoint của chính tool này ── */
  function handleCpImport(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const cp = (() => { try { return JSON.parse(ev.target.result); } catch { return null; } })();
      if (!cp) { setErr("Checkpoint không hợp lệ."); return; }
      if (cp.version && cp.version !== CHECKPOINT_VERSION) showToast("Cảnh báo: checkpoint khác phiên bản");
      applyCheckpoint(cp);
    };
    reader.readAsText(file); e.target.value = "";
  }

  /* ── import prompt cũ (chống trùng) — JSON hoặc MD ── */
  function handleDupImport(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = ev.target.result;
      let items = [];
      const arr = extractJSONArray(raw);
      if (arr) {
        items = arr.map(p => ({
          id: p.id || uid(),
          type: p.type || "text_generation",
          category: p.category || "imported",
          categoryLabel: p.categoryLabel || p.category || "Imported",
          title: p.title || (p.prompt ? String(p.prompt).slice(0, 60) : "Imported"),
          prompt: p.prompt || p.text || "",
        }));
      } else {
        // MD: tách theo heading "## " hoặc dòng "- "
        const blocks = String(raw).split(/\n(?=#{1,3}\s|[-*]\s)/).map(s => s.trim()).filter(Boolean);
        items = blocks.map(b => ({
          id: uid(), type: "text_generation", category: "imported", categoryLabel: "Imported",
          title: b.replace(/^[#\-*\s]+/, "").slice(0, 60), prompt: b.replace(/^[#\-*\s]+/, ""),
        }));
      }
      if (!items.length) { setErr("Không đọc được prompt nào từ file."); return; }
      // CHỈ lưu vào refPrompts để chống trùng — KHÔNG vào kho thành phẩm, KHÔNG export
      setRefPrompts(prev => {
        const seen = new Set(prev.map(p => norm(p.title)));
        const add = items
          .filter(p => p.title && !seen.has(norm(p.title)))
          .map(p => ({ title: p.title, category: p.category || "imported" }));
        return [...prev, ...add];
      });
      showToast(`Đã nạp ${items.length} prompt cũ làm tham chiếu chống trùng (không tính vào kho)`);
    };
    reader.readAsText(file); e.target.value = "";
  }

  /* ── nạp Rules cá nhân (.md/.txt) — ghi đè file cũ ── */
  function handleRulesImport(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target.result || "").trim();
      if (!content) { setErr("File rules rỗng."); return; }
      setCustomRules({ name: file.name, content });
      showToast(`Đã nạp Rules: ${file.name}`);
    };
    reader.readAsText(file); e.target.value = "";
  }

  /* ── chỉnh số lượng ── */
  function setQty(key, v) {
    const n = Math.max(0, Math.min(50, Math.round(Number(v) || 0)));
    setQuantities(q => ({ ...q, [key]: n }));
  }
  function toggleSyncType(key) {
    setSyncSelected(s => ({ ...s, [key]: !s[key] }));
  }
  // tổng số prompt sẽ sinh — khác nhau theo mode
  const selectedSyncTypes = PROMPT_TYPES.filter(t => syncSelected[t.key]);
  // số bộ đã có (theo setId riêng biệt) và số prompt thiếu theo từng loại
  const existingSetCount = new Set(prompts.filter(p => p.setId).map(p => p.setId)).size;
  const remainingSync = Math.max(0, syncQty - existingSetCount);
  const remainingNormal = PROMPT_TYPES.reduce((sum, t) => {
    const have = prompts.filter(p => p.category === t.key).length;
    return sum + Math.max(0, (quantities[t.key] || 0) - have);
  }, 0);
  // tổng prompt SẼ sinh thêm lần bấm này (để hiển thị nút)
  const totalToGen = syncMode
    ? remainingSync * selectedSyncTypes.length
    : remainingNormal;
  // mục tiêu gốc (để kiểm tra hợp lệ — tránh chặn khi đã đủ)
  const targetSet = syncMode ? syncQty * selectedSyncTypes.length
    : Object.values(quantities).reduce((a, b) => a + b, 0);

  /* ── SINH PROMPT — rẽ nhánh theo syncMode ── */
  async function runGenerate() {
    if (genBusy) return;
    if (!targetSet) {
      setErr(syncMode ? "Hãy đặt số lượng > 0 và tích ít nhất một loại." : "Hãy chọn số lượng cho ít nhất một loại prompt.");
      return;
    }
    if (!totalToGen) {
      setErr(syncMode
        ? `Đã đủ ${existingSetCount}/${syncQty} bộ. Tăng "Số bộ cần tạo" nếu muốn thêm.`
        : "Đã đủ số lượng đặt cho mọi loại. Tăng số lượng nếu muốn thêm.");
      return;
    }
    setGenBusy(true); setErr(""); setGenStream(""); cancelRef.current = false;

    const ch = context?.channel || {};
    // compact JSON (không indent) — tiết kiệm token input, AI đọc vẫn hiểu như nhau
    const channelCtx = JSON.stringify(ch);
    const bpCtx = context?.blueprint ? JSON.stringify(context.blueprint) : "(không có)";

    // Rules cá nhân — chỉ thị tối cao, nhúng nguyên văn nếu có
    const rulesBlock = customRules?.content
      ? `\n# CHỈ THỊ TỐI CAO (RULES CÁ NHÂN — TUÂN THỦ NGHIÊM NGẶT VỀ VĂN PHONG, CẤU TRÚC, ĐỊNH DẠNG)\n` +
        `Người dùng đã nạp file rules "${customRules.name}". Mọi prompt bạn tạo PHẢI tuân theo nguyên văn dưới đây, ` +
        `kể cả khi mâu thuẫn với mặc định:\n"""\n${customRules.content}\n"""\n`
      : "";

    // Khối SEO thật (Tool 5) — nhúng vào system khi sinh; rỗng nếu chưa nạp SEO data
    const seoBlock = buildSeoBlock(seoContext);

    let totalUsage = { input_tokens: 0, output_tokens: 0 };
    let stoppedEarly = false;

    try {
      if (syncMode) {
        stoppedEarly = await runGenerateSync({ channelCtx, bpCtx, rulesBlock, seoBlock, totalUsage });
      } else {
        stoppedEarly = await runGenerateNormal({ channelCtx, bpCtx, rulesBlock, seoBlock, totalUsage });
      }

      const p = PRICING[modelId] || PRICING["claude-sonnet-4-6"];
      const cost = (totalUsage.input_tokens * p.input + totalUsage.output_tokens * p.output) / 1e6;
      setLastUsage({ ...totalUsage, cost });
      setGenLog(stoppedEarly
        ? 'Dừng sớm — phần sinh được vẫn nằm trong "Kho Prompt". Bấm "Lưu CP" để lưu file.'
        : "Hoàn tất sinh prompt.");
      if (!stoppedEarly && !cancelRef.current) showToast("Đã sinh xong prompt");
      if (cancelRef.current) setGenLog("Đã huỷ — phần sinh được vẫn giữ lại.");
    } catch (e) {
      setErr(String(e.message || e));
      setGenLog("Lỗi — các lô trước vẫn được giữ lại.");
    } finally {
      setGenBusy(false); setGenStream("");
    }
  }

  /* ── chế độ THƯỜNG: sinh theo lô từng loại (giữ nguyên logic cũ) ── */
  async function runGenerateNormal({ channelCtx, bpCtx, rulesBlock, seoBlock, totalUsage }) {
    for (const t of PROMPT_TYPES) {
      if (cancelRef.current) break;
      const target = quantities[t.key] || 0;
      if (!target) continue;

      const existingSame = prompts.filter(p => p.category === t.key).map(p => p.title);
      const already = existingSame.length;
      const want = target - already;            // chỉ sinh phần còn THIẾU so với mục tiêu
      if (want <= 0) { setGenLog(`${t.label}: đã đủ ${already}/${target}, bỏ qua.`); continue; }

      setGenLog(`Đang sinh ${want} × ${t.label} (đã có ${already}/${target})…`);
      setGenStream("");

      // né trùng: gộp tiêu đề kho thành phẩm + prompt cũ tham chiếu
      const refSame = refPrompts.filter(p => p.category === t.key).map(p => p.title);
      const avoidSame = [...existingSame, ...refSame];
      const existingTitles = [...prompts.map(p => p.title), ...refPrompts.map(p => p.title)];

      const system =
        `Bạn là chuyên gia sản xuất nội dung YouTube. Nhiệm vụ: tạo ${want} PROMPT thuộc loại "${t.label}".\n` +
        `Mô tả loại prompt này: ${t.brief}\n\n` +
        `QUAN TRỌNG — đây là "máy đẻ prompt": bạn tạo ra các PROMPT (chỉ thị để một AI khác thực thi sau), ` +
        `KHÔNG tạo nội dung cuối cùng.\n` +
        `Trả về DUY NHẤT một JSON ARRAY, KHÔNG giải thích, KHÔNG markdown fences. Mỗi phần tử:\n` +
        `{ "title": "<tiêu đề ngắn gọn, tiếng Việt, để người dùng nhận diện>", "prompt": "<nội dung prompt đầy đủ>" }\n` +
        (t.type === "image_generation"
          ? `Vì là prompt ẢNH: trường "prompt" viết bằng TIẾNG ANH, chi tiết, sẵn sàng dán vào Midjourney/Leonardo/DALL-E.\n`
          : `Trường "prompt" viết bằng tiếng Việt, rõ ràng, đầy đủ ngữ cảnh để AI thực thi tốt.\n`) +
        `Các tiêu đề PHẢI khác nhau và KHÔNG trùng với danh sách đã có dưới đây.` +
        (patternsOn && t.type === "text_generation"
          ? `\n\n# KHO KỸ THUẬT VIẾT (gợi ý cho AI viết sau)\n${PATTERN_CATALOG}\n` +
            `Với MỖI prompt, chọn 3-4 kỹ thuật PHÙ HỢP nhất với chủ đề và ghi vào cuối nội dung prompt dạng: ` +
            `"Kỹ thuật gợi ý: <TÊN_PATTERN> (mô tả ngắn), ...". Chọn theo nội dung, không rập khuôn.`
          : "") +
        OUTPUT_HYGIENE +
        seoBlock +
        rulesBlock;

      const user =
        `# Thông tin kênh\n${channelCtx}\n\n# Blueprint (Tool 1)\n${bpCtx}\n\n` +
        `# Tiêu đề ĐÃ CÓ (cùng loại — TUYỆT ĐỐI không lặp lại)\n` +
        `${avoidSame.length ? avoidSame.map(x => "- " + x).join("\n") : "(chưa có)"}\n\n` +
        `# Tiêu đề đã có (loại khác — tránh trùng ý)\n` +
        `${existingTitles.length ? existingTitles.slice(0, 40).map(x => "- " + x).join("\n") : "(chưa có)"}\n\n` +
        `Hãy tạo đúng ${want} prompt loại "${t.label}".`;

      const maxTok = Math.min(3000 + want * 1500, 32000);
      const { text, usage, stopReason } = await callClaude(system, user, (p) => setGenStream(p), {
        model: modelId, thinkingOn, effortId, maxTokens: maxTok,
      });
      if (usage) { totalUsage.input_tokens += usage.input_tokens || 0; totalUsage.output_tokens += usage.output_tokens || 0; }

      const arr = extractJSONArray(text);
      if (!arr) { setErr(`Lô "${t.label}" trả về không đọc được JSON. Các lô trước đã được giữ lại.`); return true; }

      setPrompts(prev => {
        const seen = new Set(prev.map(p => norm(p.title)));
        const add = [];
        for (const it of arr) {
          const title = String(it.title || it.prompt || "").slice(0, 120);
          if (!title || seen.has(norm(title))) continue;
          seen.add(norm(title));
          add.push({ id: uid(), type: t.type, category: t.key, categoryLabel: t.label, title, prompt: String(it.prompt || it.text || "") });
        }
        return [...prev, ...add];
      });

      if (stopReason === "max_tokens") {
        setErr(`Lô "${t.label}" chạm giới hạn token — đã lưu phần sinh được. Bấm "Tạo Prompt" lần nữa để sinh tiếp (đã chống trùng).`);
        return true;
      }
    }
    return false;
  }

  /* ── chế độ ĐỒNG BỘ: sinh TỪNG BỘ một (mỗi bộ 1 call trả 1 object) ──
     Bền hơn cách gộp: 1 object dễ parse hơn array nhiều bộ; token cấp rộng;
     một bộ hỏng chỉ skip bộ đó, các bộ khác vẫn vào kho. */
  async function runGenerateSync({ channelCtx, bpCtx, rulesBlock, seoBlock, totalUsage }) {
    const types = selectedSyncTypes;
    if (!types.length) { setErr("Hãy tích ít nhất một loại để đồng bộ."); return true; }

    const typeSpec = types.map(t =>
      `  "${t.key}": "<${t.type === "image_generation" ? "prompt ảnh, TIẾNG ANH, chi tiết cho Midjourney/Leonardo" : "prompt, tiếng Việt, đầy đủ ngữ cảnh"}; mục đích: ${t.brief}>"`
    ).join(",\n");

    // token RỘNG TAY cho 1 bộ (theo yêu cầu: ưu tiên xong việc) — trần model lo phần còn lại
    const maxTok = Math.min(4000 + types.length * 4000, 32000);

    // số BỘ đã có trong kho = số setId riêng biệt (chỉ tính prompt thuộc bộ)
    const existingSets = new Set(prompts.filter(p => p.setId).map(p => p.setId)).size;
    const need = syncQty - existingSets;       // chỉ sinh cho đủ mục tiêu
    if (need <= 0) { setGenLog(`Đã đủ ${existingSets}/${syncQty} bộ, không cần sinh thêm.`); return false; }

    let madeAny = false;
    let failCount = 0;
    let lastRaw = "";

    for (let i = 0; i < need; i++) {
      if (cancelRef.current) break;
      setGenLog(`Đang sinh bộ ${existingSets + i + 1}/${syncQty} (${types.map(t => t.label).join(", ")})…`);
      setGenStream("");

      // chống trùng theo videoTitle đã có (kho + prompt cũ tham chiếu)
      const existingTitles = [...new Set([...prompts.map(p => p.title), ...refPrompts.map(p => p.title)])];

      const system =
        `Bạn là chuyên gia sản xuất nội dung YouTube. Nhiệm vụ: tạo ĐÚNG 1 BỘ prompt ĐỒNG BỘ ` +
        `xoay quanh MỘT chủ đề/video duy nhất. Các loại trong bộ phải ĂN KHỚP cùng chủ đề đó.\n` +
        `Đây là "máy đẻ prompt": tạo PROMPT (chỉ thị cho AI khác), KHÔNG tạo nội dung cuối.\n\n` +
        `Trả về DUY NHẤT một JSON OBJECT, KHÔNG giải thích, KHÔNG markdown fences:\n` +
        `{\n  "videoTitle": "<tên video/chủ đề, tiếng Việt>",\n  "items": {\n${typeSpec}\n  }\n}\n` +
        `videoTitle KHÔNG được trùng danh sách đã có.` +
        (patternsOn && types.some(t => t.type === "text_generation")
          ? `\n\n# KHO KỸ THUẬT VIẾT (cho các loại văn bản trong bộ)\n${PATTERN_CATALOG}\n` +
            `Với loại văn bản (kịch bản/mô tả), thêm vào cuối prompt: "Kỹ thuật gợi ý: <3-4 TÊN_PATTERN phù hợp>".`
          : "") +
        OUTPUT_HYGIENE +
        seoBlock +
        rulesBlock;

      const user =
        `# Thông tin kênh\n${channelCtx}\n\n# Blueprint (Tool 1)\n${bpCtx}\n\n` +
        `# videoTitle ĐÃ CÓ (tránh trùng)\n` +
        `${existingTitles.length ? existingTitles.slice(0, 50).map(x => "- " + x).join("\n") : "(chưa có)"}\n\n` +
        `Tạo 1 bộ gồm các loại: ${types.map(t => t.key).join(", ")}.`;

      let parsed = null;
      try {
        const { text, usage, stopReason } = await callClaude(system, user, (p) => setGenStream(p), {
          model: modelId, thinkingOn, effortId, maxTokens: maxTok,
        });
        if (usage) { totalUsage.input_tokens += usage.input_tokens || 0; totalUsage.output_tokens += usage.output_tokens || 0; }
        lastRaw = text;
        // 1 object → extractJSON; nếu hỏng thử vớt object đầu tiên
        parsed = extractJSON(text) || (salvageSets(text)?.[0] ?? null);
        if (!parsed && stopReason === "max_tokens") {
          // hiếm khi xảy ra với token rộng, nhưng vẫn báo
          setErr(`Bộ ${i + 1} chạm trần token dù đã cấp rộng — bỏ qua bộ này.`);
        }
      } catch (e) {
        setErr(`Bộ ${i + 1} lỗi API: ${String(e.message || e)} — bỏ qua, tiếp tục bộ sau.`);
      }

      if (!parsed) { failCount++; continue; }

      const videoTitle = String(parsed.videoTitle || parsed.title || `Bộ ${i + 1}`).slice(0, 120);
      const items = parsed.items || parsed;
      const setId = uid();
      setPrompts(prev => {
        const seen = new Set(prev.map(p => norm(p.title)));
        if (seen.has(norm(videoTitle))) { /* trùng → vẫn thêm nhưng đánh dấu khác */ }
        const add = [];
        for (const t of types) {
          const val = items[t.key];
          if (!val) continue;
          add.push({
            id: uid(), setId, type: t.type, category: t.key, categoryLabel: t.label,
            title: videoTitle, prompt: String(val),
          });
        }
        return [...prev, ...add];
      });
      madeAny = true;
    }

    if (!madeAny) {
      setErr(`Không sinh được bộ nào (${failCount}/${need} lỗi). Raw bộ cuối: ${lastRaw.slice(0, 200)}…`);
      return true;
    }
    if (failCount) setErr(`Đã sinh ${need - failCount}/${need} bộ mới; ${failCount} bộ lỗi đã bỏ qua.`);
    return false;
  }

  function cancelGenerate() { cancelRef.current = true; }

  /* ── kho prompt: xoá / sửa ── */
  function deletePrompt(id) { setPrompts(prev => prev.filter(p => p.id !== id)); }
  function clearPrompts() {
    if (!prompts.length) return;
    if (!window.confirm(`Xoá toàn bộ ${prompts.length} prompt?`)) return;
    setPrompts([]); showToast("Đã xoá kho prompt");
  }
  async function copyPrompt(text) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea"); ta.value = text;
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    showToast("Đã copy prompt");
  }

  /* ── export JSON / MD ── */
  function exportJSON() {
    if (!prompts.length) { setErr("Chưa có prompt để export."); return; }
    const payload = {
      tool: "tool2-prompt-factory", version: CHECKPOINT_VERSION,
      exportedAt: new Date().toISOString(),
      channel: context?.channel || null,
      prompts: prompts.map(p => ({
        id: p.id, setId: p.setId || null,
        type: p.type, category: p.category, categoryLabel: p.categoryLabel,
        title: p.title, prompt: p.prompt,
      })),
    };
    download(`${cpName || "prompts"}.json`, JSON.stringify(payload, null, 2), "application/json");
    showToast("Đã export JSON (kèm type + setId)");
  }
  function exportMD() {
    if (!prompts.length) { setErr("Chưa có prompt để export."); return; }
    let md = `# Prompt Factory — ${context?.channel?.channelName || "Kênh"}\n\n`;
    md += `> Xuất ngày ${new Date().toLocaleString("vi-VN")} · ${prompts.length} prompt\n\n`;
    for (const t of PROMPT_TYPES) {
      const items = prompts.filter(p => p.category === t.key);
      if (!items.length) continue;
      md += `## ${t.label}  \`${t.type}\`\n\n`;
      items.forEach((p, i) => { md += `### ${i + 1}. ${p.title}\n\n${p.prompt}\n\n`; });
    }
    const other = prompts.filter(p => !PROMPT_TYPES.some(t => t.key === p.category));
    if (other.length) {
      md += `## Khác / Imported\n\n`;
      other.forEach((p, i) => { md += `### ${i + 1}. ${p.title}\n\n${p.prompt}\n\n`; });
    }
    download(`${cpName || "prompts"}.md`, md, "text/markdown");
    showToast("Đã export Markdown");
  }
  function exportCheckpoint() {
    try {
      const json = JSON.stringify(buildCheckpoint(), null, 2);
      const safe = (cpName || "channel-prompt").replace(/[^\w\-]+/g, "_").slice(0, 40);
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      const fname = `${safe}_${stamp}.checkpoint.json`;
      download(fname, json, "application/json");
      showToast(`Đã lưu "${fname}" vào thư mục Download`);
    } catch (e) {
      setErr("Không tạo được checkpoint: " + String(e.message || e));
    }
  }
  function download(name, content, mime) {
    try {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a);   // một số trình duyệt cần phần tử nằm trong DOM
      a.click();
      a.remove();
      // revoke TRỄ để chắc trình duyệt đã bắt đầu tải; revoke ngay KHÔNG gây crash,
      // nhưng để trễ cho chắc, và bọc try/catch để không bao giờ làm sập UI.
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setErr("Tải file thất bại: " + String(e.message || e));
    }
  }

  /* ── nút Cập nhật model ── */
  async function runUpdateModels() {
    if (updateBusy) return;
    setUpdateBusy(true); setErr(""); setUpdateNote("Đang tra cứu tài liệu Anthropic…");
    const system =
      `Bạn có web_search. Tra danh sách model Claude HIỆN HÀNH cho Messages API (nguồn: platform.claude.com/docs, ` +
      `github.com/anthropics/skills, github.com/anthropics/claude-code).\n` +
      `Trả DUY NHẤT một JSON ARRAY (không giải thích, không fences), mỗi phần tử ` +
      `{ "id":"<model id chính xác>", "label":"<tên ngắn>", "badge":"<nhãn ngắn hoặc rỗng>" }. ` +
      `Chỉ model active, mới nhất xếp cuối, dùng đúng id (vd claude-opus-4-8).`;
    try {
      const { text } = await callClaudeWithSearch(system, "Liệt kê model Claude hiện hành cho API.", modelId);
      const arr = extractJSONArray(text);
      if (!arr?.length) { setErr("Không đọc được danh sách model."); setUpdateNote(""); return; }
      const colorFor = (id) => id.includes("haiku") ? "#d97706" : id.includes("sonnet") ? "#0d9488"
        : id.includes("opus-4-8") ? "#6d28d9" : "#7c3aed";
      const normalized = arr.filter(m => m?.id?.startsWith?.("claude-")).map(m => ({
        id: m.id, label: String(m.label || m.id).slice(0, 24), badge: String(m.badge || "").slice(0, 14), color: colorFor(m.id),
      }));
      if (!normalized.length) { setErr("Danh sách không hợp lệ."); setUpdateNote(""); return; }
      const before = new Set(models.map(m => m.id));
      const added = normalized.filter(m => !before.has(m.id)).map(m => m.label);
      setModels(normalized);
      if (!normalized.some(m => m.id === modelId)) setModelId(normalized[normalized.length - 1].id);
      setUpdateNote(added.length ? `Đã cập nhật ${normalized.length} model. Mới: ${added.join(", ")}.` : `Đã làm mới ${normalized.length} model.`);
      showToast("Đã cập nhật model");
    } catch (e) { setErr("Cập nhật thất bại: " + String(e.message || e)); setUpdateNote(""); }
    finally { setUpdateBusy(false); }
  }

  const curModel = models.find(m => m.id === modelId) || models[0];
  const byType = { text: prompts.filter(p => p.type === "text_generation").length,
                   image: prompts.filter(p => p.type === "image_generation").length };

  /* ══════════════════════════ RENDER ══════════════════════════ */
  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={S.logoBox}><Factory size={18} color="#fff" /></div>
          <div>
            <div style={S.title}>Channel & Prompt Studio</div>
            <div style={S.subtitle}>Tool 2 — Thiết lập kênh + Máy đẻ Prompt</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.btnGhost} onClick={() => cpRef.current?.click()}><FolderInput size={14} /> Nạp CP</button>
          <button style={S.btnGhost} onClick={exportCheckpoint}><Download size={14} /> Lưu CP</button>
        </div>
      </div>

      <ModelSelector
        models={models} modelId={modelId} onModel={setModelId}
        thinkingOn={thinkingOn} onThinking={setThinkingOn}
        effortId={effortId} onEffort={setEffortId}
        updateBusy={updateBusy} updateNote={updateNote} onUpdate={runUpdateModels}
      />

      <div style={S.body}>
        {err && (
          <div style={S.errBox}><AlertTriangle size={14} /><span>{err}</span>
            <X size={14} style={{ marginLeft: "auto", cursor: "pointer" }} onClick={() => setErr("")} />
          </div>
        )}

        {/* A — IMPORT BLUEPRINT TỪ TOOL 1 */}
        <Section icon={<FileJson size={15} />} title="A · Nạp Blueprint từ Tool 1" tag="Input">
          {blueprint ? (
            <div style={S.ctxCard}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#0d9488", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <Check size={14} /> Đã nạp blueprint{blueprint.channel_name_suggestions?.[0] ? `: ${blueprint.channel_name_suggestions[0]}` : ""}
                </span>
                <button style={S.btnGhostSm} onClick={() => { setBlueprint(null); showToast("Đã gỡ blueprint"); }}><Trash2 size={12} /> Gỡ</button>
              </div>
            </div>
          ) : (
            <div style={S.dropZone} onClick={() => blueprintRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0];
                if (f) { const r = new FileReader(); r.onload = ev => { try { applyBlueprint(JSON.parse(ev.target.result)); } catch { setErr("JSON không hợp lệ"); } }; r.readAsText(f); } }}>
              <Upload size={22} color="#a8a29e" />
              <div style={{ marginTop: 6 }}>Click hoặc kéo thả file JSON blueprint (từ Tool 1)</div>
              <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 2 }}>Không có cũng được — điền tay hoặc dùng AI Điền bên dưới</div>
            </div>
          )}
        </Section>

        {/* A2 — IMPORT SEO DATA TỪ TOOL 5 */}
        <Section icon={<FileJson size={15} />} title="A2 · Nạp SEO data từ Tool 5" tag="Input · tuỳ chọn">
          {seoContext ? (
            <div style={S.ctxCard}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#0d9488", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <Check size={14} /> SEO: {seoContext.topic || "(không tên)"}
                </span>
                <button style={S.btnGhostSm} onClick={() => { setSeoContext(null); showToast("Đã gỡ SEO data"); }}><Trash2 size={12} /> Gỡ</button>
              </div>
              <div style={{ fontSize: 11.5, color: "#57534e", marginTop: 6, lineHeight: 1.7 }}>
                {seoContext.opportunity && typeof seoContext.opportunity.score === "number" &&
                  <div>Opportunity: <b>{seoContext.opportunity.score}/100</b> ({seoContext.opportunity.level || "?"})</div>}
                <div>Từ khoá đã lưu: <b>{seoContext.savedKeywords?.length || 0}</b> · ứng viên: <b>{seoContext.keywordCandidates?.length || 0}</b> · tag thật: <b>{seoContext.realTags?.length || 0}</b></div>
              </div>
            </div>
          ) : (
            <div style={S.dropZone} onClick={() => seoRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0];
                if (f) { const r = new FileReader(); r.onload = ev => { try { applySeoData(JSON.parse(ev.target.result)); } catch (err) { setErr(err?.message?.includes("SEO data") ? err.message : "JSON không hợp lệ"); } }; r.readAsText(f); } }}>
              <Upload size={22} color="#a8a29e" />
              <div style={{ marginTop: 6 }}>Click hoặc kéo thả file seo-data-*.json (từ Tool 5)</div>
              <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 2 }}>Nạp vào để prompt bám từ khoá + tag thật khi sinh</div>
            </div>
          )}
        </Section>

        {/* A3 — CHANNEL SETTINGS (collapsible) */}
        <Section icon={<Tags size={15} />} title="B · Thiết lập thông tin kênh"
          tag={`${CHANNEL_FIELDS.filter(f => { const v = channel[f.key]; return Array.isArray(v) ? v.length : !!v; }).length}/${CHANNEL_FIELDS.length} · OFFLINE + AI`}
          collapsible open={channelOpen} onToggle={() => setChannelOpen(o => !o)}>
          {/* AI Fill */}
          <div style={S.aiFillBox}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
              <Sparkles size={14} color="#7c3aed" />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#6d28d9" }}>AI Điền tự động</span>
              <span style={S.apiTag}>TỐN API</span>
            </div>
            <textarea style={S.textarea} rows={2} placeholder="VD: Kênh kể chuyện khoa học vũ trụ cho người trẻ, giọng kịch tính, đăng 2 video/tuần…"
              value={aiInstruction} onChange={e => setAiInstruction(e.target.value)} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <button style={{ ...S.btnPrimary, opacity: aiBusy ? 0.6 : 1 }} disabled={aiBusy} onClick={runAIFill}>
                {aiBusy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                {aiBusy ? "Đang điền…" : "AI Điền"}
              </button>
            </div>
            {aiBusy && aiStream && <pre style={S.streamPre}>{aiStream.slice(-500)}</pre>}
          </div>
          {CHANNEL_FIELDS.map(f => (
            <FieldRow key={f.key} field={f} value={channel[f.key]} onSet={setField} onChip={toggleChip} />
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button style={S.btnGhost} onClick={clearChannel}><Trash2 size={14} /> Xóa thông tin kênh</button>
          </div>
        </Section>

        {/* B — CẤU HÌNH LÔ */}
        <Section icon={<Package size={15} />} title="C · Chọn loại & số lượng" tag="Offline">
          {/* Toggle Sync Mode */}
          <div style={S.syncToggleRow}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Layers size={15} color={syncMode ? "#7c3aed" : "#a8a29e"} />
              <span style={{ fontSize: 13, fontWeight: 600, color: syncMode ? "#6d28d9" : "#57534e" }}>Đồng bộ các loại Prompt</span>
              <span style={{ fontSize: 11, color: "#a8a29e" }}>{syncMode ? "tạo theo bộ cùng chủ đề" : "tạo riêng từng loại"}</span>
            </span>
            <span onClick={() => setSyncMode(v => !v)} style={{ ...S.toggleTrack, width: 30, height: 16, cursor: "pointer", background: syncMode ? "#7c3aed" : "#d6d3d1" }}>
              <span style={{ ...S.toggleKnob, width: 12, height: 12, transform: syncMode ? "translateX(14px)" : "translateX(0)" }} />
            </span>
          </div>

          {/* Toggle Gợi ý Pattern */}
          <div style={S.syncToggleRow}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Wand2 size={15} color={patternsOn ? "#7c3aed" : "#a8a29e"} />
              <span style={{ fontSize: 13, fontWeight: 600, color: patternsOn ? "#6d28d9" : "#57534e" }}>Gợi ý Pattern viết</span>
              <span style={{ fontSize: 11, color: "#a8a29e" }}>{patternsOn ? "nhúng kỹ thuật vào prompt văn bản" : "42 kỹ thuật · tắt để tiết kiệm token"}</span>
            </span>
            <span onClick={() => setPatternsOn(v => !v)} style={{ ...S.toggleTrack, width: 30, height: 16, cursor: "pointer", background: patternsOn ? "#7c3aed" : "#d6d3d1" }}>
              <span style={{ ...S.toggleKnob, width: 12, height: 12, transform: patternsOn ? "translateX(14px)" : "translateX(0)" }} />
            </span>
          </div>

          {/* Thẻ Rules cá nhân */}
          {customRules ? (
            <div style={S.rulesCard}>
              <span style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
                <BookCheck size={15} color="#b45309" />
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#92400e" }}>Rules cá nhân đang áp dụng</span>
                  <span style={{ fontSize: 11, color: "#a16207", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customRules.name} · {customRules.content.length} ký tự</span>
                </span>
              </span>
              <button style={S.btnGhostSm} onClick={() => { setCustomRules(null); showToast("Đã gỡ Rules"); }}><Trash2 size={12} /> Gỡ</button>
            </div>
          ) : null}

          {/* Cấu hình theo mode */}
          {syncMode ? (
            <div style={S.syncBox}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#57534e" }}>Số bộ cần tạo</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button style={S.stepBtn} onClick={() => setSyncQty(q => Math.max(1, q - 1))}><Minus size={13} /></button>
                  <input style={S.qtyInput} value={syncQty} onChange={e => setSyncQty(Math.max(1, Math.min(30, Math.round(Number(e.target.value) || 1))))} />
                  <button style={S.stepBtn} onClick={() => setSyncQty(q => Math.min(30, q + 1))}><Plus size={13} /></button>
                </span>
                <span style={{ fontSize: 11, color: "#a8a29e" }}>mỗi bộ gồm các loại đã tích</span>
              </div>
              {PROMPT_TYPES.map(t => {
                const on = !!syncSelected[t.key];
                return (
                  <div key={t.key} onClick={() => toggleSyncType(t.key)} style={{ ...S.checkRow, ...(on ? S.checkRowOn : {}) }}>
                    <span style={{ ...S.checkBox, ...(on ? { background: t.color, borderColor: t.color } : {}) }}>{on && <Check size={12} color="#fff" />}</span>
                    {t.icon === "image" ? <ImageIcon size={15} color={t.color} /> : <FileText size={15} color={t.color} />}
                    <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{t.label}</span>
                    <span style={{ ...S.typeTag, color: t.color, borderColor: t.color + "55", background: t.color + "0f" }}>{t.type}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            PROMPT_TYPES.map(t => (
              <div key={t.key} style={S.qtyRow}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {t.icon === "image" ? <ImageIcon size={15} color={t.color} /> : <FileText size={15} color={t.color} />}
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{t.label}</span>
                  <span style={{ ...S.typeTag, color: t.color, borderColor: t.color + "55", background: t.color + "0f" }}>{t.type}</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button style={S.stepBtn} onClick={() => setQty(t.key, (quantities[t.key] || 0) - 1)}><Minus size={13} /></button>
                  <input style={S.qtyInput} value={quantities[t.key] || 0} onChange={e => setQty(t.key, e.target.value)} />
                  <button style={S.stepBtn} onClick={() => setQty(t.key, (quantities[t.key] || 0) + 1)}><Plus size={13} /></button>
                </span>
              </div>
            ))
          )}

          <div style={S.genBar}>
            <button style={{ ...S.btnPrimary, opacity: genBusy ? 0.6 : 1 }} disabled={genBusy} onClick={runGenerate}>
              {genBusy ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
              {genBusy ? "Đang sinh…" : syncMode
                ? (remainingSync < syncQty ? `Sinh tiếp ${remainingSync} bộ (cho đủ ${syncQty})` : `Tạo ${syncQty} bộ (${totalToGen} prompt)`)
                : `Tạo ${totalToGen} Prompt`}
            </button>
            {genBusy && <button style={S.btnGhost} onClick={cancelGenerate}><Ban size={14} /> Huỷ</button>}
            <button style={S.btnGhost} onClick={() => dupRef.current?.click()}><Upload size={14} /> Nạp prompt cũ</button>
            <button style={S.btnGhost} onClick={() => rulesRef.current?.click()}><BookCheck size={14} /> Nạp Rules (.md)</button>
            <span style={S.apiTag}>TỐN API</span>
          </div>
          {refPrompts.length > 0 && (
            <div style={S.refChip}>
              <Ban size={12} />
              <span>{refPrompts.length} prompt cũ đang dùng làm tham chiếu chống trùng (không tính vào kho, không export)</span>
              <X size={13} style={{ cursor: "pointer", marginLeft: "auto" }} onClick={() => { setRefPrompts([]); showToast("Đã gỡ prompt tham chiếu"); }} />
            </div>
          )}
          {(genBusy || genLog) && (
            <div style={S.genStatus}>
              <span>{genLog}</span>
              {lastUsage && <span style={S.usage}>{lastUsage.input_tokens}→{lastUsage.output_tokens} tok · ${lastUsage.cost.toFixed(4)}</span>}
            </div>
          )}
          {genBusy && genStream && <pre style={S.streamPre}>{genStream.slice(-500)}</pre>}
        </Section>

        {/* C — KHO PROMPT */}
        <Section icon={<Factory size={15} />} title={`D · Kho Prompt (${prompts.length})`} tag={`text:${byType.text} · image:${byType.image}`}>
          {prompts.length === 0 ? (
            <div style={S.empty}>Chưa có prompt nào. Chọn loại & số lượng ở trên rồi bấm "Tạo Prompt".</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <button style={S.btnPrimaryOutline} onClick={exportJSON}><FileJson size={14} /> Export JSON</button>
                <button style={S.btnPrimaryOutline} onClick={exportMD}><FileText size={14} /> Export MD</button>
                <button style={S.btnGhost} onClick={clearPrompts}><Trash2 size={14} /> Xoá hết</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {prompts.map(p => (
                  <div key={p.id} style={{ ...S.promptCard, ...(p.setId ? { borderLeft: `3px solid ${setColor(p.setId)}` } : {}) }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      {p.type === "image_generation" ? <ImageIcon size={13} color="#7c3aed" /> : <FileText size={13} color="#0d9488" />}
                      <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>{p.title}</span>
                      {p.setId && <span style={{ ...S.setTag, background: setColor(p.setId) + "1a", color: setColor(p.setId) }}>BỘ</span>}
                      <span style={{ ...S.typeTagSm, color: p.type === "image_generation" ? "#7c3aed" : "#0d9488" }}>{p.categoryLabel}</span>
                      <Copy size={13} style={{ cursor: "pointer", color: "#a8a29e" }} onClick={() => copyPrompt(p.prompt)} />
                      <Trash2 size={13} style={{ cursor: "pointer", color: "#d6d3d1" }} onClick={() => deletePrompt(p.id)} />
                    </div>
                    <div style={S.promptBody}>{p.prompt}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>
      </div>

      <input ref={blueprintRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleBlueprintImport} />
      <input ref={seoRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleSeoImport} />
      <input ref={cpRef}  type="file" accept=".json" style={{ display: "none" }} onChange={handleCpImport} />
      <input ref={dupRef} type="file" accept=".json,.md,.txt" style={{ display: "none" }} onChange={handleDupImport} />
      <input ref={rulesRef} type="file" accept=".md,.txt" style={{ display: "none" }} onChange={handleRulesImport} />

      <div style={{ ...S.toast, opacity: toast.vis ? 1 : 0, transform: toast.vis ? "translateY(0)" : "translateY(8px)" }}>{toast.msg}</div>
      <style>{`.spin{animation:sp 1s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}
        textarea,input{font-family:${FONT}}`}</style>
    </div>
  );
}

/* ─── helpers render ─────────────────────────────────────────────── */
function summarizeChannel(ch) {
  if (!ch) return "—";
  const pillars = Array.isArray(ch.contentPillars) ? ch.contentPillars.slice(0, 3).join(", ") : "";
  return pillars || ch.tagline || ch.description?.slice(0, 50) || "context cơ bản";
}

function Section({ icon, title, tag, children, collapsible, open = true, onToggle }) {
  return (
    <div style={S.section}>
      <div style={{ ...S.sectionHead, cursor: collapsible ? "pointer" : "default", marginBottom: collapsible && !open ? 0 : 12 }}
        onClick={collapsible ? onToggle : undefined}>
        <span style={{ display: "flex", alignItems: "center", gap: 7, color: "#44403c", fontWeight: 600, fontSize: 13 }}>
          {collapsible && <ChevronDown size={14} style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }} />}
          {icon} {title}
        </span>
        {tag && <span style={S.sectionTag}>{tag}</span>}
      </div>
      {(!collapsible || open) && children}
    </div>
  );
}

function FieldRow({ field, value, onSet, onChip }) {
  const isMulti = field.multi;
  const arr = Array.isArray(value) ? value : [];
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={S.fieldLabel}>{field.label}</label>
      {field.area ? (
        <textarea style={S.textarea} rows={2} placeholder={field.ph}
          value={value || ""} onChange={e => onSet(field.key, e.target.value)} />
      ) : (
        <input style={S.input} placeholder={field.ph}
          value={isMulti ? arr.join(", ") : (value || "")}
          onChange={e => onSet(field.key, isMulti ? e.target.value.split(",").map(s => s.trim()).filter(Boolean) : e.target.value)} />
      )}
      {field.chips.length > 0 && (
        <div style={S.chipWrap}>
          {field.chips.map(chip => {
            const active = isMulti ? arr.includes(chip) : value === chip;
            return (
              <span key={chip} onClick={() => onChip(field.key, chip, isMulti)}
                style={{ ...S.chip, ...(active ? S.chipOn : {}) }}>
                {active && <Check size={11} />} {chip}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModelSelector({ models, modelId, onModel, thinkingOn, onThinking, effortId, onEffort, updateBusy, updateNote, onUpdate }) {
  const [effortOpen, setEffortOpen] = useState(false);
  const curEffort = EFFORT_LEVELS.find(e => e.id === effortId) || EFFORT_LEVELS[2];
  return (
    <div style={S.modelBar}>
      <div style={S.modelRow}>
        <Cpu size={13} color="#a8a29e" />
        {models.map(m => {
          const active = modelId === m.id;
          return (
            <div key={m.id} onClick={() => onModel(m.id)}
              style={{ ...S.modelChip, ...(active ? { borderColor: m.color, background: "#fff", boxShadow: `0 0 0 1px ${m.color}` } : {}) }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: m.color }} />
              <span style={{ fontWeight: 600, fontSize: 12 }}>{m.label}</span>
              {m.badge && <span style={S.modelBadge}>{m.badge}</span>}
            </div>
          );
        })}
        <button onClick={onUpdate} disabled={updateBusy} style={S.updateBtn} title="Tra docs Anthropic tìm model mới">
          {updateBusy ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
          {updateBusy ? "Đang cập nhật…" : "Cập nhật"}
        </button>
      </div>
      {updateNote && <div style={S.updateNote}>{updateNote}</div>}
      <div style={S.modelRow}>
        <div style={{ position: "relative" }}>
          <button style={S.effortBtn} onClick={() => setEffortOpen(o => !o)}>
            <span style={{ color: "#a8a29e" }}>Effort</span>
            <span style={{ fontWeight: 600 }}>{curEffort.label}</span>
            <ChevronDown size={12} />
          </button>
          {effortOpen && (
            <div style={S.effortMenu}>
              {EFFORT_LEVELS.map(e => (
                <div key={e.id} onClick={() => { onEffort(e.id); setEffortOpen(false); }}
                  style={{ ...S.effortItem, background: e.id === effortId ? "#f0fdfa" : "transparent" }}>
                  <span style={{ fontWeight: e.id === effortId ? 600 : 400 }}>{e.label}</span>
                  {e.isDefault && <span style={{ color: "#a8a29e", fontSize: 11 }}>Default</span>}
                  {e.id === effortId && <Check size={13} color="#0d9488" />}
                </div>
              ))}
            </div>
          )}
        </div>
        {(() => {
          const canThink = modelSupportsThinking(modelId);
          return (
            <button onClick={() => { if (canThink) onThinking(!thinkingOn); }}
              title={canThink ? "Cho phép model suy nghĩ kỹ hơn" : "Haiku không hỗ trợ thinking"}
              disabled={!canThink}
              style={{ ...S.thinkBtn, background: canThink && thinkingOn ? "#f5f3ff" : "#fff",
                borderColor: canThink && thinkingOn ? "#7c3aed" : "#e7e5e4",
                color: canThink && thinkingOn ? "#7c3aed" : "#78716c",
                opacity: canThink ? 1 : 0.45, cursor: canThink ? "pointer" : "not-allowed" }}>
              <Brain size={13} /> Thinking
              <span style={{ ...S.toggleTrack, background: canThink && thinkingOn ? "#7c3aed" : "#d6d3d1" }}>
                <span style={{ ...S.toggleKnob, transform: canThink && thinkingOn ? "translateX(13px)" : "translateX(0)" }} />
              </span>
            </button>
          );
        })()}
      </div>
    </div>
  );
}

/* ─── STYLES ───────────────────────────────────────────────────────── */
const S = {
  root: { fontFamily: FONT, maxWidth: 760, margin: "0 auto", background: "#fafaf9", border: "1px solid #e7e5e4", borderRadius: 14, overflow: "hidden", color: "#292524" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "#fff", borderBottom: "1px solid #f0eeec" },
  logoBox: { width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#7c3aed,#0d9488)", display: "flex", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" },
  subtitle: { fontSize: 11, color: "#a8a29e" },
  body: { padding: 16 },
  section: { background: "#fff", border: "1px solid #f0eeec", borderRadius: 11, padding: 14, marginBottom: 14 },
  sectionHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTag: { fontSize: 10, fontWeight: 600, color: "#78716c", background: "#f5f5f4", border: "1px solid #e7e5e4", borderRadius: 6, padding: "2px 7px", textTransform: "uppercase", letterSpacing: "0.04em" },
  dropZone: { border: "2px dashed #e7e5e4", borderRadius: 10, padding: "26px 16px", textAlign: "center", color: "#78716c", fontSize: 13, cursor: "pointer", background: "#fafaf9" },
  ctxCard: { border: "1px solid #ccfbf1", background: "#f0fdfa", borderRadius: 9, padding: 12 },
  aiFillBox: { background: "#faf9ff", border: "1px solid #ede9fe", borderRadius: 9, padding: 12, marginBottom: 14 },
  fieldLabel: { display: "block", fontSize: 12, fontWeight: 600, color: "#57534e", marginBottom: 5 },
  input: { width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid #e7e5e4", borderRadius: 8, fontSize: 13, outline: "none", color: "#292524" },
  textarea: { width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid #e7e5e4", borderRadius: 8, fontSize: 13, outline: "none", resize: "vertical", color: "#292524" },
  chipWrap: { display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 },
  chip: { display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11.5, padding: "3px 9px", borderRadius: 7, border: "1px solid #e7e5e4", background: "#fafaf9", color: "#78716c", cursor: "pointer" },
  chipOn: { background: "#f0fdfa", borderColor: "#5eead4", color: "#0d9488", fontWeight: 600 },
  qtyRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f5f5f4" },
  syncToggleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 11px", background: "#faf9ff", border: "1px solid #ede9fe", borderRadius: 9, marginBottom: 12 },
  rulesCard: { display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 9, marginBottom: 12 },
  syncBox: { background: "#fafaf9", border: "1px solid #f0eeec", borderRadius: 9, padding: 12, marginBottom: 4 },
  checkRow: { display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8, border: "1px solid transparent", cursor: "pointer", userSelect: "none" },
  checkRowOn: { background: "#fff", border: "1px solid #e7e5e4" },
  checkBox: { width: 18, height: 18, borderRadius: 5, border: "1.5px solid #d6d3d1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "#fff" },
  setTag: { fontSize: 9, fontWeight: 700, borderRadius: 4, padding: "1px 5px", letterSpacing: "0.04em" },
  typeTag: { fontSize: 9.5, fontWeight: 600, border: "1px solid", borderRadius: 5, padding: "1px 6px", fontFamily: MONO },
  typeTagSm: { fontSize: 10, fontWeight: 600 },
  stepBtn: { width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e7e5e4", borderRadius: 7, background: "#fff", cursor: "pointer", color: "#57534e" },
  qtyInput: { width: 42, textAlign: "center", padding: "5px 0", border: "1px solid #e7e5e4", borderRadius: 7, fontSize: 13, outline: "none" },
  genBar: { display: "flex", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" },
  btnPrimary: { display: "inline-flex", alignItems: "center", gap: 6, background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  btnPrimaryOutline: { display: "inline-flex", alignItems: "center", gap: 5, background: "#fff", color: "#7c3aed", border: "1px solid #c4b5fd", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  btnGhost: { display: "inline-flex", alignItems: "center", gap: 5, background: "#fff", color: "#57534e", border: "1px solid #e7e5e4", borderRadius: 8, padding: "7px 11px", fontSize: 12, fontWeight: 500, cursor: "pointer" },
  btnGhostSm: { display: "inline-flex", alignItems: "center", gap: 4, background: "#fff", color: "#78716c", border: "1px solid #e7e5e4", borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" },
  apiTag: { fontSize: 9, fontWeight: 700, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 5, padding: "2px 7px", marginLeft: "auto" },
  refChip: { display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 11.5, color: "#78716c", background: "#fafaf9", border: "1px solid #e7e5e4", borderRadius: 7, padding: "6px 10px" },
  genStatus: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, fontSize: 12, color: "#78716c" },
  usage: { fontSize: 11, color: "#a8a29e", fontFamily: MONO },
  streamPre: { fontFamily: MONO, fontSize: 11, color: "#6d28d9", background: "#faf9ff", border: "1px solid #ede9fe", borderRadius: 7, padding: 9, maxHeight: 140, overflow: "auto", whiteSpace: "pre-wrap", marginTop: 8 },
  empty: { textAlign: "center", color: "#a8a29e", fontSize: 13, padding: "20px 10px" },
  promptCard: { border: "1px solid #f0eeec", borderRadius: 9, padding: "10px 12px", background: "#fafaf9" },
  promptBody: { fontSize: 12, color: "#57534e", lineHeight: 1.5, whiteSpace: "pre-wrap", maxHeight: 120, overflow: "auto" },
  errBox: { display: "flex", alignItems: "center", gap: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, padding: "9px 12px", fontSize: 12, marginBottom: 14 },
  modelBar: { display: "flex", flexDirection: "column", gap: 8, padding: "10px 18px", background: "#fff", borderBottom: "1px solid #f0eeec" },
  modelRow: { display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" },
  modelChip: { display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, border: "1px solid #e7e5e4", background: "#fafaf9", cursor: "pointer", userSelect: "none" },
  modelBadge: { fontSize: 9, color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.04em" },
  updateBtn: { display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, border: "1px dashed #c4b5fd", background: "#faf9ff", color: "#7c3aed", fontSize: 12, fontWeight: 600, cursor: "pointer", marginLeft: 4 },
  updateNote: { fontSize: 11.5, color: "#6d28d9", background: "#faf9ff", border: "1px solid #ede9fe", borderRadius: 7, padding: "6px 10px" },
  thinkBtn: { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  toggleTrack: { width: 26, height: 14, borderRadius: 99, position: "relative", display: "inline-block", transition: "background 0.2s", flexShrink: 0 },
  toggleKnob: { position: "absolute", top: 2, left: 2, width: 10, height: 10, borderRadius: 99, background: "#fff", transition: "transform 0.2s" },
  effortBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e7e5e4", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: "#57534e" },
  effortMenu: { position: "absolute", top: "calc(100% + 4px)", left: 0, background: "#fff", border: "1px solid #e7e5e4", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", overflow: "hidden", zIndex: 20, minWidth: 140 },
  effortItem: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 12px", fontSize: 12.5, cursor: "pointer", color: "#44403c" },
  toast: { position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "#292524", color: "#fff", fontSize: 12.5, padding: "9px 16px", borderRadius: 9, transition: "all 0.25s", zIndex: 50, pointerEvents: "none" },
};
