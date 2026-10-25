/* 全局状态 */
let songs = [];              // 歌单数据
let site = null;             // 站点配置
let currentType = "全部";     // 类型筛选
let currentLang = "全部";     // 语种筛选
let currentArtist = "全部";   // 歌手筛选
let sortMode = null;         // null=原顺序 | artist | title
let toastTimer = null;       // 提示计时器

const bodyEl = document.getElementById("songBody");
const searchEl = document.getElementById("searchInput");
const typeEl = document.getElementById("typeFilter");
const chipsEl = document.getElementById("typeChips");
const langEl = document.getElementById("langFilter");
const artistEl = document.getElementById("artistFilter");
const emptyEl = document.getElementById("emptyTip");
const countEl = document.getElementById("countInfo");
const sortBtn = document.getElementById("sortArtistBtn");
const sortTitleBtn = document.getElementById("sortTitleBtn");
const randomBtn = document.getElementById("randomBtn");
const toastEl = document.getElementById("toast");
const backTopBtn = document.getElementById("backTop");
const stickyArea = document.getElementById("stickyArea");
const stickySentinel = document.getElementById("stickySentinel");
const searchBox = document.querySelector(".search-box");
let lastResult = [];         // 最近筛选结果

/* 启动 */
init();

async function init() {
  // 并行加载数据与配置
  const [songsRes, siteRes] = await Promise.all([
    fetch("songs.json").then(r => r.ok ? r.json() : Promise.reject()),
    fetch("site.json").then(r => r.ok ? r.json() : null).catch(() => null)
  ]);
  songs = songsRes;
  site = siteRes || { siteName: "我的歌单", subtitle: "好听的歌都在这里" };

  applySiteConfig();
  buildFilters();
  bindEvents();
  setupSticky();
  render();
}

/* 站点配置 */
function applySiteConfig() {
  if (site.siteName) {
    document.title = site.siteName;
    document.getElementById("siteTitle").textContent = site.siteName;
  }
  if (typeof site.subtitle === "string") {
    document.getElementById("siteSubtitle").textContent = site.subtitle;
  }

  // 背景
  const bg = site.background || {};
  const body = document.body;
  const imgEl = document.getElementById("bgImage");
  const overlayEl = document.getElementById("bgOverlay");

  if (bg.type === "color" && bg.color) {
    body.style.background = bg.color;
  } else if (bg.type === "image" && bg.image) {
    imgEl.style.backgroundImage = `url("${bg.image}")`;
    const o = Math.min(Math.max(Number(bg.overlay) || 0, 0), 1);
    overlayEl.style.background = `rgba(11,13,18,${o})`;
    body.classList.add("has-bg-image");
    body.style.background = "#0b0d12"; // 兜底色
  } else {
    body.style.background = "";
  }
}

/* 事件 */
function bindEvents() {
  searchEl.addEventListener("input", render);
  // 类型下拉与胶囊同步
  typeEl.addEventListener("change", () => setType(typeEl.value));
  chipsEl.addEventListener("click", e => {
    const btn = e.target.closest(".chip");
    if (btn) setType(btn.dataset.type);
  });
  langEl.addEventListener("change", () => { currentLang = langEl.value; render(); });
  artistEl.addEventListener("change", () => { currentArtist = artistEl.value; render(); });

  sortBtn.addEventListener("click", () => setSortMode(sortMode === "artist" ? null : "artist"));
  sortTitleBtn.addEventListener("click", () => setSortMode(sortMode === "title" ? null : "title"));

  // 随机一首
  randomBtn.addEventListener("click", () => {
    if (!lastResult.length) { showToast("没有可选的歌曲"); return; }
    const pick = lastResult[Math.floor(Math.random() * lastResult.length)];
    const rows = bodyEl.querySelectorAll(".song-row");
    rows.forEach(r => r.classList.remove("flash"));
    const target = bodyEl.querySelector(`.song-row[data-i="${pick.__i}"]`);
    if (target) {
      target.classList.add("flash");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => target.classList.remove("flash"), 2400);
    }
    showToast(`🎲 随机到《${pick.title || ""}》`);
    if (pick.title) copyText(pick.title); // 顺手复制
  });

}

