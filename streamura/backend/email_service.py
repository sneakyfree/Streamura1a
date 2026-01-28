"""
Email Service for Streamura

This module provides email functionality using Resend or a fallback logging approach.
Configure RESEND_API_KEY in environment variables to enable actual email sending.
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Try to import resend, fall back to mock if not installed
try:
    import resend
    RESEND_AVAILABLE = True
except ImportError:
    RESEND_AVAILABLE = False
    logger.warning("Resend not installed. Emails will be logged only.")


def configure_email():
    """Configure the email service with API key."""
    api_key = os.getenv("RESEND_API_KEY")
    if api_key and RESEND_AVAILABLE:
        resend.api_key = api_key
        logger.info("Resend email service configured")
        return True
    else:
        logger.warning("Email service not configured - emails will be logged only")
        return False


async def send_email(
    to: str,
    subject: str,
    html: str,
    from_email: str = "Streamura <noreply@streamura.com>"
) -> bool:
    """
    Send a transactional email.
    
    Args:
        to: Recipient email address
        subject: Email subject line
        html: HTML content of the email
        from_email: Sender email address
    
    Returns:
        bool: True if sent successfully, False otherwise
    """
    api_key = os.getenv("RESEND_API_KEY")
    
    if not api_key or not RESEND_AVAILABLE:
        # Log the email for development/testing
        logger.info(f"EMAIL (not sent): To={to}, Subject={subject}")
        logger.debug(f"EMAIL body: {html[:200]}...")
        return True  # Return True so the app flow continues
    
    try:
        resend.Emails.send({
            "from": from_email,
            "to": to,
            "subject": subject,
            "html": html,
        })
        logger.info(f"Email sent to {to}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return False


# Email Templates

async def send_welcome_email(email: str, username: str) -> bool:
    """Send welcome email to new user."""
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
            .header {{ text-align: center; margin-bottom: 30px; }}
            .logo {{ font-size: 28px; font-weight: bold; color: #8B5CF6; }}
            h1 {{ color: #1F2937; margin-bottom: 10px; }}
            p {{ color: #6B7280; line-height: 1.6; }}
            .cta {{ display: inline-block; background: #8B5CF6; color: white; padding: 12px 24px; 
                    border-radius: 8px; text-decoration: none; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">Streamura</div>
            </div>
            <h1>Welcome to Streamura, {username}! 🎉</h1>
            <p>Thanks for joining our community of creators and viewers.</p>
            <p>Here's what you can do now:</p>
            <ul>
                <li>📺 <strong>Watch live streams</strong> from creators around the world</li>
                <li>🎥 <strong>Go live</strong> and share your content</li>
                <li>💰 <strong>Earn money</strong> through tips and subscriptions</li>
                <li>🌍 <strong>Connect</strong> with a global community</li>
            </ul>
            <a href="https://streamura.com/discover" class="cta">Start Exploring</a>
            <p style="margin-top: 30px; font-size: 12px; color: #9CA3AF;">
                If you didn't create this account, please ignore this email.
            </p>
        </div>
    </body>
    </html>
    """
    return await send_email(email, "Welcome to Streamura! 🎉", html)


async def send_tip_receipt(
    email: str,
    amount: float,
    creator_name: str,
    stream_title: Optional[str] = None
) -> bool:
    """Send tip receipt to tipper."""
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
            .header {{ text-align: center; margin-bottom: 30px; }}
            .logo {{ font-size: 28px; font-weight: bold; color: #8B5CF6; }}
            .amount {{ font-size: 48px; font-weight: bold; color: #10B981; text-align: center; }}
            .receipt {{ background: #F3F4F6; border-radius: 8px; padding: 20px; margin: 20px 0; }}
            h1 {{ color: #1F2937; margin-bottom: 10px; }}
            p {{ color: #6B7280; line-height: 1.6; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">Streamura</div>
            </div>
            <h1>Thanks for your tip! 💜</h1>
            <div class="amount">${amount:.2f}</div>
            <div class="receipt">
                <p><strong>Sent to:</strong> {creator_name}</p>
                {f'<p><strong>Stream:</strong> {stream_title}</p>' if stream_title else ''}
                <p><strong>Date:</strong> {__import__('datetime').datetime.now().strftime('%B %d, %Y')}</p>
            </div>
            <p>Your support helps creators continue making great content. Thank you!</p>
            <p style="margin-top: 30px; font-size: 12px; color: #9CA3AF;">
                This is your receipt for the tip payment. No action is required.
            </p>
        </div>
    </body>
    </html>
    """
    return await send_email(email, f"Receipt: ${amount:.2f} tip to {creator_name}", html)


async def send_payout_confirmation(
    email: str,
    amount: float,
    estimated_arrival: str
) -> bool:
    """Send payout confirmation to creator."""
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
            .header {{ text-align: center; margin-bottom: 30px; }}
            .logo {{ font-size: 28px; font-weight: bold; color: #8B5CF6; }}
            .amount {{ font-size: 48px; font-weight: bold; color: #10B981; text-align: center; }}
            .info {{ background: #F3F4F6; border-radius: 8px; padding: 20px; margin: 20px 0; }}
            h1 {{ color: #1F2937; margin-bottom: 10px; }}
            p {{ color: #6B7280; line-height: 1.6; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">Streamura</div>
            </div>
            <h1>Payout Requested! 💰</h1>
            <div class="amount">${amount:.2f}</div>
            <div class="info">
                <p><strong>Status:</strong> Processing</p>
                <p><strong>Estimated Arrival:</strong> {estimated_arrival}</p>
            </div>
            <p>Your payout has been requested and is being processed. 
               Funds will be deposited into your connected bank account.</p>
            <p style="margin-top: 30px; font-size: 12px; color: #9CA3AF;">
                Questions? Contact us at support@streamura.com
            </p>
        </div>
    </body>
    </html>
    """
    return await send_email(email, f"Payout of ${amount:.2f} requested", html)


async def send_stream_live_notification(
    email: str,
    creator_name: str,
    stream_title: str,
    stream_url: str
) -> bool:
    """Send notification to follower that a creator went live."""
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
            .header {{ text-align: center; margin-bottom: 30px; }}
            .logo {{ font-size: 28px; font-weight: bold; color: #8B5CF6; }}
            .live-badge {{ display: inline-block; background: #EF4444; color: white; 
                          padding: 4px 12px; border-radius: 4px; font-weight: bold; }}
            h1 {{ color: #1F2937; margin-bottom: 10px; }}
            p {{ color: #6B7280; line-height: 1.6; }}
            .cta {{ display: inline-block; background: #8B5CF6; color: white; padding: 12px 24px; 
                    border-radius: 8px; text-decoration: none; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">Streamura</div>
            </div>
            <p><span class="live-badge">🔴 LIVE NOW</span></p>
            <h1>{creator_name} is live!</h1>
            <p><strong>{stream_title}</strong></p>
            <a href="{stream_url}" class="cta">Watch Now</a>
            <p style="margin-top: 30px; font-size: 12px; color: #9CA3AF;">
                You're receiving this because you follow {creator_name}.
                <a href="https://streamura.com/settings/notifications">Manage preferences</a>
            </p>
        </div>
    </body>
    </html>
    """
    return await send_email(email, f"🔴 {creator_name} is live: {stream_title}", html)
