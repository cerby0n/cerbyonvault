"""
Email sender supporting both SMTP and Microsoft Graph API.
"""
import smtplib
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from django.conf import settings
from .models import EmailConfig


class EmailSender:
    """
    Email sender that supports both SMTP and Microsoft Graph API.
    """

    def __init__(self):
        try:
            self.config = EmailConfig.objects.first()
        except Exception:
            self.config = None

    def send_email(self,
                   recipients: List[str],
                   subject: str,
                   html_body: str,
                   text_body: Optional[str] = None) -> bool:
        """
        Send email using configured method (SMTP or Microsoft Graph).

        Args:
            recipients: List of email addresses
            subject: Email subject
            html_body: HTML email body
            text_body: Plain text email body (optional)

        Returns:
            bool: True if sent successfully, False otherwise
        """
        if not self.config:
            print("No email configuration found")
            return False

        if not recipients:
            print("No recipients specified")
            return False

        if self.config.method == 'smtp':
            return self._send_via_smtp(recipients, subject, html_body, text_body)
        elif self.config.method == 'graph':
            return self._send_via_graph(recipients, subject, html_body, text_body)
        else:
            print(f"Unknown email method: {self.config.method}")
            return False

    def _send_via_smtp(self,
                       recipients: List[str],
                       subject: str,
                       html_body: str,
                       text_body: Optional[str] = None) -> bool:
        """
        Send email via SMTP.
        """
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.config.smtp_from_email
            msg['To'] = ', '.join(recipients)

            # Add plain text part if provided
            if text_body:
                part1 = MIMEText(text_body, 'plain')
                msg.attach(part1)

            # Add HTML part
            part2 = MIMEText(html_body, 'html')
            msg.attach(part2)

            # Connect to SMTP server
            if self.config.smtp_use_tls:
                server = smtplib.SMTP(self.config.smtp_host, self.config.smtp_port)
                server.starttls()
            else:
                server = smtplib.SMTP(self.config.smtp_host, self.config.smtp_port)

            # Login if credentials provided
            if self.config.smtp_username and self.config.smtp_password:
                server.login(self.config.smtp_username, self.config.smtp_password)

            # Send email
            server.sendmail(self.config.smtp_from_email, recipients, msg.as_string())
            server.quit()

            print(f"Email sent successfully via SMTP to {len(recipients)} recipient(s)")
            return True

        except Exception as e:
            print(f"Failed to send email via SMTP: {str(e)}")
            return False

    def _send_via_graph(self,
                        recipients: List[str],
                        subject: str,
                        html_body: str,
                        text_body: Optional[str] = None) -> bool:
        """
        Send email via Microsoft Graph API.
        """
        try:
            # Get access token
            token = self._get_graph_access_token()
            if not token:
                return False

            # Prepare recipients
            to_recipients = [{"emailAddress": {"address": email}} for email in recipients]

            # Prepare message
            message = {
                "message": {
                    "subject": subject,
                    "body": {
                        "contentType": "HTML",
                        "content": html_body
                    },
                    "toRecipients": to_recipients
                },
                "saveToSentItems": "true"
            }

            # Send via Graph API
            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            }

            response = requests.post(
                f'https://graph.microsoft.com/v1.0/users/{self.config.graph_from_email}/sendMail',
                json=message,
                headers=headers,
                timeout=30
            )

            if response.status_code == 202:
                print(f"Email sent successfully via Microsoft Graph to {len(recipients)} recipient(s)")
                return True
            else:
                print(f"Failed to send email via Graph: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print(f"Failed to send email via Microsoft Graph: {str(e)}")
            return False

    def _get_graph_access_token(self) -> Optional[str]:
        """
        Get access token from Microsoft Graph using client credentials flow.
        """
        try:
            token_url = f'https://login.microsoftonline.com/{self.config.graph_tenant_id}/oauth2/v2.0/token'

            data = {
                'grant_type': 'client_credentials',
                'client_id': self.config.graph_client_id,
                'client_secret': self.config.graph_client_secret,
                'scope': 'https://graph.microsoft.com/.default'
            }

            response = requests.post(token_url, data=data, timeout=10)

            if response.status_code == 200:
                token_data = response.json()
                return token_data.get('access_token')
            else:
                print(f"Failed to get Graph access token: {response.status_code}")
                return None

        except Exception as e:
            print(f"Error getting Graph access token: {str(e)}")
            return None


def render_expiry_notification_email(
    resource_type: str,
    resource_name: str,
    resource_id: int,
    days_until_expiry: int,
    expiry_date: str,
    assigned_teams: List[str] = None
) -> tuple[str, str]:
    """
    Render HTML and text email for expiry notification.

    Returns:
        tuple: (html_body, text_body)
    """
    app_url = settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else 'http://localhost'

    if resource_type == 'certificate':
        resource_url = f'{app_url}/certificates'
        resource_icon = '🔐'
    else:
        resource_url = f'{app_url}/secrets'
        resource_icon = '🔑'

    teams_text = ', '.join(assigned_teams) if assigned_teams else 'None'

    # HTML version
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #f8f9fa; padding: 20px; border-radius: 5px; text-align: center; }}
            .content {{ padding: 20px; background-color: #ffffff; }}
            .warning {{ background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }}
            .details {{ background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }}
            .details-row {{ padding: 8px 0; border-bottom: 1px solid #dee2e6; }}
            .details-row:last-child {{ border-bottom: none; }}
            .label {{ font-weight: bold; color: #666; }}
            .value {{ color: #333; }}
            .button {{ display: inline-block; padding: 12px 24px; background-color: #007bff; color: #ffffff !important; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
            .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>{resource_icon} CerbyonVault Notification</h1>
            </div>
            <div class="content">
                <div class="warning">
                    <h2 style="margin-top: 0;">⚠️ {resource_type.title()} Expiring Soon</h2>
                    <p>The following {resource_type} will expire in <strong>{days_until_expiry} days</strong>.</p>
                </div>

                <div class="details">
                    <div class="details-row">
                        <span class="label">{resource_type.title()} Name:</span>
                        <span class="value">{resource_name}</span>
                    </div>
                    <div class="details-row">
                        <span class="label">Expires On:</span>
                        <span class="value">{expiry_date}</span>
                    </div>
                    <div class="details-row">
                        <span class="label">Assigned Teams:</span>
                        <span class="value">{teams_text}</span>
                    </div>
                </div>

                <div style="text-align: center;">
                    <a href="{resource_url}" class="button">View {resource_type.title()}</a>
                </div>
            </div>
            <div class="footer">
                <p>This is an automated notification from CerbyonVault</p>
                <p>Please do not reply to this email</p>
            </div>
        </div>
    </body>
    </html>
    """

    # Plain text version
    text_body = f"""
CerbyonVault Notification

{resource_type.title()} Expiring Soon

The following {resource_type} will expire in {days_until_expiry} days.

{resource_type.title()} Name: {resource_name}
Expires On: {expiry_date}
Assigned Teams: {teams_text}

View {resource_type.title()}: {resource_url}

--
This is an automated notification from CerbyonVault
Please do not reply to this email
    """

    return html_body.strip(), text_body.strip()


def render_expired_notification_email(
    resource_type: str,
    resource_name: str,
    resource_id: int,
    expiry_date: str,
    assigned_teams: List[str] = None
) -> tuple[str, str]:
    """
    Render HTML and text email for expired resource notification.

    Returns:
        tuple: (html_body, text_body)
    """
    app_url = settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else 'http://localhost'

    if resource_type == 'certificate':
        resource_url = f'{app_url}/certificates'
        resource_icon = '🔐'
    else:
        resource_url = f'{app_url}/secrets'
        resource_icon = '🔑'

    teams_text = ', '.join(assigned_teams) if assigned_teams else 'None'

    # HTML version
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #f8f9fa; padding: 20px; border-radius: 5px; text-align: center; }}
            .content {{ padding: 20px; background-color: #ffffff; }}
            .error {{ background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; }}
            .details {{ background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }}
            .details-row {{ padding: 8px 0; border-bottom: 1px solid #dee2e6; }}
            .details-row:last-child {{ border-bottom: none; }}
            .label {{ font-weight: bold; color: #666; }}
            .value {{ color: #333; }}
            .button {{ display: inline-block; padding: 12px 24px; background-color: #dc3545; color: #ffffff !important; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
            .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>{resource_icon} CerbyonVault Notification</h1>
            </div>
            <div class="content">
                <div class="error">
                    <h2 style="margin-top: 0;">❌ {resource_type.title()} Expired</h2>
                    <p>The following {resource_type} has <strong>expired</strong> and requires immediate attention.</p>
                </div>

                <div class="details">
                    <div class="details-row">
                        <span class="label">{resource_type.title()} Name:</span>
                        <span class="value">{resource_name}</span>
                    </div>
                    <div class="details-row">
                        <span class="label">Expired On:</span>
                        <span class="value">{expiry_date}</span>
                    </div>
                    <div class="details-row">
                        <span class="label">Assigned Teams:</span>
                        <span class="value">{teams_text}</span>
                    </div>
                </div>

                <div style="text-align: center;">
                    <a href="{resource_url}" class="button">View {resource_type.title()}</a>
                </div>
            </div>
            <div class="footer">
                <p>This is an automated notification from CerbyonVault</p>
                <p>Please do not reply to this email</p>
            </div>
        </div>
    </body>
    </html>
    """

    # Plain text version
    text_body = f"""
CerbyonVault Notification

{resource_type.title()} Expired

The following {resource_type} has EXPIRED and requires immediate attention.

{resource_type.title()} Name: {resource_name}
Expired On: {expiry_date}
Assigned Teams: {teams_text}

View {resource_type.title()}: {resource_url}

--
This is an automated notification from CerbyonVault
Please do not reply to this email
    """

    return html_body.strip(), text_body.strip()
