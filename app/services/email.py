"""
GrePre Smart Life - Email Service
Handles email notifications for bill reminders and system notifications.
"""

import asyncio
import logging
import smtplib
import ssl
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional

from pydantic import BaseModel, EmailStr
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class EmailSettings(BaseSettings):
    """Email configuration settings."""

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "GrePre Smart Life"
    SMTP_USE_TLS: bool = True

    # Feature flag
    EMAIL_ENABLED: bool = False

    class Config:
        env_prefix = ""
        extra = "ignore"


email_settings = EmailSettings()


class EmailMessage(BaseModel):
    """Email message model."""

    to: List[EmailStr]
    subject: str
    body_text: str
    body_html: Optional[str] = None
    reply_to: Optional[EmailStr] = None


class EmailTemplate:
    """Email templates for various notifications."""

    @staticmethod
    def bill_reminder(
        user_name: str,
        bill_name: str,
        amount: float,
        due_date: datetime,
        days_until_due: int,
    ) -> tuple[str, str]:
        """Generate bill reminder email."""

        subject = f"Bill Reminder: {bill_name} due in {days_until_due} day(s)"

        text_body = f"""
Hello {user_name},

This is a reminder that your bill "{bill_name}" is due soon.

Bill Details:
- Name: {bill_name}
- Amount: ${amount:.2f}
- Due Date: {due_date.strftime('%B %d, %Y')}
- Days Until Due: {days_until_due}

Please ensure you make the payment on time to avoid any late fees.

Best regards,
GrePre Smart Life Team
        """.strip()

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }}
        .content {{ background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }}
        .bill-details {{ background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }}
        .amount {{ font-size: 24px; color: #667eea; font-weight: bold; }}
        .due-date {{ color: #e74c3c; font-weight: bold; }}
        .footer {{ text-align: center; padding: 15px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Bill Reminder</h1>
        </div>
        <div class="content">
            <p>Hello <strong>{user_name}</strong>,</p>
            <p>This is a reminder that your bill is due soon.</p>

            <div class="bill-details">
                <h3>{bill_name}</h3>
                <p class="amount">${amount:.2f}</p>
                <p class="due-date">Due: {due_date.strftime('%B %d, %Y')} ({days_until_due} day(s) remaining)</p>
            </div>

            <p>Please ensure you make the payment on time to avoid any late fees.</p>
        </div>
        <div class="footer">
            <p>This email was sent by GrePre Smart Life</p>
            <p>© {datetime.now().year} GrePre Smart Life. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        """.strip()

        return subject, text_body, html_body

    @staticmethod
    def welcome_email(user_name: str, user_email: str) -> tuple[str, str, str]:
        """Generate welcome email for new users."""

        subject = "Welcome to GrePre Smart Life!"

        text_body = f"""
Hello {user_name},

Welcome to GrePre Smart Life! We're excited to have you on board.

Your account has been successfully created with the email: {user_email}

With GrePre Smart Life, you can:
- Track and manage your bills
- Set up reminders for due dates
- Scan and store documents
- Categorize your expenses
- Export your financial data

Get started by adding your first bill today!

If you have any questions, feel free to reply to this email.

Best regards,
The GrePre Smart Life Team
        """.strip()

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
        .content {{ background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }}
        .features {{ display: grid; gap: 10px; margin: 20px 0; }}
        .feature {{ background: white; padding: 12px; border-radius: 6px; border-left: 4px solid #667eea; }}
        .cta-button {{ display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
        .footer {{ text-align: center; padding: 15px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Welcome to GrePre Smart Life!</h1>
        </div>
        <div class="content">
            <p>Hello <strong>{user_name}</strong>,</p>
            <p>We're thrilled to have you join GrePre Smart Life! Your account has been successfully created.</p>

            <p><strong>Your email:</strong> {user_email}</p>

            <h3>What you can do with GrePre Smart Life:</h3>
            <div class="features">
                <div class="feature">📋 Track and manage all your bills in one place</div>
                <div class="feature">⏰ Set up smart reminders for due dates</div>
                <div class="feature">📄 Scan and store important documents</div>
                <div class="feature">📊 Categorize and analyze your expenses</div>
                <div class="feature">📥 Export your financial data anytime</div>
            </div>

            <p>Get started by adding your first bill today!</p>
        </div>
        <div class="footer">
            <p>© {datetime.now().year} GrePre Smart Life. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        """.strip()

        return subject, text_body, html_body

    @staticmethod
    def password_reset(user_name: str, reset_link: str) -> tuple[str, str, str]:
        """Generate password reset email."""

        subject = "Reset Your GrePre Smart Life Password"

        text_body = f"""
Hello {user_name},

We received a request to reset your GrePre Smart Life password.

Click the link below to reset your password:
{reset_link}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email or contact support if you have concerns.

Best regards,
The GrePre Smart Life Team
        """.strip()

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }}
        .content {{ background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }}
        .cta-button {{ display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }}
        .warning {{ background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 6px; margin: 15px 0; }}
        .footer {{ text-align: center; padding: 15px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Password Reset Request</h1>
        </div>
        <div class="content">
            <p>Hello <strong>{user_name}</strong>,</p>
            <p>We received a request to reset your GrePre Smart Life password.</p>

            <p style="text-align: center;">
                <a href="{reset_link}" class="cta-button">Reset Password</a>
            </p>

            <p class="warning">
                ⏰ This link will expire in <strong>1 hour</strong>.
            </p>

            <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
        </div>
        <div class="footer">
            <p>© {datetime.now().year} GrePre Smart Life. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        """.strip()

        return subject, text_body, html_body


class EmailService:
    """Email service for sending notifications."""

    def __init__(self):
        self.settings = email_settings
        self._executor = ThreadPoolExecutor(max_workers=3)

    def _send_email_sync(self, message: EmailMessage) -> bool:
        """Send email synchronously (runs in thread pool)."""
        if not self.settings.EMAIL_ENABLED:
            logger.info(
                f"Email disabled. Would send to: {message.to}, subject: {message.subject}"
            )
            return True

        if not self.settings.SMTP_USER or not self.settings.SMTP_PASSWORD:
            logger.warning("SMTP credentials not configured")
            return False

        try:
            # Create message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = message.subject
            msg["From"] = (
                f"{self.settings.SMTP_FROM_NAME} <{self.settings.SMTP_FROM_EMAIL or self.settings.SMTP_USER}>"
            )
            msg["To"] = ", ".join(message.to)

            if message.reply_to:
                msg["Reply-To"] = message.reply_to

            # Attach text and HTML parts
            part1 = MIMEText(message.body_text, "plain")
            msg.attach(part1)

            if message.body_html:
                part2 = MIMEText(message.body_html, "html")
                msg.attach(part2)

            # Send email
            context = ssl.create_default_context()

            with smtplib.SMTP(
                self.settings.SMTP_HOST, self.settings.SMTP_PORT
            ) as server:
                if self.settings.SMTP_USE_TLS:
                    server.starttls(context=context)
                server.login(self.settings.SMTP_USER, self.settings.SMTP_PASSWORD)
                server.sendmail(self.settings.SMTP_USER, message.to, msg.as_string())

            logger.info(f"Email sent successfully to: {message.to}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}")
            return False

    async def send_email(self, message: EmailMessage) -> bool:
        """Send email asynchronously."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self._executor, self._send_email_sync, message
        )

    async def send_bill_reminder(
        self,
        user_email: str,
        user_name: str,
        bill_name: str,
        amount: float,
        due_date: datetime,
        days_until_due: int,
    ) -> bool:
        """Send bill reminder email."""
        subject, text_body, html_body = EmailTemplate.bill_reminder(
            user_name=user_name,
            bill_name=bill_name,
            amount=amount,
            due_date=due_date,
            days_until_due=days_until_due,
        )

        message = EmailMessage(
            to=[user_email],
            subject=subject,
            body_text=text_body,
            body_html=html_body,
        )

        return await self.send_email(message)

    async def send_welcome_email(
        self,
        user_email: str,
        user_name: str,
    ) -> bool:
        """Send welcome email to new user."""
        subject, text_body, html_body = EmailTemplate.welcome_email(
            user_name=user_name,
            user_email=user_email,
        )

        message = EmailMessage(
            to=[user_email],
            subject=subject,
            body_text=text_body,
            body_html=html_body,
        )

        return await self.send_email(message)

    async def send_password_reset(
        self,
        user_email: str,
        user_name: str,
        reset_link: str,
    ) -> bool:
        """Send password reset email."""
        subject, text_body, html_body = EmailTemplate.password_reset(
            user_name=user_name,
            reset_link=reset_link,
        )

        message = EmailMessage(
            to=[user_email],
            subject=subject,
            body_text=text_body,
            body_html=html_body,
        )

        return await self.send_email(message)


# Global email service instance
email_service = EmailService()