/* 排序切换 */
function setSortMode(mode) {
  sortMode = mode;
  sortBtn.classList.toggle("active", mode === "artist");
  sortBtn.textContent = mode === "artist" ? "恢复原顺序" : "按歌手名排序";
  sortTitleBtn.classList.toggle("active", mode === "title");
  sortTitleBtn.textContent = mode === "title" ? "恢复原顺序" : "按歌名排序";
  render();
}

/* 吸顶 */
const mobileMq = window.matchMedia("(max-width: 480px)");
let stickyObserver = null;

function currentStickyEl() {
  return mobileMq.matches ? searchBox : stickyArea;
}

// 吸顶高度写入 CSS 变量
function updateStickyHeight() {
  const base = currentStickyEl().offsetHeight;
  const chipsH = mobileMq.matches && chipsEl ? chipsEl.offsetHeight : 0;
  document.documentElement.style.setProperty("--sticky-h", base + "px");
  document.documentElement.style.setProperty("--sticky-h2", (base + chipsH) + "px");
}

function setupSticky() {
  if (stickyObserver) stickyObserver.disconnect();
  // 哨兵判定是否贴顶
  stickyObserver = new IntersectionObserver(entries => {
    entries.forEach(en => {
      const stuck = !en.isIntersecting;
      stickyArea.classList.toggle("stuck", stuck && !mobileMq.matches);
      searchBox.classList.toggle("stuck", stuck && mobileMq.matches);
    });
  }, { rootMargin: "-1px 0px 0px 0px", threshold: 0 });
  stickyObserver.observe(stickySentinel);
  updateStickyHeight();
}

mobileMq.addEventListener("change", () => {
  stickyArea.classList.remove("stuck");
  searchBox.classList.remove("stuck");
  setupSticky();
});
window.addEventListener("resize", updateStickyHeight);

/* 回到顶部按钮 */
backTopBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});
window.addEventListener("scroll", () => {
  backTopBtn.classList.toggle("show", window.scrollY > 400);
}, { passive: true });

/* 主题开关：切换逻辑内联在 index.html，避免脚本缓存导致失灵 */

/* 移动端横拖表格 */
const tableWrap = document.querySelector(".table-wrap");
const songTable = document.querySelector(".song-table");
// 拖动范围动态测量
function maxDrag() {
  return Math.max(0, Math.round(songTable.getBoundingClientRect().width - tableWrap.clientWidth));
}
let dragX = 0;
let tStartX = 0, tStartY = 0, startDragX = 0, dragAxis = null;

function applyDragX() {
  songTable.style.setProperty("--drag-x", dragX + "px");
}

tableWrap.addEventListener("touchstart", e => {
  if (!mobileMq.matches) return;
  const t = e.touches[0];
  tStartX = t.clientX; tStartY = t.clientY;
  startDragX = dragX; dragAxis = null;
  songTable.style.transition = "none";
}, { passive: true });

tableWrap.addEventListener("touchmove", e => {
  if (!mobileMq.matches || dragAxis === "y") return;
  const t = e.touches[0];
  const dx = t.clientX - tStartX, dy = t.clientY - tStartY;
  if (dragAxis === null) {
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; // 等意图明确
    dragAxis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (dragAxis === "y") return;                     // 纵向交还原生滚动
  }
  e.preventDefault();
  dragX = Math.min(0, Math.max(-maxDrag(), startDragX + dx));
  applyDragX();
}, { passive: false });

tableWrap.addEventListener("touchend", () => {
  if (!mobileMq.matches || dragAxis !== "x") return;
  dragAxis = null;
  songTable.style.transition = "transform 0.18s ease-out"; // 松手吸附
  const M = maxDrag();
  dragX = dragX < -M / 2 ? -M : 0;
  applyDragX();
});

/* 复制 */
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
  } catch (e) { /* 静默 */ }
  ta.remove();
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1600);
}

/* 筛选选项 */
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
  const artists = [...new Set(songs.map(s => s.artist).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), "zh-Hans-CN"));
  fillSelect(typeEl, types);
  fillSelect(langEl, langs);
  fillSelect(artistEl, artists);
  buildTypeChips(types);
}

