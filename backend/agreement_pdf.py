"""PDF generation for the signed Consignment Agreement."""
import base64
import io
from datetime import datetime
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, black, grey
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Image,
    Table,
    TableStyle,
    PageBreak,
)

MAGENTA = HexColor("#8B1F6B")


def _decode_signature(data_url: str) -> io.BytesIO | None:
    if not data_url or not data_url.startswith("data:image/"):
        return None
    try:
        _, payload = data_url.split(",", 1)
        return io.BytesIO(base64.b64decode(payload))
    except Exception:
        return None


def render_agreement_pdf(consignor: dict) -> bytes:
    """Render the signed agreement to a PDF and return bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=LETTER,
        leftMargin=0.9 * inch,
        rightMargin=0.9 * inch,
        topMargin=0.85 * inch,
        bottomMargin=0.85 * inch,
        title="Consignment Agreement",
    )

    styles = getSampleStyleSheet()
    eyebrow = ParagraphStyle(
        "eyebrow",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=MAGENTA,
        alignment=TA_CENTER,
        spaceAfter=4,
    )
    title = ParagraphStyle(
        "title",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=26,
        textColor=black,
        alignment=TA_CENTER,
        spaceAfter=2,
    )
    subtitle = ParagraphStyle(
        "subtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=grey,
        alignment=TA_CENTER,
        spaceAfter=16,
    )
    body = ParagraphStyle(
        "body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=black,
        spaceAfter=8,
        alignment=TA_LEFT,
    )
    meta_label = ParagraphStyle(
        "meta_label",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=9,
        textColor=grey,
    )
    meta_val = ParagraphStyle(
        "meta_val",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=13,
        textColor=black,
    )

    agreement = consignor.get("agreement", {}) or {}
    agreement_text = agreement.get("agreement_text", "")
    signed_name = agreement.get("signed_name") or consignor.get("full_name", "")
    signed_at_iso = agreement.get("signed_at", "")
    try:
        signed_at = datetime.fromisoformat(signed_at_iso.replace("Z", "+00:00"))
        signed_at_str = signed_at.strftime("%B %d, %Y · %I:%M %p UTC")
    except Exception:
        signed_at_str = signed_at_iso or "—"

    flow = []
    # Header
    flow.append(Paragraph("THE ELEGANT EXCHANGE", eyebrow))
    flow.append(Paragraph("Consignment Agreement", title))
    flow.append(
        Paragraph(
            "Boutique Consignment · 38 Central Sq., Bridgewater, MA 02324",
            subtitle,
        )
    )

    # Meta strip
    meta_data = [
        [
            Paragraph("CONSIGNOR", meta_label),
            Paragraph("CONSIGNOR ID", meta_label),
            Paragraph("SIGNED", meta_label),
        ],
        [
            Paragraph(consignor.get("full_name", "—"), meta_val),
            Paragraph(consignor.get("consignor_id", "—"), meta_val),
            Paragraph(signed_at_str, meta_val),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[2.2 * inch, 1.6 * inch, 2.6 * inch])
    meta_table.setStyle(
        TableStyle(
            [
                ("LINEABOVE", (0, 0), (-1, 0), 0.6, MAGENTA),
                ("LINEBELOW", (0, -1), (-1, -1), 0.5, HexColor("#dddddd")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    flow.append(meta_table)
    flow.append(Spacer(1, 16))

    # Agreement body
    for para in agreement_text.split("\n\n"):
        if not para.strip():
            continue
        # Escape angle brackets that paragraph may interpret
        safe = (
            para.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        )
        flow.append(Paragraph(safe.replace("\n", "<br/>"), body))

    # Signature block
    flow.append(Spacer(1, 12))
    sig_img_io = _decode_signature(agreement.get("signature_data_url", ""))
    sig_cell = None
    if sig_img_io:
        try:
            img = Image(sig_img_io, width=2.6 * inch, height=0.9 * inch, kind="proportional")
            sig_cell = img
        except Exception:
            sig_cell = Paragraph("(signature missing)", meta_val)
    else:
        sig_cell = Paragraph("(signature missing)", meta_val)

    sig_data = [
        [
            sig_cell,
            Paragraph(signed_name, meta_val),
        ],
        [
            Paragraph("SIGNATURE", meta_label),
            Paragraph("PRINTED NAME · DATE SIGNED", meta_label),
        ],
    ]
    sig_table = Table(sig_data, colWidths=[3.4 * inch, 3.0 * inch])
    sig_table.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, black),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
                ("TOPPADDING", (0, 1), (-1, 1), 4),
                ("VALIGN", (0, 0), (-1, 0), "BOTTOM"),
            ]
        )
    )
    flow.append(sig_table)

    flow.append(Spacer(1, 18))
    flow.append(
        Paragraph(
            f"Witnessed and recorded by The Elegant Exchange · "
            f"{agreement.get('signed_by_staff', '—')}",
            ParagraphStyle(
                "footer",
                parent=styles["Normal"],
                fontName="Helvetica-Oblique",
                fontSize=8,
                leading=10,
                textColor=grey,
                alignment=TA_CENTER,
            ),
        )
    )

    doc.build(flow)
    return buf.getvalue()
