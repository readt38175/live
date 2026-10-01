/* ================= 全局状态 ================= */
let songs = [];              // 全部歌曲数据（来自 songs.json）
let site = null;             // 站点配置（来自 site.json，可能不存在）
let currentType = "全部";     // 当前类型筛选
let currentLang = "全部";     // 当前语种筛选
let currentPaid = "全部";     // 当前付费筛选
let sortArtist = false;      // 是否按歌手名排序
let toastTimer = null;       // 复制提示计时器

const bodyEl = document.getElementById("songBody");
const searchEl = document.getElementById("searchInput");
const typeEl = document.getElementById("typeFilter");
const langEl = document.getElementById("langFilter");
const paidEl = document.getElementById("paidFilter");
const emptyEl = document.getElementById("emptyTip");
const countEl = document.getElementById("countInfo");
const sortBtn = document.getElementById("sortArtistBtn");
const toastEl = document.getElementById("toast");

/* ================= 启动 ================= */
init();

async function init() {
  // 并行加载歌单数据 + 站点配置（site.json 缺失时用默认值）
  const [songsRes, siteRes] = await Promise.all([
    fetch("songs.json").then(r => r.ok ? r.json() : Promise.reject()),
    fetch("site.json").then(r => r.ok ? r.json() : null).catch(() => null)
  ]);
  songs = songsRes;
  site = siteRes || { siteName: "我的歌单", subtitle: "好听的歌都在这里" };

  applySiteConfig();
  buildFilters();
  bindEvents();
  render();
}

/* ================= 站点配置：名称 + 背景 ================= */
function applySiteConfig() {
  // 名称
  if (site.siteName) {
    document.title = site.siteName;
    document.getElementById("siteTitle").textContent = site.siteName;
  }
  if (typeof site.subtitle === "string") {
    document.getElementById("siteSubtitle").textContent = site.subtitle;
  }

  // 背景（深色底 + 星空图：cover + 分端点 background-position 自适应见 style.css）
  const bg = site.background || {};
  const body = document.body;
  const imgEl = document.getElementById("bgImage");
  const overlayEl = document.getElementById("bgOverlay");

  if (bg.type === "color" && bg.color) {
    body.style.background = bg.color;
  } else if (bg.type === "image" && bg.image) {
    imgEl.style.backgroundImage = `url("${bg.image}")`;
    const o = Math.min(Math.max(Number(bg.overlay) || 0, 0), 1);
    // 蒙层颜色取深色（黑底主题），数值越大文字越清晰
    overlayEl.style.background = `rgba(11,13,18,${o})`;
    body.classList.add("has-bg-image");
    body.style.background = "#0b0d12"; // 图片加载前的兜底色
  } else {
    body.style.background = "";
  }
}

/* ================= 事件 ================= */
function bindEvents() {
  searchEl.addEventListener("input", render);
  typeEl.addEventListener("change", () => { currentType = typeEl.value; render(); });
  langEl.addEventListener("change", () => { currentLang = langEl.value; render(); });
  paidEl.addEventListener("change", () => { currentPaid = paidEl.value; render(); });

  sortBtn.addEventListener("click", () => {
    sortArtist = !sortArtist;
    sortBtn.classList.toggle("active", sortArtist);
    sortBtn.textContent = sortArtist ? "恢复原顺序" : "按歌手名排序";
    render();
  });
}

/* ================= 点击复制歌名 ================= */
function copyText(text) {
  const done = () => showToast(`已复制《${text}》`);
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    done();
  } catch (e) { /* 复制失败时静默 */ }
  ta.remove();
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1600);
}

/* ================= 生成下拉筛选选项 ================= */
function fillSelect(sel, values) {
  sel.innerHTML = "";
  ["全部", ...values].forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v === "全部" ? "请选择" : v;
    sel.appendChild(opt);
  });
  sel.value = "全部";
}

