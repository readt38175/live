# -*- coding: utf-8 -*-
"""歌单V2.2.xlsx -> songs.json（按 语种→类型→歌手→歌名 排序）+ 歌单V2.3.xlsx
V2.2 使用 sharedStrings 存储，需读取共享字符串表。"""
import io
import json
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter

WS = r"C:\Users\12532\WorkBuddy\2026-10-01-21-21-14"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

# ---------- 读取共享字符串 ----------
z = zipfile.ZipFile(WS + r"\歌单V2.2.xlsx")
sst_root = ET.fromstring(z.read("xl/sharedStrings.xml"))
sst = []
for si in sst_root.findall("m:si", NS):
    # 富文本 run 可能拆成多个 t，全部拼接
    text = "".join(t.text or "" for t in si.iter("{%s}t" % NS["m"]))
    sst.append(text)
print("sharedStrings:", len(sst))

# ---------- 读取单元格 ----------
sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
rows = []
for r in sheet.findall(".//m:row", NS):
    cells = {}
    for c in r.findall("m:c", NS):
        ref = c.attrib["r"]
        col = "".join(ch for ch in ref if ch.isalpha())
        t = c.attrib.get("t")
        val = ""
        if t == "s":
            v = c.find("m:v", NS)
            val = sst[int(v.text)] if v is not None else ""
        elif t == "inlineStr":
            is_el = c.find("m:is", NS)
            val = "".join(x.text or "" for x in is_el.iter("{%s}t" % NS["m"])) if is_el is not None else ""
        else:
            v = c.find("m:v", NS)
            val = v.text if v is not None else ""
        cells[col] = (val or "").strip()
    rows.append(cells)

# 列顺序 A..I：序号/类型/歌手原唱作曲/歌名/歌名(中文)/语言/是否付费/付费礼物/备注
def get(cells, col):
    return cells.get(col, "")

# 表头校验
header = [get(rows[0], c) for c in "ABCDEFGHI"]
print("header:", header)
assert "歌名" in header[3] and "类型" in header[1], "表头结构与预期不符"

songs = []
for cells in rows[1:]:
    title = get(cells, "D")
    artist = get(cells, "C")
    if not title and not artist:
        continue  # 空行
    songs.append({
        "title": title,
        "titleZh": get(cells, "E"),
        "artist": artist,
        "type": get(cells, "B"),
        "language": get(cells, "F"),
        "paid": "是" if get(cells, "G") == "是" else "否",
        "gift": get(cells, "H"),
        "note": get(cells, "I"),
        "link": "",
    })
print("songs:", len(songs))
print("type:", Counter(s["type"] for s in songs))
print("language:", Counter(s["language"] for s in songs))

# ---------- 排序：语种 -> 类型 -> 歌手 -> 歌名 ----------
# 修正：V2.2 中新增的真夜中歌曲「类型」列误填为「日文」（填成了语言值），归回 JPOP
for s in songs:
    if s["type"] == "日文":
        s["type"] = "JPOP"

LANG_ORDER = ["中文", "日文"]
TYPE_ORDER = ["中文", "JPOP", "动画/游戏插曲", "VOCALOID/ボカロ"]
lang_key = lambda l: LANG_ORDER.index(l) if l in LANG_ORDER else 99
type_key = lambda t: TYPE_ORDER.index(t) if t in TYPE_ORDER else 99

songs.sort(key=lambda s: (
    lang_key(s["language"]),
    type_key(s["type"]),
    s["artist"].localeCompare if False else s["artist"],  # placeholder
))
# localeCompare 用 Python 的 locale 不方便，改用 sorted + localeCompare 等价策略：
# 中文按拼音排序 -> 用 locale strcoll
import locale
try:
    locale.setlocale(locale.LC_COLLATE, "Chinese_China.936")
except Exception:
    try:
        locale.setlocale(locale.LC_COLLATE, "")
    except Exception:
        pass
