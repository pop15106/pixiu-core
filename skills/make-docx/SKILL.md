---
name: make-docx
description: 以固定的 Pixiu 風格（藍色標題、彩色表格、風險框、程式碼佐證、流程圖、自動目錄）產生 DOCX 技術文件。適用於流程分析、系統說明、風險報告等場景。
origin: Pixiu
---

# make-docx

Slash command（`/make-docx`），根據使用者提供的主題與大綱，以 python-docx + matplotlib 產生
**可直接交付的 Word 技術文件**，風格與 `進出倉確認流程深度分析.docx` 完全一致。

---

## When to Use

- 需要把分析結果、流程說明、風險報告輸出成 Word 文件
- 想要有封面、自動目錄、流程圖、程式碼佐證的標準化文件
- 任何「幫我產出 docx / word 文件」的需求

---

## Invocation

```
/make-docx <主題描述>
```

**範例**

```
/make-docx 核心保證金計算模組
/make-docx 系統登入與權限驗證流程
/make-docx 出倉申請到核銷完整 SOP
```

未帶參數時詢問使用者：文件主題、章節大綱（可列點）、是否需要流程圖。

---

## Execution Steps

1. **確認需求**（若參數不足）
   - 文件主題、輸出路徑（預設 `docs/<主題>.docx`）
   - 章節清單（使用者可提供大綱或讓 Claude 依主題自動規劃）
   - 是否需要流程圖（需要則同步產生 PNG）

2. **建立 Python 腳本**
   - 若需流程圖：先寫 `docs/gen_flowcharts_<slug>.py`，執行產生 PNG
   - 再寫 `docs/gen_docx_<slug>.py`，執行產生 DOCX

3. **執行腳本**
   ```bash
   python docs/gen_flowcharts_<slug>.py   # 有流程圖才執行
   python docs/gen_docx_<slug>.py
   ```

4. **確認檔案**：`ls -lh docs/*.docx`

5. **告知使用者**：檔案路徑 + 提醒開啟後 Ctrl+A → F9 更新目錄

---

## Style Reference（固定不變的設計規範）

### 顏色

| 用途 | HEX |
|------|-----|
| 封面/H1 標題 | `#1F497D`（深藍） |
| H2 節標題 | `#2E75B6`（藍） |
| H3 小標 | `#404040`（深灰） |
| 高風險框 | `#C00000`（紅） |
| 中風險框 | `#E26B0A`（橙） |
| 低風險/建議 | `#378610`（綠） |
| 表格標題列 | `#2E75B6`（白字） |

### 元素說明

| 元素 | 函式 | 用途 |
|------|------|------|
| 封面大標 | `add_title(doc, text)` | 文件主標題 |
| 章標題 | `add_h1(doc, num, text)` | Heading 1，供 TOC 抓取 |
| 節標題 | `add_h2(doc, text)` | Heading 2 |
| 小節 | `add_h3(doc, text)` | Heading 3 |
| 內文 | `add_body(doc, text)` | 一般說明文字 |
| 條列 | `add_bullet(doc, text)` | 項目清單 |
| 風險框 | `add_risk_box(doc, level, title, content)` | level='HIGH'/'MED'/'LOW' |
| 程式碼 | `add_code_block(doc, file_ref, lines)` | 灰底 Courier New |
| 表格 | `add_simple_table(doc, headers, rows)` | 藍色標題列 |
| 圖片 | `add_image(doc, filename, caption)` | 嵌入 PNG |
| 目錄 | `add_toc(doc)` | Word 自動目錄欄位 |

---

## Generator Template

以下是**完整可直接複製使用**的 Python 樣板，包含所有 helper 函式。
寫新文件時：複製此樣板 → 修改章節內容 → 執行即可。