function buildFilters() {
  const types = [...new Set(songs.map(s => s.type).filter(Boolean))];
  const langs = [...new Set(songs.map(s => s.language).filter(Boolean))];
  fillSelect(typeEl, types);
  fillSelect(langEl, langs);
}

/* ================= 核心渲染 ================= */
function render() {
  const keyword = searchEl.value.trim().toLowerCase();

  // 1. 筛选（关键字匹配：歌名 / 中文译名 / 歌手 / 备注）
  let result = songs.filter(s => {
    const matchType = currentType === "全部" || s.type === currentType;
    const matchLang = currentLang === "全部" || s.language === currentLang;
    const matchPaid = currentPaid === "全部"
      || (s.paid || "否") === currentPaid
      || (currentPaid === "是" && (s.gift || "").trim()); // 有礼物也算付费
    const hay = [s.title, s.titleZh, s.artist, s.note]
      .map(x => (x || "").toLowerCase()).join(" ");
    return matchType && matchLang && matchPaid && (!keyword || hay.includes(keyword));
  });

  // 2. 排序
  if (sortArtist) {
    result = [...result].sort((a, b) =>
      String(a.artist || "").localeCompare(String(b.artist || ""), "zh-Hans-CN")
    );
  }

  // 3. 渲染表格
  countEl.textContent = `共 ${result.length} 首`;
  emptyEl.hidden = result.length > 0;
  bodyEl.innerHTML = "";

  result.forEach((song, i) => {
    const tr = document.createElement("tr");
    tr.className = "song-row";
    tr.title = "点击复制歌名";
    tr.addEventListener("click", () => copyText(song.title || ""));

    // 序号
    const tdIdx = document.createElement("td");
    tdIdx.className = "td-idx";
    tdIdx.textContent = i + 1;
    tr.appendChild(tdIdx);

    // 歌名（+ 中文译名小字）
    const tdTitle = document.createElement("td");
    tdTitle.className = "td-title";
    tdTitle.textContent = song.title || "未知歌名";
    if (song.titleZh) {
      const zh = document.createElement("span");
      zh.className = "title-zh";
      zh.textContent = song.titleZh;
      tdTitle.appendChild(zh);
    }
    tr.appendChild(tdTitle);

    // 歌手
    const tdArtist = document.createElement("td");
    tdArtist.className = "td-artist";
    tdArtist.textContent = song.artist || "";
    tr.appendChild(tdArtist);

    // 类型（小标签）
    const tdType = document.createElement("td");
    if (song.type) {
      const tag = document.createElement("span");
      tag.className = "type-tag";
      tag.textContent = song.type;
      tdType.appendChild(tag);
    }
    tr.appendChild(tdType);

    // 语言
    const tdLang = document.createElement("td");
    tdLang.className = "td-lang";
    tdLang.textContent = song.language || "";
    tr.appendChild(tdLang);

    // 是否付费（是 -> 粉色高亮；否 -> 留空）
    const tdPaid = document.createElement("td");
    if ((song.paid || "否") === "是") {
      const b = document.createElement("span");
      b.className = "paid-yes";
      b.textContent = "是";
      tdPaid.appendChild(b);
    }
    tr.appendChild(tdPaid);

    // 付费礼物
    const tdGift = document.createElement("td");
    tdGift.textContent = song.gift || "";
    tr.appendChild(tdGift);

    // 备注（粉色小字，对应 Excel「备注」列）
    const tdNote = document.createElement("td");
    tdNote.className = "td-note";
    tdNote.textContent = song.note || "";
    tr.appendChild(tdNote);

    // 收听链接
    const tdLink = document.createElement("td");
    if (song.link) {
      const a = document.createElement("a");
      a.className = "song-link";
      a.href = song.link;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "▶ 收听";
      a.addEventListener("click", e => e.stopPropagation()); // 点链接不触发复制
      tdLink.appendChild(a);
    }
    tr.appendChild(tdLink);

    bodyEl.appendChild(tr);
  });
}
