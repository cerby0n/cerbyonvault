"""
API views for notification system.
Handles email configuration, notification settings, and notification logs.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db.models import Q

from ..models import (
    EmailConfig, NotificationConfig, CertificateNotification,
    SecretNotification, NotificationLog, Certificate, Secret, Team
)
from ..serializers import (
    EmailConfigSerializer, NotificationConfigSerializer,
    CertificateNotificationSerializer, SecretNotificationSerializer,
    NotificationLogSerializer
)
from ..permissions import IsAdminUser


class EmailConfigViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing email configuration.
    Only admins can access this endpoint.
    Only one EmailConfig instance should exist.
    """
    queryset = EmailConfig.objects.all()
    serializer_class = EmailConfigSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def list(self, request):
        """Get the email configuration (returns single object)"""
        config = EmailConfig.objects.first()
        if config:
            serializer = self.get_serializer(config)
            return Response(serializer.data)
        return Response({'message': 'No email configuration found'}, status=status.HTTP_404_NOT_FOUND)

    def create(self, request):
        """Create email configuration if none exists"""
        if EmailConfig.objects.exists():
            return Response(
                {'error': 'Email configuration already exists. Use PUT to update.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        """Update email configuration"""
        config = EmailConfig.objects.first()
        if not config:
            return Response(
                {'error': 'No email configuration found'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = self.get_serializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def test_connection(self, request):
        """
        Test email connection by sending a test email.
        Expects 'test_email' in request data.
        """
        config = EmailConfig.objects.first()
        if not config:
            return Response(
                {'error': 'No email configuration found'},
                status=status.HTTP_404_NOT_FOUND
            )

        test_email = request.data.get('test_email')
        if not test_email:
            return Response(
                {'error': 'test_email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from ..email_sender import EmailSender

        sender = EmailSender()
        html_body = """
        <html>
        <body>
            <h2>CerbyonVault Email Test</h2>
            <p>This is a test email from CerbyonVault notification system.</p>
            <p>If you received this email, your email configuration is working correctly.</p>
        </body>
        </html>
        """
        text_body = "CerbyonVault Email Test - If you received this email, your email configuration is working correctly."

        success = sender.send_email(
            recipients=[test_email],
            subject='CerbyonVault - Email Configuration Test',
            html_body=html_body,
            text_body=text_body
        )

        if success:
            return Response({'message': 'Test email sent successfully'})
        else:
            return Response(
                {'error': 'Failed to send test email. Check your configuration.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def test_daily_check(self, request):
        """
        Trigger the daily expiry check task immediately for testing purposes.
        This will check all certificates and secrets and send notifications.
        """
        config = EmailConfig.objects.first()
        if not config:
            return Response(
                {'error': 'No email configuration found. Please configure email settings first.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Import the task function directly to run it synchronously for immediate feedback
        from ..tasks import daily_expiry_check

        try:
            # Run the check synchronously
            results = daily_expiry_check()

            return Response({
                'message': 'Daily check completed successfully',
                'results': {
                    'certificates_checked': results.get('certificates_checked', 0),
                    'secrets_checked': results.get('secrets_checked', 0),
                    'notifications_sent': results.get('notifications_sent', 0),
                    'notifications_failed': results.get('notifications_failed', 0),
                }
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to run daily check: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class NotificationConfigViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing notification configurations.
    Handles both global and team-based notification settings.
    """
    queryset = NotificationConfig.objects.all()
    serializer_class = NotificationConfigSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter notifications based on user permissions"""
        user = self.request.user

        if user.is_staff:
            # Admins can see all configurations
            return NotificationConfig.objects.all()
        else:
            # Regular users can only see global config and configs for their teams
            user_teams = user.teams.all()
            return NotificationConfig.objects.filter(
                Q(is_global=True) | Q(team__in=user_teams)
            )

    @action(detail=False, methods=['get'])
    def global_config(self, request):
        """Get the global notification configuration"""
        config = NotificationConfig.objects.filter(is_global=True).first()
        if config:
            serializer = self.get_serializer(config)
            return Response(serializer.data)
        return Response({'message': 'No global configuration found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'])
    def team_configs(self, request):
        """Get notification configurations for user's teams"""
        user = request.user
        user_teams = user.teams.all()
        configs = NotificationConfig.objects.filter(team__in=user_teams)
        serializer = self.get_serializer(configs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get', 'put', 'post'])
    def for_team(self, request):
        """
        Get or create/update notification config for a specific team.
        Requires 'team_id' query parameter.
        """
        team_id = request.query_params.get('team_id') or request.data.get('team_id')
        if not team_id:
            return Response(
                {'error': 'team_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        team = get_object_or_404(Team, id=team_id)

        # Check permissions - user must be admin or member of the team
        if not request.user.is_staff and team not in request.user.teams.all():
            return Response(
                {'error': 'You do not have permission to manage this team\'s notifications'},
                status=status.HTTP_403_FORBIDDEN
            )

        if request.method == 'GET':
            config = NotificationConfig.objects.filter(team=team).first()
            if config:
                serializer = self.get_serializer(config)
                return Response(serializer.data)
            return Response({'message': 'No configuration found for this team'}, status=status.HTTP_404_NOT_FOUND)

        else:  # PUT or POST
            config = NotificationConfig.objects.filter(team=team).first()

            if config:
                # Update existing config
                serializer = self.get_serializer(config, data=request.data, partial=True)
            else:
                # Create new config
                data = request.data.copy()
                data['team'] = team_id
                serializer = self.get_serializer(data=data)

            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK if config else status.HTTP_201_CREATED)


class CertificateNotificationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing per-certificate notification overrides.
    """
    queryset = CertificateNotification.objects.all()
    serializer_class = CertificateNotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter by user's accessible certificates"""
        user = self.request.user

        if user.is_staff:
            return CertificateNotification.objects.all()
        else:
            user_teams = user.teams.all()
            return CertificateNotification.objects.filter(
                certificate__access_teams__in=user_teams
            ).distinct()

    @action(detail=False, methods=['get', 'put', 'post'])
    def for_certificate(self, request):
        """
        Get or create/update notification config for a specific certificate.
        Requires 'certificate_id' query parameter or in request body.
        """
        cert_id = request.query_params.get('certificate_id') or request.data.get('certificate_id')
        if not cert_id:
            return Response(
                {'error': 'certificate_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        certificate = get_object_or_404(Certificate, id=cert_id)

        # Check permissions
        user = request.user
        if not user.is_staff:
            user_teams = user.teams.all()
            if not certificate.access_teams.filter(id__in=user_teams.values_list('id', flat=True)).exists():
                return Response(
                    {'error': 'You do not have permission to manage this certificate\'s notifications'},
                    status=status.HTTP_403_FORBIDDEN
                )

        if request.method == 'GET':
            config = CertificateNotification.objects.filter(certificate=certificate).first()
            if config:
                serializer = self.get_serializer(config)
                return Response(serializer.data)
            return Response({'message': 'No custom notification configuration found for this certificate'}, status=status.HTTP_404_NOT_FOUND)

        else:  # PUT or POST
            config = CertificateNotification.objects.filter(certificate=certificate).first()

            if config:
                # Update existing config
                serializer = self.get_serializer(config, data=request.data, partial=True)
            else:
                # Create new config
                data = request.data.copy()
                data['certificate'] = cert_id
                serializer = self.get_serializer(data=data)

            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK if config else status.HTTP_201_CREATED)


class SecretNotificationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing per-secret notification overrides.
    """
    queryset = SecretNotification.objects.all()
    serializer_class = SecretNotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter by user's accessible secrets"""
        user = self.request.user

        if user.is_staff:
            return SecretNotification.objects.all()
        else:
            user_teams = user.teams.all()
            return SecretNotification.objects.filter(
                secret__access_teams__in=user_teams
            ).distinct()

    @action(detail=False, methods=['get', 'put', 'post'])
    def for_secret(self, request):
        """
        Get or create/update notification config for a specific secret.
        Requires 'secret_id' query parameter or in request body.
        """
        secret_id = request.query_params.get('secret_id') or request.data.get('secret_id')
        if not secret_id:
            return Response(
                {'error': 'secret_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        secret = get_object_or_404(Secret, id=secret_id)

        # Check permissions
        user = request.user
        if not user.is_staff:
            user_teams = user.teams.all()
            if not secret.access_teams.filter(id__in=user_teams.values_list('id', flat=True)).exists():
                return Response(
                    {'error': 'You do not have permission to manage this secret\'s notifications'},
                    status=status.HTTP_403_FORBIDDEN
                )

        if request.method == 'GET':
            config = SecretNotification.objects.filter(secret=secret).first()
            if config:
                serializer = self.get_serializer(config)
                return Response(serializer.data)
            return Response({'message': 'No custom notification configuration found for this secret'}, status=status.HTTP_404_NOT_FOUND)

        else:  # PUT or POST
            config = SecretNotification.objects.filter(secret=secret).first()

            if config:
                # Update existing config
                serializer = self.get_serializer(config, data=request.data, partial=True)
            else:
                # Create new config
                data = request.data.copy()
                data['secret'] = secret_id
                serializer = self.get_serializer(data=data)

            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK if config else status.HTTP_201_CREATED)


class NotificationLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing notification logs (read-only).
    Provides audit trail of sent notifications.
    """
    queryset = NotificationLog.objects.all().order_by('-sent_at')
    serializer_class = NotificationLogSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        """
        Allow filtering by resource type, resource ID, status, and date range.
        """
        queryset = super().get_queryset()

        # Filter by resource type
        resource_type = self.request.query_params.get('resource_type')
        if resource_type:
            queryset = queryset.filter(resource_type=resource_type)

        # Filter by resource ID
        resource_id = self.request.query_params.get('resource_id')
        if resource_id:
            queryset = queryset.filter(resource_id=resource_id)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by notification type
        notification_type = self.request.query_params.get('notification_type')
        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)

        return queryset

    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recent notification logs (last 100)"""
        logs = self.get_queryset()[:100]
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def failed(self, request):
        """Get all failed notifications"""
        logs = self.get_queryset().filter(status='failed')
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)
