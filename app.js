/* ================= 全局状态 ================= */
let songs = [];          // 全部歌曲数据（来自 songs.json）
let currentLanguage = "全部"; // 当前选中的语言筛选
let sortArtist = false;  // 是否按歌手名排序

const listEl = document.getElementById("songList");
const filterEl = document.getElementById("languageFilter");
const searchEl = document.getElementById("searchInput");
const emptyEl = document.getElementById("emptyTip");
const countEl = document.getElementById("countInfo");
const sortBtn = document.getElementById("sortArtistBtn");

/* ================= 启动 ================= */
init();

async function init() {
  try {
    const res = await fetch("songs.json");
    songs = await res.json();
  } catch (e) {
    listEl.innerHTML = "";
    emptyEl.hidden = false;
    emptyEl.textContent = "读取 songs.json 失败，请检查文件是否存在";
    return;
  }
  buildLanguageFilter();
  bindEvents();
  render();
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

  // 1. 筛选
  let result = songs.filter(s => {
    const matchLang = currentLanguage === "全部" || s.language === currentLanguage;
    const matchKey =
      !keyword ||
      (s.title || "").toLowerCase().includes(keyword) ||
      (s.artist || "").toLowerCase().includes(keyword);
    return matchLang && matchKey;
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
    info.innerHTML = `
      <div class="song-title">${escapeHtml(song.title || "未知歌名")}</div>
      <div class="song-artist">${escapeHtml(song.artist || "未知歌手")}</div>
    `;

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

/* ================= 工具函数：防 HTML 注入 ================= */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
