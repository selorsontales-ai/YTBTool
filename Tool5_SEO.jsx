import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search, Youtube, Cpu, Brain, Sparkles, Download, Upload, FileJson, Loader2, X, Check,
  AlertTriangle, TrendingUp, Tag, Type, FileText, Key, Eye, EyeOff, RefreshCw, Trash2,
  ChevronDown, ChevronRight, BarChart3, Target, Zap, Copy, ExternalLink, Award,
  Flame, Clock, Users, Play, Save, ListChecks, Lightbulb, Gauge, MessageSquare,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════════
   TOOL 5 — YOUTUBE SEO RESEARCHER  (data thật, không phải "AI tự nghĩ SEO")
   3 module:
     1. Khám phá từ khóa  — YouTube Data API search → tiêu đề + tags thật của video rank
     2. Phân tích cạnh tranh — views/subs ratio → Opportunity Score (cửa còn mở?)
     3. Gợi ý AI — Claude tổng hợp: title patterns, tags, description template
   Output JSON → nạp vào Tool 2 để sinh prompt SEO bám data thật.
   API: YouTube Data API v3 (free key client-side) + Claude API (output_config.effort).
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
  { id: "low", label: "Low" }, { id: "medium", label: "Medium" },
  { id: "high", label: "High" }, { id: "max", label: "Max" },
];
const PRICING = {
  "claude-haiku-4-5-20251001": { input: 1.00, output: 5.00 },
  "claude-sonnet-4-6":         { input: 3.00, output: 15.00 },
  "claude-opus-4-6":           { input: 15.00, output: 75.00 },
  "claude-opus-4-7":           { input: 5.00, output: 25.00 },
  "claude-opus-4-8":           { input: 15.00, output: 75.00 },
};

const MARKETS = [
  { v: "VN", label: "Việt Nam", region: "VN", lang: "vi" },
  { v: "US", label: "Global (US/EN)", region: "US", lang: "en" },
];

const STORAGE_KEY = "tool5_seo_researcher_v1";
const APIKEY_STORAGE = "tool5_youtube_apikey";
const CHECKPOINT_VERSION = "tool5-seo-v2";
const COMPAT_VERSIONS = new Set(["tool5-seo-v1", "tool5-seo-v2"]); // nạp được cả checkpoint cũ
const YT_QUOTA_LIMIT = 10000; // units/ngày mặc định
const YT_COST = { search: 100, videos: 1, channels: 1, comments: 1 }; // units mỗi call

/* ════════════════════════════════════════════════════════════════════
   YOUTUBE DATA API v3 — helpers (client-side, key của user)
   ════════════════════════════════════════════════════════════════════ */
const YT_BASE = "https://www.googleapis.com/youtube/v3";

async function ytSearch(apiKey, query, { region = "VN", lang = "vi", maxResults = 20 } = {}) {
  const url = `${YT_BASE}/search?part=snippet&type=video&q=${encodeURIComponent(query)}`
    + `&maxResults=${maxResults}&regionCode=${region}&relevanceLanguage=${lang}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(parseYTError(res.status, t));
  }
  const data = await res.json();
  return (data.items || []).filter(i => i.id?.videoId).map(i => ({
    videoId: i.id.videoId,
    title: decodeHTML(i.snippet?.title || ""),
    channelId: i.snippet?.channelId,
    channelTitle: i.snippet?.channelTitle || "",
    publishedAt: i.snippet?.publishedAt,
    description: i.snippet?.description || "",
  }));
}

async function ytVideos(apiKey, videoIds) {
  if (!videoIds.length) return {};
  const url = `${YT_BASE}/videos?part=statistics,snippet,contentDetails&id=${videoIds.join(",")}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(parseYTError(res.status, await res.text()));
  const data = await res.json();
  const map = {};
  (data.items || []).forEach(v => {
    map[v.id] = {
      views: +(v.statistics?.viewCount || 0),
      likes: +(v.statistics?.likeCount || 0),
      comments: +(v.statistics?.commentCount || 0),
      tags: v.snippet?.tags || [],
      title: decodeHTML(v.snippet?.title || ""),
      duration: v.contentDetails?.duration || "",
    };
  });
  return map;
}

async function ytChannels(apiKey, channelIds) {
  const uniq = [...new Set(channelIds)].filter(Boolean);
  if (!uniq.length) return {};
  const map = {};
  // API cho tối đa 50 id mỗi lần
  for (let i = 0; i < uniq.length; i += 50) {
    const batch = uniq.slice(i, i + 50);
    const url = `${YT_BASE}/channels?part=statistics&id=${batch.join(",")}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(parseYTError(res.status, await res.text()));
    const data = await res.json();
    (data.items || []).forEach(c => {
      map[c.id] = {
        subs: +(c.statistics?.subscriberCount || 0),
        videoCount: +(c.statistics?.videoCount || 0),
        hidden: !!c.statistics?.hiddenSubscriberCount,
      };
    });
  }
  return map;
}

/* commentThreads.list = 1 unit/call (rẻ). Trả mảng text top comment.
   Ném lỗi "COMMENTS_DISABLED" nếu video tắt bình luận để caller bỏ qua gọn. */
async function ytComments(apiKey, videoId, maxResults = 100) {
  const url = `${YT_BASE}/commentThreads?part=snippet&videoId=${videoId}`
    + `&maxResults=${maxResults}&order=relevance&textFormat=plainText&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 403 && /commentsDisabled|disabled comments/i.test(t)) {
      const e = new Error("COMMENTS_DISABLED"); e.code = "COMMENTS_DISABLED"; throw e;
    }
    throw new Error(parseYTError(res.status, t));
  }
  const data = await res.json();
  return (data.items || [])
    .map(it => decodeHTML(it.snippet?.topLevelComment?.snippet?.textDisplay || ""))
    .map(s => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/* ISO8601 duration (PT#H#M#S) → giây. "" / lỗi → 0. */
function parseISO8601(iso) {
  const m = String(iso || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

function fmtDuration(sec) {
  sec = Math.round(sec || 0);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/* Điểm ngọt độ dài: median + khoảng phổ biến (P25-P75) từ video có duration > 0. */
function computeDurationSweetSpot(videos) {
  const secs = (videos || []).map(v => parseISO8601(v.duration)).filter(s => s > 0).sort((a, b) => a - b);
  if (secs.length < 3) return null;
  const q = (p) => secs[Math.min(secs.length - 1, Math.floor(p * (secs.length - 1)))];
  return { minSec: q(0.25), maxSec: q(0.75), medianSec: q(0.5), count: secs.length };
}

function parseYTError(status, text) {
  try {
    const j = JSON.parse(text);
    const reason = j?.error?.errors?.[0]?.reason || "";
    const msg = j?.error?.message || "";
    if (status === 403 && /quota/i.test(reason + msg)) return "Hết quota YouTube API hôm nay (10k units/ngày). Thử lại ngày mai hoặc tạo project khác.";
    if (status === 400 && /key/i.test(msg)) return "API key không hợp lệ. Kiểm tra lại key.";
    if (status === 403 && /disabled|not been used|blocked/i.test(msg)) return "YouTube Data API v3 chưa được Enable cho project này, hoặc key bị hạn chế sai. Vào Cloud Console bật API + cho phép YouTube Data API v3.";
    return `YouTube API ${status}: ${msg.slice(0, 160)}`;
  } catch {
    return `YouTube API ${status}: ${String(text).slice(0, 160)}`;
  }
}

function decodeHTML(s) {
  return (s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");
}

/* ════════════════════════════════════════════════════════════════════
   SCORING — Opportunity Score (cửa còn mở cho kênh nhỏ?)
   Ý tưởng: video view CAO nhưng kênh nhỏ → từ khóa dễ chen vào.
   Nhiều kênh lớn (subs cao) thống trị → khó.
   ════════════════════════════════════════════════════════════════════ */
function monthsSince(iso) {
  if (!iso) return 999;
  const d = new Date(iso).getTime();
  return (Date.now() - d) / (1000 * 60 * 60 * 24 * 30);
}

function analyzeCompetition(videos) {
  // videos: [{views, subs, publishedAt, ...}]
  const valid = videos.filter(v => v.views >= 0);
  if (!valid.length) return { score: 0, level: "unknown", metrics: {} };

  const views = valid.map(v => v.views).sort((a, b) => a - b);
  const subsArr = valid.map(v => v.subs || 0);
  const medianViews = views[Math.floor(views.length / 2)] || 0;

  // tỷ lệ video từ kênh nhỏ (<50k subs) — nhiều = cửa mở
  const smallChannels = valid.filter(v => (v.subs || 0) < 50000).length;
  const smallRatio = smallChannels / valid.length;

  // view/sub ratio trung vị: >1 nghĩa video vượt size kênh (từ khóa có lực kéo riêng)
  const ratios = valid.map(v => v.views / Math.max(v.subs || 1, 1)).sort((a, b) => a - b);
  const medianRatio = ratios[Math.floor(ratios.length / 2)] || 0;

  // độ mới: tỷ lệ video < 12 tháng — cao = chủ đề đang sống
  const fresh = valid.filter(v => monthsSince(v.publishedAt) < 12).length / valid.length;

  // video "khổng lồ" (kênh > 500k) thống trị — nhiều = khó
  const giants = valid.filter(v => (v.subs || 0) > 500000).length / valid.length;

  // Opportunity 0-100
  let score = 0;
  score += smallRatio * 45;            // kênh nhỏ rank được = cơ hội lớn nhất
  score += Math.min(medianRatio, 5) / 5 * 25; // view vượt sub
  score += fresh * 20;                 // chủ đề còn sống
  score += (1 - giants) * 10;          // ít ông lớn
  score = Math.round(Math.max(0, Math.min(100, score)));

  const level = score >= 65 ? "easy" : score >= 40 ? "medium" : "hard";
  return {
    score, level,
    metrics: {
      medianViews, smallRatio: Math.round(smallRatio * 100),
      medianRatio: +medianRatio.toFixed(1), fresh: Math.round(fresh * 100),
      giants: Math.round(giants * 100), sampleSize: valid.length,
    },
  };
}

/* Trích cụm từ khóa phổ biến từ danh sách tiêu đề + tags (n-gram đơn giản) */
const VI_STOP = new Set(["và","là","của","cho","các","một","những","để","trong","với","khi","này","đã","được","có","không","ở","đi","làm","mà","thì","cũng","ra","vào","lên","bằng","như","sao","gì","nào","bạn","tôi","mình","cách","bí","quyết"]);
const EN_STOP = new Set(["the","a","an","to","of","for","and","or","in","on","with","how","what","why","you","your","is","are","this","that","best","top"]);

function extractKeywords(titles, tags, lang) {
  const stop = lang === "vi" ? VI_STOP : EN_STOP;
  const freq = {};
  const add = (phrase) => {
    const p = phrase.toLowerCase().trim();
    if (p.length < 3) return;
    freq[p] = (freq[p] || 0) + 1;
  };
  // tags là từ khóa thật người làm video dùng → trọng số cao
  tags.forEach(t => { add(t); freq[t.toLowerCase().trim()] = (freq[t.toLowerCase().trim()] || 0) + 2; });
  // n-gram 2-3 từ từ tiêu đề
  titles.forEach(title => {
    const words = title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(w => w && !stop.has(w));
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i + n <= words.length; i++) {
        add(words.slice(i, i + n).join(" "));
      }
    }
  });
  return Object.entries(freq)
    .filter(([k, v]) => v >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([k, v]) => ({ kw: k, count: v }));
}

function costOf(modelId, usage) {
  if (!usage) return 0;
  const p = PRICING[modelId]; if (!p) return 0;
  const inp = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) * 0.1;
  return (inp * p.input + (usage.output_tokens || 0) * p.output) / 1_000_000;
}

function modelSupportsThinking(id) {
  if (!id) return false;
  const l = id.toLowerCase();
  if (l.includes("haiku")) return false;
  const m = l.match(/-(\d+)-(\d+)/);
  if (m) { const M = +m[1], n = +m[2]; return M > 4 || (M === 4 && n >= 6); }
  return true;
}

async function callClaude(system, user, onChunk, cfg = {}) {
  const { model = "claude-sonnet-4-6", thinkingOn = false, effortId = "high", maxTokens = 4000 } = cfg;
  const body = {
    model, max_tokens: maxTokens, stream: true, system,
    messages: [{ role: "user", content: user }],
    output_config: { effort: effortId },
  };
  if (thinkingOn && modelSupportsThinking(model)) body.thinking = { type: "adaptive" };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "anthropic-beta": "effort-2025-11-24" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = "", usage = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of dec.decode(value).split("\n")) {
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (d === "[DONE]") continue;
      try {
        const j = JSON.parse(d);
        if (j?.type === "message_start" && j?.message?.usage) usage = { ...j.message.usage };
        if (j?.type === "message_delta" && j?.usage) usage = { ...usage, ...j.usage };
        if (j?.delta?.type === "text_delta") { full += j.delta.text || ""; onChunk && onChunk(full); }
      } catch {}
    }
  }
  return { text: full, usage };
}

