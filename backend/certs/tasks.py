"""
Celery tasks for certificate and secret management.
"""
from celery import shared_task
from django.utils import timezone
from datetime import date
from typing import List, Dict
from .models import Certificate, Secret, EmailConfig, NotificationLog
from .notifications import (
    get_notification_recipients_for_certificate,
    get_notification_recipients_for_secret,
    calculate_days_until_expiry_certificate,
    calculate_days_until_expiry_secret,
)
from .email_sender import (
    EmailSender,
    render_expiry_notification_email,
    render_expired_notification_email,
)


@shared_task
def check_and_update_expired_certificates():
    """Check for expired certificates and mark them as expired if necessary."""
    """This task checks all certificates and marks them as expired if their not_after date is in the past."""
    now = timezone.now()
    # Find certificates that are not marked as expired but should be
    expired_certs = Certificate.objects.filter(not_after__lt=now, is_expired=False)
    count = expired_certs.update(is_expired=True)
    return f"Marked {count} certificates as expired."


@shared_task
def daily_expiry_check():
    """
    Daily task to check for expiring/expired certificates and secrets.
    This task should be scheduled to run at the time configured in EmailConfig.daily_check_time.
    """
    results = {
        'certificates_checked': 0,
        'secrets_checked': 0,
        'notifications_sent': 0,
        'notifications_failed': 0,
    }

    # Check certificates
    cert_results = check_certificate_expiry_notifications()
    results['certificates_checked'] = cert_results.get('checked', 0)
    results['notifications_sent'] += cert_results.get('sent', 0)
    results['notifications_failed'] += cert_results.get('failed', 0)

    # Check secrets
    secret_results = check_secret_expiry_notifications()
    results['secrets_checked'] = secret_results.get('checked', 0)
    results['notifications_sent'] += secret_results.get('sent', 0)
    results['notifications_failed'] += secret_results.get('failed', 0)

    return results


@shared_task
def check_certificate_expiry_notifications():
    """
    Check all certificates for expiry and send notifications based on configured thresholds.
    Returns dict with statistics.
    """
    results = {'checked': 0, 'sent': 0, 'failed': 0}

    # Get all active certificates (not expired)
    certificates = Certificate.objects.filter(is_expired=False).select_related()

    for certificate in certificates:
        results['checked'] += 1

        # Get notification configuration for this certificate
        notification_config = get_notification_recipients_for_certificate(certificate)

        if not notification_config:
            continue  # No notifications configured

        # Skip if notifications are disabled
        if not notification_config.get('notify_expiring') and not notification_config.get('notify_expired'):
            continue

        # Calculate days until expiry
        days_until_expiry = calculate_days_until_expiry_certificate(certificate)

        # Check if already expired
        if days_until_expiry < 0:
            if notification_config.get('notify_expired'):
                # Check if we haven't already sent an expired notification
                if not _notification_already_sent(
                    notification_type='expired',
                    resource_type='certificate',
                    resource_id=certificate.id
                ):
                    success = _send_certificate_expired_notification(certificate, notification_config)
                    if success:
                        results['sent'] += 1
                    else:
                        results['failed'] += 1
        else:
            # Check against expiry thresholds
            if notification_config.get('notify_expiring'):
                thresholds = notification_config.get('thresholds', [])
                for threshold in thresholds:
                    if days_until_expiry <= threshold:
                        # Check if we haven't already sent this threshold notification
                        if not _notification_already_sent(
                            notification_type='expiring_soon',
                            resource_type='certificate',
                            resource_id=certificate.id,
                            days_until_expiry=threshold
                        ):
                            success = _send_certificate_expiring_notification(
                                certificate,
                                notification_config,
                                days_until_expiry
                            )
                            if success:
                                results['sent'] += 1
                            else:
                                results['failed'] += 1
                        break  # Only send for the first matching threshold

    return results