// 类型入口：同步下拉与胶囊
function setType(t) {
  currentType = t;
  typeEl.value = t;
  chipsEl.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c.dataset.type === t));
  render();
}

// 类型胶囊行
function buildTypeChips(types) {
  chipsEl.innerHTML = "";
  ["全部", ...types].forEach(t => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (t === currentType ? " active" : "");
    btn.dataset.type = t;
    btn.textContent = t;
    chipsEl.appendChild(btn);
  });
}

/* 渲染 */
function render() {
  const keyword = searchEl.value.trim().toLowerCase();

  // 筛选
  let result = songs.filter(s => {
    const matchType = currentType === "全部" || s.type === currentType;
    const matchLang = currentLang === "全部" || s.language === currentLang;
    const matchArtist = currentArtist === "全部" || s.artist === currentArtist;
    const hay = [s.title, s.titleZh, s.artist, s.note]
      .map(x => (x || "").toLowerCase()).join(" ");
    return matchType && matchLang && matchArtist && (!keyword || hay.includes(keyword));
  });

  // 排序
  if (sortMode === "artist") {
    result = [...result].sort((a, b) =>
      String(a.artist || "").localeCompare(String(b.artist || ""), "zh-Hans-CN")
    );
  } else if (sortMode === "title") {
    result = [...result].sort((a, b) =>
      String(a.title || "").localeCompare(String(b.title || ""), "zh-Hans-CN")
    );
  }

  // 渲染
  countEl.textContent = `共 ${result.length} 首`;
  emptyEl.hidden = result.length > 0;
  lastResult = result;
  bodyEl.innerHTML = "";

  result.forEach((song, i) => {
    const tr = document.createElement("tr");
    tr.className = "song-row";
    tr.dataset.i = i;
    tr.title = "点击复制歌名";
    tr.addEventListener("click", () => copyText(song.title || ""));

    // 序号
    const tdIdx = document.createElement("td");
    tdIdx.className = "td-idx";
    tdIdx.textContent = i + 1;
    tr.appendChild(tdIdx);

    // 歌名 + 礼物徽章 + 译名
    const tdTitle = document.createElement("td");
    tdTitle.className = "td-title";
    tdTitle.textContent = song.title || "未知歌名";
    const giftStr = (song.gift || "").trim();
    if (giftStr) {
      const gi = document.createElement("span");
      gi.className = "gift-inline";
      gi.textContent = giftStr;
      tdTitle.appendChild(gi);
    }
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

    // 类型
    const tdType = document.createElement("td");
    if (song.type) {
      const tag = document.createElement("span");
      const cls = { "JPOP": "tag-jpop", "中文": "tag-zh",
                    "动画/游戏插曲": "tag-anime", "VOCALOID/ボカロ": "tag-vocaloid" }[song.type] || "";
      tag.className = "type-tag " + cls;
      tag.textContent = song.type;
      tag.title = song.type;
      tdType.appendChild(tag);
    }
    tr.appendChild(tdType);

    // 语言
    const tdLang = document.createElement("td");
    tdLang.className = "td-lang";
    if (song.language) {
      const langSpan = document.createElement("span");
      langSpan.className = "lang-tag";
      langSpan.textContent = song.language;
      tdLang.appendChild(langSpan);
    }
    tr.appendChild(tdLang);

    // 备注
    const tdNote = document.createElement("td");
    tdNote.className = "td-note";
    tdNote.textContent = song.note || "";
    tr.appendChild(tdNote);

    // 链接 + 复制图标
    const tdLink = document.createElement("td");
    tdLink.className = "td-link";
    if (song.link) {
      const a = document.createElement("a");
      a.className = "song-link";
      a.href = song.link;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "▶ 收听";
      a.addEventListener("click", e => e.stopPropagation());
      tdLink.appendChild(a);
    }
    const copyHint = document.createElement("span");
    copyHint.className = "copy-hint";
    copyHint.title = "点击行复制歌名";
    copyHint.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="9" y="9" width="13" height="13" rx="2.5"/>' +
      '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    tdLink.appendChild(copyHint);
    tr.appendChild(tdLink);

    bodyEl.appendChild(tr);
  });
}
