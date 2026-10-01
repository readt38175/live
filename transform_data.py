# -*- coding: utf-8 -*-
"""歌单数据 V2 转换：
1) songs.json：拆分「类型 type」和「语言 language」两个维度，新增 paid / gift 字段
   - 昭和老歌 -> 类型并入 JPOP（取消该分类），语言=日文
   - JPOP / 动画/游戏插曲 / VOCALOID/ボカロ -> 类型不变，语言=日文
   - 中文 -> 类型=中文，语言=中文
2) 生成 歌单V2.0.xlsx（纯标准库写 xlsx，inline string，无需 openpyxl）
"""
import io
import json
import zipfile

WS = r"C:\Users\12532\WorkBuddy\2026-10-01-21-21-14"

JP_TYPES = {"JPOP", "动画/游戏插曲", "VOCALOID/ボカロ", "昭和老歌"}

songs = json.load(io.open(WS + r"\songs.json", encoding="utf-8"))

out = []
for s in songs:
    old = (s.get("language") or "").strip()
    if old in JP_TYPES:
        t = "JPOP" if old == "昭和老歌" else old
        lang = "日文"
    elif old == "中文":
        t, lang = "中文", "中文"
    else:  # 兜底：未知类型原样保留
        t, lang = old, old
    out.append({
        "title": s.get("title", ""),
        "titleZh": s.get("titleZh", ""),
        "artist": s.get("artist", ""),
        "type": t,
        "language": lang,
        "paid": "否",
        "gift": "",
        "note": s.get("note", ""),
        "link": s.get("link", ""),
    })

json.dump(out, io.open(WS + r"\songs.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

from collections import Counter
print("songs:", len(out))
print("type:", Counter(s["type"] for s in out))
print("language:", Counter(s["language"] for s in out))

# ---------------- 生成 歌单V2.0.xlsx ----------------
HEADERS = ["序号", "类型", "歌手原唱作曲", "歌名", "歌名(中文)",
           "语言", "是否付费", "付费礼物", "备注"]
rows = []
for i, s in enumerate(out, 1):
    rows.append([str(i), s["type"], s["artist"], s["title"], s["titleZh"],
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


sheet_rows = []
# 表头行（加粗样式 s="1"，冻结首行）
sheet_rows.append('<row r="1">' + "".join(
    cell(COLS[c], 1, h, ' s="1"') for c, h in enumerate(HEADERS)) + "</row>")
for r, row in enumerate(rows, 2):
    sheet_rows.append(f'<row r="{r}">' + "".join(
        cell(COLS[c], r, v) for c, v in enumerate(row)) + "</row>")

cols_xml = "".join(
    f'<col min="{i+1}" max="{i+1}" width="{w}" customWidth="1"/>'
    for i, w in enumerate(WIDTHS))

sheet_xml = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    f'<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
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

xp = WS + r"\歌单V2.0.xlsx"
with zipfile.ZipFile(xp, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types)
    z.writestr("_rels/.rels", root_rels)
    z.writestr("xl/workbook.xml", workbook_xml)
    z.writestr("xl/_rels/workbook.xml.rels", wb_rels)
    z.writestr("xl/styles.xml", styles_xml)
    z.writestr("xl/worksheets/sheet1.xml", sheet_xml)

print("xlsx written:", xp)