@shared_task
def check_secret_expiry_notifications():
    """
    Check all secrets for expiry and send notifications based on configured thresholds.
    Returns dict with statistics.
    """
    results = {'checked': 0, 'sent': 0, 'failed': 0}

    # Get all secrets with expiry dates
    secrets = Secret.objects.filter(expiry_date__isnull=False).select_related()

    for secret in secrets:
        results['checked'] += 1

        # Get notification configuration for this secret
        notification_config = get_notification_recipients_for_secret(secret)

        if not notification_config:
            continue  # No notifications configured

        # Skip if notifications are disabled
        if not notification_config.get('notify_expiring') and not notification_config.get('notify_expired'):
            continue

        # Calculate days until expiry
        days_until_expiry = calculate_days_until_expiry_secret(secret)

        if days_until_expiry is None:
            continue  # No expiry date set

        # Check if already expired
        if days_until_expiry < 0:
            if notification_config.get('notify_expired'):
                # Check if we haven't already sent an expired notification
                if not _notification_already_sent(
                    notification_type='expired',
                    resource_type='secret',
                    resource_id=secret.id
                ):
                    success = _send_secret_expired_notification(secret, notification_config)
                    if success:
                        results['sent'] += 1
                    else:
                        results['failed'] += 1
        else:
            # Check against expiry thresholds
            if notification_config.get('notify_expiring'):
                thresholds = notification_config.get('thresholds', [])
                for threshold in thresholds:
                    if days_until_expiry <= threshold:
                        # Check if we haven't already sent this threshold notification
                        if not _notification_already_sent(
                            notification_type='expiring_soon',
                            resource_type='secret',
                            resource_id=secret.id,
                            days_until_expiry=threshold
                        ):
                            success = _send_secret_expiring_notification(
                                secret,
                                notification_config,
                                days_until_expiry
                            )
                            if success:
                                results['sent'] += 1
                            else:
                                results['failed'] += 1
                        break  # Only send for the first matching threshold

    return results


def _notification_already_sent(
    notification_type: str,
    resource_type: str,
    resource_id: int,
    days_until_expiry: int = None
) -> bool:
    """
    Check if a notification has already been sent for this resource.
    For 'expiring_soon', checks if notification was sent for this specific threshold.
    For 'expired', checks if any expired notification was sent today.
    """
    from datetime import datetime, timedelta

    today_start = datetime.combine(date.today(), datetime.min.time())

    query_filters = {
        'notification_type': notification_type,
        'resource_type': resource_type,
        'resource_id': resource_id,
        'status': 'sent',
        'sent_at__gte': today_start,
    }

    # For expiring notifications, also match the specific threshold
    if notification_type == 'expiring_soon' and days_until_expiry is not None:
        query_filters['days_until_expiry'] = days_until_expiry

    return NotificationLog.objects.filter(**query_filters).exists()


def _send_certificate_expiring_notification(
    certificate: Certificate,
    notification_config: Dict,
    days_until_expiry: int
) -> bool:
    """
    Send expiring notification for a certificate.
    Returns True if sent successfully, False otherwise.
    """
    recipients = notification_config.get('recipients', [])
    if not recipients:
        return False

    # Get team names for the certificate
    team_names = [team.name for team in certificate.access_teams.all()]

    # Render email content
    expiry_date = certificate.not_after.strftime('%Y-%m-%d')
    html_body, text_body = render_expiry_notification_email(
        resource_type='certificate',
        resource_name=certificate.common_name or certificate.subject,
        resource_id=certificate.id,
        days_until_expiry=days_until_expiry,
        expiry_date=expiry_date,
        assigned_teams=team_names
    )

    # Send email
    email_sender = EmailSender()
    subject = f'Certificate Expiring Soon: {certificate.common_name or certificate.subject}'

    success = email_sender.send_email(
        recipients=recipients,
        subject=subject,
        html_body=html_body,
        text_body=text_body
    )

    # Log the notification
    NotificationLog.objects.create(
        notification_type='expiring_soon',
        resource_type='certificate',
        resource_id=certificate.id,
        resource_name=certificate.common_name or certificate.subject,
        recipients=recipients,
        days_until_expiry=days_until_expiry,
        status='sent' if success else 'failed',
        error_message=None if success else 'Failed to send email'
    )

    return success


