"""
تقرير PDF للمناديب — fpdf2 مع دعم العربية الصحيح (RTL)
"""
from __future__ import annotations
from io import BytesIO
from datetime import datetime
import os

from fpdf import FPDF

# ── مكتبات العربية ─────────────────────────────────────────────────────────
try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    _HAS_ARABIC = True
except ImportError:
    _HAS_ARABIC = False

# ── مسار الخط ──────────────────────────────────────────────────────────────
_FONT_DIR     = os.path.join(os.path.dirname(__file__), "fonts")
_FONT_REGULAR = os.path.join(_FONT_DIR, "NotoSansArabic-Regular.ttf")
_USE_FONT     = os.path.exists(_FONT_REGULAR)


def _ar(text: str | None) -> str:
    """تحويل النص العربي لعرضه صحيحاً في PDF (reshape + bidi)"""
    if not text:
        return ""
    text = str(text)
    if not _USE_FONT or not _HAS_ARABIC:
        # بدون خط عربي — نعيد ASCII فقط
        try:
            return text.encode("latin-1").decode("latin-1")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return text.encode("latin-1", errors="replace").decode("latin-1")
    try:
        reshaped = arabic_reshaper.reshape(text)
        return get_display(reshaped)
    except Exception:
        return text


def _safe(text: str | None) -> str:
    """نص آمن — أرقام وتواريخ وكودات (ASCII فقط)"""
    if not text:
        return ""
    return str(text)


def _fmt(n) -> str:
    try:
        return f"{float(n or 0):,.2f}"
    except Exception:
        return "0.00"


def _date(d) -> str:
    if not d:
        return "-"
    try:
        if isinstance(d, str):
            d = datetime.fromisoformat(d.split("T")[0])
        return d.strftime("%Y/%m/%d")
    except Exception:
        return str(d)


# ══════════════════════════════════════════════════════════════════════════════
class RepsPDF(FPDF):
    C_BLUE   = (37,  99,  235)
    C_GREEN  = (5,  150, 105)
    C_RED    = (220, 38,  38)
    C_AMBER  = (217,119,   6)
    C_PURPLE = (124, 58, 237)
    C_DARK   = (30,  41,  59)
    C_MUTED  = (100,116, 139)
    C_ALT    = (248,250, 252)
    C_WHITE  = (255,255, 255)

    def __init__(self):
        super().__init__(orientation="L", unit="mm", format="A4")
        self.set_auto_page_break(auto=True, margin=14)
        self.set_margins(10, 10, 10)
        # تسجيل الخط
        if _USE_FONT:
            self.add_font("Ar", "",  _FONT_REGULAR, uni=True)
            self.add_font("Ar", "B", _FONT_REGULAR, uni=True)
            self._f = "Ar"
        else:
            self._f = "Helvetica"

    # ── header / footer ────────────────────────────────────────────────────
    def header(self):
        self.set_fill_color(*self.C_BLUE)
        self.rect(0, 0, self.w, 12, "F")
        self.set_text_color(*self.C_WHITE)
        self.set_font(self._f, "B", 12)
        self.set_y(1)
        self.cell(0, 10, _ar(getattr(self, "_title", "Rep Report")), align="C")
        self.set_y(14)
        self.set_text_color(*self.C_DARK)

    def footer(self):
        self.set_y(-11)
        self.set_font(self._f, "", 7)
        self.set_text_color(*self.C_MUTED)
        ts = datetime.now().strftime("%Y/%m/%d %H:%M")
        pg = self.page_no()
        self.cell(0, 6, f"{ts}   |   {pg}", align="C")

    # ── helpers ────────────────────────────────────────────────────────────
    def sec(self, label: str, color=None):
        """عنوان قسم"""
        self.ln(3)
        c = color or self.C_BLUE
        self.set_fill_color(*c)
        self.set_text_color(*self.C_WHITE)
        self.set_font(self._f, "B", 9)
        self.cell(0, 7, f"  {_ar(label)}", fill=True, ln=True)
        self.set_text_color(*self.C_DARK)
        self.ln(1)

    def th(self, cols):
        """رأس جدول — cols: list[{ar, w, align?}]
        نعكس ترتيب الأعمدة لـ RTL"""
        self.set_fill_color(*self.C_DARK)
        self.set_text_color(*self.C_WHITE)
        self.set_font(self._f, "B", 7.5)
        for col in reversed(cols):
            self.cell(col["w"], 6, _ar(col["ar"]),
                      border=0, fill=True, align=col.get("align", "C"))
        self.ln()
        self.set_text_color(*self.C_DARK)

    def tr(self, cols, cells, alt=False):
        """صف جدول — cells: list[{text, color?, align?}] بنفس ترتيب cols
        نعكس الاثنين معاً لـ RTL"""
        bg = self.C_ALT if alt else self.C_WHITE
        self.set_fill_color(*bg)
        self.set_font(self._f, "", 7.5)
        for col, cell in zip(reversed(cols), reversed(cells)):
            clr = cell.get("color", self.C_DARK)
            self.set_text_color(*clr)
            txt = cell.get("text", "")
            # النص العربي يحتاج _ar، الأرقام يبقون _safe
            rendered = _ar(str(txt)) if txt else ""
            self.cell(col["w"], 5.5, rendered,
                      border=0, fill=True, align=col.get("align", "R"))
        self.ln()
        self.set_text_color(*self.C_DARK)

    def stat_row(self, items):
        """صف صناديق إحصاء — items: [{label, value, color}]"""
        n = len(items)
        bw = (self.w - 20) / n
        y0 = self.get_y()
        for i, item in enumerate(items):
            x = 10 + i * bw
            self.set_fill_color(248, 250, 252)
            self.rect(x + 0.5, y0, bw - 1, 17, "F")
            self.set_draw_color(226, 232, 240)
            self.rect(x + 0.5, y0, bw - 1, 17)
            # label
            self.set_font(self._f, "", 6.5)
            self.set_text_color(*self.C_MUTED)
            self.set_xy(x + 0.5, y0 + 1.5)
            self.cell(bw - 1, 5, _ar(item["label"]), align="C")
            # value
            self.set_font(self._f, "B", 9)
            clr = item.get("color", self.C_DARK)
            self.set_text_color(*clr)
            self.set_xy(x + 0.5, y0 + 7)
            self.cell(bw - 1, 7, _ar(str(item["value"])), align="C")
        self.set_draw_color(0, 0, 0)
        self.ln(20)