```python
# -*- coding: utf-8 -*-
"""
<文件標題> - DOCX 產生器
"""
from docx import Document
from docx.shared import Pt, RGBColor, Inches, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import os

doc = Document()
DOCS_DIR = os.path.dirname(os.path.abspath(__file__))

# ── 頁面設定 ──
section = doc.sections[0]
section.page_width    = Cm(21)
section.page_height   = Cm(29.7)
section.left_margin   = Cm(2.5)
section.right_margin  = Cm(2.5)
section.top_margin    = Cm(2.5)
section.bottom_margin = Cm(2.5)

# ── 顏色 ──
C_TITLE  = RGBColor(0x1F, 0x49, 0x7D)
C_H1     = RGBColor(0x2E, 0x75, 0xB6)
C_H2     = RGBColor(0x2E, 0x75, 0xB6)
C_H3     = RGBColor(0x40, 0x40, 0x40)
C_RED    = RGBColor(0xC0, 0x00, 0x00)
C_ORANGE = RGBColor(0xE2, 0x6B, 0x0A)
C_GREEN  = RGBColor(0x37, 0x86, 0x10)

# ════════════════════════════════
# Helper Functions（固定，勿改）
# ════════════════════════════════
def set_cell_bg(cell, rgb):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), '{:02X}{:02X}{:02X}'.format(*rgb))
    tcPr.append(shd)

def add_title(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(text)
    run.font.size = Pt(22)
    run.font.bold = True
    run.font.color.rgb = C_TITLE

def add_h1(doc, num, text):
    p = doc.add_paragraph(style='Heading 1')
    run = p.add_run(f'第{num}章　{text}')
    run.font.size = Pt(16)
    run.font.bold = True
    run.font.color.rgb = C_H1
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after  = Pt(4)

def add_h2(doc, text):
    p = doc.add_paragraph(style='Heading 2')
    run = p.add_run(text)
    run.font.size = Pt(13)
    run.font.bold = True
    run.font.color.rgb = C_H2
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after  = Pt(2)

def add_h3(doc, text):
    p = doc.add_paragraph(style='Heading 3')
    run = p.add_run(text)
    run.font.size = Pt(11)
    run.font.bold = True
    run.font.color.rgb = C_H3
    p.paragraph_format.space_before = Pt(4)

def add_body(doc, text, bold=False, color=None):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.size = Pt(10.5)
    run.font.bold = bold
    if color:
        run.font.color.rgb = color

def add_bullet(doc, text, level=0, color=None):
    p = doc.add_paragraph(style='List Bullet')
    run = p.add_run(text)
    run.font.size = Pt(10.5)
    if color:
        run.font.color.rgb = color
    p.paragraph_format.left_indent = Inches(0.25 * (level + 1))

def add_simple_table(doc, headers, rows, header_bg=(0x2E, 0x75, 0xB6)):
    tbl = doc.add_table(rows=1+len(rows), cols=len(headers))
    tbl.style = 'Table Grid'
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        cell = tbl.rows[0].cells[i]
        cell.text = h
        set_cell_bg(cell, header_bg)
        for run in cell.paragraphs[0].runs:
            run.font.bold = True
            run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            run.font.size = Pt(10)
        cell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
    for ri, row_data in enumerate(rows):
        row = tbl.rows[ri+1]
        for ci, val in enumerate(row_data):
            cell = row.cells[ci]
            cell.text = str(val)
            for run in cell.paragraphs[0].runs:
                run.font.size = Pt(10)
    doc.add_paragraph()

def add_risk_box(doc, level, title, content):
    color_map = {'HIGH': C_RED, 'MED': C_ORANGE, 'LOW': C_GREEN}
    label_map = {'HIGH': '[高風險]', 'MED': '[中風險]', 'LOW': '[改善建議]'}
    tbl = doc.add_table(rows=2, cols=1)
    tbl.style = 'Table Grid'
    hcell = tbl.rows[0].cells[0]
    hcell.text = f'{label_map[level]}  {title}'
    for run in hcell.paragraphs[0].runs:
        run.font.bold = True
        run.font.color.rgb = color_map[level]
        run.font.size = Pt(10.5)
    bcell = tbl.rows[1].cells[0]
    bcell.text = content
    for run in bcell.paragraphs[0].runs:
        run.font.size = Pt(10)
    doc.add_paragraph()

def add_code_block(doc, file_ref, code_lines):
    p = doc.add_paragraph()
    run = p.add_run(f'[程式碼佐證]  {file_ref}')
    run.font.size = Pt(8.5)
    run.font.bold = True
    run.font.color.rgb = C_H1
    p.paragraph_format.space_after = Pt(0)
    tbl = doc.add_table(rows=1, cols=1)
    tbl.style = 'Table Grid'
    cell = tbl.rows[0].cells[0]
    set_cell_bg(cell, (0xF2, 0xF2, 0xF2))
    cell.text = ''
    for i, line in enumerate(code_lines):
        p2 = cell.paragraphs[0] if i == 0 else cell.add_paragraph()
        run2 = p2.add_run(line)
        run2.font.name = 'Courier New'
        run2.font.size = Pt(8)
        run2.font.color.rgb = RGBColor(0x20, 0x20, 0x20)
        p2.paragraph_format.space_before = Pt(0)
        p2.paragraph_format.space_after  = Pt(0)
    doc.add_paragraph()

def add_image(doc, filename, caption='', width_cm=14.5):
    img_path = os.path.join(DOCS_DIR, filename)
    if os.path.exists(img_path):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run().add_picture(img_path, width=Cm(width_cm))
        if caption:
            cp = doc.add_paragraph()
            cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
            cr = cp.add_run(caption)
            cr.font.size = Pt(9)
            cr.font.italic = True
            cr.font.color.rgb = RGBColor(0x60, 0x60, 0x60)
        doc.add_paragraph()

def add_toc(doc):
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_t = p_title.add_run('目　錄')
    run_t.font.size = Pt(16)
    run_t.font.bold = True
    run_t.font.color.rgb = C_TITLE
    p_title.paragraph_format.space_after = Pt(10)
    p = doc.add_paragraph()
    r1 = p.add_run()
    fc1 = OxmlElement('w:fldChar')
    fc1.set(qn('w:fldCharType'), 'begin')
    fc1.set(qn('w:dirty'), 'true')
    r1._r.append(fc1)
    r2 = p.add_run()
    instr = OxmlElement('w:instrText')
    instr.set(qn('xml:space'), 'preserve')
    instr.text = ' TOC \\o "1-3" \\h \\z \\u '
    r2._r.append(instr)
    r3 = p.add_run()
    fc2 = OxmlElement('w:fldChar')
    fc2.set(qn('w:fldCharType'), 'separate')
    r3._r.append(fc2)
    r4 = p.add_run()
    r4.text = '（開啟後右鍵 → 更新欄位，或 Ctrl+A → F9）'
    r4.font.size = Pt(9)
    r4.font.italic = True
    r4.font.color.rgb = RGBColor(0x80, 0x80, 0x80)
    r5 = p.add_run()
    fc3 = OxmlElement('w:fldChar')
    fc3.set(qn('w:fldCharType'), 'end')
    r5._r.append(fc3)
    doc.add_page_break()

# ════════════════════════════════
# 封面
# ════════════════════════════════
doc.add_paragraph()
doc.add_paragraph()
add_title(doc, '<系統名稱>')
add_title(doc, '<文件主標題>')
doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('<副標題或說明>')
run.font.size = Pt(13)
run.font.color.rgb = C_H2

doc.add_paragraph()
doc.add_paragraph()

meta = [
    ('文件版本', 'v1.0'),
    ('建立日期', 'YYYY-MM-DD'),
    ('涵蓋模組', '<模組清單>'),
]
add_simple_table(doc, ['項目', '說明'], meta, header_bg=(0x1F, 0x49, 0x7D))
doc.add_page_break()

# ════════════════════════════════
# 目錄
# ════════════════════════════════
add_toc(doc)

# ════════════════════════════════
# 章節內容（依需求填入）
# ════════════════════════════════
add_h1(doc, '一', '<章節標題>')
add_h2(doc, '1.1 <節標題>')
add_body(doc, '<內文說明>')
add_simple_table(doc, ['欄位A', '欄位B', '說明'], [
    ('值1', '值2', '說明1'),
])

# 風險框範例
add_risk_box(doc, 'HIGH', '<風險標題>', '<風險說明>')
add_risk_box(doc, 'MED',  '<中風險>',  '<說明>')
add_risk_box(doc, 'LOW',  '<建議>',    '<說明>')

# 程式碼佐證範例
add_code_block(doc, 'FileName.java : L10-20', [
    'String sql = "SELECT * FROM table WHERE id=\'" + id + "\'"',
    '// <-- 說明問題所在',
])

# 流程圖範例（需先執行 gen_flowcharts_<slug>.py）
# add_image(doc, 'fc1_xxx.png', '圖 1-1　XXX 流程圖')

doc.add_page_break()

# ════════════════════════════════
# 儲存
# ════════════════════════════════
out_path = 'docs/<輸出檔名>.docx'
doc.save(out_path)
print(f'DOCX saved: {out_path}')
```

