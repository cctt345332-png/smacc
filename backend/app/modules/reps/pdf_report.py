"""
تقرير PDF للمناديب — يُولَّد بـ fpdf2 مع دعم العربية
"""
from __future__ import annotations
from io import BytesIO
from datetime import datetime
from decimal import Decimal
import os

from fpdf import FPDF

# ── مساعد العربية ──────────────────────────────────────────────────────────
try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    _HAS_ARABIC = True
except ImportError:
    _HAS_ARABIC = False


def _ar(text: str | None) -> str:
    """تحويل النص العربي لعرضه صحيحاً في PDF"""
    if not text:
        return ""
    text = str(text)
    if not _USE_ARABIC_FONT:
        # بدون خط Unicode نعيد النص كما هو لكن نستبدل الحروف غير Latin
        # نحاول encode آمن — إذا فشل نعيد نص بديل
        try:
            return text.encode("latin-1").decode("latin-1")
        except (UnicodeEncodeError, UnicodeDecodeError):
            # نحذف الأحرف غير Latin أو نستبدلها بـ ?
            return text.encode("latin-1", errors="replace").decode("latin-1")
    if not _HAS_ARABIC:
        return text
    try:
        reshaped = arabic_reshaper.reshape(text)
        return get_display(reshaped)
    except Exception:
        return text


def _fmt(n) -> str:
    try:
        return f"{float(n or 0):,.2f}"
    except Exception:
        return "0.00"


def _date(d) -> str:
    if not d:
        return "—"
    try:
        if isinstance(d, str):
            d = datetime.fromisoformat(d.split("T")[0])
        return d.strftime("%Y/%m/%d")
    except Exception:
        return str(d)


# ── مسار الخط ──────────────────────────────────────────────────────────────
_FONT_DIR = os.path.join(os.path.dirname(__file__), "fonts")
_FONT_REGULAR = os.path.join(_FONT_DIR, "NotoSansArabic-Regular.ttf")
_FONT_BOLD    = os.path.join(_FONT_DIR, "NotoSansArabic-Bold.ttf")

# نتحقق من وجود الخط — لو ما موجود نستخدم Helvetica (بدون عربية)
_USE_ARABIC_FONT = os.path.exists(_FONT_REGULAR)