/* Như callClaude nhưng đính kèm ẢNH (thumbnail) vào message để Claude vision
   phân tích. imageUrls: mảng URL ảnh công khai. Không stream (gọn). */
async function callClaudeVision(system, textPrompt, imageUrls, cfg = {}) {
  const { model = "claude-sonnet-4-6", thinkingOn = false, effortId = "medium", maxTokens = 2000 } = cfg;
  const content = [
    ...imageUrls.map(u => ({ type: "image", source: { type: "url", url: u } })),
    { type: "text", text: textPrompt },
  ];
  const body = {
    model, max_tokens: maxTokens, system,
    messages: [{ role: "user", content }],
    output_config: { effort: effortId },
  };
  if (thinkingOn && modelSupportsThinking(model)) body.thinking = { type: "adaptive" };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "anthropic-beta": "effort-2025-11-24" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  return { text, usage: data.usage };
}

function parseJSON(raw) {
  if (!raw) return null;
  let s = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < 0) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

function safeDownload(name, content, mime) {
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (e) { console.error(e); }
}

function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n || 0);
}

/* Keyword dạng CÂU HỎI = search intent rõ → dễ viết title hook, CTR cao hơn.
   Regex VI đã validate; EN bắt từ để hỏi đầu câu. */
const QUESTION_RE_VI = /^(ai|gì|cái gì|điều gì|đâu|ở đâu|chỗ nào|nơi nào|khi nào|lúc nào|bao giờ|bao nhiêu|bao lâu|bao xa|mấy|mấy giờ|tại sao|vì sao|do đâu|thế nào|như thế nào|ra sao|làm sao|làm thế nào|cách nào|bằng cách nào|là gì|nghĩa là gì|có phải|liệu|nên|có nên|có thể)(?=\s|$|[?!.,:;])/i;
const QUESTION_RE_EN = /^(who|what|how|why|when|where|which|whom|whose|can|should|does|do|is|are)\b/i;
function isQuestionKw(kw, lang) {
  const s = String(kw || "").trim();
  if (!s) return false;
  return (lang === "vi" ? QUESTION_RE_VI : QUESTION_RE_EN).test(s);
}

