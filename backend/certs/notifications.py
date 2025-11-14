"""
Notification system helpers and logic.
"""
from datetime import date, timedelta
from typing import Dict, List, Optional
from django.db.models import Q
from .models import (
    Certificate, Secret, NotificationConfig,
    CertificateNotification, SecretNotification
)


def get_notification_recipients_for_certificate(certificate: Certificate) -> Optional[Dict]:
    """
    Determine who should be notified for a certificate.
    Priority: Custom > Team > Global

    Returns dict with recipients, thresholds, notify_expired, and source,
    or None if no notifications configured.
    """
    # 1. Check for custom certificate notifications (highest priority)
    try:
        cert_notification = CertificateNotification.objects.get(
            certificate=certificate,
            override_enabled=True
        )
        if cert_notification.recipients:
            return {
                'recipients': cert_notification.recipients,
                'thresholds': cert_notification.expiry_thresholds or [],
                'notify_expired': cert_notification.notify_expired,
                'notify_expiring': cert_notification.notify_expiring,
                'source': 'custom'
            }
    except CertificateNotification.DoesNotExist:
        pass

    # 2. Check team-based notifications
    teams = certificate.access_teams.all()
    if teams.exists():
        all_recipients = []
        all_thresholds = set()
        notify_expired = False
        notify_expiring = False

        for team in teams:
            try:
                team_config = NotificationConfig.objects.get(
                    team=team,
                    enabled=True
                )
                if team_config.recipients:
                    all_recipients.extend(team_config.recipients)
                    all_thresholds.update(team_config.expiry_thresholds or [])
                    notify_expired = notify_expired or team_config.notify_expired
                    notify_expiring = notify_expiring or team_config.notify_expiring
            except NotificationConfig.DoesNotExist:
                continue

        if all_recipients:
            return {
                'recipients': list(set(all_recipients)),  # Remove duplicates
                'thresholds': sorted(list(all_thresholds)),
                'notify_expired': notify_expired,
                'notify_expiring': notify_expiring,
                'source': 'teams'
            }

    # 3. Fall back to global/enterprise config
    try:
        global_config = NotificationConfig.objects.get(
            is_global=True,
            enabled=True
        )
        if global_config.recipients:
            return {
                'recipients': global_config.recipients,
                'thresholds': global_config.expiry_thresholds or [],
                'notify_expired': global_config.notify_expired,
                'notify_expiring': global_config.notify_expiring,
                'source': 'global'
            }
    except NotificationConfig.DoesNotExist:
        pass

    return None  # No notifications configured


def get_notification_recipients_for_secret(secret: Secret) -> Optional[Dict]:
    """
    Determine who should be notified for a secret.
    Priority: Custom > Team > Global

    Returns dict with recipients, thresholds, notify_expired, and source,
    or None if no notifications configured.
    """
    # 1. Check for custom secret notifications (highest priority)
    try:
        secret_notification = SecretNotification.objects.get(
            secret=secret,
            override_enabled=True
        )
        if secret_notification.recipients:
            return {
                'recipients': secret_notification.recipients,
                'thresholds': secret_notification.expiry_thresholds or [],
                'notify_expired': secret_notification.notify_expired,
                'notify_expiring': secret_notification.notify_expiring,
                'source': 'custom'
            }
    except SecretNotification.DoesNotExist:
        pass

    # 2. Check team-based notifications
    teams = secret.access_teams.all()
    if teams.exists():
        all_recipients = []
        all_thresholds = set()
        notify_expired = False
        notify_expiring = False

        for team in teams:
            try:
                team_config = NotificationConfig.objects.get(
                    team=team,
                    enabled=True
                )
                if team_config.recipients:
                    all_recipients.extend(team_config.recipients)
                    all_thresholds.update(team_config.expiry_thresholds or [])
                    notify_expired = notify_expired or team_config.notify_expired
                    notify_expiring = notify_expiring or team_config.notify_expiring
            except NotificationConfig.DoesNotExist:
                continue

        if all_recipients:
            return {
                'recipients': list(set(all_recipients)),  # Remove duplicates
                'thresholds': sorted(list(all_thresholds)),
                'notify_expired': notify_expired,
                'notify_expiring': notify_expiring,
                'source': 'teams'
            }

    # 3. Fall back to global/enterprise config
    try:
        global_config = NotificationConfig.objects.get(
            is_global=True,
            enabled=True
        )
        if global_config.recipients:
            return {
                'recipients': global_config.recipients,
                'thresholds': global_config.expiry_thresholds or [],
                'notify_expired': global_config.notify_expired,
                'notify_expiring': global_config.notify_expiring,
                'source': 'global'
            }
    except NotificationConfig.DoesNotExist:
        pass

    return None  # No notifications configured


def get_expiring_certificates(days_threshold: int) -> List[Certificate]:
    """
    Get certificates expiring within the specified number of days.
    """
    today = date.today()
    threshold_date = today + timedelta(days=days_threshold)

    return Certificate.objects.filter(
        is_expired=False,
        not_after__date__gte=today,
        not_after__date__lte=threshold_date
    )


def get_expired_certificates() -> List[Certificate]:
    """
    Get all expired certificates.
    """
    return Certificate.objects.filter(is_expired=True)


def get_expiring_secrets(days_threshold: int) -> List[Secret]:
    """
    Get secrets expiring within the specified number of days.
    """
    today = date.today()
    threshold_date = today + timedelta(days=days_threshold)

    return Secret.objects.filter(
        expiry_date__isnull=False,
        expiry_date__gte=today,
        expiry_date__lte=threshold_date
    )


def get_expired_secrets() -> List[Secret]:
    """
    Get all expired secrets.
    """
    today = date.today()
    return Secret.objects.filter(
        expiry_date__isnull=False,
        expiry_date__lt=today
    )


def calculate_days_until_expiry_certificate(certificate: Certificate) -> int:
    """
    Calculate days until certificate expiry.
    Returns negative number if already expired.
    """
    today = date.today()
    expiry_date = certificate.not_after.date() if hasattr(certificate.not_after, 'date') else certificate.not_after
    return (expiry_date - today).days


def calculate_days_until_expiry_secret(secret: Secret) -> Optional[int]:
    """
    Calculate days until secret expiry.
    Returns None if no expiry date set.
    Returns negative number if already expired.
    """
    if not secret.expiry_date:
        return None

    today = date.today()
    return (secret.expiry_date - today).days