# ══════════════════════════════════════════════════════════════════════════════
class RepsPDF(FPDF):
    """PDF مخصص لتقرير المناديب"""

    TITLE_COLOR  = (30, 41, 59)    # slate-800
    HEADER_COLOR = (37, 99, 235)   # blue-600
    ACCENT_COLOR = (5, 150, 105)   # green-600
    WARN_COLOR   = (220, 38, 38)   # red-600
    MUTED_COLOR  = (100, 116, 139) # slate-500
    ROW_ALT      = (248, 250, 252) # slate-50

    def __init__(self, title: str = "تقرير المناديب", subtitle: str = ""):
        super().__init__(orientation="L", unit="mm", format="A4")
        self.set_auto_page_break(auto=True, margin=15)
        self.set_margins(12, 12, 12)
        self._title_ar   = title
        self._subtitle   = subtitle
        self._page_title = _ar(title)

        # تسجيل الخط
        if _USE_ARABIC_FONT:
            self.add_font("Arabic", "",   _FONT_REGULAR, uni=True)
            self.add_font("Arabic", "B",  _FONT_BOLD,    uni=True)
            self._font = "Arabic"
        else:
            self._font = "Helvetica"

    # ── Header / Footer ────────────────────────────────────────────────────
    def header(self):
        # شريط علوي
        self.set_fill_color(*self.HEADER_COLOR)
        self.rect(0, 0, self.w, 14, "F")
        self.set_text_color(255, 255, 255)
        self.set_font(self._font, "B", 13)
        self.set_y(2)
        self.cell(0, 10, self._page_title, align="C")
        self.set_y(16)
        self.set_text_color(*self.TITLE_COLOR)

    def footer(self):
        self.set_y(-12)
        self.set_font(self._font, "", 8)
        self.set_text_color(*self.MUTED_COLOR)
        now = datetime.now().strftime("%Y/%m/%d %H:%M")
        self.cell(0, 6, f"{now}  —  {_ar('تاريخ الطباعة')}  |  {self.page_no()}", align="C")

    # ── helpers ────────────────────────────────────────────────────────────
    def section_title(self, text: str):
        self.ln(4)
        self.set_fill_color(*self.HEADER_COLOR)
        self.set_text_color(255, 255, 255)
        self.set_font(self._font, "B", 10)
        self.cell(0, 8, f"  {_ar(text)}", fill=True, ln=True)
        self.set_text_color(*self.TITLE_COLOR)
        self.ln(1)

    def kv_row(self, label: str, value: str, x: float = None, w: float = 80):
        """صف بيانات ثنائي (تسمية: قيمة)"""
        if x is not None:
            self.set_x(x)
        self.set_font(self._font, "", 9)
        self.set_text_color(*self.MUTED_COLOR)
        self.cell(35, 6, _ar(label + ":"), align="R")
        self.set_text_color(*self.TITLE_COLOR)
        self.set_font(self._font, "B", 9)
        self.cell(w, 6, _ar(str(value)), align="R")
        self.set_font(self._font, "", 9)

    def table_header(self, cols: list[dict]):
        """رأس جدول — cols: [{text, w, align}]"""
        self.set_fill_color(*self.HEADER_COLOR)
        self.set_text_color(255, 255, 255)
        self.set_font(self._font, "B", 8)
        for col in cols:
            self.cell(col["w"], 7, _ar(col["text"]), border=0, fill=True, align=col.get("align", "C"))
        self.ln()
        self.set_text_color(*self.TITLE_COLOR)

    def table_row(self, cells: list[dict], alt: bool = False):
        """صف جدول — cells: [{text, w, align, color?}]"""
        if alt:
            self.set_fill_color(*self.ROW_ALT)
        else:
            self.set_fill_color(255, 255, 255)
        self.set_font(self._font, "", 8)
        for cell in cells:
            if "color" in cell:
                self.set_text_color(*cell["color"])
            else:
                self.set_text_color(*self.TITLE_COLOR)
            self.cell(cell["w"], 6, _ar(str(cell.get("text", ""))), border=0,
                      fill=True, align=cell.get("align", "R"))
        self.ln()
        self.set_text_color(*self.TITLE_COLOR)

    def summary_box(self, items: list[dict]):
        """صناديق ملخص في صف — items: [{label, value, color}]"""
        box_w = (self.w - 24) / len(items)
        x_start = 12
        for i, item in enumerate(items):
            x = x_start + i * box_w
            # إطار
            self.set_fill_color(248, 250, 252)
            self.rect(x + 1, self.get_y(), box_w - 2, 18, "F")
            self.set_draw_color(226, 232, 240)
            self.rect(x + 1, self.get_y(), box_w - 2, 18)
            # تسمية
            self.set_font(self._font, "", 7)
            self.set_text_color(*self.MUTED_COLOR)
            self.set_xy(x + 1, self.get_y() + 2)
            self.cell(box_w - 2, 5, _ar(item["label"]), align="C")
            # قيمة
            color = item.get("color", self.TITLE_COLOR)
            self.set_font(self._font, "B", 10)
            self.set_text_color(*color)
            self.set_xy(x + 1, self.get_y() + 5)
            self.cell(box_w - 2, 7, _ar(str(item["value"])), align="C")
        self.ln(22)
        self.set_draw_color(0, 0, 0)