def _send_certificate_expired_notification(
    certificate: Certificate,
    notification_config: Dict
) -> bool:
    """
    Send expired notification for a certificate.
    Returns True if sent successfully, False otherwise.
    """
    recipients = notification_config.get('recipients', [])
    if not recipients:
        return False

    # Get team names for the certificate
    team_names = [team.name for team in certificate.access_teams.all()]

    # Render email content
    expiry_date = certificate.not_after.strftime('%Y-%m-%d')
    html_body, text_body = render_expired_notification_email(
        resource_type='certificate',
        resource_name=certificate.common_name or certificate.subject,
        resource_id=certificate.id,
        expiry_date=expiry_date,
        assigned_teams=team_names
    )

    # Send email
    email_sender = EmailSender()
    subject = f'Certificate EXPIRED: {certificate.common_name or certificate.subject}'

    success = email_sender.send_email(
        recipients=recipients,
        subject=subject,
        html_body=html_body,
        text_body=text_body
    )

    # Log the notification
    NotificationLog.objects.create(
        notification_type='expired',
        resource_type='certificate',
        resource_id=certificate.id,
        resource_name=certificate.common_name or certificate.subject,
        recipients=recipients,
        days_until_expiry=None,
        status='sent' if success else 'failed',
        error_message=None if success else 'Failed to send email'
    )

    return success


def _send_secret_expiring_notification(
    secret: Secret,
    notification_config: Dict,
    days_until_expiry: int
) -> bool:
    """
    Send expiring notification for a secret.
    Returns True if sent successfully, False otherwise.
    """
    recipients = notification_config.get('recipients', [])
    if not recipients:
        return False

    # Get team names for the secret
    team_names = [team.name for team in secret.access_teams.all()]

    # Render email content
    expiry_date = secret.expiry_date.strftime('%Y-%m-%d')
    html_body, text_body = render_expiry_notification_email(
        resource_type='secret',
        resource_name=secret.name,
        resource_id=secret.id,
        days_until_expiry=days_until_expiry,
        expiry_date=expiry_date,
        assigned_teams=team_names
    )

    # Send email
    email_sender = EmailSender()
    subject = f'Secret Expiring Soon: {secret.name}'

    success = email_sender.send_email(
        recipients=recipients,
        subject=subject,
        html_body=html_body,
        text_body=text_body
    )

    # Log the notification
    NotificationLog.objects.create(
        notification_type='expiring_soon',
        resource_type='secret',
        resource_id=secret.id,
        resource_name=secret.name,
        recipients=recipients,
        days_until_expiry=days_until_expiry,
        status='sent' if success else 'failed',
        error_message=None if success else 'Failed to send email'
    )

    return success


def _send_secret_expired_notification(
    secret: Secret,
    notification_config: Dict
) -> bool:
    """
    Send expired notification for a secret.
    Returns True if sent successfully, False otherwise.
    """
    recipients = notification_config.get('recipients', [])
    if not recipients:
        return False

    # Get team names for the secret
    team_names = [team.name for team in secret.access_teams.all()]

    # Render email content
    expiry_date = secret.expiry_date.strftime('%Y-%m-%d')
    html_body, text_body = render_expired_notification_email(
        resource_type='secret',
        resource_name=secret.name,
        resource_id=secret.id,
        expiry_date=expiry_date,
        assigned_teams=team_names
    )

    # Send email
    email_sender = EmailSender()
    subject = f'Secret EXPIRED: {secret.name}'

    success = email_sender.send_email(
        recipients=recipients,
        subject=subject,
        html_body=html_body,
        text_body=text_body
    )

    # Log the notification
    NotificationLog.objects.create(
        notification_type='expired',
        resource_type='secret',
        resource_id=secret.id,
        resource_name=secret.name,
        recipients=recipients,
        days_until_expiry=None,
        status='sent' if success else 'failed',
        error_message=None if success else 'Failed to send email'
    )

    return success