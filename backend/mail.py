"""Transactional email helpers (invite, etc.)."""
from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage
from html import escape

logger = logging.getLogger("elegant_exchange.mail")

STORE_NAME = "The Elegant Exchange"
MAGENTA = "#8B1F6B"
INK = "#1a1a1a"


def mail_configured() -> bool:
    return bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_FROM"))


def _frontend_url() -> str:
    return (os.environ.get("FRONTEND_URL") or "http://localhost:3000").rstrip("/")


def _role_blurb(role: str) -> str:
    r = (role or "retail").lower()
    if r == "admin":
        return (
            "As Admin, you manage the shop setup (Square, commission split), "
            "invite the team, and have full access to floor ops, payouts, and analytics."
        )
    if r == "manager":
        return (
            "As Manager, you run day-to-day floor work plus payouts and analytics—"
            "consignors, inventory, sales, and what’s owed."
        )
    return (
        "As Retail, you’ll work the floor: consignors, inventory intake & tags, "
        "and logging sales so store and consignor cuts stay accurate."
    )


def build_invite_email(
    *,
    name: str,
    email: str,
    password: str,
    role: str,
    invited_by: str | None = None,
) -> tuple[str, str, str]:
    """Returns (subject, text_body, html_body)."""
    login_url = f"{_frontend_url()}/login"
    role_label = (role or "retail").capitalize()
    safe_name = escape(name or "there")
    safe_email = escape(email)
    safe_password = escape(password)
    safe_role = escape(role_label)
    blurb = escape(_role_blurb(role))
    byline = (
        f"Invited by {escape(invited_by)}."
        if invited_by
        else f"Welcome to {STORE_NAME}."
    )

    subject = f"You’re invited to {STORE_NAME}"

    text = f"""{STORE_NAME} — team invite

Hi {name or "there"},

{byline}

You’ve been added as {role_label}. Sign in here:
{login_url}

Email: {email}
Temporary password: {password}

On first sign-in you’ll set your own password. Then a short in-app guide will walk you through the workspace.

What this app is for
{STORE_NAME}’s back-of-house tool for consignment: track consignors and pieces, print tags, log sales, and (for managers) handle payouts and performance.

{_role_blurb(role)}

— {STORE_NAME}
"""

    html = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0f0f0;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#fcfcfc;border:1px solid #e8e8e8;border-radius:11px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 12px;background:linear-gradient(135deg,#f7eef4 0%,#fcfcfc 55%);">
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b6b6b;font-family:Helvetica,Arial,sans-serif;">Team invite</div>
              <div style="font-size:26px;color:{INK};margin-top:8px;font-weight:600;">{STORE_NAME}</div>
              <div style="font-size:14px;color:#666;margin-top:6px;font-family:Helvetica,Arial,sans-serif;">Back of house for boutique consignment</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px;font-family:Helvetica,Arial,sans-serif;color:{INK};font-size:14px;line-height:1.55;">
              <p style="margin:16px 0 0;">Hi {safe_name},</p>
              <p style="margin:12px 0 0;color:#444;">{byline} You’ve been added as <strong style="color:{MAGENTA};">{safe_role}</strong>.</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border:1px solid #e8e8e8;border-radius:8px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <div style="font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#888;margin-bottom:8px;">Your login</div>
                    <div style="margin:0 0 6px;"><span style="color:#888;">Email</span><br/><strong>{safe_email}</strong></div>
                    <div style="margin:10px 0 0;"><span style="color:#888;">Temporary password</span><br/><strong style="font-family:ui-monospace,Menlo,monospace;">{safe_password}</strong></div>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 18px;">
                <a href="{escape(login_url)}" style="display:inline-block;background:{MAGENTA};color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">
                  Sign in
                </a>
              </p>

              <p style="margin:0 0 10px;color:#444;">
                On first sign-in you’ll choose your own password. After that, a short guide on the site walks you through the pages you’ll use.
              </p>

              <div style="font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#888;margin:22px 0 8px;">How we use this app</div>
              <p style="margin:0 0 10px;color:#444;">
                Track consignors and inventory, print tags, log sales, and keep store vs consignor splits accurate. Managers also handle payouts and analytics.
              </p>
              <p style="margin:0;color:#444;">{blurb}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #eee;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#999;">
              {STORE_NAME} · 38 Central Sq., Bridgewater, MA
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    return subject, text, html


def send_email(*, to: str, subject: str, text: str, html: str) -> dict:
    """
    Send via SMTP when configured.
    If SMTP is not set, logs the message and returns delivered=False (dev-friendly).
    """
    to = (to or "").strip().lower()
    if not to:
        return {"delivered": False, "reason": "missing_recipient"}

    if not mail_configured():
        logger.info(
            "SMTP not configured — invite email for %s (subject=%s)\n%s",
            to,
            subject,
            text,
        )
        return {
            "delivered": False,
            "reason": "smtp_not_configured",
            "preview_text": text,
        }

    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT") or "587")
    user = os.environ.get("SMTP_USER") or ""
    password = os.environ.get("SMTP_PASSWORD") or ""
    from_addr = os.environ["SMTP_FROM"]
    use_tls = (os.environ.get("SMTP_TLS") or "true").lower() in ("1", "true", "yes")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    try:
        with smtplib.SMTP(host, port, timeout=20) as smtp:
            if use_tls:
                smtp.starttls()
            if user:
                smtp.login(user, password)
            smtp.send_message(msg)
        logger.info("Sent email to %s (%s)", to, subject)
        return {"delivered": True}
    except Exception as e:
        logger.exception("Failed to send email to %s", to)
        return {"delivered": False, "reason": str(e), "preview_text": text}