# ══════════════════════════════════════════════════════════════════════════════
# دالة توليد تقرير جميع المناديب
# ══════════════════════════════════════════════════════════════════════════════
def generate_reps_summary_pdf(
    reps_data: list[dict],          # قائمة المناديب مع الملخص
    invoices: list[dict],           # كل الفواتير
    company_name: str = "",
    filter_rep_id: str = "",
    filter_zone: str = "",
    filter_month: str = "",
) -> bytes:
    """
    يُولّد PDF مجدول بـ:
    - صفحة 1: ملخص أداء الفريق + جدول كل المناديب
    - صفحة 2+: لكل مندوب (لو filter_rep_id) أو تفاصيل الفواتير
    """
    now_str = datetime.now().strftime("%Y/%m/%d")

    # بناء عنوان فرعي
    parts = []
    if filter_zone:   parts.append(f"المنطقة: {filter_zone}")
    if filter_month:  parts.append(f"الشهر: {filter_month}")
    if not parts:     parts.append(now_str)

    pdf = RepsPDF(
        title="تقرير المناديب — أداء المبيعات",
        subtitle=" | ".join(parts),
    )

    # ─── الصفحة 1: ملخص الفريق ───────────────────────────────────────────
    pdf.add_page()

    # اسم الشركة + التاريخ
    if company_name:
        pdf.set_font(pdf._font, "B", 11)
        pdf.set_text_color(*pdf.TITLE_COLOR)
        pdf.cell(0, 7, _ar(company_name), align="C", ln=True)
    pdf.set_font(pdf._font, "", 8)
    pdf.set_text_color(*pdf.MUTED_COLOR)
    pdf.cell(0, 5, _ar(" | ".join(parts)), align="C", ln=True)
    pdf.ln(3)

    # ── بطاقات الملخص العام ────────────────────────────────────────────────
    active_reps = [r for r in reps_data if r.get("is_active", True)]
    total_sales      = sum(float(r.get("total_sales", 0))     for r in reps_data)
    total_collected  = sum(float(r.get("total_collected", 0)) for r in reps_data)
    total_outstanding= sum(float(r.get("outstanding", 0))     for r in reps_data)
    total_commission = sum(
        float(r.get("total_sales", 0)) * float(r.get("commission_pct", 0)) / 100
        for r in reps_data
    )
    pending_count = len([i for i in invoices if i.get("status") == "submitted"])

    pdf.summary_box([
        {"label": "عدد المناديب",         "value": str(len(active_reps)),              "color": pdf.HEADER_COLOR},
        {"label": "إجمالي المبيعات (SAR)", "value": _fmt(total_sales),                  "color": pdf.HEADER_COLOR},
        {"label": "المحصّل (SAR)",          "value": _fmt(total_collected),              "color": pdf.ACCENT_COLOR},
        {"label": "المستحق (SAR)",          "value": _fmt(total_outstanding),            "color": pdf.WARN_COLOR if total_outstanding > 0 else pdf.ACCENT_COLOR},
        {"label": "العمولات (SAR)",         "value": _fmt(total_commission),             "color": (124, 58, 237)},
        {"label": "فواتير بانتظار المراجعة","value": str(pending_count),                "color": (217, 119, 6) if pending_count > 0 else pdf.ACCENT_COLOR},
    ])

    # ── جدول أداء المناديب ────────────────────────────────────────────────
    pdf.section_title("مقارنة أداء المناديب")

    cols = [
        {"text": "#",               "w": 8,  "align": "C"},
        {"text": "المندوب",          "w": 38, "align": "R"},
        {"text": "الكود",            "w": 20, "align": "C"},
        {"text": "المنطقة",          "w": 25, "align": "R"},
        {"text": "الهدف (SAR)",      "w": 28, "align": "R"},
        {"text": "المبيعات (SAR)",   "w": 32, "align": "R"},
        {"text": "التحقق%",          "w": 18, "align": "C"},
        {"text": "المحصّل (SAR)",     "w": 28, "align": "R"},
        {"text": "المستحق (SAR)",    "w": 28, "align": "R"},
        {"text": "الفواتير",         "w": 16, "align": "C"},
        {"text": "المعلقة",          "w": 16, "align": "C"},
        {"text": "العمولة (SAR)",    "w": 25, "align": "R"},
    ]
    pdf.table_header(cols)

    sorted_reps = sorted(reps_data, key=lambda r: float(r.get("total_sales", 0)), reverse=True)
    medals = ["🥇", "🥈", "🥉"]

    for idx, rep in enumerate(sorted_reps):
        sales     = float(rep.get("total_sales", 0))
        collected = float(rep.get("total_collected", 0))
        outstanding = float(rep.get("outstanding", 0))
        target    = float(rep.get("target_monthly", 0))
        pct       = round(min(100, sales / target * 100)) if target > 0 else 0
        commission= sales * float(rep.get("commission_pct", 0)) / 100
        pending   = len([i for i in invoices if i.get("rep_id") == rep.get("id") and i.get("status") == "submitted"])
        inv_count = rep.get("invoice_count", 0)

        rank = medals[idx] if idx < 3 else str(idx + 1)

        pct_color = pdf.ACCENT_COLOR if pct >= 100 else ((217,119,6) if pct >= 70 else pdf.WARN_COLOR)
        out_color = pdf.WARN_COLOR if outstanding > 0 else pdf.ACCENT_COLOR

        pdf.table_row([
            {"text": rank,                    "w": 8,  "align": "C"},
            {"text": rep.get("full_name",""), "w": 38, "align": "R"},
            {"text": rep.get("rep_code",""),  "w": 20, "align": "C"},
            {"text": rep.get("zone","—"),     "w": 25, "align": "R"},
            {"text": _fmt(target) if target > 0 else "—", "w": 28, "align": "R"},
            {"text": _fmt(sales),             "w": 32, "align": "R", "color": pdf.HEADER_COLOR},
            {"text": f"{pct}%" if target > 0 else "—", "w": 18, "align": "C", "color": pct_color},
            {"text": _fmt(collected),         "w": 28, "align": "R", "color": pdf.ACCENT_COLOR},
            {"text": _fmt(outstanding),       "w": 28, "align": "R", "color": out_color},
            {"text": str(inv_count),          "w": 16, "align": "C"},
            {"text": str(pending) if pending > 0 else "—", "w": 16, "align": "C",
             "color": (217,119,6) if pending > 0 else pdf.TITLE_COLOR},
            {"text": _fmt(commission) if commission > 0 else "—", "w": 25, "align": "R", "color": (124,58,237)},
        ], alt=idx % 2 == 1)

    # ── سطر الإجمالي ──────────────────────────────────────────────────────
    total_inv = sum(r.get("invoice_count", 0) for r in reps_data)
    total_pend= sum(len([i for i in invoices if i.get("rep_id") == r.get("id") and i.get("status") == "submitted"]) for r in reps_data)

    pdf.set_fill_color(30, 41, 59)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font(pdf._font, "B", 8)
    summary_cells = [
        {"text": "", "w": 8},
        {"text": _ar("الإجمالي"), "w": 38, "align": "R"},
        {"text": "", "w": 20},
        {"text": "", "w": 25},
        {"text": "", "w": 28},
        {"text": _fmt(total_sales),       "w": 32, "align": "R"},
        {"text": "", "w": 18},
        {"text": _fmt(total_collected),   "w": 28, "align": "R"},
        {"text": _fmt(total_outstanding), "w": 28, "align": "R"},
        {"text": str(total_inv),          "w": 16, "align": "C"},
        {"text": str(total_pend) if total_pend > 0 else "—", "w": 16, "align": "C"},
        {"text": _fmt(total_commission),  "w": 25, "align": "R"},
    ]
    for c in summary_cells:
        pdf.cell(c["w"], 7, c.get("text",""), border=0, fill=True, align=c.get("align","R"))
    pdf.ln()
    pdf.set_text_color(*pdf.TITLE_COLOR)

    # ─── الصفحة 2: جدول الفواتير التفصيلية ─────────────────────────────
    STATUS_AR = {
        "draft": "مسودة", "submitted": "بانتظار", "approved": "موافق",
        "rejected": "مرفوضة", "confirmed": "مؤكدة", "paid": "مدفوعة",
        "partial": "جزئي", "cancelled": "ملغاة",
    }
    STATUS_COLOR = {
        "draft": pdf.MUTED_COLOR, "submitted": (217,119,6), "approved": pdf.HEADER_COLOR,
        "rejected": pdf.WARN_COLOR, "confirmed": pdf.ACCENT_COLOR, "paid": pdf.ACCENT_COLOR,
        "partial": (217,119,6), "cancelled": pdf.MUTED_COLOR,
    }
    PAY_AR = {"cash": "نقد", "credit": "آجل", "cheque": "شيك", "transfer": "تحويل"}

    # بناء map للمناديب
    rep_map = {r["id"]: r for r in reps_data}

    # فلتر الفواتير — فقط فواتير المناديب
    inv_list = [i for i in invoices if i.get("rep_id")]

    if inv_list:
        pdf.add_page()
        pdf.set_font(pdf._font, "B", 10)
        pdf.set_text_color(*pdf.TITLE_COLOR)
        pdf.ln(2)
        pdf.section_title("الفواتير التفصيلية — جميع المناديب")

        # ملخص صغير
        total_inv_amount = sum(float(i.get("total", 0)) for i in inv_list)
        total_paid_amount = sum(float(i.get("paid_amount", 0)) for i in inv_list)
        total_remaining  = total_inv_amount - total_paid_amount

        pdf.set_font(pdf._font, "", 8)
        pdf.set_text_color(*pdf.MUTED_COLOR)
        pdf.cell(0, 5, _ar(f"إجمالي الفواتير: {len(inv_list)}  |  المجموع: {_fmt(total_inv_amount)} SAR  |  المحصّل: {_fmt(total_paid_amount)} SAR  |  المتبقي: {_fmt(total_remaining)} SAR"), align="C", ln=True)
        pdf.ln(2)

        inv_cols = [
            {"text": "رقم الفاتورة", "w": 28, "align": "C"},
            {"text": "المندوب",       "w": 35, "align": "R"},
            {"text": "العميل",        "w": 40, "align": "R"},
            {"text": "الحالة",        "w": 22, "align": "C"},
            {"text": "طريقة الدفع",  "w": 20, "align": "C"},
            {"text": "التاريخ",       "w": 22, "align": "C"},
            {"text": "الإجمالي",      "w": 28, "align": "R"},
            {"text": "المدفوع",       "w": 25, "align": "R"},
            {"text": "المتبقي",       "w": 27, "align": "R"},
        ]

        # نجمع الفواتير مجمعة حسب الحالة للترتيب: submitted أولاً
        status_order = {"submitted": 0, "approved": 1, "confirmed": 2, "partial": 3,
                        "paid": 4, "rejected": 5, "draft": 6, "cancelled": 7}
        sorted_invs = sorted(inv_list, key=lambda i: (
            status_order.get(i.get("status",""), 9),
            i.get("issue_date", "") or ""
        ))

        current_status = None
        row_idx = 0

        for inv in sorted_invs:
            status = inv.get("status", "")

            # فاصل الحالة
            if status != current_status:
                current_status = status
                pdf.ln(2)
                st_label = STATUS_AR.get(status, status)
                st_color = STATUS_COLOR.get(status, pdf.MUTED_COLOR)
                pdf.set_fill_color(*st_color)
                pdf.set_text_color(255, 255, 255)
                pdf.set_font(pdf._font, "B", 8)
                pdf.cell(0, 6, f"  {_ar(st_label)}  ({len([x for x in sorted_invs if x.get('status') == status])})", fill=True, ln=True)
                pdf.set_text_color(*pdf.TITLE_COLOR)
                pdf.table_header(inv_cols)
                row_idx = 0

            rep   = rep_map.get(inv.get("rep_id", ""), {})
            remaining = max(0, float(inv.get("total", 0)) - float(inv.get("paid_amount", 0)))

            pdf.table_row([
                {"text": inv.get("invoice_number", ""), "w": 28, "align": "C"},
                {"text": rep.get("full_name", "—"),      "w": 35, "align": "R"},
                {"text": inv.get("buyer_name_ar", "—"), "w": 40, "align": "R"},
                {"text": STATUS_AR.get(status, status), "w": 22, "align": "C",
                 "color": STATUS_COLOR.get(status, pdf.TITLE_COLOR)},
                {"text": PAY_AR.get(inv.get("invoice_payment_method",""), "—"), "w": 20, "align": "C"},
                {"text": _date(inv.get("issue_date")),  "w": 22, "align": "C"},
                {"text": _fmt(inv.get("total", 0)),     "w": 28, "align": "R"},
                {"text": _fmt(inv.get("paid_amount",0)),"w": 25, "align": "R", "color": pdf.ACCENT_COLOR},
                {"text": _fmt(remaining),               "w": 27, "align": "R",
                 "color": pdf.WARN_COLOR if remaining > 0.01 else pdf.ACCENT_COLOR},
            ], alt=row_idx % 2 == 1)
            row_idx += 1

    # ─── صفحة تفاصيل لكل مندوب (لو طُلب مندوب واحد) ─────────────────────
    if filter_rep_id:
        rep_invoices = [i for i in invoices if i.get("rep_id") == filter_rep_id]
        rep_info = rep_map.get(filter_rep_id, {})

        if rep_info and rep_invoices:
            pdf.add_page()
            pdf.section_title(f"تقرير مفصل — {rep_info.get('full_name','')}")

            # بيانات المندوب
            pdf.set_font(pdf._font, "", 9)
            y = pdf.get_y()
            col_w = (pdf.w - 24) / 2
            info_rows = [
                [("الاسم", rep_info.get("full_name","")),       ("الكود", rep_info.get("rep_code",""))],
                [("المنطقة", rep_info.get("zone","—")),          ("الجوال", rep_info.get("phone","—"))],
                [("المستودع", rep_info.get("warehouse_name","—")),("السيارة", rep_info.get("vehicle_plate","—"))],
                [("الهدف الشهري", f"{_fmt(rep_info.get('target_monthly',0))} SAR"),
                 ("نسبة العمولة", f"{rep_info.get('commission_pct',0)}%")],
            ]
            for row in info_rows:
                for j, (label, val) in enumerate(row):
                    pdf.set_x(12 + j * col_w)
                    pdf.kv_row(label, str(val), w=col_w - 40)
                pdf.ln(6)

            # إحصائيات الفواتير حسب الحالة
            pdf.ln(2)
            pdf.section_title("إحصائيات الفواتير")

            status_groups: dict[str, list] = {}
            for inv in rep_invoices:
                s = inv.get("status", "other")
                status_groups.setdefault(s, []).append(inv)

            stat_boxes = []
            for status, invs in sorted(status_groups.items(), key=lambda x: status_order.get(x[0], 9)):
                total_s = sum(float(i.get("total", 0)) for i in invs)
                stat_boxes.append({
                    "label": f"{STATUS_AR.get(status, status)} ({len(invs)})",
                    "value": f"{_fmt(total_s)} SAR",
                    "color": STATUS_COLOR.get(status, pdf.TITLE_COLOR),
                })

            if stat_boxes:
                # نقسمها على 4 في صف
                for chunk_start in range(0, len(stat_boxes), 4):
                    chunk = stat_boxes[chunk_start:chunk_start+4]
                    pdf.summary_box(chunk)

    # ── تجميع الـ bytes ────────────────────────────────────────────────────
    buf = BytesIO()
    pdf.output(buf)
    return buf.getvalue()
