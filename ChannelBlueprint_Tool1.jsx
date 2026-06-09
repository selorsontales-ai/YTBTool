import { useState, useEffect, useRef, useCallback } from "react";

// ─── CHECKPOINT STORAGE KEY ────────────────────────────────────────────────
const STORAGE_KEY = "yt_blueprint_v1";

// ─── HIERARCHICAL SUGGESTION DATA (hardcoded, no API cost) ──────────────────
const SUGGESTION_TREE = [
  {
    id: "niche",
    icon: "🎯",
    label: "Chủ đề / Niche",
    desc: "Lĩnh vực chính của kênh",
    color: "#e11d48",
    bg: "#fff1f2",
    children: [
      { id: "tech", label: "Công nghệ", children: [
        { id: "tech_ai", label: "AI & Machine Learning" },
        { id: "tech_dev", label: "Lập trình / Dev" },
        { id: "tech_gadget", label: "Review thiết bị" },
        { id: "tech_saas", label: "SaaS & Productivity tools" },
        { id: "tech_cyber", label: "An ninh mạng" },
        { id: "tech_web3", label: "Web3 / Blockchain" },
      ]},
      { id: "finance", label: "Tài chính / Đầu tư", children: [
        { id: "fin_stock", label: "Chứng khoán" },
        { id: "fin_crypto", label: "Crypto" },
        { id: "fin_personal", label: "Tài chính cá nhân" },
        { id: "fin_realestate", label: "Bất động sản" },
        { id: "fin_business", label: "Kinh doanh & Khởi nghiệp" },
      ]},
      { id: "education", label: "Giáo dục", children: [
        { id: "edu_language", label: "Học ngoại ngữ" },
        { id: "edu_academic", label: "Học thuật / Khoa học" },
        { id: "edu_skills", label: "Kỹ năng mềm" },
        { id: "edu_history", label: "Lịch sử & Văn hóa" },
        { id: "edu_explainer", label: "Giải thích khái niệm phức tạp" },
      ]},
      { id: "gaming", label: "Gaming", children: [
        { id: "game_gameplay", label: "Gameplay / Let's Play" },
        { id: "game_esports", label: "Esports & Tournament" },
        { id: "game_review", label: "Review game" },
        { id: "game_mobile", label: "Mobile gaming" },
        { id: "game_retro", label: "Retro gaming" },
      ]},
      { id: "health", label: "Sức khỏe / Fitness", children: [
        { id: "health_workout", label: "Tập luyện & Workout" },
        { id: "health_nutrition", label: "Dinh dưỡng" },
        { id: "health_mental", label: "Sức khỏe tinh thần" },
        { id: "health_yoga", label: "Yoga & Thiền định" },
      ]},
      { id: "entertainment", label: "Giải trí", children: [
        { id: "ent_comedy", label: "Comedy / Hài hước" },
        { id: "ent_reaction", label: "Reaction videos" },
        { id: "ent_challenge", label: "Challenge & Experiment" },
        { id: "ent_mukbang", label: "Mukbang & Food" },
        { id: "ent_asmr", label: "ASMR" },
      ]},
      { id: "lifestyle", label: "Lifestyle", children: [
        { id: "life_travel", label: "Du lịch" },
        { id: "life_fashion", label: "Thời trang & Làm đẹp" },
        { id: "life_family", label: "Gia đình & Parenting" },
        { id: "life_minimalism", label: "Minimalism & Productivity" },
      ]},
      { id: "creative", label: "Sáng tạo / Nghệ thuật", children: [
        { id: "cre_music", label: "Âm nhạc" },
        { id: "cre_art", label: "Hội họa & Thiết kế" },
        { id: "cre_film", label: "Làm phim & Video" },
        { id: "cre_writing", label: "Viết lách & Storytelling" },
      ]},
    ],
  },
  {
    id: "format",
    icon: "🎬",
    label: "Định dạng nội dung",
    desc: "Cách thức sản xuất video",
    color: "#7c3aed",
    bg: "#f5f3ff",
    children: [
      { id: "fmt_faceless", label: "Faceless channel", children: [
        { id: "faceless_aivoice", label: "AI Voiceover" },
        { id: "faceless_textscreen", label: "Text on screen" },
        { id: "faceless_stockfootage", label: "Stock footage montage" },
        { id: "faceless_animation", label: "Animation / Motion graphics" },
        { id: "faceless_screencast", label: "Screencast / Tutorial" },
      ]},
      { id: "fmt_talkinghead", label: "Talking Head (có mặt)", children: [
        { id: "th_single", label: "Solo presenter" },
        { id: "th_interview", label: "Interview / Guest" },
        { id: "th_debate", label: "Discussion / Debate" },
      ]},
      { id: "fmt_vlog", label: "Vlog / Documentary", children: [
        { id: "vlog_day", label: "Day-in-the-life" },
        { id: "vlog_travel", label: "Travel vlog" },
        { id: "vlog_minidoc", label: "Mini documentary" },
      ]},
      { id: "fmt_tutorial", label: "Tutorial / How-to", children: [
        { id: "tut_stepbystep", label: "Step-by-step guide" },
        { id: "tut_explainer", label: "Concept explainer" },
        { id: "tut_review", label: "Review & Comparison" },
      ]},
      { id: "fmt_podcast", label: "Podcast / Longform", children: [
        { id: "pod_solo", label: "Solo podcast" },
        { id: "pod_interview", label: "Interview podcast" },
        { id: "pod_panel", label: "Panel discussion" },
      ]},
      { id: "fmt_shorts", label: "Shorts-first strategy", children: [
        { id: "short_tip", label: "Quick tips (< 60s)" },
        { id: "short_clip", label: "Clip highlights từ video dài" },
        { id: "short_trend", label: "Trending content" },
      ]},
    ],
  },
  {
    id: "audience",
    icon: "👥",
    label: "Đối tượng khán giả",
    desc: "Target audience của kênh",
    color: "#0284c7",
    bg: "#f0f9ff",
    children: [
      { id: "aud_genz", label: "Gen Z (1997–2012)", children: [
        { id: "genz_student", label: "Sinh viên" },
        { id: "genz_earlycareer", label: "Mới đi làm" },
        { id: "genz_creator", label: "Content creator" },
      ]},
      { id: "aud_millennial", label: "Millennial (1981–1996)", children: [
        { id: "mil_pro", label: "Professionals" },
        { id: "mil_parent", label: "Bố/Mẹ trẻ" },
        { id: "mil_entrepreneur", label: "Doanh nhân" },
      ]},
      { id: "aud_professional", label: "Chuyên gia / Professional", children: [
        { id: "pro_dev", label: "Developers / Engineers" },
        { id: "pro_marketer", label: "Marketers" },
        { id: "pro_designer", label: "Designers" },
        { id: "pro_finance", label: "Finance professionals" },
        { id: "pro_manager", label: "Managers / Leaders" },
      ]},
      { id: "aud_student", label: "Học sinh / Sinh viên", children: [
        { id: "stu_highschool", label: "THPT" },
        { id: "stu_university", label: "Đại học" },
        { id: "stu_selfstudy", label: "Tự học online" },
      ]},
      { id: "aud_general", label: "Đại chúng", children: [
        { id: "gen_family", label: "Gia đình Việt Nam" },
        { id: "gen_curious", label: "Người tò mò / Lifelong learners" },
        { id: "gen_hobbyist", label: "Hobbyists" },
      ]},
    ],
  },
  {
    id: "monetization",
    icon: "💰",
    label: "Chiến lược kiếm tiền",
    desc: "Cách kênh tạo ra doanh thu",
    color: "#059669",
    bg: "#ecfdf5",
    children: [
      { id: "mon_adsense", label: "AdSense (CPM)", children: [
        { id: "ads_high", label: "High-CPM niche (Finance, Tech, B2B)" },
        { id: "ads_volume", label: "Volume play (nhiều video, viral)" },
      ]},
      { id: "mon_sponsor", label: "Sponsorship", children: [
        { id: "spon_direct", label: "Direct brand deals" },
        { id: "spon_network", label: "MCN / Sponsor network" },
        { id: "spon_integrated", label: "Integration vào nội dung" },
      ]},
      { id: "mon_affiliate", label: "Affiliate Marketing", children: [
        { id: "aff_amazon", label: "Amazon Associates" },
        { id: "aff_saas", label: "SaaS / Software affiliate" },
        { id: "aff_course", label: "Course affiliate" },
      ]},
      { id: "mon_product", label: "Digital Products", children: [
        { id: "prod_course", label: "Online courses" },
        { id: "prod_template", label: "Templates / Presets" },
        { id: "prod_ebook", label: "E-book / Guides" },
        { id: "prod_saas", label: "SaaS tool" },
      ]},
      { id: "mon_membership", label: "Membership / Community", children: [
        { id: "mem_patreon", label: "Patreon / Buy Me a Coffee" },
        { id: "mem_ytmem", label: "YouTube Membership" },
        { id: "mem_discord", label: "Discord community" },
      ]},
      { id: "mon_service", label: "Services / Consulting", children: [
        { id: "svc_coaching", label: "1:1 Coaching" },
        { id: "svc_agency", label: "Agency services" },
        { id: "svc_workshop", label: "Workshops / Bootcamps" },
      ]},
    ],
  },
  {
    id: "language",
    icon: "🌍",
    label: "Ngôn ngữ & Thị trường",
    desc: "Ngôn ngữ sản xuất và thị trường mục tiêu",
    color: "#b45309",
    bg: "#fefce8",
    children: [
      { id: "lang_vi", label: "Tiếng Việt", children: [
        { id: "vi_vn", label: "Thị trường Việt Nam" },
        { id: "vi_oversea", label: "Người Việt hải ngoại" },
      ]},
      { id: "lang_en", label: "Tiếng Anh", children: [
        { id: "en_us", label: "US market" },
        { id: "en_global", label: "Global audience" },
        { id: "en_uk", label: "UK / ANZ" },
      ]},
      { id: "lang_bilingual", label: "Song ngữ (Việt + Anh)", children: [
        { id: "bi_viprimary", label: "Việt chính, sub Anh" },
        { id: "bi_enprimary", label: "Anh chính, sub Việt" },
      ]},
      { id: "lang_multi", label: "Đa ngôn ngữ", children: [
        { id: "multi_dubbed", label: "Dubbing sang nhiều ngôn ngữ" },
        { id: "multi_subtitles", label: "Subtitles tự động (AI)" },
      ]},
    ],
  },
  {
    id: "frequency",
    icon: "📅",
    label: "Tần suất đăng",
    desc: "Upload schedule dự kiến",
    color: "#0891b2",
    bg: "#ecfeff",
    children: [
      { id: "freq_daily", label: "Hàng ngày (7/tuần)", children: [] },
      { id: "freq_35week", label: "3–5 video/tuần", children: [] },
      { id: "freq_12week", label: "1–2 video/tuần", children: [] },
      { id: "freq_biweekly", label: "2 tuần/video", children: [] },
      { id: "freq_monthly", label: "2–4 video/tháng", children: [] },
      { id: "freq_shorts_heavy", label: "Shorts hàng ngày + Long 1/tuần", children: [] },
    ],
  },
  {
    id: "production",
    icon: "🎨",
    label: "Phong cách sản xuất",
    desc: "Mức độ đầu tư & style sản xuất",
    color: "#c026d3",
    bg: "#fdf4ff",
    children: [
      { id: "prod_lowbudget", label: "Low-budget DIY", children: [
        { id: "diy_phone", label: "Quay bằng điện thoại" },
        { id: "diy_screencapture", label: "Screen capture chính" },
        { id: "diy_minimal_edit", label: "Edit tối giản (CapCut / DaVinci)" },
      ]},
      { id: "prod_midrange", label: "Mid-range setup", children: [
        { id: "mid_mirrorless", label: "Camera mirrorless/DSLR" },
        { id: "mid_homesetup", label: "Home studio setup" },
        { id: "mid_moderate_edit", label: "Edit nâng cao (Premiere / Final Cut)" },
      ]},
      { id: "prod_highend", label: "High-production", children: [
        { id: "high_studio", label: "Studio chuyên nghiệp" },
        { id: "high_cinema", label: "Cinema-quality footage" },
        { id: "high_team", label: "Có team hỗ trợ (editor, thumbnail artist...)" },
      ]},
      { id: "prod_aiassisted", label: "AI-assisted production", children: [
        { id: "ai_script", label: "AI viết script (ChatGPT / Claude)" },
        { id: "ai_voice", label: "AI Voiceover (ElevenLabs, Murf)" },
        { id: "ai_image", label: "AI Images (Midjourney, DALL-E)" },
        { id: "ai_video", label: "AI Video (Sora, Runway, Kling)" },
        { id: "ai_thumbnail", label: "AI Thumbnail generation" },
        { id: "ai_edit", label: "AI Auto-edit (Descript, Opus Clip)" },
      ]},
    ],
  },
  {
    id: "duration",
    icon: "📏",
    label: "Độ dài video",
    desc: "Format độ dài chính",
    color: "#16a34a",
    bg: "#f0fdf4",
    children: [
      { id: "dur_shorts", label: "Shorts (< 60 giây)", children: [] },
      { id: "dur_shortform", label: "Short-form (1–5 phút)", children: [] },
      { id: "dur_mid", label: "Mid-form (8–15 phút)", children: [] },
      { id: "dur_long", label: "Long-form (20–45 phút)", children: [] },
      { id: "dur_podcast", label: "Podcast / Longform (60+ phút)", children: [] },
      { id: "dur_mixed", label: "Hỗn hợp (Shorts + Long)", children: [] },
    ],
  },
  {
    id: "usp",
    icon: "🧩",
    label: "USP / Điểm khác biệt",
    desc: "Lý do khán giả chọn kênh này thay vì kênh khác",
    color: "#dc2626",
    bg: "#fff1f2",
    children: [
      { id: "usp_humor", label: "Hài hước & Giải trí cao", children: [] },
      { id: "usp_deepanalysis", label: "Phân tích sâu, research kỹ", children: [] },
      { id: "usp_simplify", label: "Đơn giản hóa vấn đề phức tạp", children: [] },
      { id: "usp_storytelling", label: "Storytelling & Narrative mạnh", children: [] },
      { id: "usp_datadriven", label: "Data-driven & Evidence-based", children: [] },
      { id: "usp_practical", label: "Thực hành được ngay (actionable)", children: [] },
      { id: "usp_exclusive", label: "Nội dung độc quyền / Insider access", children: [] },
      { id: "usp_personality", label: "Personality mạnh / Personal brand", children: [] },
      { id: "usp_niche", label: "Siêu niche, ít cạnh tranh", children: [] },
      { id: "usp_community", label: "Community-driven content", children: [] },
    ],
  },
  {
    id: "repurpose",
    icon: "🔄",
    label: "Chiến lược tái chế nội dung",
    desc: "Tận dụng tối đa mỗi video đã làm",
    color: "#7c3aed",
    bg: "#f5f3ff",
    children: [
      { id: "rep_shorts", label: "Cắt Shorts từ video dài", children: [] },
      { id: "rep_blog", label: "Chuyển thành Blog post", children: [] },
      { id: "rep_twitter", label: "Thread Twitter / X", children: [] },
      { id: "rep_tiktok", label: "TikTok cross-post", children: [] },
      { id: "rep_podcast", label: "Audio → Podcast feed", children: [] },
      { id: "rep_newsletter", label: "Newsletter / Email", children: [] },
      { id: "rep_linkedin", label: "LinkedIn articles", children: [] },
      { id: "rep_reel", label: "Instagram Reels", children: [] },
    ],
  },
];