/* ════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function SEOResearcher() {
  // API key
  const [apiKey, setApiKey]       = useState("");
  const [showKey, setShowKey]     = useState(false);
  const [keyValid, setKeyValid]   = useState(null); // null | true | false

  // Input
  const [seed, setSeed]           = useState("");
  const [market, setMarket]       = useState("VN");

  // Channel Profile — context kênh để AI gợi ý bám sát (điền 1 lần/phiên, lưu vào checkpoint)
  const [profile, setProfile]     = useState({ audience: "", tone: "", niche: "" });
  const [profileOpen, setProfileOpen] = useState(false);

  // Model
  const [modelId, setModelId]     = useState("claude-sonnet-4-6");
  const [effortId, setEffortId]   = useState("medium");
  const [thinkingOn, setThinkingOn] = useState(false);

  // Research results
  const [busy, setBusy]           = useState(false);
  const [phase, setPhase]         = useState(""); // search | videos | channels | analyze
  const [videos, setVideos]       = useState([]); // [{videoId,title,channel,views,likes,subs,publishedAt,tags}]
  const [competition, setCompetition] = useState(null);
  const [keywordCands, setKeywordCands] = useState([]);
  const [allTags, setAllTags]     = useState([]);

  // AI suggestions
  const [aiBusy, setAiBusy]       = useState(false);
  const [aiStream, setAiStream]   = useState("");
  const [ai, setAi]               = useState(null); // {titlePatterns[], tags[], descriptionTemplate, extraKeywords[]}

  // Saved keywords (user tick để gom vào export)
  const [savedKw, setSavedKw]     = useState([]); // [{kw, opportunity, level}]

  // ── PROMPT 5: Tầng 1 (comments mining + duration + quota) ──
  const [quotaUsed, setQuotaUsed]         = useState(0);   // units tiêu trong phiên
  const [commentsBusy, setCommentsBusy]   = useState(false);
  const [audiencePain, setAudiencePain]   = useState([]);  // câu hỏi/nỗi đau từ comment
  const [contentGaps, setContentGaps]     = useState([]);  // chủ đề top chưa nhắc tới
  const [durationSweetSpot, setDurationSweetSpot] = useState(null);

  // ── PROMPT 6: backend (transcript + autocomplete) ──
  const [backendUrl, setBackendUrl]       = useState("http://localhost:8000");
  const [backendOk, setBackendOk]         = useState(null); // null=chưa kiểm tra, true/false
  const [backendBusy, setBackendBusy]     = useState(false);
  const [transcriptBusy, setTranscriptBusy]   = useState(false);
  const [transcriptInsights, setTranscriptInsights] = useState(null); // {commonStructure, gaps[]}
  const [autocompleteBusy, setAutocompleteBusy]     = useState(false);
  const [autocompleteLongTail, setAutocompleteLongTail] = useState([]);

  // ── PROMPT 7 (Tầng 3): Reddit + Trends (backend) + thumbnail vision (client) ──
  const [redditBusy, setRedditBusy]       = useState(false);
  const [redditSignals, setRedditSignals] = useState([]); // [{title, subreddit, score, url}]
  const [trendBusy, setTrendBusy]         = useState(false);
  const [trend, setTrend]                 = useState(null); // {direction, data[]}
  const [thumbBusy, setThumbBusy]         = useState(false);
  const [thumbnailConcept, setThumbnailConcept] = useState(null); // {commonPatterns, differentiationIdea}

  // UI
  const [err, setErr]             = useState("");
  const [toast, setToast]         = useState("");
  const [cost, setCost]           = useState(0);
  const [open, setOpen]           = useState({ kw: true, comp: true, ai: true });
  const cpRef = useRef(null);
  const saveT = useRef(null);

  const mk = useMemo(() => MARKETS.find(m => m.v === market) || MARKETS[0], [market]);

  const showToast = useCallback((m) => { setToast(m); setTimeout(() => setToast(""), 2200); }, []);

  // Khối Hồ sơ kênh để nhúng vào system prompt các bước AI. Rỗng nếu chưa điền.
  function profileCtx() {
    const L = [];
    if (profile.audience?.trim()) L.push(`- Đối tượng khán giả: ${profile.audience.trim()}`);
    if (profile.tone?.trim()) L.push(`- Giọng/phong cách kênh: ${profile.tone.trim()}`);
    if (profile.niche?.trim()) L.push(`- Niche/lĩnh vực: ${profile.niche.trim()}`);
    return L.length ? `\n\n# HỒ SƠ KÊNH (bám sát để gợi ý đúng chất kênh, KHÔNG generic)\n${L.join("\n")}` : "";
  }

  /* ── Load API key + last state ── */
  useEffect(() => {
    (async () => {
      try {
        const k = await window.storage?.get(APIKEY_STORAGE);
        if (k?.value) setApiKey(k.value);
      } catch {}
      try {
        const s = await window.storage?.get(STORAGE_KEY);
        if (s?.value) {
          const snap = JSON.parse(s.value);
          if (COMPAT_VERSIONS.has(snap.version)) applySnap(snap);
        }
      } catch {}
    })();
  // eslint-disable-next-line
  }, []);

  const buildSnap = useCallback(() => ({
    version: CHECKPOINT_VERSION, ts: Date.now(),
    seed, market, profile, modelId, effortId, thinkingOn,
    videos, competition, keywordCands, allTags, ai, savedKw, cost,
    quotaUsed, audiencePain, contentGaps, durationSweetSpot,
    backendUrl, transcriptInsights, autocompleteLongTail,
    redditSignals, trend, thumbnailConcept,
  }), [seed, market, profile, modelId, effortId, thinkingOn, videos, competition, keywordCands, allTags, ai, savedKw, cost, quotaUsed, audiencePain, contentGaps, durationSweetSpot, backendUrl, transcriptInsights, autocompleteLongTail, redditSignals, trend, thumbnailConcept]);

  function applySnap(s) {
    setSeed(s.seed || ""); setMarket(s.market || "VN");
    if (s.profile && typeof s.profile === "object") setProfile({ audience: "", tone: "", niche: "", ...s.profile });
    if (s.modelId) setModelId(s.modelId);
    if (s.effortId) setEffortId(s.effortId);
    if (typeof s.thinkingOn === "boolean") setThinkingOn(s.thinkingOn);
    setVideos(s.videos || []); setCompetition(s.competition || null);
    setKeywordCands(s.keywordCands || []); setAllTags(s.allTags || []);
    setAi(s.ai || null); setSavedKw(s.savedKw || []); setCost(s.cost || 0);
    // các trường v2 — file v1 không có → mặc định an toàn
    setQuotaUsed(s.quotaUsed || 0);
    setAudiencePain(s.audiencePain || []); setContentGaps(s.contentGaps || []);
    setDurationSweetSpot(s.durationSweetSpot || null);
    if (s.backendUrl) setBackendUrl(s.backendUrl);
    setTranscriptInsights(s.transcriptInsights || null);
    setAutocompleteLongTail(s.autocompleteLongTail || []);
    setRedditSignals(s.redditSignals || []); setTrend(s.trend || null);
    setThumbnailConcept(s.thumbnailConcept || null);
  }
  const bumpQuota = (n) => setQuotaUsed(x => x + n);

  // autosave state (trừ apiKey lưu riêng)
  useEffect(() => {
    if (saveT.current) clearTimeout(saveT.current);
    saveT.current = setTimeout(async () => {
      try { await window.storage?.set(STORAGE_KEY, JSON.stringify(buildSnap())); } catch {}
    }, 800);
    return () => saveT.current && clearTimeout(saveT.current);
  }, [buildSnap]);

  async function saveApiKey(k) {
    setApiKey(k);
    setKeyValid(null);
    try { await window.storage?.set(APIKEY_STORAGE, k); } catch {}
  }

  /* ════════════════════════════════════════════════════════════════════
     MODULE 1+2: RESEARCH — search → videos → channels → analyze
     ════════════════════════════════════════════════════════════════════ */
  async function runResearch() {
    const kw = seed.trim();
    if (!kw) { setErr("Nhập chủ đề/từ khóa trước"); return; }
    if (!apiKey.trim()) { setErr("Chưa có YouTube API key — nhập ở mục trên cùng"); return; }
    // cảnh báo nếu sắp vượt quota ngày (search = 100 + videos 1 + channels ~1)
    if (quotaUsed + YT_COST.search > YT_QUOTA_LIMIT) {
      if (!window.confirm(`Đã tiêu ${quotaUsed}/${YT_QUOTA_LIMIT} units hôm nay. Lượt này tốn ~${YT_COST.search}+ nữa, có thể hết quota. Vẫn chạy?`)) return;
    }
    setBusy(true); setErr(""); setAi(null); setAiStream("");
    setAudiencePain([]); setContentGaps([]); setDurationSweetSpot(null); // insight cũ thuộc từ khóa khác
    try {
      setPhase("search");
      const found = await ytSearch(apiKey, kw, { region: mk.region, lang: mk.lang, maxResults: 20 });
      bumpQuota(YT_COST.search);
      setKeyValid(true);
      if (!found.length) { setErr("Không tìm thấy video nào cho từ khóa này"); setBusy(false); setPhase(""); return; }

      setPhase("videos");
      const stats = await ytVideos(apiKey, found.map(v => v.videoId));
      bumpQuota(YT_COST.videos);

      setPhase("channels");
      const chanIds = [...new Set(found.map(v => v.channelId).filter(Boolean))];
      const chans = await ytChannels(apiKey, chanIds);
      bumpQuota(Math.max(1, Math.ceil(chanIds.length / 50)) * YT_COST.channels);

      setPhase("analyze");
      const merged = found.map(v => {
        const s = stats[v.videoId] || {};
        const c = chans[v.channelId] || {};
        return {
          videoId: v.videoId, title: v.title, channelTitle: v.channelTitle,
          publishedAt: v.publishedAt, views: s.views || 0, likes: s.likes || 0,
          comments: s.comments || 0, tags: s.tags || [], subs: c.subs || 0,
          hiddenSubs: c.hidden, duration: s.duration || "",
        };
      }).sort((a, b) => b.views - a.views);

      const comp = analyzeCompetition(merged);
      const tagsFlat = [];
      merged.forEach(v => v.tags.forEach(t => tagsFlat.push(t)));
      const cands = extractKeywords(merged.map(v => v.title), tagsFlat, mk.lang);
      // tags phổ biến nhất
      const tagFreq = {};
      tagsFlat.forEach(t => { const k = t.toLowerCase().trim(); tagFreq[k] = (tagFreq[k] || 0) + 1; });
      const topTags = Object.entries(tagFreq).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([t]) => t);

      setVideos(merged);
      setCompetition({ ...comp, keyword: kw });
      setKeywordCands(cands);
      setAllTags(topTags);
      setDurationSweetSpot(computeDurationSweetSpot(merged));
      setPhase("");
      showToast(`Phân tích xong ${merged.length} video · Opportunity ${comp.score}/100`);
    } catch (e) {
      setErr(String(e.message || e));
      if (/key|quota|API/i.test(String(e.message))) setKeyValid(false);
      setPhase("");
    } finally {
      setBusy(false);
    }
  }

  /* ════════════════════════════════════════════════════════════════════
     MODULE 3: AI SUGGESTIONS — Claude tổng hợp title/tags/description
     ════════════════════════════════════════════════════════════════════ */
  async function runAISuggest() {
    if (!competition) { setErr("Chạy nghiên cứu trước đã"); return; }
    setAiBusy(true); setAiStream(""); setErr("");
    try {
      const topVids = videos.slice(0, 12).map(v =>
        `- "${v.title}" · ${fmtNum(v.views)} views · kênh ${fmtNum(v.subs)} subs`).join("\n");
      const sys = `Bạn là chuyên gia YouTube SEO cho thị trường ${mk.label}. Dựa trên DATA THẬT dưới đây (video đang rank cho từ khóa), đề xuất chiến lược SEO.

QUY TẮC TIÊU ĐỀ (tiếng ${mk.lang === "vi" ? "Việt" : "Anh"}):
- Tối đa 70 ký tự, từ khóa chính trong 40 ký tự đầu.
- ${mk.lang === "vi" ? "Viết hoa chuẩn tiếng Việt (KHÔNG Title Case), KHÔNG em-dash (dùng ' - '), KHÔNG dấu hai chấm." : "Sentence case, no clickbait spam."}
- Nêu kết quả cụ thể + đối tượng, tránh sáo rỗng ("bí mật", "khám phá").

TRẢ JSON THUẦN, KHÔNG BACKTICKS:
{
  "opportunitySummary": "1-2 câu nhận định độ cạnh tranh & cơ hội cho kênh nhỏ",
  "titlePatterns": ["5-7 mẫu tiêu đề tối ưu CTR, bám từ khóa thật"],
  "tags": ["12-15 tag, trộn broad + long-tail, từ data thật + mở rộng hợp lý"],
  "extraKeywords": ["8-10 từ khóa long-tail tiềm năng chưa ai khai thác mạnh"],
  "descriptionTemplate": "mẫu mô tả 150-200 từ: 2 câu đầu chứa từ khóa chính, có chỗ chèn timestamp, CTA, hashtag cuối",
  "searchIntent": "một trong: informational | transactional | comparison | problem-solving (vì sao người ta tìm từ khóa này)",
  "emotionalTrigger": "một trong: fear | curiosity | aspiration | social_proof | FOMO (cảm xúc thúc đẩy click)"
}` + profileCtx();
      const user = `TỪ KHÓA GỐC: "${competition.keyword}"
THỊ TRƯỜNG: ${mk.label}
OPPORTUNITY SCORE: ${competition.score}/100 (${competition.level}) — ${competition.metrics.smallRatio}% video từ kênh nhỏ, ${competition.metrics.fresh}% video mới <12 tháng, ${competition.metrics.giants}% từ kênh lớn >500k.

TOP VIDEO ĐANG RANK:
${topVids}

TỪ KHÓA PHỔ BIẾN (từ tiêu đề + tags thật):
${keywordCands.slice(0, 15).map(k => k.kw).join(", ")}

TAGS THẬT video top đang dùng:
${allTags.slice(0, 15).join(", ")}`;

      const { text, usage } = await callClaude(sys, user, (c) => setAiStream(c),
        { model: modelId, thinkingOn, effortId, maxTokens: 3000 });
      const parsed = parseJSON(text);
      if (!parsed) throw new Error("Không parse được kết quả AI");
      setAi({
        opportunitySummary: String(parsed.opportunitySummary || ""),
        titlePatterns: Array.isArray(parsed.titlePatterns) ? parsed.titlePatterns : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        extraKeywords: Array.isArray(parsed.extraKeywords) ? parsed.extraKeywords : [],
        descriptionTemplate: String(parsed.descriptionTemplate || ""),
        searchIntent: String(parsed.searchIntent || ""),
        emotionalTrigger: String(parsed.emotionalTrigger || ""),
      });
      setAiStream("");
      const c = costOf(modelId, usage); setCost(x => x + c);
      showToast(`AI gợi ý xong (+$${c.toFixed(4)})`);
    } catch (e) {
      setErr("AI lỗi: " + String(e.message || e));
      setAiStream("");
    } finally {
      setAiBusy(false);
    }
  }

  /* ════════════════════════════════════════════════════════════════════
     PROMPT 5 — COMMENTS MINING: đào top comment top video → Claude phân tích
     nỗi đau khán giả + content gap. commentThreads.list = 1 unit/call (rẻ).
     ════════════════════════════════════════════════════════════════════ */
  async function runCommentsMining() {
    if (commentsBusy || busy) return;
    if (!competition || !videos.length) { setErr("Chạy nghiên cứu trước đã"); return; }
    if (!apiKey.trim()) { setErr("Chưa có YouTube API key"); return; }

    const targets = videos.slice(0, 8);
    const estUnits = targets.length * YT_COST.comments;
    if (!window.confirm(`Sẽ gọi commentThreads.list cho ${targets.length} video top (~${estUnits} unit quota). ` +
      `Đã tiêu ${quotaUsed}/${YT_QUOTA_LIMIT} hôm nay. Tiếp tục?`)) return;
    if (quotaUsed + estUnits > YT_QUOTA_LIMIT) {
      if (!window.confirm("Có thể vượt quota ngày. Vẫn chạy?")) return;
    }

    setCommentsBusy(true); setErr("");
    try {
      const collected = []; // [{title, comments:[...]}]
      let disabled = 0;
      for (const v of targets) {
        try {
          const cmts = await ytComments(apiKey, v.videoId, 100);
          bumpQuota(YT_COST.comments);
          if (cmts.length) collected.push({ title: v.title, comments: cmts.slice(0, 60) });
        } catch (e) {
          if (e.code === "COMMENTS_DISABLED") { bumpQuota(YT_COST.comments); disabled++; continue; }
          throw e; // lỗi khác (quota/key) → dừng
        }
      }
      if (!collected.length) { setErr(`Không lấy được comment nào (${disabled} video tắt bình luận).`); setCommentsBusy(false); return; }

      const corpus = collected.map(c =>
        `### Video: ${c.title}\n${c.comments.map(x => "- " + x).join("\n")}`).join("\n\n").slice(0, 18000);

      const sys = `Bạn là nhà phân tích khán giả YouTube cho thị trường ${mk.label}. Dưới đây là comment thật từ các video top đang rank cho từ khóa. Hãy đào insight.
TRẢ JSON THUẦN, KHÔNG BACKTICKS:
{
  "audiencePain": ["6-10 câu hỏi CHƯA được giải đáp / lời phàn nàn lặp lại / mong muốn khán giả, viết bằng tiếng ${mk.lang === "vi" ? "Việt" : "Anh"}, cụ thể"],
  "contentGaps": ["4-8 chủ đề/góc nhìn mà khán giả MUỐN nhưng video top CHƯA làm tốt - đây là cơ hội nội dung"]
}` + profileCtx();
      const user = `TỪ KHÓA: "${competition.keyword}"\n\nCOMMENT THẬT (${collected.length} video):\n${corpus}`;

      const { text, usage } = await callClaude(sys, user, null,
        { model: modelId, thinkingOn, effortId, maxTokens: 2500 });
      const parsed = parseJSON(text);
      if (!parsed) throw new Error("Không parse được kết quả AI");
      setAudiencePain(Array.isArray(parsed.audiencePain) ? parsed.audiencePain : []);
      setContentGaps(Array.isArray(parsed.contentGaps) ? parsed.contentGaps : []);
      const c = costOf(modelId, usage); setCost(x => x + c);
      showToast(`Đào comment xong: ${collected.length} video${disabled ? `, ${disabled} tắt bình luận` : ""} (+$${c.toFixed(4)})`);
    } catch (e) {
      setErr("Đào comment lỗi: " + String(e.message || e));
    } finally {
      setCommentsBusy(false);
    }
  }

  /* ════════════════════════════════════════════════════════════════════
     PROMPT 6 — BACKEND: transcript + autocomplete (cần server/ chạy).
     Hỏng/không bật → tính năng ẩn gọn, phần còn lại của tool vẫn chạy.
     ════════════════════════════════════════════════════════════════════ */
  const apiBase = () => backendUrl.replace(/\/+$/, "");

  async function checkBackend() {
    setBackendBusy(true); setErr("");
    try {
      const r = await fetch(`${apiBase()}/health`, { method: "GET" });
      const ok = r.ok && (await r.json())?.ok === true;
      setBackendOk(!!ok);
      showToast(ok ? "Backend đang chạy" : "Backend phản hồi nhưng không hợp lệ");
    } catch {
      setBackendOk(false);
      setErr(`Không kết nối được backend tại ${apiBase()}. Chạy server/ chưa? (xem server/README.md)`);
    } finally {
      setBackendBusy(false);
    }
  }

  async function runTranscriptInsights() {
    if (transcriptBusy) return;
    if (!competition || !videos.length) { setErr("Chạy nghiên cứu trước đã"); return; }
    setTranscriptBusy(true); setErr("");
    try {
      const targets = videos.slice(0, 3);
      const scripts = [];
      let failed = 0;
      for (const v of targets) {
        try {
          const r = await fetch(`${apiBase()}/transcript?videoId=${encodeURIComponent(v.videoId)}&lang=${mk.lang},en`);
          if (!r.ok) { failed++; continue; }
          const d = await r.json();
          if (d.text) scripts.push({ title: v.title, text: d.text.slice(0, 6000) });
        } catch { failed++; }
      }
      if (!scripts.length) { setErr(`Không lấy được transcript nào (${failed} video không có phụ đề hoặc backend lỗi).`); setTranscriptBusy(false); return; }

      const corpus = scripts.map((s, i) => `### Video ${i + 1}: ${s.title}\n${s.text}`).join("\n\n").slice(0, 20000);
      const sys = `Bạn là chuyên gia reverse-engineering nội dung YouTube. Dưới đây là transcript thật của ${scripts.length} video top đang rank. Phân tích cấu trúc kịch bản chung + content gap.
TRẢ JSON THUẦN, KHÔNG BACKTICKS:
{
  "commonStructure": "mô tả 3-5 câu: cấu trúc mở bài → thân → kết mà các video top dùng chung (hook kiểu gì, sắp xếp ý ra sao, cách giữ chân)",
  "gaps": ["4-7 điểm các video top BỎ SÓT hoặc làm hời hợt - cơ hội để bạn làm tốt hơn"]
}` + profileCtx();
      const user = `TỪ KHÓA: "${competition.keyword}"\n\nTRANSCRIPT:\n${corpus}`;
      const { text, usage } = await callClaude(sys, user, null, { model: modelId, thinkingOn, effortId, maxTokens: 2500 });
      const parsed = parseJSON(text);
      if (!parsed) throw new Error("Không parse được kết quả AI");
      setTranscriptInsights({
        commonStructure: String(parsed.commonStructure || ""),
        gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      });
      const c = costOf(modelId, usage); setCost(x => x + c);
      showToast(`Phân tích transcript xong: ${scripts.length} video (+$${c.toFixed(4)})`);
    } catch (e) {
      setErr("Transcript lỗi: " + String(e.message || e));
    } finally {
      setTranscriptBusy(false);
    }
  }

  async function runAutocomplete() {
    if (autocompleteBusy) return;
    const q = (competition?.keyword || seed).trim();
    if (!q) { setErr("Nhập chủ đề trước"); return; }
    setAutocompleteBusy(true); setErr("");
    try {
      const r = await fetch(`${apiBase()}/autocomplete?q=${encodeURIComponent(q)}&lang=${mk.lang}`);
      if (!r.ok) throw new Error(`Backend ${r.status}`);
      const d = await r.json();
      const list = (d.suggestions || []).filter(s => s && s.toLowerCase() !== q.toLowerCase());
      setAutocompleteLongTail(list);
      showToast(`Autocomplete: ${list.length} gợi ý long-tail`);
    } catch (e) {
      setErr("Autocomplete lỗi: " + String(e.message || e) + ` (backend tại ${apiBase()} có chạy không?)`);
    } finally {
      setAutocompleteBusy(false);
    }
  }

  /* ════════════════════════════════════════════════════════════════════
     PROMPT 7 (Tầng 3) — Reddit + Trends (qua backend) + Thumbnail Vision.
     Mỗi nguồn độc lập: hỏng một cái không ảnh hưởng các phần khác.
     ════════════════════════════════════════════════════════════════════ */
  async function runReddit() {
    if (redditBusy) return;
    const q = (competition?.keyword || seed).trim();
    if (!q) { setErr("Nhập chủ đề trước"); return; }
    setRedditBusy(true); setErr("");
    try {
      const r = await fetch(`${apiBase()}/reddit?q=${encodeURIComponent(q)}&limit=15`);
      if (!r.ok) throw new Error(`Backend ${r.status}`);
      const d = await r.json();
      setRedditSignals(d.posts || []);
      showToast(`Reddit: ${d.posts?.length || 0} post`);
    } catch (e) {
      setErr("Reddit lỗi: " + String(e.message || e) + ` (backend tại ${apiBase()} có chạy không?)`);
    } finally { setRedditBusy(false); }
  }

  async function runTrends() {
    if (trendBusy) return;
    const q = (competition?.keyword || seed).trim();
    if (!q) { setErr("Nhập chủ đề trước"); return; }
    setTrendBusy(true); setErr("");
    try {
      const r = await fetch(`${apiBase()}/trends?q=${encodeURIComponent(q)}&geo=${mk.region || ""}`);
      if (!r.ok) {
        const t = await r.json().catch(() => ({}));
        throw new Error(t.detail || `Backend ${r.status}`);
      }
      const d = await r.json();
      setTrend({ direction: d.direction || "unknown", data: d.data || [] });
      showToast(`Trends: ${d.direction}`);
    } catch (e) {
      setErr("Trends lỗi: " + String(e.message || e));
    } finally { setTrendBusy(false); }
  }

  async function runThumbnailVision() {
    if (thumbBusy) return;
    if (!videos.length) { setErr("Chạy nghiên cứu trước đã"); return; }
    setThumbBusy(true); setErr("");
    try {
      const urls = videos.slice(0, 5).map(v => `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`);
      const sys = `Bạn là chuyên gia thiết kế thumbnail YouTube. Phân tích ${urls.length} thumbnail của video TOP đang rank.
TRẢ JSON THUẦN, KHÔNG BACKTICKS:
{
  "commonPatterns": "mô tả 3-5 câu: màu sắc, bố cục, biểu cảm khuôn mặt, text overlay, phong cách CHUNG mà các thumbnail top dùng",
  "differentiationIdea": "1 concept thumbnail TƯƠNG PHẢN để nổi bật giữa đám đông này (màu/bố cục/góc tiếp cận khác biệt)"
}` + profileCtx();
      const { text, usage } = await callClaudeVision(sys, `Từ khóa: "${competition?.keyword || seed}". Phân tích các thumbnail đính kèm.`,
        urls, { model: modelId, thinkingOn, effortId, maxTokens: 1500 });
      const parsed = parseJSON(text);
      if (!parsed) throw new Error("Không parse được kết quả AI");
      setThumbnailConcept({
        commonPatterns: String(parsed.commonPatterns || ""),
        differentiationIdea: String(parsed.differentiationIdea || ""),
      });
      const c = costOf(modelId, usage); setCost(x => x + c);
      showToast(`Phân tích thumbnail xong (+$${c.toFixed(4)})`);
    } catch (e) {
      setErr("Thumbnail vision lỗi: " + String(e.message || e));
    } finally { setThumbBusy(false); }
  }

  /* ── Lưu/bỏ từ khóa vào giỏ export ── */
  function toggleSaveKw(kw, opportunity, level) {
    setSavedKw(prev => prev.some(x => x.kw === kw)
      ? prev.filter(x => x.kw !== kw)
      : [...prev, { kw, opportunity: opportunity ?? null, level: level || "" }]);
  }
  const isSaved = (kw) => savedKw.some(x => x.kw === kw);

  /* ════════════════════════════════════════════════════════════════════
     EXPORT — JSON cho Tool 2 + checkpoint
     ════════════════════════════════════════════════════════════════════ */
  function exportForTool2() {
    try {
      const out = {
        tool: "tool5-seo-research",
        version: CHECKPOINT_VERSION,
        timestamp: Date.now(),
        topic: competition?.keyword || seed,
        market, lang: mk.lang,
        opportunity: competition ? { score: competition.score, level: competition.level, metrics: competition.metrics } : null,
        savedKeywords: savedKw,
        keywordCandidates: keywordCands.slice(0, 20).map(k => k.kw),
        realTags: allTags,
        ai: ai || null,
        channelProfile: [profile.audience, profile.tone, profile.niche].some(x => x?.trim()) ? profile : null,
        // ── Tầng 1 (v2) — chỉ kèm khi có; Tool 2 đọc file v1 (thiếu các trường này) vẫn chạy ──
        audiencePain, contentGaps, durationSweetSpot,
        // ── Tầng 2 (backend) ──
        autocompleteLongTail, transcriptInsights,
        // ── Tầng 3 ──
        trend, redditSignals: redditSignals.map(p => p.title), thumbnailConcept,
      };
      safeDownload(`seo-data-${(competition?.keyword || seed).replace(/\s+/g, "-").slice(0, 30)}-${Date.now()}.json`,
        JSON.stringify(out, null, 2), "application/json");
      showToast("Đã tải SEO data cho Tool 2");
    } catch (e) { setErr("Export lỗi: " + e.message); }
  }

  function exportCheckpoint() {
    try {
      safeDownload(`checkpoint-tool5-${Date.now()}.json`, JSON.stringify(buildSnap(), null, 2), "application/json");
      showToast("Đã tải checkpoint");
    } catch (e) { setErr("Export lỗi: " + e.message); }
  }

  function importCheckpoint(file) {
    const fr = new FileReader();
    fr.onload = (e) => {
      try {
        const snap = JSON.parse(e.target.result);
        if (!COMPAT_VERSIONS.has(snap.version)) throw new Error("File không phải checkpoint Tool 5");
        applySnap(snap);
        showToast("Đã khôi phục checkpoint");
      } catch (e2) { setErr("Import lỗi: " + e2.message); }
    };
    fr.readAsText(file);
  }

  function clearAll() {
    setSeed(""); setVideos([]); setCompetition(null); setKeywordCands([]);
    setAllTags([]); setAi(null); setSavedKw([]); setCost(0); setErr("");
    setAudiencePain([]); setContentGaps([]); setDurationSweetSpot(null);
    setTranscriptInsights(null); setAutocompleteLongTail([]);
    setRedditSignals([]); setTrend(null); setThumbnailConcept(null);
    // quotaUsed KHÔNG reset — nó phản ánh quota đã tiêu trong NGÀY, không theo phiên
    showToast("Đã xoá phiên");
  }

  /* ════════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════════ */
  const C = {
    bg: "#0a0e14", panel: "#0f1620", panel2: "#131c28", border: "#1e2a3a",
    text: "#e6f0f5", textDim: "#7d8fa3",
    red: "#ef4444", redDim: "#dc2626", teal: "#2dd4bf", tealDim: "#0d9488",
    violet: "#a78bfa", violetDim: "#7c3aed", amber: "#f59e0b", green: "#34d399",
    blue: "#60a5fa",
  };
  const levelColor = (lv) => lv === "easy" ? C.green : lv === "medium" ? C.amber : C.red;
  const levelLabel = (lv) => lv === "easy" ? "Dễ chen vào" : lv === "medium" ? "Trung bình" : lv === "hard" ? "Cạnh tranh cao" : "—";

  return (
    <div style={{ fontFamily: FONT, background: C.bg, color: C.text, minHeight: "100vh", overflowX: "hidden", width: "100%",
      backgroundImage: `radial-gradient(900px 500px at 88% -8%, rgba(239,68,68,0.10), transparent 60%),
        radial-gradient(800px 480px at 8% 108%, rgba(45,212,191,0.07), transparent 60%)` }}>
      <style>{`
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:9px;height:9px}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:9px}
        input,textarea,select{font-family:inherit}
        input::placeholder{color:${C.textDim}}
        .t5-spin{animation:t5s 1s linear infinite}@keyframes t5s{to{transform:rotate(360deg)}}
        .t5-fade{animation:t5f .35s ease both}@keyframes t5f{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        a{color:${C.blue}}
      `}</style>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 20px 80px" }}>
        {/* HEADER */}
        <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, display: "grid", placeItems: "center",
            background: `linear-gradient(135deg, ${C.redDim}, ${C.violetDim})` }}>
            <Youtube size={24} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 style={{ margin: 0, fontSize: 21, letterSpacing: -0.4 }}>YouTube SEO Researcher</h1>
            <div style={{ fontSize: 12.5, color: C.textDim, fontFamily: MONO }}>
              Tool 5 — data thật từ YouTube, không phải "AI tự nghĩ SEO"
            </div>
          </div>
          {cost > 0 && <Pill C={C} icon={<Sparkles size={13} />} text={`$${cost.toFixed(4)}`} color={C.amber} />}
          {quotaUsed > 0 && <Pill C={C} icon={<Gauge size={13} />} text={`${quotaUsed}/${YT_QUOTA_LIMIT} units`}
            color={quotaUsed > YT_QUOTA_LIMIT * 0.9 ? C.red : quotaUsed > YT_QUOTA_LIMIT * 0.7 ? C.amber : C.teal} />}
          {savedKw.length > 0 && <Pill C={C} icon={<Award size={13} />} text={`${savedKw.length} từ khóa đã lưu`} color={C.teal} />}
        </header>

        {err && (
          <div className="t5-fade" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 14px",
            background: "rgba(239,68,68,0.08)", border: `1px solid ${C.red}55`, borderRadius: 11, marginBottom: 16, fontSize: 13.5 }}>
            <AlertTriangle size={16} color={C.red} style={{ marginTop: 1, flexShrink: 0 }} />
            <span style={{ flex: 1, wordBreak: "break-word" }}>{err}</span>
            <X size={15} color={C.textDim} style={{ cursor: "pointer" }} onClick={() => setErr("")} />
          </div>
        )}

        {/* API KEY SETUP */}
        <Card C={C} title="YouTube Data API v3 Key" icon={<Key size={15} color={C.amber} />}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
              <input type={showKey ? "text" : "password"} value={apiKey}
                onChange={e => saveApiKey(e.target.value)}
                placeholder="Dán API key (AIzaSy...)"
                style={{ width: "100%", padding: "9px 38px 9px 12px", fontSize: 13, background: C.bg,
                  border: `1px solid ${keyValid === true ? C.green : keyValid === false ? C.red : C.border}`,
                  borderRadius: 9, color: C.text, outline: "none", fontFamily: MONO }} />
              <span onClick={() => setShowKey(s => !s)} style={{ position: "absolute", right: 10, top: 9, cursor: "pointer" }}>
                {showKey ? <EyeOff size={15} color={C.textDim} /> : <Eye size={15} color={C.textDim} />}
              </span>
            </div>
            {keyValid === true && <Pill C={C} icon={<Check size={13} />} text="Key hoạt động" color={C.green} />}
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: C.textDim, lineHeight: 1.6 }}>
            Lấy free tại <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer">console.cloud.google.com</a> → tạo project → bật "YouTube Data API v3" → Credentials → tạo API key. Miễn phí 10.000 units/ngày (~100 lượt nghiên cứu). Key lưu cục bộ trong trình duyệt, chỉ dùng đọc dữ liệu công khai.
          </div>
        </Card>

        {/* SEARCH BAR */}
        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 5 }}>Chủ đề / từ khóa video</div>
            <input type="text" value={seed} onChange={e => setSeed(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !busy) runResearch(); }}
              placeholder='vd: "dùng AI viết báo cáo tuần", "cách giảm đường huyết"'
              style={{ width: "100%", padding: "11px 13px", fontSize: 14, background: C.panel,
                border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: "none" }} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 5 }}>Thị trường</div>
            <select value={market} onChange={e => setMarket(e.target.value)}
              style={{ padding: "11px 12px", fontSize: 13.5, background: C.panel, border: `1px solid ${C.border}`,
                borderRadius: 10, color: C.text, outline: "none" }}>
              {MARKETS.map(m => <option key={m.v} value={m.v}>{m.label}</option>)}
            </select>
          </div>
          <button onClick={runResearch} disabled={busy}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 10,
              background: busy ? C.panel2 : C.redDim, border: `1px solid ${C.redDim}`, color: "#fff",
              fontSize: 14, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", fontFamily: FONT }}>
            {busy ? <Loader2 size={16} className="t5-spin" /> : <Search size={16} />}
            {busy ? phaseLabel(phase) : "Nghiên cứu"}
          </button>
        </div>

        {/* MODEL ROW (cho AI module) */}
        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
          padding: "10px 12px", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10 }}>
          <Cpu size={14} color={C.teal} />
          <span style={{ fontSize: 12, color: C.textDim }}>AI:</span>
          {DEFAULT_MODELS.map(m => (
            <button key={m.id} onClick={() => setModelId(m.id)} style={{
              padding: "5px 10px", borderRadius: 7, fontSize: 12, cursor: "pointer", fontFamily: FONT,
              background: modelId === m.id ? C.panel2 : "transparent",
              border: `1px solid ${modelId === m.id ? m.color : C.border}`,
              color: modelId === m.id ? C.text : C.textDim }}>{m.label}</button>
          ))}
          <span style={{ width: 1, height: 18, background: C.border, margin: "0 4px" }} />
          {EFFORT_LEVELS.map(e => (
            <button key={e.id} onClick={() => setEffortId(e.id)} style={{
              padding: "5px 9px", borderRadius: 7, fontSize: 11.5, cursor: "pointer", fontFamily: FONT,
              background: effortId === e.id ? C.tealDim : "transparent",
              border: `1px solid ${effortId === e.id ? C.tealDim : C.border}`,
              color: effortId === e.id ? "#03100e" : C.textDim }}>{e.label}</button>
          ))}
        </div>

        {/* CHANNEL PROFILE — context kênh cho AI gợi ý bám sát (tuỳ chọn) */}
        <div style={{ marginTop: 12, padding: "10px 12px", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10 }}>
          <div onClick={() => setProfileOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            {profileOpen ? <ChevronDown size={14} color={C.textDim} /> : <ChevronRight size={14} color={C.textDim} />}
            <Users size={14} color={C.violet} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>Hồ sơ kênh (tuỳ chọn)</span>
            <span style={{ fontSize: 11, color: C.textDim }}>
              {[profile.audience, profile.tone, profile.niche].filter(x => x?.trim()).length}/3 · giúp AI gợi ý đúng chất kênh
            </span>
          </div>
          {profileOpen && (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {[
                ["audience", "Đối tượng khán giả", "vd: phụ nữ VN 30-45, quan tâm sức khỏe"],
                ["tone", "Giọng/phong cách", "vd: khoa học nhưng gần gũi, không dùng jargon"],
                ["niche", "Niche/lĩnh vực", "vd: circadian biology, dinh dưỡng, thói quen"],
              ].map(([k, label, ph]) => (
                <div key={k}>
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>{label}</div>
                  <input type="text" value={profile[k]} onChange={e => setProfile(p => ({ ...p, [k]: e.target.value }))}
                    placeholder={ph}
                    style={{ width: "100%", padding: "8px 11px", fontSize: 12.5, background: C.bg,
                      border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: "none" }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ MODULE 2: COMPETITION (hiện trước vì là "verdict") ═══ */}
        {competition && (
          <div className="t5-fade" style={{ marginTop: 18 }}>
            <SectionHead C={C} icon={<BarChart3 size={16} color={C.red} />} title="Phân tích cạnh tranh"
              open={open.comp} onToggle={() => setOpen(o => ({ ...o, comp: !o.comp }))} />
            {open.comp && (
              <div style={{ marginTop: 10 }}>
                {/* Opportunity gauge */}
                <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "16px 18px", borderRadius: 14,
                  background: `linear-gradient(135deg, ${levelColor(competition.level)}18, transparent)`,
                  border: `1px solid ${levelColor(competition.level)}55`, flexWrap: "wrap" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 38, fontWeight: 800, color: levelColor(competition.level), lineHeight: 1 }}>
                      {competition.score}</div>
                    <div style={{ fontSize: 11, color: C.textDim, fontFamily: MONO }}>/100</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: levelColor(competition.level) }}>
                      {levelLabel(competition.level)}</div>
                    <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 3 }}>
                      Opportunity Score cho từ khóa "<b style={{ color: C.text }}>{competition.keyword}</b>"
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 14px", fontSize: 11.5 }}>
                    <Metric C={C} label="Kênh nhỏ rank" val={`${competition.metrics.smallRatio}%`} />
                    <Metric C={C} label="Video mới <12th" val={`${competition.metrics.fresh}%`} />
                    <Metric C={C} label="View/Sub (median)" val={`${competition.metrics.medianRatio}x`} />
                    <Metric C={C} label="Kênh lớn >500k" val={`${competition.metrics.giants}%`} />
                  </div>
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: C.textDim, lineHeight: 1.5 }}>
                  Điểm cao = nhiều video từ kênh nhỏ vẫn rank được → cửa còn mở cho kênh mới. Điểm thấp = bị kênh lớn thống trị.
                </div>

                {/* Video table */}
                <div style={{ marginTop: 12, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 90px", gap: 8, padding: "8px 12px",
                    background: C.panel2, fontSize: 11, color: C.textDim, fontFamily: MONO, fontWeight: 600 }}>
                    <span>Tiêu đề video đang rank</span><span style={{ textAlign: "right" }}>Views</span>
                    <span style={{ textAlign: "right" }}>Subs</span><span style={{ textAlign: "right" }}>View/Sub</span>
                  </div>
                  <div style={{ maxHeight: 360, overflowY: "auto" }}>
                    {videos.map((v, i) => {
                      const ratio = v.views / Math.max(v.subs || 1, 1);
                      const hot = ratio > 2 && v.subs < 100000;
                      return (
                        <a key={v.videoId} href={`https://youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noreferrer"
                          style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 90px", gap: 8, padding: "9px 12px",
                            borderTop: `1px solid ${C.border}`, fontSize: 12, textDecoration: "none", color: C.text,
                            background: hot ? C.green + "0c" : "transparent" }}>
                          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {hot && <Flame size={11} color={C.green} style={{ marginRight: 4, verticalAlign: "middle" }} />}
                            {v.title}
                            <span style={{ color: C.textDim, fontSize: 10.5 }}> · {v.channelTitle}</span>
                          </span>
                          <span style={{ textAlign: "right", color: C.textDim, fontFamily: MONO }}>{fmtNum(v.views)}</span>
                          <span style={{ textAlign: "right", color: C.textDim, fontFamily: MONO }}>{v.hiddenSubs ? "ẩn" : fmtNum(v.subs)}</span>
                          <span style={{ textAlign: "right", fontFamily: MONO, color: hot ? C.green : C.textDim }}>{ratio.toFixed(1)}x</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: C.textDim }}>
                  🔥 = video "vượt size kênh" (view cao hơn sub nhiều, kênh nhỏ) — dấu hiệu từ khóa có lực kéo riêng, đáng nhắm.
                </div>

                {/* DURATION SWEET-SPOT */}
                {durationSweetSpot && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                    padding: "11px 14px", borderRadius: 12, background: C.panel, border: `1px solid ${C.border}` }}>
                    <Clock size={18} color={C.blue} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                        Điểm ngọt độ dài: {fmtDuration(durationSweetSpot.medianSec)}
                        <span style={{ fontWeight: 400, color: C.textDim, fontSize: 12 }}> (median)</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>
                        Khoảng phổ biến {fmtDuration(durationSweetSpot.minSec)} - {fmtDuration(durationSweetSpot.maxSec)} · từ {durationSweetSpot.count} video top
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ MODULE 1: KEYWORD CANDIDATES ═══ */}
        {keywordCands.length > 0 && (
          <div className="t5-fade" style={{ marginTop: 18 }}>
            <SectionHead C={C} icon={<Target size={16} color={C.teal} />} title={`Từ khóa thật (${keywordCands.length})`}
              open={open.kw} onToggle={() => setOpen(o => ({ ...o, kw: !o.kw }))} />
            {open.kw && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 8 }}>
                  Trích từ tiêu đề + tags thật của video đang rank. Bấm để lưu vào giỏ export. Số = tần suất xuất hiện.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {keywordCands.map((k, i) => (
                    <button key={i} onClick={() => toggleSaveKw(k.kw, null, "")} style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 20, cursor: "pointer",
                      background: isSaved(k.kw) ? C.tealDim : C.panel, fontFamily: FONT,
                      border: `1px solid ${isSaved(k.kw) ? C.tealDim : C.border}`,
                      color: isSaved(k.kw) ? "#03100e" : C.text, fontSize: 12.5, fontWeight: isSaved(k.kw) ? 600 : 400 }}>
                      {isSaved(k.kw) ? <Check size={12} /> : <Tag size={12} color={C.textDim} />}
                      {isQuestionKw(k.kw, mk.lang) && <span title="Keyword dạng câu hỏi - intent rõ, dễ làm title hook">❓</span>}
                      {k.kw}
                      <span style={{ fontSize: 10, opacity: 0.6 }}>{k.count}</span>
                    </button>
                  ))}
                </div>
                {allTags.length > 0 && (
                  <>
                    <div style={{ fontSize: 11.5, color: C.textDim, margin: "14px 0 8px" }}>
                      Tags thật video top đang dùng (copy được):
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {allTags.map((t, i) => (
                        <span key={i} style={{ padding: "4px 9px", borderRadius: 7, background: C.panel2,
                          border: `1px solid ${C.border}`, fontSize: 11.5, color: C.textDim, fontFamily: MONO }}>{t}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ MODULE 3: AI SUGGESTIONS ═══ */}
        {competition && (
          <div className="t5-fade" style={{ marginTop: 18 }}>
            <SectionHead C={C} icon={<Lightbulb size={16} color={C.violet} />} title="Gợi ý AI (title, tags, mô tả)"
              open={open.ai} onToggle={() => setOpen(o => ({ ...o, ai: !o.ai }))} />
            {open.ai && (
              <div style={{ marginTop: 10 }}>
                {!ai && !aiBusy && (
                  <button onClick={runAISuggest} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10,
                    background: C.violetDim, border: `1px solid ${C.violetDim}`, color: "#fff",
                    fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                    <Sparkles size={15} /> Tạo gợi ý SEO từ data thật
                  </button>
                )}
                {aiBusy && (
                  <div style={{ padding: "12px 14px", background: C.panel, borderRadius: 10, fontSize: 13,
                    display: "flex", alignItems: "center", gap: 10 }}>
                    <Loader2 size={15} color={C.violet} className="t5-spin" />
                    <span style={{ color: C.textDim }}>AI đang phân tích {videos.length} video... ({(aiStream || "").length} ký tự)</span>
                  </div>
                )}
                {ai && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {ai.opportunitySummary && (
                      <div style={{ padding: "11px 14px", background: C.violet + "12", borderRadius: 10,
                        border: `1px solid ${C.violetDim}55`, fontSize: 13, lineHeight: 1.5 }}>
                        💡 {ai.opportunitySummary}
                      </div>
                    )}
                    {(ai.searchIntent || ai.emotionalTrigger) && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {ai.searchIntent && <Pill C={C} icon={<Target size={12} />} text={`intent: ${ai.searchIntent}`} color={C.blue} />}
                        {ai.emotionalTrigger && <Pill C={C} icon={<Zap size={12} />} text={`cảm xúc: ${ai.emotionalTrigger}`} color={C.amber} />}
                      </div>
                    )}
                    {ai.titlePatterns?.length > 0 && (
                      <Block C={C} icon={<Type size={14} color={C.teal} />} title="Mẫu tiêu đề tối ưu">
                        {ai.titlePatterns.map((t, i) => (
                          <CopyRow key={i} C={C} text={t} onCopy={() => { navigator.clipboard?.writeText(t); showToast("Đã copy"); }} />
                        ))}
                      </Block>
                    )}
                    {ai.tags?.length > 0 && (
                      <Block C={C} icon={<Tag size={14} color={C.amber} />} title="Tags đề xuất"
                        action={<button onClick={() => { navigator.clipboard?.writeText(ai.tags.join(", ")); showToast("Đã copy tất cả tags"); }}
                          style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "transparent",
                            border: `1px solid ${C.border}`, color: C.textDim, cursor: "pointer", fontFamily: FONT }}>Copy tất cả</button>}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {ai.tags.map((t, i) => (
                            <span key={i} style={{ padding: "4px 9px", borderRadius: 7, background: C.panel2,
                              border: `1px solid ${C.border}`, fontSize: 11.5, color: C.text, fontFamily: MONO }}>{t}</span>
                          ))}
                        </div>
                      </Block>
                    )}
                    {ai.extraKeywords?.length > 0 && (
                      <Block C={C} icon={<Zap size={14} color={C.green} />} title="Từ khóa long-tail tiềm năng">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                          {ai.extraKeywords.map((k, i) => (
                            <button key={i} onClick={() => toggleSaveKw(k, null, "")} style={{
                              display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 20, cursor: "pointer",
                              background: isSaved(k) ? C.tealDim : C.panel, fontFamily: FONT,
                              border: `1px solid ${isSaved(k) ? C.tealDim : C.border}`,
                              color: isSaved(k) ? "#03100e" : C.text, fontSize: 12 }}>
                              {isSaved(k) ? <Check size={11} /> : <Zap size={11} color={C.green} />}{k}
                            </button>
                          ))}
                        </div>
                      </Block>
                    )}
                    {ai.descriptionTemplate && (
                      <Block C={C} icon={<FileText size={14} color={C.blue} />} title="Mẫu mô tả"
                        action={<button onClick={() => { navigator.clipboard?.writeText(ai.descriptionTemplate); showToast("Đã copy mô tả"); }}
                          style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "transparent",
                            border: `1px solid ${C.border}`, color: C.textDim, cursor: "pointer", fontFamily: FONT }}>Copy</button>}>
                        <pre style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, whiteSpace: "pre-wrap",
                          wordBreak: "break-word", fontFamily: FONT, color: C.text }}>{ai.descriptionTemplate}</pre>
                      </Block>
                    )}
                    <button onClick={runAISuggest} disabled={aiBusy} style={{
                      alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
                      borderRadius: 8, background: "transparent", border: `1px solid ${C.border}`,
                      color: C.textDim, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>
                      <RefreshCw size={12} /> Tạo lại gợi ý
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ PROMPT 5: COMMENTS MINING (nỗi đau khán giả + content gap) ═══ */}
        {competition && (
          <div className="t5-fade" style={{ marginTop: 18 }}>
            <SectionHead C={C} icon={<MessageSquare size={16} color={C.amber} />} title="Đào comment - nỗi đau khán giả"
              open={open.cmt !== false} onToggle={() => setOpen(o => ({ ...o, cmt: o.cmt === false }))} />
            {open.cmt !== false && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 10, lineHeight: 1.6 }}>
                  Gọi top comment của 8 video đầu (commentThreads.list = 1 unit/video, rất rẻ) rồi để Claude đào: câu hỏi chưa được giải đáp, lời phàn nàn lặp lại, và content gap. Insight này là vàng cho ý tưởng video.
                </div>
                {(audiencePain.length === 0 && contentGaps.length === 0) && (
                  <button onClick={runCommentsMining} disabled={commentsBusy} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10,
                    background: commentsBusy ? C.panel2 : C.amber + "22", border: `1px solid ${C.amber}`, color: C.text,
                    fontSize: 13.5, fontWeight: 600, cursor: commentsBusy ? "not-allowed" : "pointer", fontFamily: FONT }}>
                    {commentsBusy ? <Loader2 size={15} className="t5-spin" /> : <MessageSquare size={15} color={C.amber} />}
                    {commentsBusy ? "Đang đào comment…" : `Đào comment (8 video, ~8 units)`}
                  </button>
                )}
                {(audiencePain.length > 0 || contentGaps.length > 0) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {audiencePain.length > 0 && (
                      <Block C={C} icon={<Users size={14} color={C.amber} />} title="Nỗi đau / câu hỏi khán giả">
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {audiencePain.map((p, i) => (
                            <div key={i} style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5, paddingLeft: 14, position: "relative" }}>
                              <span style={{ position: "absolute", left: 0, color: C.amber }}>•</span>{p}
                            </div>
                          ))}
                        </div>
                      </Block>
                    )}
                    {contentGaps.length > 0 && (
                      <Block C={C} icon={<Zap size={14} color={C.green} />} title="Content gap (cơ hội nội dung)">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                          {contentGaps.map((g, i) => (
                            <button key={i} onClick={() => toggleSaveKw(g, null, "")} style={{
                              display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 9, cursor: "pointer",
                              background: isSaved(g) ? C.tealDim : C.panel, fontFamily: FONT, textAlign: "left",
                              border: `1px solid ${isSaved(g) ? C.tealDim : C.border}`,
                              color: isSaved(g) ? "#03100e" : C.text, fontSize: 12 }}>
                              {isSaved(g) ? <Check size={11} /> : <Zap size={11} color={C.green} />}{g}
                            </button>
                          ))}
                        </div>
                      </Block>
                    )}
                    <button onClick={runCommentsMining} disabled={commentsBusy} style={{
                      alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
                      borderRadius: 8, background: "transparent", border: `1px solid ${C.border}`,
                      color: C.textDim, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>
                      <RefreshCw size={12} /> Đào lại
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ PROMPT 6: BACKEND (transcript + autocomplete) ═══ */}
        <div className="t5-fade" style={{ marginTop: 18 }}>
          <SectionHead C={C} icon={<Play size={16} color={C.green} />} title="Backend - transcript + autocomplete (Tầng 2)"
            open={open.be === true} onToggle={() => setOpen(o => ({ ...o, be: o.be !== true }))} />
          {open.be === true && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 10, lineHeight: 1.6 }}>
                Cần chạy server cục bộ (xem <span style={{ fontFamily: MONO, color: C.text }}>server/README.md</span>). Backend lấy transcript video người khác (reverse-engineer cấu trúc kịch bản) và autocomplete long-tail mà browser không làm được.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                <input type="text" value={backendUrl} onChange={e => { setBackendUrl(e.target.value); setBackendOk(null); }}
                  placeholder="http://localhost:8000"
                  style={{ flex: 1, minWidth: 200, padding: "8px 11px", fontSize: 12.5, background: C.bg,
                    border: `1px solid ${backendOk === true ? C.green : backendOk === false ? C.red : C.border}`,
                    borderRadius: 9, color: C.text, outline: "none", fontFamily: MONO }} />
                <button onClick={checkBackend} disabled={backendBusy} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9,
                  background: C.panel2, border: `1px solid ${C.border}`, color: C.text,
                  fontSize: 12.5, cursor: backendBusy ? "not-allowed" : "pointer", fontFamily: FONT }}>
                  {backendBusy ? <Loader2 size={14} className="t5-spin" /> : <RefreshCw size={14} />} Kiểm tra
                </button>
                {backendOk === true && <Pill C={C} icon={<Check size={13} />} text="Online" color={C.green} />}
                {backendOk === false && <Pill C={C} icon={<X size={13} />} text="Không kết nối" color={C.red} />}
              </div>

              {backendOk === true && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* TRANSCRIPT */}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={runTranscriptInsights} disabled={transcriptBusy || !competition} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 9,
                      background: C.green + "22", border: `1px solid ${C.green}`, color: C.text,
                      fontSize: 13, fontWeight: 600, cursor: (transcriptBusy || !competition) ? "not-allowed" : "pointer", fontFamily: FONT }}>
                      {transcriptBusy ? <Loader2 size={14} className="t5-spin" /> : <FileText size={14} color={C.green} />}
                      {transcriptBusy ? "Đang phân tích…" : "Lấy transcript top 3 + phân tích"}
                    </button>
                    <button onClick={runAutocomplete} disabled={autocompleteBusy} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 9,
                      background: C.blue + "22", border: `1px solid ${C.blue}`, color: C.text,
                      fontSize: 13, fontWeight: 600, cursor: autocompleteBusy ? "not-allowed" : "pointer", fontFamily: FONT }}>
                      {autocompleteBusy ? <Loader2 size={14} className="t5-spin" /> : <Search size={14} color={C.blue} />}
                      {autocompleteBusy ? "Đang lấy…" : "Autocomplete long-tail"}
                    </button>
                  </div>

                  {transcriptInsights && (
                    <Block C={C} icon={<FileText size={14} color={C.green} />} title="Cấu trúc kịch bản video top">
                      {transcriptInsights.commonStructure && (
                        <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, marginBottom: transcriptInsights.gaps?.length ? 10 : 0 }}>
                          {transcriptInsights.commonStructure}
                        </div>
                      )}
                      {transcriptInsights.gaps?.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <div style={{ fontSize: 11.5, color: C.textDim, fontWeight: 600 }}>Điểm bỏ sót (cơ hội):</div>
                          {transcriptInsights.gaps.map((g, i) => (
                            <div key={i} style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5, paddingLeft: 14, position: "relative" }}>
                              <span style={{ position: "absolute", left: 0, color: C.green }}>•</span>{g}
                            </div>
                          ))}
                        </div>
                      )}
                    </Block>
                  )}

                  {autocompleteLongTail.length > 0 && (
                    <Block C={C} icon={<Search size={14} color={C.blue} />} title={`Long-tail từ autocomplete (${autocompleteLongTail.length})`}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                        {autocompleteLongTail.map((k, i) => (
                          <button key={i} onClick={() => toggleSaveKw(k, null, "")} style={{
                            display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 20, cursor: "pointer",
                            background: isSaved(k) ? C.tealDim : C.panel, fontFamily: FONT,
                            border: `1px solid ${isSaved(k) ? C.tealDim : C.border}`,
                            color: isSaved(k) ? "#03100e" : C.text, fontSize: 12 }}>
                            {isSaved(k) ? <Check size={11} /> : <Tag size={11} color={C.blue} />}
                            {isQuestionKw(k, mk.lang) && <span title="Câu hỏi - intent rõ">❓</span>}{k}
                          </button>
                        ))}
                      </div>
                    </Block>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ PROMPT 7 (Tầng 3): Reddit + Trends + Thumbnail Vision ═══ */}
        {competition && (
          <div className="t5-fade" style={{ marginTop: 18 }}>
            <SectionHead C={C} icon={<TrendingUp size={16} color={C.violet} />} title="Tầng 3 - Reddit, Trends, Thumbnail"
              open={open.t3 === true} onToggle={() => setOpen(o => ({ ...o, t3: o.t3 !== true }))} />
            {open.t3 === true && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={runReddit} disabled={redditBusy || backendOk !== true} title={backendOk !== true ? "Cần backend (mục trên)" : ""} style={{
                    display: "flex", alignItems: "center", gap: 7, padding: "9px 13px", borderRadius: 9,
                    background: C.panel, border: `1px solid ${C.border}`, color: backendOk === true ? C.text : C.textDim,
                    fontSize: 12.5, fontWeight: 600, cursor: (redditBusy || backendOk !== true) ? "not-allowed" : "pointer", fontFamily: FONT }}>
                    {redditBusy ? <Loader2 size={14} className="t5-spin" /> : <Users size={14} color={C.amber} />} Reddit signals
                  </button>
                  <button onClick={runTrends} disabled={trendBusy || backendOk !== true} title={backendOk !== true ? "Cần backend + pytrends" : ""} style={{
                    display: "flex", alignItems: "center", gap: 7, padding: "9px 13px", borderRadius: 9,
                    background: C.panel, border: `1px solid ${C.border}`, color: backendOk === true ? C.text : C.textDim,
                    fontSize: 12.5, fontWeight: 600, cursor: (trendBusy || backendOk !== true) ? "not-allowed" : "pointer", fontFamily: FONT }}>
                    {trendBusy ? <Loader2 size={14} className="t5-spin" /> : <TrendingUp size={14} color={C.green} />} Google Trends
                  </button>
                  <button onClick={runThumbnailVision} disabled={thumbBusy} style={{
                    display: "flex", alignItems: "center", gap: 7, padding: "9px 13px", borderRadius: 9,
                    background: C.violet + "22", border: `1px solid ${C.violet}`, color: C.text,
                    fontSize: 12.5, fontWeight: 600, cursor: thumbBusy ? "not-allowed" : "pointer", fontFamily: FONT }}>
                    {thumbBusy ? <Loader2 size={14} className="t5-spin" /> : <Lightbulb size={14} color={C.violet} />} Thumbnail vision
                  </button>
                </div>
                {backendOk !== true && <div style={{ fontSize: 11, color: C.textDim }}>Reddit/Trends cần backend (bật ở mục trên). Thumbnail vision chạy được ngay (không cần backend).</div>}

                {trend && (
                  <Block C={C} icon={<TrendingUp size={14} color={C.green} />} title="Xu hướng quan tâm (12 tháng)">
                    <div style={{ fontSize: 13, color: C.text }}>
                      Hướng: <b style={{ color: trend.direction === "rising" ? C.green : trend.direction === "falling" ? C.red : C.amber }}>
                        {trend.direction === "rising" ? "đang lên ↗" : trend.direction === "falling" ? "đang xuống ↘" : trend.direction === "stable" ? "ổn định →" : "không rõ"}</b>
                      {trend.data?.length > 0 && <span style={{ color: C.textDim, fontSize: 11.5 }}> · {trend.data.length} điểm dữ liệu</span>}
                    </div>
                  </Block>
                )}
                {redditSignals.length > 0 && (
                  <Block C={C} icon={<Users size={14} color={C.amber} />} title={`Reddit - ngôn ngữ mạng & nỗi đau (${redditSignals.length})`}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {redditSignals.slice(0, 12).map((p, i) => (
                        <a key={i} href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: C.text, textDecoration: "none", lineHeight: 1.4 }}>
                          <span style={{ color: C.amber, fontFamily: MONO, fontSize: 11 }}>▲{fmtNum(p.score)}</span>{" "}
                          <span style={{ color: C.textDim, fontSize: 11 }}>r/{p.subreddit}</span>{" "}{p.title}
                        </a>
                      ))}
                    </div>
                  </Block>
                )}
                {thumbnailConcept && (
                  <Block C={C} icon={<Lightbulb size={14} color={C.violet} />} title="Concept thumbnail">
                    {thumbnailConcept.commonPatterns && (
                      <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, marginBottom: 8 }}>
                        <b style={{ color: C.textDim }}>Mẫu chung: </b>{thumbnailConcept.commonPatterns}
                      </div>
                    )}
                    {thumbnailConcept.differentiationIdea && (
                      <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, padding: "8px 11px", background: C.violet + "12", borderRadius: 9, border: `1px solid ${C.violetDim}55` }}>
                        💡 <b>Ý tưởng khác biệt: </b>{thumbnailConcept.differentiationIdea}
                      </div>
                    )}
                  </Block>
                )}
              </div>
            )}
          </div>
        )}

        {/* EXPORT BAR */}
        {(competition || savedKw.length > 0) && (
          <div style={{ marginTop: 22, padding: "14px 16px", borderRadius: 14, background: C.panel,
            border: `1px solid ${C.border}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text, marginRight: "auto" }}>
              <ListChecks size={15} color={C.teal} style={{ verticalAlign: "middle", marginRight: 6 }} />
              {savedKw.length} từ khóa trong giỏ
            </span>
            <SmallBtn C={C} icon={<Download size={13} />} label="Export SEO data (cho Tool 2)" primary onClick={exportForTool2} />
            <SmallBtn C={C} icon={<FileJson size={13} />} label="Checkpoint" onClick={exportCheckpoint} />
            <SmallBtn C={C} icon={<Upload size={13} />} label="Import" onClick={() => cpRef.current?.click()} />
            <SmallBtn C={C} icon={<Trash2 size={13} />} label="Xoá" danger onClick={clearAll} />
            <input ref={cpRef} type="file" accept=".json" style={{ display: "none" }}
              onChange={e => { e.target.files[0] && importCheckpoint(e.target.files[0]); e.target.value = ""; }} />
          </div>
        )}

        {toast && (
          <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
            padding: "10px 18px", borderRadius: 11, background: C.panel, color: C.text,
            border: `1px solid ${C.tealDim}`, fontSize: 13.5, zIndex: 99 }} className="t5-fade">{toast}</div>
        )}
      </div>
    </div>
  );
}

