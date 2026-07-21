from __future__ import annotations

import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Interview-OS-product-spec-v0.5.0.md"
OUTPUT = ROOT / "docs" / "Interview-OS-产品与架构说明-v0.5.0.pdf"

FONT_REGULAR = "MicrosoftYaHei"
FONT_BOLD = "MicrosoftYaHeiBold"
BLUE = colors.HexColor("#2E74B5")
DARK_BLUE = colors.HexColor("#1F4D78")
INK = colors.HexColor("#1D2F44")
MUTED = colors.HexColor("#66778A")
LIGHT_FILL = colors.HexColor("#F2F4F7")
CALLOUT_FILL = colors.HexColor("#EEF5FC")
GREEN_FILL = colors.HexColor("#E7F4EE")
BORDER = colors.HexColor("#D8E0E8")


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont(FONT_REGULAR, r"C:\Windows\Fonts\msyh.ttc", subfontIndex=0))
    pdfmetrics.registerFont(TTFont(FONT_BOLD, r"C:\Windows\Fonts\msyhbd.ttc", subfontIndex=0))


def inline_markup(text: str) -> str:
    parts: list[str] = []
    position = 0
    for match in re.finditer(r"(\*\*.+?\*\*|`.+?`)", text):
        parts.append(html.escape(text[position:match.start()]))
        token = match.group(0)
        if token.startswith("**"):
            parts.append(f"<b>{html.escape(token[2:-2])}</b>")
        else:
            parts.append(f'<font name="Courier" color="#1F4D78">{html.escape(token[1:-1])}</font>')
        position = match.end()
    parts.append(html.escape(text[position:]))
    return "".join(parts)


def make_styles():
    styles = getSampleStyleSheet()
    return {
        "body": ParagraphStyle(
            "Body",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=11,
            leading=13.75,
            textColor=INK,
            spaceAfter=6,
            wordWrap="CJK",
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=styles["Heading1"],
            fontName=FONT_BOLD,
            fontSize=16,
            leading=20,
            textColor=BLUE,
            spaceBefore=18,
            spaceAfter=10,
            keepWithNext=True,
            wordWrap="CJK",
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=styles["Heading2"],
            fontName=FONT_BOLD,
            fontSize=13,
            leading=17,
            textColor=BLUE,
            spaceBefore=14,
            spaceAfter=7,
            keepWithNext=True,
            wordWrap="CJK",
        ),
        "h3": ParagraphStyle(
            "H3",
            parent=styles["Heading3"],
            fontName=FONT_BOLD,
            fontSize=12,
            leading=15,
            textColor=DARK_BLUE,
            spaceBefore=10,
            spaceAfter=5,
            keepWithNext=True,
            wordWrap="CJK",
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=11,
            leading=13.75,
            leftIndent=27,
            firstLineIndent=-13.5,
            bulletIndent=13.5,
            spaceAfter=4,
            textColor=INK,
            wordWrap="CJK",
        ),
        "code": ParagraphStyle(
            "Code",
            parent=styles["Code"],
            fontName="Courier",
            fontSize=9,
            leading=11,
            textColor=colors.HexColor("#334E68"),
            wordWrap="CJK",
        ),
        "callout": ParagraphStyle(
            "Callout",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=10.5,
            leading=13,
            textColor=DARK_BLUE,
            wordWrap="CJK",
        ),
        "meta_label": ParagraphStyle(
            "MetaLabel",
            parent=styles["Normal"],
            fontName=FONT_BOLD,
            fontSize=10.5,
            leading=14,
            textColor=INK,
            wordWrap="CJK",
        ),
        "meta_value": ParagraphStyle(
            "MetaValue",
            parent=styles["Normal"],
            fontName=FONT_REGULAR,
            fontSize=10.5,
            leading=14,
            textColor=MUTED,
            wordWrap="CJK",
        ),
    }


def table_widths(column_count: int) -> list[float]:
    if column_count == 2:
        return [125, 343]
    if column_count == 3:
        return [105, 240, 123]
    if column_count == 4:
        return [90, 130, 75, 173]
    return [468 / column_count] * column_count


def parse_table(lines: list[str], start: int) -> tuple[list[list[str]], int]:
    rows: list[list[str]] = []
    index = start
    while index < len(lines) and lines[index].strip().startswith("|"):
        rows.append([cell.strip() for cell in lines[index].strip().strip("|").split("|")])
        index += 1
    if len(rows) >= 2 and all(re.fullmatch(r":?-{3,}:?", cell.replace(" ", "")) for cell in rows[1]):
        rows.pop(1)
    return rows, index


