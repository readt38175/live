/* ================= 全局状态 ================= */
let songs = [];              // 全部歌曲数据（来自 songs.json）
let site = null;             // 站点配置（来自 site.json，可能不存在）
let currentLanguage = "全部"; // 当前选中的语言筛选
let sortArtist = false;      // 是否按歌手名排序

const listEl = document.getElementById("songList");
const filterEl = document.getElementById("languageFilter");
const searchEl = document.getElementById("searchInput");
const emptyEl = document.getElementById("emptyTip");
const countEl = document.getElementById("countInfo");
const sortBtn = document.getElementById("sortArtistBtn");

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
  buildLanguageFilter();
  bindEvents();
  render();
}

/* ================= 站点配置：名称 + 背景 ================= */
function applySiteConfig() {
  // 名称
  if (site.siteName) {
    document.title = site.siteName;
    document.getElementById("siteTitle").textContent = "🎵 " + site.siteName;
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
    // 蒙层颜色取浅灰白，数值越大文字越清晰
    overlayEl.style.background = `rgba(245,247,248,${o})`;
    body.classList.add("has-bg-image");
    body.style.background = "#f5f7fb"; // 图片加载前的兜底色
  } else {
    body.style.background = "";
  }
}

/* ================= 事件 ================= */
function bindEvents() {
  searchEl.addEventListener("input", render);

  sortBtn.addEventListener("click", () => {
    sortArtist = !sortArtist;
    sortBtn.classList.toggle("active", sortArtist);
    sortBtn.textContent = sortArtist ? "恢复原顺序" : "按歌手名排序";
    render();
  });
}

/* ================= 生成语言筛选按钮 ================= */
function buildLanguageFilter() {
  const langs = [...new Set(songs.map(s => s.language).filter(Boolean))];
  const all = ["全部", ...langs];

  filterEl.innerHTML = "";
  all.forEach(lang => {
    const btn = document.createElement("button");
    btn.className = "filter-btn" + (lang === currentLanguage ? " active" : "");
    btn.textContent = lang;
    btn.addEventListener("click", () => {
      currentLanguage = lang;
      filterEl.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      render();
    });
    filterEl.appendChild(btn);
  });
}

/* ================= 核心渲染 ================= */
function render() {
  const keyword = searchEl.value.trim().toLowerCase();

  // 1. 筛选（关键字匹配：歌名 / 中文译名 / 歌手 / 备注）
  let result = songs.filter(s => {
    const matchLang = currentLanguage === "全部" || s.language === currentLanguage;
    const hay = [s.title, s.titleZh, s.artist, s.note]
      .map(x => (x || "").toLowerCase()).join(" ");
    return matchLang && (!keyword || hay.includes(keyword));
  });

  // 2. 排序
  if (sortArtist) {
    result = [...result].sort((a, b) =>
      String(a.artist || "").localeCompare(String(b.artist || ""), "zh-Hans-CN")
    );
  }

  // 3. 渲染列表
  countEl.textContent = `共 ${result.length} 首`;
  emptyEl.hidden = result.length > 0;
  listEl.innerHTML = "";

  result.forEach((song, i) => {
    const li = document.createElement("li");
    li.className = "song-item";

    const index = document.createElement("span");
    index.className = "song-index";
    index.textContent = i + 1;

    const info = document.createElement("div");
    info.className = "song-info";

    const titleDiv = document.createElement("div");
    titleDiv.className = "song-title";
    titleDiv.textContent = song.title || "未知歌名";
    if (song.titleZh) {
      const zh = document.createElement("span");
      zh.className = "song-title-zh";
      zh.textContent = song.titleZh;
      titleDiv.appendChild(zh);
    }
    info.appendChild(titleDiv);

    const artistDiv = document.createElement("div");
    artistDiv.className = "song-artist";
    artistDiv.textContent = song.artist || "未知歌手";
    info.appendChild(artistDiv);

    if (song.note) {
      const noteDiv = document.createElement("div");
      noteDiv.className = "song-note";
      noteDiv.textContent = "📌 " + song.note;
      info.appendChild(noteDiv);
    }

    li.appendChild(index);
    li.appendChild(info);

    if (song.language) {
      const tag = document.createElement("span");
      tag.className = "song-tag";
      tag.textContent = song.language;
      li.appendChild(tag);
    }

    if (song.link) {
      const a = document.createElement("a");
      a.className = "song-link";
      a.href = song.link;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "▶ 收听";
      li.appendChild(a);
    }

    listEl.appendChild(li);
  });
}