// ─── HELPERS ────────────────────────────────────────────────────────────────
async function storageGet(key) {
  try {
    if (window.storage) {
      const r = await window.storage.get(key);
      return r ? JSON.parse(r.value) : null;
    }
  } catch {}
  return null;
}
async function storageSet(key, val) {
  try {
    if (window.storage) await window.storage.set(key, JSON.stringify(val));
  } catch {}
}

const flattenSelections = (selections) => {
  const result = [];
  for (const [catId, chosen] of Object.entries(selections)) {
    if (!chosen || chosen.size === 0) continue;
    const cat = SUGGESTION_TREE.find(c => c.id === catId);
    if (!cat) continue;
    const items = [];
    for (const itemId of chosen) {
      let found = null;
      for (const child of cat.children) {
        if (child.id === itemId) { found = child.label; break; }
        if (child.children) {
          const sub = child.children.find(s => s.id === itemId);
          if (sub) { found = `${child.label} → ${sub.label}`; break; }
        }
      }
      if (found) items.push(found);
    }
    if (items.length) result.push({ category: `${cat.icon} ${cat.label}`, items });
  }
  return result;
};

// ─── STYLES ─────────────────────────────────────────────────────────────────
const FONT = "'Plus Jakarta Sans', 'DM Sans', system-ui, sans-serif";