# ══════════════════════════════════════════════════════════════════════════════
def generate_reps_summary_pdf(
    reps_data: list[dict],
    invoices: list[dict],
    company_name: str = "",
    filter_rep_id: str = "",
    filter_zone: str = "",
    filter_month: str = "",
) -> bytes:

    pdf = RepsPDF()
    pdf._title = "تقرير المناديب — أداء المبيعات"

    today = datetime.now().strftime("%Y/%m/%d")
    sub_parts = []
    if filter_zone:  sub_parts.append(f"المنطقة: {filter_zone}")
    if filter_month: sub_parts.append(f"الشهر: {filter_month}")
    if not sub_parts: sub_parts.append(today)

    # ══ صفحة 1: ملخص الفريق + جدول الأداء ══════════════════════════════════
    pdf.add_page()

    # اسم الشركة
    if company_name:
        pdf.set_font(pdf._f, "B", 10)
        pdf.cell(0, 6, _ar(company_name), align="C", ln=True)
    pdf.set_font(pdf._f, "", 7.5)
    pdf.set_text_color(*pdf.C_MUTED)
    pdf.cell(0, 5, _ar("  |  ".join(sub_parts)), align="C", ln=True)
    pdf.set_text_color(*pdf.C_DARK)
    pdf.ln(2)

    # ── إحصاءات ──────────────────────────────────────────────────────────────
    total_sales      = sum(float(r.get("total_sales",      0)) for r in reps_data)
    total_collected  = sum(float(r.get("total_collected",  0)) for r in reps_data)
    total_outstanding= sum(float(r.get("outstanding",      0)) for r in reps_data)
    total_commission = sum(
        float(r.get("total_sales", 0)) * float(r.get("commission_pct", 0)) / 100
        for r in reps_data
    )
    pending_count = len([i for i in invoices if i.get("status") == "submitted"])

    pdf.stat_row([
        {"label": "عدد المناديب",           "value": str(len(reps_data)),       "color": pdf.C_BLUE},
        {"label": "إجمالي المبيعات SAR",    "value": _fmt(total_sales),          "color": pdf.C_BLUE},
        {"label": "المحصّل SAR",             "value": _fmt(total_collected),      "color": pdf.C_GREEN},
        {"label": "المستحق SAR",             "value": _fmt(total_outstanding),    "color": pdf.C_RED if total_outstanding > 0 else pdf.C_GREEN},
        {"label": "العمولات SAR",            "value": _fmt(total_commission),     "color": pdf.C_PURPLE},
        {"label": "فواتير انتظار المراجعة", "value": str(pending_count),         "color": pdf.C_AMBER if pending_count > 0 else pdf.C_GREEN},
    ])

    # ── جدول الأداء ──────────────────────────────────────────────────────────
    pdf.sec("مقارنة أداء المناديب")

    perf_cols = [
        {"ar": "#",            "w": 7,  "align": "C"},
        {"ar": "المندوب",      "w": 35, "align": "R"},
        {"ar": "الكود",        "w": 18, "align": "C"},
        {"ar": "المنطقة",      "w": 22, "align": "R"},
        {"ar": "الهدف SAR",    "w": 26, "align": "R"},
        {"ar": "المبيعات SAR", "w": 28, "align": "R"},
        {"ar": "التحقق",       "w": 16, "align": "C"},
        {"ar": "المحصّل SAR",  "w": 26, "align": "R"},
        {"ar": "المستحق SAR",  "w": 26, "align": "R"},
        {"ar": "الفواتير",     "w": 14, "align": "C"},
        {"ar": "المعلقة",      "w": 14, "align": "C"},
        {"ar": "العمولة SAR",  "w": 25, "align": "R"},
    ]
    pdf.th(perf_cols)

    sorted_reps = sorted(reps_data, key=lambda r: float(r.get("total_sales", 0)), reverse=True)

    for idx, rep in enumerate(sorted_reps):
        sales       = float(rep.get("total_sales",     0))
        collected   = float(rep.get("total_collected", 0))
        outstanding = float(rep.get("outstanding",     0))
        target      = float(rep.get("target_monthly",  0))
        pct         = round(min(100, sales / target * 100)) if target > 0 else 0
        commission  = sales * float(rep.get("commission_pct", 0)) / 100
        inv_count   = rep.get("invoice_count", 0)
        pending     = len([i for i in invoices
                           if i.get("rep_id") == rep.get("id")
                           and i.get("status") == "submitted"])

        rank_str = f"{idx+1}."
        pct_clr  = pdf.C_GREEN if pct >= 100 else (pdf.C_AMBER if pct >= 70 else pdf.C_RED)
        out_clr  = pdf.C_RED if outstanding > 0 else pdf.C_GREEN

        pdf.tr(perf_cols, [
            {"text": rank_str,                                   "color": pdf.C_MUTED,  "align": "C"},
            {"text": rep.get("full_name", ""),                   "align": "R"},
            {"text": rep.get("rep_code",  ""),                   "align": "C"},
            {"text": rep.get("zone", "-"),                       "align": "R"},
            {"text": _fmt(target) if target > 0 else "-",        "align": "R"},
            {"text": _fmt(sales),                                "color": pdf.C_BLUE,   "align": "R"},
            {"text": f"{pct}%" if target > 0 else "-",          "color": pct_clr,      "align": "C"},
            {"text": _fmt(collected),                            "color": pdf.C_GREEN,  "align": "R"},
            {"text": _fmt(outstanding),                          "color": out_clr,      "align": "R"},
            {"text": str(inv_count),                             "align": "C"},
            {"text": str(pending) if pending > 0 else "-",      "color": pdf.C_AMBER if pending > 0 else pdf.C_DARK, "align": "C"},
            {"text": _fmt(commission) if commission > 0 else "-","color": pdf.C_PURPLE, "align": "R"},
        ], alt=idx % 2 == 1)

    # صف الإجمالي
    total_inv  = sum(r.get("invoice_count", 0) for r in reps_data)
    total_pend = sum(len([i for i in invoices
                          if i.get("rep_id") == r.get("id")
                          and i.get("status") == "submitted"])
                     for r in reps_data)

    pdf.set_fill_color(*pdf.C_DARK)
    pdf.set_text_color(*pdf.C_WHITE)
    pdf.set_font(pdf._f, "B", 7.5)
    totals_row = [
        {"text": "",                                    "w": 7},
        {"text": _ar("الإجمالي"),                       "w": 35, "align": "R"},
        {"text": "",                                    "w": 18},
        {"text": "",                                    "w": 22},
        {"text": "",                                    "w": 26},
        {"text": _fmt(total_sales),                    "w": 28, "align": "R"},
        {"text": "",                                    "w": 16},
        {"text": _fmt(total_collected),                "w": 26, "align": "R"},
        {"text": _fmt(total_outstanding),              "w": 26, "align": "R"},
        {"text": str(total_inv),                       "w": 14, "align": "C"},
        {"text": str(total_pend) if total_pend > 0 else "-", "w": 14, "align": "C"},
        {"text": _fmt(total_commission),               "w": 25, "align": "R"},
    ]
    for c in reversed(totals_row):
        pdf.cell(c["w"], 6, c.get("text", ""), border=0, fill=True, align=c.get("align", "R"))
    pdf.ln()
    pdf.set_text_color(*pdf.C_DARK)

    # ══ صفحة 2: الفواتير التفصيلية ══════════════════════════════════════════
    STATUS_AR = {
        "draft": "مسودة", "submitted": "بانتظار المراجعة", "approved": "تمت الموافقة",
        "rejected": "معادة للمندوب", "confirmed": "مؤكدة", "paid": "مدفوعة",
        "partial": "مدفوعة جزئيًا", "overdue": "متأخرة السداد", "cancelled": "ملغاة",
    }
    STATUS_CLR = {
        "draft": pdf.C_MUTED, "submitted": pdf.C_AMBER, "approved": pdf.C_BLUE,
        "rejected": pdf.C_RED, "confirmed": pdf.C_GREEN, "paid": pdf.C_GREEN,
        "partial": pdf.C_AMBER, "overdue": pdf.C_RED, "cancelled": pdf.C_MUTED,
    }
    PAY_AR = {"cash": "نقد", "credit": "آجل", "cheque": "شيك", "transfer": "تحويل"}

    rep_map = {r["id"]: r for r in reps_data}
    financial_statuses = {"confirmed", "paid", "partial", "overdue"}
    # تفاصيل وإجماليات تقرير المبيعات تقتصر على الفواتير التي اكتملت
    # دورتها المالية. تبقى submitted في عداد المراجعة أعلى التقرير فقط.
    inv_list = [
        i for i in invoices
        if i.get("rep_id") and i.get("status") in financial_statuses
    ]

    if inv_list:
        pdf.add_page()
        pdf.sec("الفواتير التفصيلية")

        # ملخص صغير
        t_amt  = sum(float(i.get("total",       0)) for i in inv_list)
        t_paid = sum(float(i.get("paid_amount", 0)) for i in inv_list)
        t_rem  = t_amt - t_paid
        pdf.set_font(pdf._f, "", 7.5)
        pdf.set_text_color(*pdf.C_MUTED)
        pdf.cell(0, 5,
                 _ar(f"عدد الفواتير: {len(inv_list)}  |  الإجمالي: {_fmt(t_amt)} SAR  |  المحصّل: {_fmt(t_paid)} SAR  |  المتبقي: {_fmt(t_rem)} SAR"),
                 align="C", ln=True)
        pdf.set_text_color(*pdf.C_DARK)
        pdf.ln(1)

        inv_cols = [
            {"ar": "رقم الفاتورة", "w": 25, "align": "C"},
            {"ar": "المندوب",      "w": 30, "align": "R"},
            {"ar": "العميل",       "w": 38, "align": "R"},
            {"ar": "الحالة",       "w": 25, "align": "C"},
            {"ar": "طريقة الدفع", "w": 18, "align": "C"},
            {"ar": "التاريخ",      "w": 20, "align": "C"},
            {"ar": "الإجمالي",     "w": 26, "align": "R"},
            {"ar": "المدفوع",      "w": 22, "align": "R"},
            {"ar": "المتبقي",      "w": 23, "align": "R"},
        ]

        status_order = {
            "submitted": 0, "approved": 1, "confirmed": 2,
            "partial": 3, "paid": 4, "rejected": 5, "draft": 6, "cancelled": 7,
        }
        sorted_invs = sorted(inv_list, key=lambda i: (
            status_order.get(i.get("status", ""), 9),
            i.get("issue_date") or ""
        ))

        current_status = None
        row_idx = 0

        for inv in sorted_invs:
            status = inv.get("status", "")

            if status != current_status:
                current_status = status
                pdf.ln(2)
                st_label = STATUS_AR.get(status, status)
                st_color = STATUS_CLR.get(status, pdf.C_MUTED)
                count_st = len([x for x in sorted_invs if x.get("status") == status])
                pdf.sec(f"{st_label}  ({count_st})", color=st_color)
                pdf.th(inv_cols)
                row_idx = 0

            rep       = rep_map.get(inv.get("rep_id", ""), {})
            remaining = max(0.0, float(inv.get("total", 0)) - float(inv.get("paid_amount", 0)))
            out_clr   = pdf.C_RED if remaining > 0.01 else pdf.C_GREEN

            pdf.tr(inv_cols, [
                {"text": inv.get("invoice_number", ""), "align": "C"},
                {"text": rep.get("full_name", "-"),     "align": "R"},
                {"text": inv.get("buyer_name_ar", "-"), "align": "R"},
                {"text": STATUS_AR.get(status, status), "color": STATUS_CLR.get(status, pdf.C_DARK), "align": "C"},
                {"text": PAY_AR.get(inv.get("invoice_payment_method", ""), "-"), "align": "C"},
                {"text": _date(inv.get("issue_date")),  "align": "C"},
                {"text": _fmt(inv.get("total",        0)), "align": "R"},
                {"text": _fmt(inv.get("paid_amount",  0)), "color": pdf.C_GREEN, "align": "R"},
                {"text": _fmt(remaining),                  "color": out_clr,     "align": "R"},
            ], alt=row_idx % 2 == 1)
            row_idx += 1

    # ══ صفحة 3+: تفاصيل مندوب واحد (إذا طُلب) ══════════════════════════════
    if filter_rep_id:
        rep_info     = rep_map.get(filter_rep_id, {})
        rep_invoices = [
            i for i in invoices
            if i.get("rep_id") == filter_rep_id and i.get("status") in financial_statuses
        ]

        if rep_info:
            pdf.add_page()
            pdf.sec(f"تقرير مفصل  -  {rep_info.get('full_name', '')}")

            # بيانات المندوب — جدولان جنباً إلى جنب
            half = (pdf.w - 20) / 2
            rows_a = [
                ("الاسم",        rep_info.get("full_name",       "-")),
                ("الكود",        rep_info.get("rep_code",        "-")),
                ("المنطقة",      rep_info.get("zone",            "-")),
                ("الجوال",       rep_info.get("phone",           "-")),
            ]
            rows_b = [
                ("المستودع",     rep_info.get("warehouse_name",  "-")),
                ("السيارة",      rep_info.get("vehicle_plate",   "-")),
                ("الهدف الشهري", f"{_fmt(rep_info.get('target_monthly', 0))} SAR"),
                ("العمولة",      f"{rep_info.get('commission_pct', 0)}%"),
            ]
            pdf.set_font(pdf._f, "", 8)
            y0 = pdf.get_y()
            for i, (lbl, val) in enumerate(rows_a):
                pdf.set_xy(10, y0 + i * 6)
                pdf.set_text_color(*pdf.C_MUTED)
                pdf.cell(28, 5, _ar(lbl + ":"), align="R")
                pdf.set_text_color(*pdf.C_DARK)
                pdf.set_font(pdf._f, "B", 8)
                pdf.cell(half - 30, 5, _ar(str(val)), align="R")
                pdf.set_font(pdf._f, "", 8)

            for i, (lbl, val) in enumerate(rows_b):
                pdf.set_xy(10 + half, y0 + i * 6)
                pdf.set_text_color(*pdf.C_MUTED)
                pdf.cell(28, 5, _ar(lbl + ":"), align="R")
                pdf.set_text_color(*pdf.C_DARK)
                pdf.set_font(pdf._f, "B", 8)
                pdf.cell(half - 30, 5, _ar(str(val)), align="R")
                pdf.set_font(pdf._f, "", 8)

            pdf.set_y(y0 + len(rows_a) * 6 + 4)

            # إحصاءات الفواتير حسب الحالة
            if rep_invoices:
                pdf.sec("إحصائيات الفواتير")
                groups: dict[str, list] = {}
                for inv in rep_invoices:
                    s = inv.get("status", "other")
                    groups.setdefault(s, []).append(inv)

                boxes = []
                for status, invs in sorted(groups.items(), key=lambda x: status_order.get(x[0], 9)):
                    total_s = sum(float(i.get("total", 0)) for i in invs)
                    boxes.append({
                        "label": f"{STATUS_AR.get(status, status)} ({len(invs)})",
                        "value": f"{_fmt(total_s)} SAR",
                        "color": STATUS_CLR.get(status, pdf.C_DARK),
                    })

                for chunk_start in range(0, len(boxes), 5):
                    pdf.stat_row(boxes[chunk_start:chunk_start + 5])

    # ── output ────────────────────────────────────────────────────────────────
    buf = BytesIO()
    pdf.output(buf)
    return buf.getvalue()