---

## Flowchart Template

流程圖使用 matplotlib 繪製，所有形狀函式如下（固定不變）：

```python
# -*- coding: utf-8 -*-
import os, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
from docx.oxml.ns import qn  # not needed here, just reference

C_PROCESS  = '#2E75B6'
C_DECISION = '#ED7D31'
C_TERM     = '#70AD47'
C_WARN     = '#C00000'
C_ARROW    = '#404040'
C_BG       = '#FAFAFA'

def make_fig(w=10, h=14):
    fig, ax = plt.subplots(figsize=(w, h))
    fig.patch.set_facecolor(C_BG)
    ax.set_facecolor(C_BG)
    ax.set_xlim(0, w)
    ax.set_ylim(0, h)
    ax.axis('off')
    return fig, ax

def draw_rect(ax, x, y, w=3.6, h=0.55, color=C_PROCESS, text='', fontsize=9):
    box = FancyBboxPatch((x-w/2, y-h/2), w, h,
                         boxstyle='round,pad=0.05,rounding_size=0.12',
                         linewidth=1.2, edgecolor='white', facecolor=color, zorder=3)
    ax.add_patch(box)
    ax.text(x, y, text, ha='center', va='center',
            fontsize=fontsize, color='white',
            fontfamily='Microsoft JhengHei', zorder=4)

def draw_diamond(ax, x, y, w=3.8, h=0.8, color=C_DECISION, text='', fontsize=8.5):
    pts = [(x, y+h/2), (x+w/2, y), (x, y-h/2), (x-w/2, y)]
    ax.add_patch(plt.Polygon(pts, closed=True, linewidth=1.2,
                              edgecolor='white', facecolor=color, zorder=3))
    ax.text(x, y, text, ha='center', va='center',
            fontsize=fontsize, color='white',
            fontfamily='Microsoft JhengHei', zorder=4)

def draw_term(ax, x, y, w=2.8, h=0.5, color=C_TERM, text=''):
    box = FancyBboxPatch((x-w/2, y-h/2), w, h,
                         boxstyle='round,pad=0.05,rounding_size=0.22',
                         linewidth=1.5, edgecolor='white', facecolor=color, zorder=3)
    ax.add_patch(box)
    ax.text(x, y, text, ha='center', va='center',
            fontsize=10, color='white', fontweight='bold',
            fontfamily='Microsoft JhengHei', zorder=4)

def arrow(ax, x1, y1, x2, y2, label='', label_side='right'):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle='->', color=C_ARROW, lw=1.5), zorder=2)
    if label:
        mx, my = (x1+x2)/2, (y1+y2)/2
        dx = 0.15 if label_side == 'right' else -0.15
        ax.text(mx+dx, my, label, fontsize=8, color='#C00000',
                fontfamily='Microsoft JhengHei',
                ha='left' if label_side=='right' else 'right', va='center')

# 使用範例：
# fig, ax = make_fig(9, 15)
# ax.set_title('流程標題', fontsize=14, ...)
# draw_term(ax, 4.5, 14.0, text='開始')
# draw_rect(ax, 4.5, 13.0, text='步驟一')
# arrow(ax, 4.5, 13.7, 4.5, 13.3)
# fig.savefig('docs/fc1_xxx.png', dpi=150, bbox_inches='tight')
# plt.close(fig)
```

---

## Output Conventions

| 項目 | 規則 |
|------|------|
| 腳本路徑 | `docs/gen_docx_<slug>.py` |
| 流程圖腳本 | `docs/gen_flowcharts_<slug>.py` |
| PNG 暫存 | `docs/fc<n>_<name>.png` |
| DOCX 輸出 | `docs/<中文主題>.docx` |
| 字型（中文） | Microsoft JhengHei（流程圖）|
| 字型（程式碼）| Courier New |
| 頁面 | A4，四邊 2.5cm |

---

## Reference Implementation

完整實作範例參考：

```
c:\Users\7010\Desktop\gravityTest\PCLMS_AP\JAVA\pclms_mvn\docs\gen_docx.py
c:\Users\7010\Desktop\gravityTest\PCLMS_AP\JAVA\pclms_mvn\docs\gen_flowcharts.py
```

產出文件：`docs\進出倉確認流程深度分析.docx`