const S = {
  root: {
    fontFamily: FONT,
    maxWidth: 900,
    margin: "0 auto",
    padding: "20px 16px 60px",
    background: "#fafaf9",
    minHeight: "100vh",
  },
  topbar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 24, paddingBottom: 16,
    borderBottom: "2px solid #e7e5e4",
  },
  logoBlock: { display: "flex", alignItems: "center", gap: 12 },
  logoIcon: {
    width: 38, height: 38, background: "#dc2626",
    borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 18, flexShrink: 0,
  },
  logoTitle: { fontSize: 16, fontWeight: 700, color: "#1c1917", letterSpacing: "-0.3px" },
  logoSub: { fontSize: 11, color: "#78716c", letterSpacing: "0.2px" },
  topActions: { display: "flex", gap: 8 },
  // section
  sectionCard: {
    background: "#fff",
    border: "1px solid #e7e5e4",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  sectionHeader: (color, bg, open) => ({
    display: "flex", alignItems: "center", gap: 10,
    padding: "13px 16px",
    background: open ? bg : "#fff",
    cursor: "pointer",
    userSelect: "none",
    transition: "background 0.15s",
    borderBottom: open ? `1px solid ${color}22` : "none",
  }),
  sectionIcon: (color, bg) => ({
    width: 32, height: 32, background: bg,
    borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 16, flexShrink: 0,
    border: `1px solid ${color}33`,
  }),
  sectionTitle: { fontSize: 13, fontWeight: 600, color: "#1c1917" },
  sectionDesc: { fontSize: 11, color: "#78716c" },
  sectionChevron: (open) => ({
    marginLeft: "auto", fontSize: 13, color: "#a8a29e",
    transform: open ? "rotate(90deg)" : "rotate(0deg)",
    transition: "transform 0.2s",
  }),
  selBadge: (color) => ({
    fontSize: 10, fontWeight: 700, padding: "2px 7px",
    background: color + "1a", color, borderRadius: 10, marginLeft: 6,
  }),
  sectionBody: { padding: "12px 16px 14px" },
  // category row
  catRow: {
    marginBottom: 14,
    padding: "10px 12px",
    background: "#f9f8f7",
    borderRadius: 8,
    border: "1px solid #e7e5e4",
  },
  catLabel: {
    fontSize: 12, fontWeight: 600, color: "#44403c",
    marginBottom: 7, display: "flex", alignItems: "center", gap: 5,
  },
  chipGrid: {
    display: "flex", flexWrap: "wrap", gap: 5,
  },
  chip: (selected, color, bg) => ({
    padding: "4px 10px", borderRadius: 6,
    fontSize: 12, cursor: "pointer",
    fontWeight: selected ? 600 : 400,
    border: `1px solid ${selected ? color : "#d6d3d1"}`,
    background: selected ? bg : "#fff",
    color: selected ? color : "#57534e",
    transition: "all 0.12s",
  }),
  subChipGrid: {
    display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6, paddingLeft: 10,
  },
  subChip: (selected, color) => ({
    padding: "3px 9px", borderRadius: 5,
    fontSize: 11, cursor: "pointer",
    fontWeight: selected ? 600 : 400,
    border: `1px solid ${selected ? color : "#e5e2de"}`,
    background: selected ? color + "12" : "#f5f5f4",
    color: selected ? color : "#78716c",
    transition: "all 0.12s",
  }),
  // free-form
  textarea: (h) => ({
    width: "100%", minHeight: h, resize: "vertical",
    padding: "10px 12px", borderRadius: 8,
    border: "1px solid #d6d3d1",
    fontSize: 13, fontFamily: FONT, color: "#1c1917",
    lineHeight: 1.65, outline: "none",
    background: "#fafaf9",
    boxSizing: "border-box",
  }),
  // buttons
  btn: (v = "default", sm = false) => ({
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: sm ? "5px 10px" : "7px 14px",
    borderRadius: 7, fontSize: sm ? 12 : 13,
    cursor: "pointer", fontWeight: 500, border: "1px solid",
    fontFamily: FONT,
    ...(v === "primary" ? { background: "#dc2626", color: "#fff", borderColor: "#dc2626" } : {}),
    ...(v === "default" ? { background: "#fff", color: "#44403c", borderColor: "#d6d3d1" } : {}),
    ...(v === "ghost"   ? { background: "transparent", color: "#78716c", borderColor: "transparent" } : {}),
    ...(v === "outline" ? { background: "#fff", color: "#dc2626", borderColor: "#fca5a5" } : {}),
    transition: "opacity 0.15s",
  }),
  label: { display: "block", fontSize: 12, fontWeight: 500, color: "#57534e", marginBottom: 5 },
  input: {
    width: "100%", padding: "8px 10px", borderRadius: 7,
    border: "1px solid #d6d3d1", fontSize: 13, fontFamily: FONT,
    color: "#1c1917", outline: "none", background: "#fafaf9",
    boxSizing: "border-box",
  },
  // summary sidebar panel
  summaryPanel: {
    position: "sticky", top: 16,
    background: "#fff", border: "1px solid #e7e5e4",
    borderRadius: 12, padding: "14px 16px",
    marginBottom: 16,
  },
  summaryTitle: { fontSize: 13, fontWeight: 700, color: "#1c1917", marginBottom: 10 },
  summaryItem: { marginBottom: 6 },
  summaryCat: { fontSize: 11, fontWeight: 600, color: "#44403c" },
  summarySub: { fontSize: 11, color: "#78716c", paddingLeft: 8, lineHeight: 1.6 },
  // toast
  toast: (v) => ({
    position: "fixed", bottom: 20, left: "50%",
    transform: "translateX(-50%)",
    background: "#1c1917", color: "#fafaf9",
    padding: "8px 18px", borderRadius: 8,
    fontSize: 13, zIndex: 999,
    opacity: v ? 1 : 0, transition: "opacity 0.25s",
    pointerEvents: "none", whiteSpace: "nowrap",
    fontFamily: FONT,
  }),
  fileImportArea: {
    border: "2px dashed #d6d3d1", borderRadius: 8,
    padding: "18px 14px", textAlign: "center",
    cursor: "pointer", color: "#a8a29e",
    fontSize: 12, transition: "border-color 0.15s",
  },
  mdPreview: {
    background: "#f9f8f7", border: "1px solid #e7e5e4",
    borderRadius: 8, padding: "10px 12px",
    fontSize: 12, color: "#44403c", lineHeight: 1.7,
    maxHeight: 160, overflowY: "auto",
    whiteSpace: "pre-wrap", marginTop: 8,
    fontFamily: "ui-monospace, monospace",
  },
};

// ─── TOAST HOOK ─────────────────────────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState("");
  const [vis, setVis] = useState(false);
  const t = useRef();
  const show = useCallback((m, d = 2400) => {
    setMsg(m); setVis(true);
    clearTimeout(t.current);
    t.current = setTimeout(() => setVis(false), d);
  }, []);
  return { msg, vis, show };
}

