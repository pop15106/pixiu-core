---
name: md-to-docx
description: |
  Markdown 轉 Word(.docx) 文件 Skill。
  使用 python-docx 將結構化 Markdown（標題、表格、代碼塊、清單）
  轉換為可交付的 .docx 報告。
  當使用者提及「產生 docx」、「轉 Word」、「匯出文件」時自動載入。
license: MIT
compatibility: Pixiu Agent / Claude Code / Cursor
metadata:
  author: pixiu
  version: "1.0.0"
  category: workflow
  tags: [docx, word, report, markdown, python-docx]
---

# 📄 Markdown → Word (.docx) 轉換

## 何時啟用

- 使用者要求產出可交付的 Word 文件（給主管、客戶、資安審查）
- 已有結構化 Markdown，需轉為正式格式
- 關鍵字：「產生 docx」「轉 Word」「匯出文件」「generate docx」

## 執行流程

### Step 1：確認環境

```bash
python -c "from docx import Document; print('ok')"
# 若失敗：pip install python-docx
```

### Step 2：使用標準轉換腳本

專案若已有 `md_to_docx_util.py`，直接呼叫：

```bash
python -c "
from md_to_docx_util import create_docx_from_md
create_docx_from_md('input.md', 'output.docx')
"
```

### Step 3：無現成腳本時，使用內建範本

```python
from docx import Document
from docx.shared import Pt, RGBColor

def md_to_docx(md_path: str, docx_path: str):
    doc = Document()
    style = doc.styles['Normal']
    style.font.name = 'Arial'
    style.font.size = Pt(11)

    in_code = False
    code_buf = []

    with open(md_path, encoding='utf-8') as f:
        for line in f:
            s = line.strip()
            if s.startswith('```'):
                if not in_code:
                    in_code = True
                else:
                    p = doc.add_paragraph()
                    p.paragraph_format.left_indent = Pt(20)
                    run = p.add_run('\n'.join(code_buf))
                    run.font.name = 'Courier New'
                    run.font.size = Pt(9)
                    run.font.color.rgb = RGBColor(50, 50, 50)
                    in_code, code_buf = False, []
                continue
            if in_code:
                code_buf.append(line.rstrip())
                continue
            if s.startswith('# '):
                doc.add_heading(s[2:], level=1)
            elif s.startswith('## '):
                doc.add_heading(s[3:], level=2)
            elif s.startswith('### '):
                doc.add_heading(s[4:], level=3)
            elif s.startswith('---'):
                doc.add_page_break()
            elif s:
                doc.add_paragraph(s)

    doc.save(docx_path)
    print(f"✅ 已儲存：{docx_path}")
```

## 輸出品質檢查清單

- [ ] 標題層級正確（H1/H2/H3）
- [ ] 代碼塊使用等寬字體（Courier New）
- [ ] 表格正確渲染
- [ ] 檔案可正常用 Word / LibreOffice 開啟
- [ ] 無 PermissionError（確認目標檔案未被開啟）

## 已知限制

| 元素 | 支援度 |
|------|--------|
| 標題（H1~H3）| ✅ 完整支援 |
| 段落文字 | ✅ 完整支援 |
| 代碼塊 | ✅ Courier New + 縮排 |
| 粗體 / 斜體 | ⚠️ 需額外解析 `**` `*` |
| Markdown 表格 | ⚠️ 需額外解析 |
| 圖片 | ❌ 不支援 |

## 注意事項

- 目標 .docx 被 Word 開啟時會導致 PermissionError，需先關閉
- 中文字體建議改為 `'微軟正黑體'` 或 `'標楷體'` 以符合繁體中文規範