function phaseLabel(p) {
  return p === "search" ? "Đang tìm video…" : p === "videos" ? "Lấy chỉ số…"
    : p === "channels" ? "Lấy quy mô kênh…" : p === "analyze" ? "Phân tích…" : "Đang xử lý…";
}

/* ── SUB-COMPONENTS ── */
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
function SectionHead({ C, title, icon, open, onToggle }) {
  return (
    <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer",
      padding: "10px 12px", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 11 }}>
      {icon}
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{title}</span>
      <ChevronRight size={16} color={C.textDim} style={{ transform: open ? "rotate(90deg)" : "none", transition: ".15s" }} />
    </div>
  );
}
function Block({ C, title, icon, action, children }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 11, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9, fontSize: 12.5, fontWeight: 600 }}>
        {icon}<span style={{ flex: 1 }}>{title}</span>{action}
      </div>
      {children}
    </div>
  );
}
function CopyRow({ C, text, onCopy }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8,
      background: C.bg, border: `1px solid ${C.border}`, marginBottom: 6 }}>
      <span style={{ flex: 1, fontSize: 13, color: C.text, lineHeight: 1.4 }}>{text}</span>
      <span style={{ fontSize: 10, color: C.textDim, fontFamily: MONO, flexShrink: 0 }}>{text.length} ký tự</span>
      <Copy size={13} color={C.textDim} style={{ cursor: "pointer", flexShrink: 0 }} onClick={onCopy} />
    </div>
  );
}
function Metric({ C, label, val }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ color: C.textDim }}>{label}</span>
      <span style={{ color: C.text, fontWeight: 600, fontFamily: MONO }}>{val}</span>
    </div>
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
function SmallBtn({ C, label, icon, onClick, primary, danger }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, cursor: "pointer",
      background: primary ? C.tealDim : "transparent",
      border: `1px solid ${primary ? C.tealDim : danger ? C.red + "55" : C.border}`,
      color: primary ? "#03100e" : danger ? C.red : C.text, fontSize: 12.5, fontWeight: primary ? 600 : 400, fontFamily: FONT }}>
      {icon}{label}
    </button>
  );
}