// ─── SECTION COMPONENT ───────────────────────────────────────────────────────
function SuggestionSection({ section, selections, onToggle }) {
  const [open, setOpen] = useState(false);
  const sel = selections[section.id] || new Set();
  const selCount = sel.size;
  const { color, bg } = section;

  return (
    <div style={S.sectionCard}>
      <div style={S.sectionHeader(color, bg, open)} onClick={() => setOpen(o => !o)}>
        <div style={S.sectionIcon(color, bg)}>{section.icon}</div>
        <div>
          <div style={S.sectionTitle}>
            {section.label}
            {selCount > 0 && <span style={S.selBadge(color)}>{selCount} chọn</span>}
          </div>
          <div style={S.sectionDesc}>{section.desc}</div>
        </div>
        <span style={S.sectionChevron(open)}>▶</span>
      </div>

      {open && (
        <div style={S.sectionBody}>
          {section.children.map(cat => {
            const hasChildren = cat.children && cat.children.length > 0;
            const isCatSelected = sel.has(cat.id);

            return (
              <div key={cat.id} style={S.catRow}>
                <div style={S.catLabel}>
                  <span
                    style={S.chip(isCatSelected, color, bg)}
                    onClick={() => onToggle(section.id, cat.id)}
                  >
                    {cat.label}
                  </span>
                </div>
                {hasChildren && (
                  <div style={S.subChipGrid}>
                    {cat.children.map(sub => (
                      <span
                        key={sub.id}
                        style={S.subChip(sel.has(sub.id), color)}
                        onClick={() => onToggle(section.id, sub.id)}
                      >
                        {sub.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SELECTION SUMMARY ───────────────────────────────────────────────────────
function SelectionSummary({ selections }) {
  const flat = flattenSelections(selections);
  const total = flat.reduce((s, c) => s + c.items.length, 0);
  if (total === 0) return null;

  return (
    <div style={S.summaryPanel}>
      <div style={S.summaryTitle}>✅ Lựa chọn hiện tại ({total})</div>
      {flat.map(cat => (
        <div key={cat.category} style={S.summaryItem}>
          <div style={S.summaryCat}>{cat.category}</div>
          <div style={S.summarySub}>{cat.items.join(" · ")}</div>
        </div>
      ))}
    </div>
  );
}

// ─── MODEL DEFINITIONS (NeuroForge) ─────────────────────────────────────────
// Color palette để gán cho model mới phát hiện qua web_search
const MODEL_COLORS = ["#d97706", "#2563eb", "#7c3aed", "#0891b2", "#16a34a", "#dc2626", "#c026d3", "#0284c7"];

// Suy ra model có hỗ trợ Extended Thinking dựa trên ID
// Claude.md mục 5: model đời 4.6+ có adaptive thinking. Haiku 4.5 và đời cũ thì không.
function inferThinkingSupport(id) {
  if (!id) return false;
  const lower = id.toLowerCase();
  // Haiku 4.5 (và Haiku đời cũ) — không thinking
  if (lower.includes("haiku")) return false;
  // Match đời 4.6, 4.7, 4.8, 5.x, 6.x... → có thinking
  // Sonnet 4.6 / Opus 4.6 / Opus 4.7 / Opus 4.8 → true
  const match = lower.match(/-(\d+)-(\d+)/);
  if (match) {
    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);
    if (major > 4) return true;
    if (major === 4 && minor >= 6) return true;
    return false;
  }
  // Default: assume true (model mới chưa biết → ưu tiên bật tính năng)
  return true;
}

const DEFAULT_MODELS = [
  {
    id: "claude-haiku-4-5-20251001",
    label: "Haiku 4.5",
    badge: "Nhanh",
    desc: "Nhanh · tiết kiệm token · phù hợp thử nghiệm",
    color: "#d97706",
    thinking: false,
  },
  {
    id: "claude-sonnet-4-6",
    label: "Sonnet 4.6",
    badge: "Khuyên dùng",
    desc: "Cân bằng chất lượng & tốc độ · có Extended Thinking",
    color: "#2563eb",
    thinking: true,
  },
  {
    id: "claude-opus-4-6",
    label: "Opus 4.6",
    badge: "Mạnh nhất",
    desc: "Phân tích sâu nhất · có Extended Thinking",
    color: "#7c3aed",
    thinking: true,
  },
];

const EFFORT_LEVELS = [
  { id: "low",    label: "Low",    isDefault: true,  tok: "~1K",  budget: 1024  },
  { id: "medium", label: "Medium", isDefault: false, tok: "~5K",  budget: 5000  },
  { id: "high",   label: "High",   isDefault: false, tok: "~10K", budget: 10000 },
  { id: "max",    label: "Max",    isDefault: false, tok: "~16K", budget: 16000 },
];

// ─── CLAUDE API — chuẩn Claude.md (effort + adaptive thinking) ──────────────
// Tham chiếu: Claude.md mục 3, 4, 5.
// - Effort qua `output_config.effort`, KHÔNG qua budget_tokens.
// - Thinking adaptive: chỉ `{ type: "enabled" }`, KHÔNG budget_tokens, KHÔNG temperature.
// - Bắt buộc header `anthropic-beta: effort-2025-11-24`.
async function callClaude(system, user, onChunk, cfg = {}) {
  const {
    model        = "claude-sonnet-4-6",
    maxTokens    = 16000,
    thinkingOn   = false,
    effortBudget = 5000,    // legacy field — chỉ dùng để suy ra effort string bên dưới
    effort,                 // ưu tiên nếu caller truyền thẳng "low"|"medium"|"high"|"max"
  } = cfg;

  // Map budget cũ → effort string (giữ tương thích với UI hiện tại)
  const effortFromBudget = (b) => {
    if (b <= 1500)  return "low";
    if (b <= 6000)  return "medium";
    if (b <= 11000) return "high";
    return "max";
  };
  let effortLevel = effort || effortFromBudget(effortBudget);

  // API chính thức hiện chỉ nhận low/medium/high (max chưa mở — xem CHANGELOG Claude Code).
  // Clamp ở tầng API để UI vẫn giữ "Max". Khi Anthropic mở max, XOÁ đúng dòng dưới là xong.
  if (effortLevel === "max") effortLevel = "high";

  const body = {
    model,
    max_tokens: maxTokens,
    stream: true,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { effort: effortLevel },
  };
  if (thinkingOn) {
    // Model 4.6+ dùng adaptive thinking (KHÔNG "enabled", KHÔNG budget_tokens, KHÔNG temperature).
    // Nguồn: plugins/security-guidance/hooks/llm.py — mirror Claude Code chính thức.
    // Gửi "enabled" cho 4.6+ trả 400 "thinking.type.enabled is not supported".
    body.thinking = { type: "adaptive" };
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-beta": "effort-2025-11-24",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err.slice(0, 200)}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value).split("\n")) {
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (d === "[DONE]") continue;
      try {
        const j = JSON.parse(d);
        // CHỈ lấy text_delta — bỏ thinking_delta để không lẫn nội dung suy nghĩ vào output
        if (j?.delta?.type === "text_delta") {
          const delta = j.delta.text || "";
          if (delta) { full += delta; onChunk(full); }
        }
      } catch {}
    }
  }
  return full;
}


// ─── CLAUDE API + WEB SEARCH (non-stream) — Claude.md mục 7 ─────────────────
// Dùng cho tính năng "Cập nhật Model" — Claude tự web_search docs.anthropic.com
// rồi trả về JSON danh sách model hiện hành.
async function callClaudeWithSearch(system, user, cfg = {}) {
  const {
    model  = "claude-sonnet-4-6",
    effort = "medium",
    maxTokens = 8000,
  } = cfg;

  const body = {
    model,
    max_tokens: maxTokens,
    stream: false,  // Claude.md mục 7: web_search nên gọi non-stream
    system,
    messages: [{ role: "user", content: user }],
    output_config: { effort },
    tools: [{ type: "web_search_20250305", name: "web_search" }],
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-beta": "effort-2025-11-24",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();

  // Claude.md mục 7: gom text từ các block type === "text" (không dựa vị trí)
  const textParts = (data.content || [])
    .filter(b => b.type === "text")
    .map(b => b.text || "")
    .join("\n");

  // Đếm số web_search calls để báo cáo
  const searchCount = (data.content || []).filter(b => b.type === "server_tool_use").length;

  return { text: textParts, raw: data, searchCount };
}

// ─── runUpdateModels — gọi Claude+search, parse JSON, merge với palette ────
async function runUpdateModels({ model, effort, onLog, onSuccess, onError }) {
  const system = `Bạn là trợ lý cập nhật danh sách model API Anthropic Claude.
Hãy dùng web_search để tra cứu trang chính thức https://platform.claude.com/docs/en/about-claude/models/overview
và liệt kê các model Claude hiện đang khả dụng qua API (Haiku, Sonnet, Opus đời mới nhất).

QUAN TRỌNG: Chỉ trả về DUY NHẤT một JSON array hợp lệ, KHÔNG markdown, KHÔNG \`\`\`json, KHÔNG preamble.
Mỗi phần tử có cấu trúc chính xác:
{
  "id": "model-api-id-chính-thức",
  "label": "Tên hiển thị ngắn (vd: 'Opus 4.8')",
  "badge": "Nhãn ngắn 1-2 từ (vd: 'Mạnh nhất' / 'Khuyên dùng' / 'Nhanh')",
  "desc": "Mô tả 1 dòng tiếng Việt về điểm mạnh"
}

Sắp xếp từ nhẹ → nặng (Haiku → Sonnet → Opus). Chỉ kê các model đang available trên API.`;

  const user = `Tra cứu và liệt kê toàn bộ model Claude API hiện tại (2025-2026) từ docs Anthropic. Chỉ trả JSON array.`;

  try {
    onLog && onLog("🔍 Đang tra cứu docs Anthropic...");
    const { text, searchCount } = await callClaudeWithSearch(system, user, {
      model, effort, maxTokens: 8000,
    });
    onLog && onLog(`✓ Đã web_search ${searchCount} lần. Đang parse JSON...`);

    // Trích JSON array từ text (có thể có ký tự thừa quanh)
    let clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    // Trim đến `[` đầu và `]` cuối nếu có text rác
    const firstBracket = clean.indexOf("[");
    const lastBracket  = clean.lastIndexOf("]");
    if (firstBracket >= 0 && lastBracket > firstBracket) {
      clean = clean.slice(firstBracket, lastBracket + 1);
    }
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Response không phải JSON array hợp lệ");
    }

    // Bồi đắp metadata UI (màu sắc + thinking flag)
    const enriched = parsed.map((m, i) => ({
      id:       String(m.id || "").trim(),
      label:    String(m.label || m.id || `Model ${i+1}`).trim(),
      badge:    String(m.badge || "").trim() || "Model",
      desc:     String(m.desc || "").trim() || "Model Claude API",
      color:    MODEL_COLORS[i % MODEL_COLORS.length],
      thinking: typeof m.supports_thinking === "boolean"
        ? m.supports_thinking
        : inferThinkingSupport(m.id),
    })).filter(m => m.id.length > 0);

    if (enriched.length === 0) throw new Error("Không có model hợp lệ sau khi parse");

    onLog && onLog(`✅ Đã cập nhật ${enriched.length} model.`);
    onSuccess && onSuccess(enriched);
    return enriched;
  } catch (err) {
    onLog && onLog(`❌ Lỗi: ${err.message}`);
    onError && onError(err);
    throw err;
  }
}


// ─── MODEL SELECTOR SUB-COMPONENT ───────────────────────────────────────────
function ModelSelector({ models, modelId, onModel, thinkingOn, onThinking, effortId, onEffort, onUpdateModels, updatingModels, updateLog }) {
  const [effortOpen, setEffortOpen] = useState(false);
  const cur        = models.find(m => m.id === modelId) || models[Math.min(1, models.length - 1)] || models[0];
  const supportsThinking = cur?.thinking || false;
  const curEffort  = EFFORT_LEVELS.find(e => e.id === effortId) || EFFORT_LEVELS[2];

  return (
    <div style={{ borderBottom: "1px solid #f0eeec", background: "#fafaf9" }}>

      {/* ── Model list ── */}
      <div style={{ padding: "10px 14px 6px", borderBottom: "1px solid #f0eeec" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 6,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#a8a29e", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: FONT }}>
            Model ({models.length})
          </div>
          <button
            onClick={onUpdateModels}
            disabled={updatingModels}
            title="Cập nhật danh sách model qua web_search"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 9px", borderRadius: 6,
              fontSize: 11, fontFamily: FONT,
              border: "1px solid #d6d3d1",
              background: updatingModels ? "#fafaf9" : "#fff",
              color: updatingModels ? "#a8a29e" : "#44403c",
              cursor: updatingModels ? "not-allowed" : "pointer",
              fontWeight: 500,
              transition: "all 0.12s",
            }}
          >
            {updatingModels ? (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{
                  animation: "spin 1s linear infinite",
                }}>
                  <circle cx="12" cy="12" r="10" stroke="#a8a29e" strokeWidth="3" strokeDasharray="32" strokeLinecap="round"/>
                </svg>
                Đang cập nhật...
              </>
            ) : (
              <>🔄 Cập nhật</>
            )}
          </button>
        </div>
        {/* Spinner keyframes */}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {/* Update log (collapsible) */}
        {updateLog && (
          <div style={{
            margin: "0 0 6px",
            padding: "6px 10px", borderRadius: 6,
            background: updateLog.startsWith("❌") ? "#fff1f2" : updateLog.startsWith("✅") ? "#f0fdf4" : "#f0f9ff",
            border: `1px solid ${updateLog.startsWith("❌") ? "#fecaca" : updateLog.startsWith("✅") ? "#bbf7d0" : "#bae6fd"}`,
            color: updateLog.startsWith("❌") ? "#b91c1c" : updateLog.startsWith("✅") ? "#15803d" : "#0c4a6e",
            fontSize: 11, fontFamily: FONT,
          }}>
            {updateLog}
          </div>
        )}

        {models.map(m => {
          const active = modelId === m.id;
          return (
            <div
              key={m.id}
              onClick={() => { onModel(m.id); if (!m.thinking && thinkingOn) onThinking(false); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 10px", borderRadius: 8, marginBottom: 2,
                cursor: "pointer", userSelect: "none",
                background: active ? "#fff" : "transparent",
                border: active ? `1px solid ${m.color}30` : "1px solid transparent",
                transition: "all 0.12s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Color dot */}
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? m.color : "#1c1917", fontFamily: FONT, display: "flex", alignItems: "center", gap: 6 }}>
                    {m.label}
                    {m.badge && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "1px 5px",
                        borderRadius: 4, background: active ? m.color : "#e7e5e4",
                        color: active ? "#fff" : "#78716c",
                      }}>{m.badge}</span>
                    )}
                    {m.thinking && (
                      <span style={{ fontSize: 9, color: "#7c3aed" }} title="Hỗ trợ Extended Thinking">💭</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#78716c", fontFamily: FONT }}>{m.desc}</div>
                </div>
              </div>
              {/* Checkmark if active */}
              {active && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8L6.5 11.5L13 4.5" stroke={m.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Effort row ── */}
      <div style={{ position: "relative" }}>
        <div
          onClick={() => setEffortOpen(o => !o)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "11px 16px", cursor: "pointer", userSelect: "none",
            borderBottom: effortOpen ? "1px solid #f0eeec" : "none",
            background: effortOpen ? "#fff" : "transparent",
            transition: "background 0.12s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#1c1917", fontFamily: FONT }}>Effort</span>
            {!effortOpen && (
              <span style={{ fontSize: 12, color: "#a8a29e", fontFamily: FONT }}>
                mức độ kỹ lưỡng khi suy luận
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: cur.color, fontFamily: FONT }}>{curEffort.label}</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: effortOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
              <path d="M5 3L9 7L5 11" stroke="#a8a29e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Effort dropdown */}
        {effortOpen && (
          <div style={{ background: "#fff", paddingBottom: 6 }}>
            <div style={{ padding: "8px 16px 4px", fontSize: 11, color: "#78716c", fontFamily: FONT }}>
              Effort cao hơn cho kết quả kỹ lưỡng hơn, nhưng chậm hơn và tốn quota nhanh hơn.
            </div>
            {EFFORT_LEVELS.map(e => {
              const active = effortId === e.id;
              return (
                <div
                  key={e.id}
                  onClick={() => { onEffort(e.id); setEffortOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "9px 16px", cursor: "pointer",
                    background: active ? cur.color + "08" : "transparent",
                    transition: "background 0.1s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? "#1c1917" : "#44403c", fontFamily: FONT }}>
                      {e.label}
                    </span>
                    {e.isDefault && (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#e7e5e4", color: "#78716c", fontFamily: FONT }}>
                        Default
                      </span>
                    )}
                    {e.id === "max" && (
                      <span
                        title="API hiện chưa mở mức Max — sẽ tự chạy ở mức High. Khi Anthropic kích hoạt, không cần đổi gì."
                        style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontFamily: FONT }}
                      >
                        ⚠ chạy như High
                      </span>
                    )}
                  </div>
                  {active && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8L6.5 11.5L13 4.5" stroke={cur.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Thinking toggle row ── */}
      <div
        onClick={() => supportsThinking && onThinking(!thinkingOn)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px 16px",
          cursor: supportsThinking ? "pointer" : "not-allowed",
          opacity: supportsThinking ? 1 : 0.45,
          userSelect: "none",
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#1c1917", fontFamily: FONT }}>Thinking</div>
          <div style={{ fontSize: 11, color: "#78716c", fontFamily: FONT }}>
            {supportsThinking ? "Can think for more complex tasks" : "Not available for this model"}
          </div>
        </div>
        {/* Toggle switch — same shape as Claude.ai */}
        <div style={{
          width: 44, height: 24, borderRadius: 12, flexShrink: 0,
          background: thinkingOn && supportsThinking ? cur.color : "#d6d3d1",
          position: "relative", transition: "background 0.2s",
        }}>
          <div style={{
            position: "absolute", top: 3, width: 18, height: 18,
            borderRadius: "50%", background: "#fff",
            left: thinkingOn && supportsThinking ? 23 : 3,
            transition: "left 0.2s",
            boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
          }} />
        </div>
      </div>

    </div>
  );
}


// ─── GENERATE SECTION COMPONENT ─────────────────────────────────────────────
function GenerateSection({
  totalSelected, freeformIdea, mdFileName,
  buildContextForAI, blueprint, onBlueprint,
  generating, onGenerating,
  updateLog, onUpdateLog, updating, onUpdating,
  onSuggestionsUpdate, onToast,
  // Model state — lifted to App
  models, modelId, onModelId,
  thinkingOn, onThinkingOn, effortId, onEffortId,
  onUpdateModels, updatingModels, modelsUpdateLog,
}) {
  const [genError, setGenError]       = useState("");
  const [updateError, setUpdateError] = useState("");
  const [rawStream, setRawStream]     = useState("");

  const curModel  = models.find(m => m.id === modelId) || models[Math.min(1, models.length - 1)] || models[0];
  const curEffort = EFFORT_LEVELS.find(e => e.id === effortId) || EFFORT_LEVELS[1];
  const canGenerate = totalSelected > 0 || freeformIdea.trim().length > 20;

  // ── Generate Blueprint ──
  const generate = async () => {
    if (!canGenerate) return;
    setGenError(""); onGenerating(true); onBlueprint(null); setRawStream("");

    const context = buildContextForAI();
    const system = `Bạn là chuyên gia tư vấn xây dựng kênh YouTube chuyên nghiệp.
Nhiệm vụ: phân tích input của user và tạo một Channel Blueprint chi tiết.
QUAN TRỌNG: Chỉ trả về một JSON object hợp lệ, KHÔNG có markdown, KHÔNG có \`\`\`json, KHÔNG có preamble.
JSON phải có đúng cấu trúc sau (tất cả trường bằng tiếng Việt trừ keys):
{
  "channel_name_suggestions": ["Tên 1", "Tên 2", "Tên 3"],
  "tagline": "Tagline ngắn gọn",
  "core_concept": "Mô tả concept cốt lõi 2-3 câu",
  "target_audience": "Mô tả audience cụ thể",
  "content_pillars": [
    {"title": "Trụ cột 1", "description": "Mô tả", "example_topics": ["topic 1", "topic 2", "topic 3"]}
  ],
  "upload_schedule": {"frequency": "X video/tuần", "best_days": ["Thứ Ba", "Thứ Năm"], "best_time": "19:00-21:00"},
  "production_setup": {"style": "mô tả style", "tools": ["tool 1", "tool 2"], "estimated_time_per_video": "X giờ"},
  "monetization_roadmap": [
    {"phase": "Phase 1 (0-1K subs)", "strategy": "mô tả", "revenue_potential": "X-Y USD/tháng"}
  ],
  "growth_strategy": {"hook_formula": "công thức hook", "thumbnail_style": "mô tả thumbnail", "seo_approach": "chiến lược SEO", "collaboration_targets": ["đối tượng collab"]},
  "first_10_video_ideas": ["Ý tưởng 1", "Ý tưởng 2", "..."],
  "competitive_advantages": ["Lợi thế 1", "Lợi thế 2"],
  "risks_and_mitigation": [{"risk": "rủi ro", "mitigation": "giải pháp"}],
  "success_metrics": {"month_3": "mục tiêu 3 tháng", "month_6": "mục tiêu 6 tháng", "year_1": "mục tiêu 1 năm"}
}

# QUY TẮC VĂN PHONG TIẾNG VIỆT (áp cho MỌI text trong JSON: channel_name, tagline, title pillar, example_topics, first_10_video_ideas...)
- Viết hoa: CHỈ chữ cái đầu cụm + tên riêng. TUYỆT ĐỐI KHÔNG Title Case kiểu tiếng Anh.
  SAI: "AI Tools Review — Dùng Hay Bỏ?"  →  ĐÚNG: "Review công cụ AI - Dùng hay bỏ?"
  SAI: "Tutorial Thực Chiến — Làm Từng Bước"  →  ĐÚNG: "Hướng dẫn thực chiến - Làm từng bước"
- CẤM dấu gạch dài em-dash "—". Dùng gạch ngang "-" có dấu cách hai bên.
- Hạn chế dấu hai chấm ":" trong tiêu đề/tên pillar; nếu cần phân tách dùng " - ".
- Giữ thuật ngữ phổ biến (AI, SEO, CEO, KPI, ChatGPT...) nguyên dạng, không dịch máy móc.`;

    const user = `Đây là thông tin từ user:\n\n${context}\n\nHãy tạo Channel Blueprint hoàn chỉnh dựa trên thông tin này. Chỉ trả về JSON.`;

    const cfg = {
      model: modelId,
      maxTokens: 16000,        // luôn đặt đủ lớn — output_config.effort mới điều khiển chất lượng
      thinkingOn,
      effortBudget: curEffort.budget,  // dùng để map → effort string trong callClaude
    };

    try {
      let raw = "";
      await callClaude(system, user, (text) => { raw = text; setRawStream(text); }, cfg);
      const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(clean);
      onBlueprint(parsed);
      onToast(`Blueprint tạo xong bằng ${curModel.label} ✓`);
    } catch (err) {
      setGenError("Lỗi: " + err.message + ". Raw: " + rawStream.slice(0, 120));
    } finally {
      onGenerating(false);
    }
  };

  // ── Update xu hướng + model mới ──
  const update = async () => {
    setUpdateError(""); onUpdating(true); onUpdateLog("");
    const system = `Bạn là chuyên gia YouTube & AI ecosystem năm 2025-2026.
Nhiệm vụ: Cập nhật xu hướng mới nhất và đặc biệt liệt kê các model AI mới có thể dùng để phân tích/tạo nội dung YouTube.
Trả về JSON object (KHÔNG markdown, KHÔNG preamble):
{
  "new_ai_tools": [{"name": "tên tool", "category": "voice|video|edit|script|image|music", "description": "mô tả ngắn"}],
  "new_claude_models": [{"id": "model-api-id", "label": "Tên hiển thị", "badge": "badge ngắn", "desc": "mô tả 1 dòng", "supports_thinking": true}],
  "trending_niches": ["niche 1", "niche 2", "niche 3"],
  "platform_changes": ["thay đổi YouTube quan trọng 1", "2", "3"],
  "new_formats": ["format mới 1", "2"],
  "notes": "ghi chú tổng hợp"
}`;
    const user = `Cập nhật toàn bộ ecosystem YouTube & Claude AI năm 2025-2026. Đặc biệt chú ý các model Claude mới nhất (Opus 4, Sonnet 4, Haiku 4, có model nào mới hơn không?). Chỉ trả về JSON.`;
    try {
      let raw = "";
      await callClaude(system, user, (text) => { raw = text; onUpdateLog(text); }, {
        model: modelId, maxTokens: 8000, thinkingOn: false,
      });
      const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(clean);
      onSuggestionsUpdate(parsed);
      onToast("Đã cập nhật xu hướng mới ✓");
    } catch (err) {
      setUpdateError("Lỗi: " + err.message);
    } finally {
      onUpdating(false);
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Stats row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          { label: "Lựa chọn",  value: totalSelected, ok: totalSelected > 0 },
          { label: "Ý tưởng",   value: freeformIdea.trim().length + " ký tự", ok: freeformIdea.trim().length > 20 },
          { label: "Tài liệu",  value: mdFileName || "Chưa có", ok: !!mdFileName },
        ].map(item => (
          <div key={item.label} style={{
            flex: 1, minWidth: 100,
            background: item.ok ? "#f0fdf4" : "#f9f8f7",
            border: `1px solid ${item.ok ? "#bbf7d0" : "#e7e5e4"}`,
            borderRadius: 8, padding: "8px 12px",
          }}>
            <div style={{ fontSize: 10, color: "#78716c", fontFamily: FONT }}>{item.label}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: item.ok ? "#15803d" : "#44403c", fontFamily: FONT }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Main generate card */}
      <div style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 12, overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${curModel.color} 0%, ${curModel.color}cc 100%)`,
          padding: "14px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          transition: "background 0.3s",
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>✨ Tạo Channel Blueprint</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
              {curModel.label}{thinkingOn ? ` · Thinking ${curEffort.label}` : ""} · Claude sẽ phân tích và tạo bộ khung kênh hoàn chỉnh
            </div>
          </div>
          <button
            onClick={generate}
            disabled={generating || !canGenerate}
            style={{
              padding: "9px 18px", borderRadius: 8, fontSize: 13,
              fontWeight: 700, border: "none", fontFamily: FONT,
              background: canGenerate && !generating ? "#fff" : "rgba(255,255,255,0.3)",
              color: canGenerate && !generating ? curModel.color : "#fff",
              cursor: canGenerate && !generating ? "pointer" : "not-allowed",
              opacity: generating ? 0.75 : 1,
              transition: "all 0.15s",
            }}
          >
            {generating ? "⏳ Đang tạo..." : "🚀 Tạo Blueprint"}
          </button>
        </div>

        {/* NeuroForge Model Selector */}
        <ModelSelector
          models={models}
          modelId={modelId}        onModel={onModelId}
          thinkingOn={thinkingOn}  onThinking={onThinkingOn}
          effortId={effortId}      onEffort={onEffortId}
          onUpdateModels={onUpdateModels}
          updatingModels={updatingModels}
          updateLog={modelsUpdateLog}
        />

        {/* Streaming preview */}
        {generating && rawStream && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0eeec" }}>
            <div style={{ fontSize: 11, color: "#78716c", marginBottom: 4, fontFamily: FONT }}>
              ⚡ Stream từ {curModel.label}{thinkingOn ? " (thinking...)" : ""}
            </div>
            <div style={{
              background: "#f9f8f7", borderRadius: 6, padding: "8px 10px",
              fontFamily: "ui-monospace, monospace", fontSize: 11,
              color: "#44403c", maxHeight: 100, overflowY: "auto",
              whiteSpace: "pre-wrap",
            }}>
              {rawStream.slice(-400)}
            </div>
          </div>
        )}

        {!canGenerate && (
          <div style={{ padding: "10px 16px", fontSize: 12, color: "#b45309", background: "#fefce8", fontFamily: FONT }}>
            ⚠️ Hãy chọn ít nhất 1 danh mục hoặc viết ý tưởng tự do (tối thiểu 20 ký tự) để bắt đầu.
          </div>
        )}
        {genError && (
          <div style={{ padding: "10px 16px", fontSize: 12, color: "#dc2626", background: "#fff1f2", fontFamily: FONT }}>
            {genError}
          </div>
        )}

        {/* Update row */}
        <div style={{
          padding: "12px 16px", borderTop: "1px solid #f0eeec",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
        }}>
          <div style={{ fontSize: 11, color: "#78716c", fontFamily: FONT }}>
            🔄 Cập nhật xu hướng YouTube, AI tools & model mới vào hệ thống
          </div>
          <button
            onClick={update}
            disabled={updating}
            style={{
              ...S.btn("default", true),
              opacity: updating ? 0.6 : 1,
              cursor: updating ? "not-allowed" : "pointer",
            }}
          >
            {updating ? "⏳ Đang cập nhật..." : "🔄 Update xu hướng"}
          </button>
        </div>

        {/* Update log + model suggestions */}
        {updateLog && (
          <div style={{ padding: "0 16px 12px" }}>
            <div style={{ fontSize: 11, color: "#78716c", marginBottom: 4, fontFamily: FONT }}>📡 Update log:</div>
            <div style={{
              background: "#f0f9ff", border: "1px solid #bae6fd",
              borderRadius: 6, padding: "8px 10px",
              fontFamily: "ui-monospace, monospace", fontSize: 11,
              color: "#0c4a6e", maxHeight: 140, overflowY: "auto",
              whiteSpace: "pre-wrap",
            }}>
              {updateLog}
            </div>
            {updateError && (
              <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4, fontFamily: FONT }}>{updateError}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}



// ─── EXPORT BLUEPRINT JSON ──────────────────────────────────────────────────
function exportBlueprint(blueprint, name) {
  try {
    const blob = new Blob([JSON.stringify(blueprint, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = (name || "channel") + "_blueprint_" + Date.now() + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (err) {
    console.error("exportBlueprint error:", err);
  }
}

// ─── BLUEPRINT RESULT COMPONENT ─────────────────────────────────────────────
function BlueprintResult({ blueprint: bp, onExport, onClear }) {
  const [tab, setTab] = useState("overview");

  const TABS = [
    { id: "overview",    label: "🏠 Tổng quan" },
    { id: "content",     label: "📋 Nội dung" },
    { id: "monetize",    label: "💰 Doanh thu" },
    { id: "growth",      label: "📈 Tăng trưởng" },
    { id: "ideas",       label: "💡 Ý tưởng" },
  ];

  const Card = ({ title, children }) => (
    <div style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 10, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#44403c", marginBottom: 10, fontFamily: FONT }}>{title}</div>
      {children}
    </div>
  );

  const Tag = ({ text, color = "#dc2626" }) => (
    <span style={{
      fontSize: 11, padding: "3px 9px", borderRadius: 5,
      background: color + "12", color, border: `1px solid ${color}30`,
      fontFamily: FONT, display: "inline-block", marginRight: 4, marginBottom: 4,
    }}>{text}</span>
  );

  const renderOverview = () => (
    <div>
      <Card title="🏷 Tên kênh gợi ý">
        {(bp.channel_name_suggestions || []).map((name, i) => (
          <div key={i} style={{ fontSize: 14, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? "#dc2626" : "#44403c", padding: "4px 0", fontFamily: FONT }}>
            {i === 0 ? "⭐ " : `${i + 1}. `}{name}
          </div>
        ))}
      </Card>
      <Card title="✍️ Tagline">
        <div style={{ fontSize: 14, fontStyle: "italic", color: "#44403c", fontFamily: FONT }}>{bp.tagline}</div>
      </Card>
      <Card title="🎯 Concept cốt lõi">
        <div style={{ fontSize: 13, color: "#44403c", lineHeight: 1.65, fontFamily: FONT }}>{bp.core_concept}</div>
      </Card>
      <Card title="👥 Target Audience">
        <div style={{ fontSize: 13, color: "#44403c", lineHeight: 1.65, fontFamily: FONT }}>{bp.target_audience}</div>
      </Card>
      {bp.competitive_advantages && (
        <Card title="💪 Lợi thế cạnh tranh">
          {bp.competitive_advantages.map((a, i) => (
            <div key={i} style={{ fontSize: 12, color: "#44403c", padding: "3px 0", fontFamily: FONT }}>✓ {a}</div>
          ))}
        </Card>
      )}
    </div>
  );

  const renderContent = () => (
    <div>
      {(bp.content_pillars || []).map((pillar, i) => (
        <Card key={i} title={`📌 Trụ cột ${i + 1}: ${pillar.title}`}>
          <div style={{ fontSize: 12, color: "#57534e", marginBottom: 8, fontFamily: FONT }}>{pillar.description}</div>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {(pillar.example_topics || []).map((t, j) => <Tag key={j} text={t} color="#7c3aed" />)}
          </div>
        </Card>
      ))}
      {bp.upload_schedule && (
        <Card title="📅 Lịch đăng">
          <div style={{ fontSize: 13, fontFamily: FONT }}>
            <div style={{ marginBottom: 4 }}><strong>Tần suất:</strong> {bp.upload_schedule.frequency}</div>
            <div style={{ marginBottom: 4 }}><strong>Ngày tốt nhất:</strong> {(bp.upload_schedule.best_days || []).join(", ")}</div>
            <div><strong>Khung giờ:</strong> {bp.upload_schedule.best_time}</div>
          </div>
        </Card>
      )}
      {bp.production_setup && (
        <Card title="🎬 Setup sản xuất">
          <div style={{ fontSize: 13, fontFamily: FONT, marginBottom: 6 }}>{bp.production_setup.style}</div>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {(bp.production_setup.tools || []).map((t, i) => <Tag key={i} text={t} color="#0284c7" />)}
          </div>
          {bp.production_setup.estimated_time_per_video && (
            <div style={{ fontSize: 12, color: "#78716c", marginTop: 6, fontFamily: FONT }}>
              ⏱ Thời gian ước tính: {bp.production_setup.estimated_time_per_video}
            </div>
          )}
        </Card>
      )}
    </div>
  );

  const renderMonetize = () => (
    <div>
      {(bp.monetization_roadmap || []).map((phase, i) => (
        <Card key={i} title={phase.phase}>
          <div style={{ fontSize: 13, color: "#44403c", lineHeight: 1.6, marginBottom: 6, fontFamily: FONT }}>{phase.strategy}</div>
          {phase.revenue_potential && (
            <div style={{ fontSize: 12, fontWeight: 600, color: "#059669", fontFamily: FONT }}>
              💵 {phase.revenue_potential}
            </div>
          )}
        </Card>
      ))}
      {bp.success_metrics && (
        <Card title="🎯 Mục tiêu tăng trưởng">
          {[
            ["📅 3 tháng", bp.success_metrics.month_3],
            ["📅 6 tháng", bp.success_metrics.month_6],
            ["📅 1 năm",   bp.success_metrics.year_1],
          ].map(([label, val]) => val && (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f0eeec", fontFamily: FONT }}>
              <span style={{ fontSize: 12, color: "#78716c" }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#44403c" }}>{val}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );

  const renderGrowth = () => (
    <div>
      {bp.growth_strategy && (
        <>
          <Card title="🎣 Hook Formula">
            <div style={{ fontSize: 13, color: "#44403c", fontFamily: FONT }}>{bp.growth_strategy.hook_formula}</div>
          </Card>
          <Card title="🖼 Thumbnail Style">
            <div style={{ fontSize: 13, color: "#44403c", fontFamily: FONT }}>{bp.growth_strategy.thumbnail_style}</div>
          </Card>
          <Card title="🔍 SEO Strategy">
            <div style={{ fontSize: 13, color: "#44403c", fontFamily: FONT }}>{bp.growth_strategy.seo_approach}</div>
          </Card>
          {bp.growth_strategy.collaboration_targets?.length > 0 && (
            <Card title="🤝 Collab targets">
              <div style={{ display: "flex", flexWrap: "wrap" }}>
                {bp.growth_strategy.collaboration_targets.map((t, i) => <Tag key={i} text={t} color="#059669" />)}
              </div>
            </Card>
          )}
        </>
      )}
      {bp.risks_and_mitigation && (
        <Card title="⚠️ Rủi ro & Giải pháp">
          {bp.risks_and_mitigation.map((r, i) => (
            <div key={i} style={{ marginBottom: 8, fontFamily: FONT }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#dc2626" }}>⚠ {r.risk}</div>
              <div style={{ fontSize: 12, color: "#44403c", paddingLeft: 10 }}>→ {r.mitigation}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );

  const renderIdeas = () => (
    <Card title="🎬 10 Ý tưởng video đầu tiên">
      {(bp.first_10_video_ideas || []).map((idea, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "flex-start", gap: 8,
          padding: "7px 0", borderBottom: i < (bp.first_10_video_ideas.length - 1) ? "1px solid #f0eeec" : "none",
          fontFamily: FONT,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", minWidth: 22 }}>#{i + 1}</span>
          <span style={{ fontSize: 13, color: "#44403c", lineHeight: 1.5 }}>{idea}</span>
        </div>
      ))}
    </Card>
  );

  return (
    <div style={{ marginTop: 16 }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1c1917 0%, #292524 100%)",
        borderRadius: 12, padding: "16px 18px", marginBottom: 12,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: FONT }}>
            ✅ Channel Blueprint
          </div>
          <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 2, fontFamily: FONT }}>
            {bp.channel_name_suggestions?.[0] || "Kênh của bạn"} · {bp.tagline || ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...S.btn("default", true), background: "#292524", borderColor: "#44403c", color: "#e7e5e4" }} onClick={onExport}>
            ⬇ Export JSON
          </button>
          <button style={{ ...S.btn("ghost", true), color: "#a8a29e" }} onClick={onClear}>
            × Đóng
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "#f3f2f1", borderRadius: 10, padding: 3, marginBottom: 12 }}>
        {TABS.map(t => (
          <button key={t.id} style={{
            flex: 1, padding: "6px 4px", borderRadius: 7,
            fontSize: 12, cursor: "pointer", border: "none",
            background: tab === t.id ? "#fff" : "transparent",
            color: tab === t.id ? "#1c1917" : "#78716c",
            fontWeight: tab === t.id ? 600 : 400,
            boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            fontFamily: FONT, transition: "all 0.15s", whiteSpace: "nowrap",
          }} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview"  && renderOverview()}
      {tab === "content"   && renderContent()}
      {tab === "monetize"  && renderMonetize()}
      {tab === "growth"    && renderGrowth()}
      {tab === "ideas"     && renderIdeas()}
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  // State
  const [freeformIdea, setFreeformIdea] = useState("");
  const [mdFileContent, setMdFileContent] = useState("");
  const [mdFileName, setMdFileName] = useState("");
  // selections: { [sectionId]: Set<itemId> }
  const [selections, setSelections] = useState(
    Object.fromEntries(SUGGESTION_TREE.map(s => [s.id, new Set()]))
  );
  const [loaded, setLoaded] = useState(false);
  const [checkpointName, setCheckpointName] = useState("blueprint_v1");
  const [blueprint, setBlueprint]   = useState(null);
  const [generating, setGenerating] = useState(false);
  const [updateLog, setUpdateLog]   = useState("");
  const [updating, setUpdating]     = useState(false);

  // ── Model state (lifted from GenerateSection) ──
  const [models,         setModels]         = useState(DEFAULT_MODELS);
  const [modelId,        setModelId]        = useState("claude-sonnet-4-6");
  const [thinkingOn,     setThinkingOn]     = useState(false);
  const [effortId,       setEffortId]       = useState("medium");
  const [updatingModels, setUpdatingModels] = useState(false);
  const [modelsUpdateLog, setModelsUpdateLog] = useState("");

  const toast = useToast();
  const mdFileRef = useRef();
  const cpImportRef = useRef();

  // ── Handler: Cập nhật danh sách model qua web_search ──
  const handleUpdateModels = useCallback(async () => {
    setUpdatingModels(true);
    setModelsUpdateLog("🔍 Đang tra cứu docs Anthropic...");
    try {
      await runUpdateModels({
        model: modelId,
        effort: "medium",
        onLog: (msg) => setModelsUpdateLog(msg),
        onSuccess: (newModels) => {
          setModels(newModels);
          // Nếu modelId hiện tại không còn trong list mới → chọn model thứ 2 (thường là Sonnet)
          if (!newModels.find(m => m.id === modelId)) {
            const fallback = newModels[Math.min(1, newModels.length - 1)] || newModels[0];
            if (fallback) setModelId(fallback.id);
          }
          toast.show(`Đã cập nhật ${newModels.length} model ✓`);
          // Tự ẩn log sau 5s
          setTimeout(() => setModelsUpdateLog(""), 5000);
        },
        onError: (err) => {
          toast.show("Cập nhật model thất bại");
        },
      });
    } finally {
      setUpdatingModels(false);
    }
  }, [modelId, toast]);

  // ── Load checkpoint from storage ──
  useEffect(() => {
    storageGet(STORAGE_KEY).then(data => {
      if (data) {
        if (data.freeformIdea)  setFreeformIdea(data.freeformIdea);
        if (data.mdFileContent) setMdFileContent(data.mdFileContent);
        if (data.mdFileName)    setMdFileName(data.mdFileName);
        if (data.checkpointName) setCheckpointName(data.checkpointName);
        if (data.blueprint)      setBlueprint(data.blueprint);
        if (Array.isArray(data.models) && data.models.length) setModels(data.models);
        if (data.modelId)        setModelId(data.modelId);
        if (typeof data.thinkingOn === "boolean") setThinkingOn(data.thinkingOn);
        if (data.effortId)       setEffortId(data.effortId);
        if (data.selections) {
          const restored = {};
          for (const [k, v] of Object.entries(data.selections)) {
            restored[k] = new Set(v);
          }
          setSelections(prev => ({ ...prev, ...restored }));
        }
      }
      setLoaded(true);
    });
  }, []);

  // ── Auto-save ──
  useEffect(() => {
    if (!loaded) return;
    const serialized = {};
    for (const [k, v] of Object.entries(selections)) {
      serialized[k] = Array.from(v);
    }
    storageSet(STORAGE_KEY, {
      freeformIdea, mdFileContent, mdFileName,
      selections: serialized, checkpointName,
      blueprint: blueprint || null,
      models, modelId, thinkingOn, effortId,
    });
  }, [loaded, freeformIdea, mdFileContent, mdFileName, selections, checkpointName, blueprint, models, modelId, thinkingOn, effortId]);

  // ── Handle suggestions update from Claude ──
  const handleSuggestionsUpdate = useCallback((parsed) => {
    // Store update result in storage for reference; UI shows toast
    storageSet("yt_update_log", { updated_at: new Date().toISOString(), data: parsed });
  }, []);
  const toggle = useCallback((sectionId, itemId) => {
    setSelections(prev => {
      const cur = new Set(prev[sectionId] || []);
      cur.has(itemId) ? cur.delete(itemId) : cur.add(itemId);
      return { ...prev, [sectionId]: cur };
    });
  }, []);

  const totalSelected = Object.values(selections).reduce((s, v) => s + v.size, 0);

  // ── Import MD file ──
  const handleMdImport = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    let loaded = 0;
    const results = new Array(files.length);
    files.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        results[i] = ev.target.result;
        loaded++;
        if (loaded === files.length) {
          const combined = results
            .map((txt, j) => `=== ${files[j].name} ===\n${txt}`)
            .join("\n\n");
          const label = files.length === 1
            ? files[0].name
            : `${files.length} files (${files.map(f => f.name).join(", ")})`;
          setMdFileContent(combined);
          setMdFileName(label);
          toast.show(`Import ${files.length > 1 ? `${files.length} files` : `"${files[0].name}"`} thành công`);
        }
      };
      reader.readAsText(file);
    });
    e.target.value = "";
  };

  // ── Export checkpoint JSON ──
  const exportCheckpoint = () => {
    const serialized = {};
    for (const [k, v] of Object.entries(selections)) {
      serialized[k] = Array.from(v);
    }
    const data = {
      version: "1.0",
      tool: "ChannelBlueprintBuilder",
      exported_at: new Date().toISOString(),
      freeformIdea,
      mdFileContent,
      mdFileName,
      selections: serialized,
      checkpointName,
      // bổ sung: blueprint đã generate + config model (handleCpImport vốn đã đọc các key này)
      blueprint,
      models,
      modelId,
      thinkingOn,
      effortId,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    try {
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = (checkpointName || "blueprint") + "_checkpoint_" + Date.now() + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error("exportCheckpoint error:", err);
    }
    toast.show("Checkpoint đã export ✓");
  };

  // ── Import checkpoint JSON ──
  const handleCpImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target.result);
        if (d.freeformIdea !== undefined) setFreeformIdea(d.freeformIdea);
        if (d.mdFileContent)  setMdFileContent(d.mdFileContent);
        if (d.mdFileName)     setMdFileName(d.mdFileName);
        if (d.checkpointName) setCheckpointName(d.checkpointName);
        if (d.blueprint)      setBlueprint(d.blueprint);
        if (Array.isArray(d.models) && d.models.length) setModels(d.models);
        if (d.modelId)        setModelId(d.modelId);
        if (typeof d.thinkingOn === "boolean") setThinkingOn(d.thinkingOn);
        if (d.effortId)       setEffortId(d.effortId);
        if (d.selections) {
          const restored = Object.fromEntries(
            SUGGESTION_TREE.map(s => [s.id, new Set()])
          );
          for (const [k, v] of Object.entries(d.selections)) {
            restored[k] = new Set(v);
          }
          setSelections(restored);
        }
        toast.show("Checkpoint đã import ✓");
      } catch {
        toast.show("Lỗi đọc file checkpoint JSON");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Clear all ──
  const clearAll = () => {
    if (!confirm("Xóa TẤT CẢ lựa chọn và nội dung? Không thể hoàn tác.")) return;
    setFreeformIdea("");
    setMdFileContent(""); setMdFileName("");
    setSelections(Object.fromEntries(SUGGESTION_TREE.map(s => [s.id, new Set()])));
    toast.show("Đã xóa tất cả");
  };

  // ── Build context summary string (for next module: Generate Blueprint) ──
  const buildContextForAI = () => {
    const flat = flattenSelections(selections);
    let ctx = "";
    if (freeformIdea.trim()) ctx += `=== Ý tưởng tự do ===\n${freeformIdea.trim()}\n\n`;
    if (mdFileContent)        ctx += `=== Tài liệu tham khảo (${mdFileName}) ===\n${mdFileContent.slice(0, 4000)}\n\n`;
    if (flat.length > 0) {
      ctx += "=== Lựa chọn định hướng ===\n";
      for (const cat of flat) {
        ctx += `${cat.category}:\n  ${cat.items.join(", ")}\n`;
      }
    }
    return ctx;
  };

  if (!loaded) {
    return (
      <div style={{ padding: 50, textAlign: "center", color: "#a8a29e", fontFamily: FONT }}>
        Đang tải...
      </div>
    );
  }

  return (
    <div style={S.root}>
      {/* ── Topbar ── */}
      <div style={S.topbar}>
        <div style={S.logoBlock}>
          <div style={S.logoIcon}>▶</div>
          <div>
            <div style={S.logoTitle}>Channel Blueprint Builder</div>
            <div style={S.logoSub}>YouTube Channel System · Tool 1 · Full</div>
          </div>
        </div>
        <div style={S.topActions}>
          <button style={S.btn("default", true)} onClick={() => cpImportRef.current?.click()}>
            ⬆ Import
          </button>
          <button style={S.btn("default", true)} onClick={exportCheckpoint}>
            ⬇ Export
          </button>
          <button style={{ ...S.btn("ghost", true), color: "#dc2626", fontSize: 12 }} onClick={clearAll}>
            🗑 Xóa
          </button>
        </div>
      </div>

      {/* ── Checkpoint Name ── */}
      <div style={{ ...S.sectionCard, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: "#78716c", whiteSpace: "nowrap" }}>Tên checkpoint:</span>
        <input
          style={{ ...S.input, flex: 1 }}
          value={checkpointName}
          placeholder="Đặt tên để dễ nhận biết khi import..."
          onChange={e => setCheckpointName(e.target.value)}
        />
        <span style={{ fontSize: 11, color: "#a8a29e", whiteSpace: "nowrap" }}>Auto-save ✓</span>
      </div>

      {/* ── Summary (sticky summary of selections) ── */}
      <SelectionSummary selections={selections} />

      {/* ── Section A: Free-form ── */}
      <div style={S.sectionCard}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid #f0eeec" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1c1917", marginBottom: 2 }}>
            💡 Ý tưởng tự do
          </div>
          <div style={{ fontSize: 11, color: "#78716c" }}>Viết bất kỳ suy nghĩ nào về kênh bạn muốn xây dựng</div>
        </div>
        <div style={{ padding: "12px 16px" }}>
          <textarea
            style={S.textarea(110)}
            value={freeformIdea}
            placeholder={`Ví dụ:\n- Tôi muốn làm kênh về AI cho người Việt không biết lập trình\n- Target: nhân viên văn phòng muốn tăng năng suất\n- Phong cách: giải thích đơn giản, thực hành ngay được\n- Lên video 2-3 lần/tuần, faceless, AI voiceover...`}
            onChange={e => setFreeformIdea(e.target.value)}
          />
        </div>
      </div>

      {/* ── Section B: Import MD file ── */}
      <div style={S.sectionCard}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid #f0eeec" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1c1917", marginBottom: 2 }}>
            📄 Import tài liệu tham khảo (.md)
          </div>
          <div style={{ fontSize: 11, color: "#78716c" }}>
            Notes, nghiên cứu đối thủ, channel strategy notes... — Claude sẽ dùng làm context khi phân tích
          </div>
        </div>
        <div style={{ padding: "12px 16px" }}>
          {mdFileContent ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 500 }}>✓ {mdFileName}</span>
                <button style={S.btn("ghost", true)} onClick={() => { setMdFileContent(""); setMdFileName(""); }}>
                  × Xóa
                </button>
              </div>
              <div style={S.mdPreview}>{mdFileContent.slice(0, 800)}{mdFileContent.length > 800 ? "\n[... xem thêm ...]" : ""}</div>
            </div>
          ) : (
            <div
              style={S.fileImportArea}
              onClick={() => mdFileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); }}
              onDrop={e => {
                e.preventDefault();
                const files = Array.from(e.dataTransfer.files)
                  .filter(f => f.name.endsWith(".md") || f.name.endsWith(".txt"));
                if (!files.length) return;
                let loaded = 0;
                const results = new Array(files.length);
                files.forEach((file, i) => {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    results[i] = ev.target.result;
                    loaded++;
                    if (loaded === files.length) {
                      const combined = results
                        .map((txt, j) => `=== ${files[j].name} ===\n${txt}`)
                        .join("\n\n");
                      const label = files.length === 1
                        ? files[0].name
                        : `${files.length} files (${files.map(f => f.name).join(", ")})`;
                      setMdFileContent(combined);
                      setMdFileName(label);
                      toast.show(`Import ${files.length > 1 ? `${files.length} files` : `"${files[0].name}"`} thành công`);
                    }
                  };
                  reader.readAsText(file);
                });
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 6 }}>📁</div>
              <div>Click hoặc kéo thả nhiều file .md / .txt vào đây</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Section C: Hierarchical Suggestions ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#44403c", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "2px 8px", color: "#dc2626", fontSize: 11 }}>KHÔNG TỐN API</span>
          Hệ thống gợi ý phân tầng
          {totalSelected > 0 && (
            <span style={{ fontSize: 11, color: "#78716c", fontWeight: 400 }}>({totalSelected} lựa chọn)</span>
          )}
        </div>
        {SUGGESTION_TREE.map(section => (
          <SuggestionSection
            key={section.id}
            section={section}
            selections={selections}
            onToggle={toggle}
          />
        ))}
      </div>

      {/* ── Generate Section ── */}
      <GenerateSection
        totalSelected={totalSelected}
        freeformIdea={freeformIdea}
        mdFileName={mdFileName}
        buildContextForAI={buildContextForAI}
        blueprint={blueprint}
        onBlueprint={setBlueprint}
        generating={generating}
        onGenerating={setGenerating}
        updateLog={updateLog}
        onUpdateLog={setUpdateLog}
        updating={updating}
        onUpdating={setUpdating}
        onSuggestionsUpdate={handleSuggestionsUpdate}
        onToast={toast.show}
        models={models}
        modelId={modelId}        onModelId={setModelId}
        thinkingOn={thinkingOn}  onThinkingOn={setThinkingOn}
        effortId={effortId}      onEffortId={setEffortId}
        onUpdateModels={handleUpdateModels}
        updatingModels={updatingModels}
        modelsUpdateLog={modelsUpdateLog}
      />

      {/* ── Blueprint Result ── */}
      {blueprint && (
        <BlueprintResult
          blueprint={blueprint}
          onExport={() => exportBlueprint(blueprint, checkpointName)}
          onClear={() => setBlueprint(null)}
        />
      )}

      {/* Hidden file inputs */}
      <input ref={mdFileRef} type="file" accept=".md,.txt" multiple style={{ display: "none" }} onChange={handleMdImport} />
      <input ref={cpImportRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleCpImport} />

      {/* Toast */}
      <div style={S.toast(toast.vis)}>{toast.msg}</div>
    </div>
  );
}