def make_table(rows: list[list[str]], styles) -> Table:
    data: list[list[Paragraph]] = []
    for row_index, row in enumerate(rows):
        row_style = ParagraphStyle(
            f"Table{row_index}",
            parent=styles["body"],
            fontName=FONT_BOLD if row_index == 0 else FONT_REGULAR,
            fontSize=9.2,
            leading=11.5,
            spaceAfter=0,
            alignment=TA_LEFT,
        )
        data.append([Paragraph(inline_markup(cell), row_style) for cell in row])
    table = Table(data, colWidths=table_widths(len(rows[0])), repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT_FILL),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK),
        ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def draw_later_page(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont(FONT_BOLD, 8.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(72, LETTER[1] - 38, "INTERVIEW OS  |  产品与架构说明")
    canvas.setFont(FONT_REGULAR, 8.5)
    canvas.drawRightString(LETTER[0] - 72, LETTER[1] - 38, "v0.5.0")
    canvas.drawRightString(LETTER[0] - 72, 36, f"Interview OS  |  {doc.page}")
    canvas.restoreState()


def draw_first_page(canvas, doc) -> None:
    canvas.saveState()
    canvas.setTitle("Interview OS 产品与架构说明 v0.5.0")
    canvas.setAuthor("Interview OS Project")
    canvas.setSubject("产品需求文档与系统架构说明")
    canvas.restoreState()


def build_pdf() -> Path:
    register_fonts()
    styles = make_styles()
    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=LETTER,
        rightMargin=inch,
        leftMargin=inch,
        topMargin=inch,
        bottomMargin=inch,
        title="Interview OS 产品与架构说明 v0.5.0",
        author="Interview OS Project",
    )
    story = []

    kicker_style = ParagraphStyle(
        "Kicker", fontName=FONT_BOLD, fontSize=9.5, leading=12, textColor=BLUE, spaceAfter=14
    )
    title_style = ParagraphStyle(
        "Title", fontName=FONT_BOLD, fontSize=28, leading=34, textColor=INK, spaceAfter=6, wordWrap="CJK"
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", fontName=FONT_REGULAR, fontSize=14, leading=19, textColor=MUTED, spaceAfter=20, wordWrap="CJK"
    )
    story.extend([
        Spacer(1, 26),
        Paragraph("PRODUCT SPECIFICATION / SYSTEM ARCHITECTURE", kicker_style),
        Paragraph("Interview OS", title_style),
        Paragraph("产品与架构说明", subtitle_style),
    ])
    meta = [
        ("版本", "v0.5.0 Career Workspace + Obsidian Phase 1"),
        ("阶段", "本地求职闭环与知识资产导出可用，真实外部连接器逐步接入前"),
        ("文档类型", "产品需求文档（PRD）+ 系统架构说明"),
        ("更新时间", "2026-07-21"),
        ("项目位置", str(ROOT)),
    ]
    meta_table = Table(
        [[Paragraph(label, styles["meta_label"]), Paragraph(value, styles["meta_value"])] for label, value in meta],
        colWidths=[86, 382],
        hAlign="LEFT",
    )
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.extend([meta_table, Spacer(1, 20)])
    callout = Table(
        [[Paragraph(
            "当前结论：Interview OS 已形成岗位、简历、投递、训练、求职 Agent 和 Obsidian 知识资产导出的本地闭环。真实招聘平台抓取、外部推送、自动投递和双向同步仍保持关闭。",
            styles["callout"],
        )]],
        colWidths=[468],
        hAlign="LEFT",
    )
    callout.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GREEN_FILL),
        ("LINEBEFORE", (0, 0), (0, -1), 3, colors.HexColor("#176B53")),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    story.extend([callout, Spacer(1, 62), Paragraph("Internal Product Document", ParagraphStyle(
        "Internal", fontName=FONT_REGULAR, fontSize=9, textColor=MUTED, alignment=TA_RIGHT
    )), PageBreak()])

    story.append(Paragraph("文档目录", styles["h1"]))
    section_titles = [line[3:] for line in lines if re.match(r"^## \d+\.", line)]
    for section in section_titles:
        story.append(Paragraph(f"• {html.escape(section)}", styles["bullet"]))
    story.append(PageBreak())

    index = next(i for i, line in enumerate(lines) if line.startswith("## 1."))
    in_code = False
    code_lines: list[str] = []
    page_break_sections = {"## 5.", "## 7."}
    while index < len(lines):
        raw = lines[index]
        stripped = raw.strip()
        if stripped.startswith("```"):
            if in_code:
                code_paragraph = Paragraph("<br/>".join(html.escape(line) for line in code_lines), styles["code"])
                box = Table([[code_paragraph]], colWidths=[468], hAlign="LEFT")
                box.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), LIGHT_FILL),
                    ("BOX", (0, 0), (-1, -1), 0.4, BORDER),
                    ("LEFTPADDING", (0, 0), (-1, -1), 9),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ]))
                story.extend([box, Spacer(1, 6)])
                code_lines = []
                in_code = False
            else:
                in_code = True
            index += 1
            continue
        if in_code:
            code_lines.append(raw)
            index += 1
            continue
        if not stripped:
            index += 1
            continue
        if stripped.startswith("|"):
            rows, index = parse_table(lines, index)
            story.extend([make_table(rows, styles), Spacer(1, 6)])
            continue
        if stripped.startswith("## "):
            if any(stripped.startswith(prefix) for prefix in page_break_sections) and story:
                story.append(PageBreak())
            story.append(Paragraph(inline_markup(stripped[3:]), styles["h1"]))
        elif stripped.startswith("### "):
            story.append(Paragraph(inline_markup(stripped[4:]), styles["h2"]))
        elif stripped.startswith("> "):
            p = Paragraph(inline_markup(stripped[2:]), styles["callout"])
            box = Table([[p]], colWidths=[468], hAlign="LEFT")
            box.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), CALLOUT_FILL),
                ("LINEBEFORE", (0, 0), (0, -1), 3, BLUE),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]))
            story.extend([box, Spacer(1, 6)])
        elif re.match(r"^\d+\.\s", stripped):
            story.append(Paragraph(inline_markup(stripped), styles["bullet"]))
        elif stripped.startswith("- "):
            story.append(Paragraph(f"• {inline_markup(stripped[2:])}", styles["bullet"]))
        else:
            story.append(Paragraph(inline_markup(stripped.replace("  ", " ")), styles["body"]))
        index += 1

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.build(story, onFirstPage=draw_first_page, onLaterPages=draw_later_page)
    return OUTPUT


if __name__ == "__main__":
    print(build_pdf())