from functools import cmp_to_key

def cmp_zh(a, b):
    return locale.strcoll(a, b)

songs.sort(key=cmp_to_key(lambda a, b: (
    lang_key(a["language"]) - lang_key(b["language"])
    or type_key(a["type"]) - type_key(b["type"])
    or cmp_zh(a["artist"], b["artist"])
    or cmp_zh(a["title"], b["title"])
)))

# ---------- 写 songs.json ----------
json.dump(songs, io.open(WS + r"\songs.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print("songs.json written, total:", len(songs))
print("first 3:", [f'{s["language"]}/{s["type"]}/{s["artist"]}/{s["title"]}' for s in songs[:3]])
print("boundary check (中文->日文交界):")
for s in songs[81:87]:
    print("  ", s["language"], "|", s["type"], "|", s["artist"], "|", s["title"])

# ---------- 生成 歌单V2.3.xlsx ----------
HEADERS = ["序号", "类型", "歌手原唱作曲", "歌名", "歌名(中文)",
           "语言", "是否付费", "付费礼物", "备注"]
rows_out = []
for i, s in enumerate(songs, 1):
    rows_out.append([str(i), s["type"], s["artist"], s["title"], s["titleZh"],
                     s["language"], s["paid"], s["gift"], s["note"]])

COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"]
WIDTHS = [6, 16, 30, 34, 22, 8, 9, 10, 30]

def esc(t):
    return (t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;"))

def cell(col, row, value, style=""):
    if value is None or value == "":
        return f'<c r="{col}{row}"{style}/>'
    return f'<c r="{col}{row}"{style} t="inlineStr"><is><t>{esc(value)}</t></is></c>'

sheet_rows = ['<row r="1">' + "".join(
    cell(COLS[c], 1, h, ' s="1"') for c, h in enumerate(HEADERS)) + "</row>"]
for r, row in enumerate(rows_out, 2):
    sheet_rows.append(f'<row r="{r}">' + "".join(
        cell(COLS[c], r, v) for c, v in enumerate(row)) + "</row>")

cols_xml = "".join(
    f'<col min="{i+1}" max="{i+1}" width="{w}" customWidth="1"/>'
    for i, w in enumerate(WIDTHS))

sheet_xml = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    f'<sheetFormatPr defaultRowHeight="16"/>{cols_xml}'
    f'<sheetData>{"".join(sheet_rows)}</sheetData></worksheet>')

styles_xml = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    '<fonts count="2">'
    '<font><sz val="11"/><name val="等线"/></font>'
    '<font><b/><sz val="11"/><color rgb="FF1F4E79"/><name val="等线"/></font>'
    '</fonts>'
    '<fills count="3">'
    '<fill><patternFill patternType="none"/></fill>'
    '<fill><patternFill patternType="gray125"/></fill>'
    '<fill><patternFill patternType="solid"><fgColor rgb="FFDDEBF7"/><bgColor indexed="64"/></patternFill></fill>'
    '</fills>'
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    '<cellXfs count="2">'
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
    '</cellXfs></styleSheet>')

workbook_xml = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    '<sheets><sheet name="歌单" sheetId="1" r:id="rId1"/></sheets></workbook>')

wb_rels = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    '</Relationships>')

root_rels = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    '</Relationships>')

content_types = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    '</Types>')

xp = WS + r"\歌单V2.3.xlsx"
with zipfile.ZipFile(xp, "w", zipfile.ZIP_DEFLATED) as zz:
    zz.writestr("[Content_Types].xml", content_types)
    zz.writestr("_rels/.rels", root_rels)
    zz.writestr("xl/workbook.xml", workbook_xml)
    zz.writestr("xl/_rels/workbook.xml.rels", wb_rels)
    zz.writestr("xl/styles.xml", styles_xml)
    zz.writestr("xl/worksheets/sheet1.xml", sheet_xml)
print("xlsx written:", xp)
