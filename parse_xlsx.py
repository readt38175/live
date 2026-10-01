# -*- coding: utf-8 -*-
"""把 歌单V1.0.xlsx 转成 songs.json（标准库实现）"""
import zipfile, json, re
import xml.etree.ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
path = r"E:\迅雷下载\ZLML\zl\歌单V1.0.xlsx"
z = zipfile.ZipFile(path)

shared = []
if "xl/sharedStrings.xml" in z.namelist():
    ss = ET.fromstring(z.read("xl/sharedStrings.xml"))
    for si in ss.findall("m:si", NS):
        shared.append("".join(t.text or "" for t in si.findall(".//m:t", NS)))

def col_to_idx(ref):
    m = re.match(r"([A-Z]+)(\d+)", ref)
    col = 0
    for ch in m.group(1):
        col = col * 26 + (ord(ch) - 64)
    return col - 1, int(m.group(2)) - 1

sheet_xml = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
rows = {}
for c in sheet_xml.findall(".//m:c", NS):
    ci, ri = col_to_idx(c.get("r"))
    t, v, is_node = c.get("t"), c.find("m:v", NS), c.find("m:is", NS)
    if t == "s" and v is not None:
        val = shared[int(v.text)]
    elif t == "inlineStr" and is_node is not None:
        val = "".join(x.text or "" for x in is_node.findall(".//m:t", NS))
    elif v is not None:
        val = v.text
    else:
        val = ""
    rows.setdefault(ri, {})[ci] = (val or "").strip()

max_col = max(max(r) for r in rows.values()) + 1
table = [[rows.get(r, {}).get(c, "") for c in range(max_col)] for r in sorted(rows)]

def clean_zh(s):
    """去掉中文歌名列的括号： (xx) （xx）"""
    s = s.strip()
    return re.sub(r"^[（(](.*)[)）]$", r"\1", s).strip()

songs, last_lang = [], ""
for row in table:
    idx, lang, artist, title, title_zh, note = (row + [""] * 6)[:6]
    # 跳过表头 / 标题行 / 完全空行
    if idx == "序号" or title == "歌单":
        continue
    if not (artist or title):
        continue
    if lang:
        last_lang = lang
    if not title:
        continue  # 没有歌名的行（如空行残留）跳过
    songs.append({
        "title": title,
        "titleZh": clean_zh(title_zh),
        "artist": artist,
        "language": last_lang,
        "note": note,
        "link": ""
    })

out = r"C:\Users\12532\WorkBuddy\2026-10-01-21-21-14\songs.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump(songs, f, ensure_ascii=False, indent=2)
langs = {}
for s in songs:
    langs[s["language"]] = langs.get(s["language"], 0) + 1
print("total:", len(songs))
print("langs:", langs)
