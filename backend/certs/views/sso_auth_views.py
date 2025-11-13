"""
Custom OIDC views that load configuration from database
"""
from mozilla_django_oidc.views import OIDCAuthenticationRequestView, OIDCAuthenticationCallbackView
from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import redirect
from rest_framework_simplejwt.tokens import RefreshToken
from ..models import SSOConfiguration
import logging
import urllib.parse

logger = logging.getLogger(__name__)


class CustomOIDCAuthenticationRequestView(OIDCAuthenticationRequestView):
    """
    Custom OIDC authentication view that loads configuration from database.
    Overrides get_settings() to load from database instead of Django settings.
    """

    def get_settings(self, attr, *args):
        """
        Override get_settings to load from database.
        This is called by parent __init__ and other methods.
        """
        logger.info(f"!!! CustomOIDCAuthenticationRequestView.get_settings() called with attr={attr}")

        try:
            sso_config = SSOConfiguration.objects.filter(is_enabled=True).first()
            logger.info(f"!!! SSO Config loaded: {sso_config is not None}")

            if not sso_config:
                logger.warning(f"!!! No SSO config found, falling back to parent")
                # Fall back to Django settings if no config
                return super().get_settings(attr, *args)

            tenant_id = sso_config.tenant_id
            logger.info(f"!!! Tenant ID: {tenant_id}, Client ID: {sso_config.client_id}")

            # Map setting names to database values - ONLY override what we need
            settings_map = {
                'OIDC_RP_CLIENT_ID': sso_config.client_id,
                'OIDC_RP_CLIENT_SECRET': settings.FERNET.decrypt(sso_config.encrypted_client_secret.encode()).decode(),
                'OIDC_OP_AUTHORIZATION_ENDPOINT': f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize',
                'OIDC_OP_TOKEN_ENDPOINT': f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token',
                'OIDC_OP_USER_ENDPOINT': 'https://graph.microsoft.com/v1.0/me',
                'OIDC_OP_JWKS_ENDPOINT': f'https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys',
                'OIDC_RP_SIGN_ALGO': 'RS256',
                'OIDC_RP_SCOPES': 'openid profile email',
                'OIDC_AUTHENTICATION_CALLBACK_URL': 'oidc_authentication_callback',
            }

            if attr in settings_map:
                value = settings_map[attr]
                logger.info(f"!!! Returning {attr} = {value[:50] if isinstance(value, str) and len(value) > 50 else value}")
                return value

        except Exception as e:
            logger.error(f"!!! Error loading SSO config for {attr}: {e}", exc_info=True)

        # For any setting not in our map, use parent's default
        result = super().get_settings(attr, *args)
        logger.info(f"!!! Parent get_settings({attr}) returned: {result}")
        return result

    def get(self, request):
        """Check that SSO is configured before processing"""
        logger.info(f"!!! CustomOIDCAuthenticationRequestView.get() called")
        logger.info(f"!!! self.OIDC_RP_CLIENT_ID = {getattr(self, 'OIDC_RP_CLIENT_ID', 'NOT SET')}")

        sso_config = SSOConfiguration.objects.filter(is_enabled=True).first()

        if not sso_config:
            return HttpResponse("SSO is not configured or enabled.", status=400)

        logger.info(f"!!! SSO authentication initiated for tenant: {sso_config.tenant_id}, client_id: {sso_config.client_id}")

        return super().get(request)


class CustomOIDCAuthenticationCallbackView(OIDCAuthenticationCallbackView):
    """
    Custom OIDC callback view that loads configuration from database.
    Overrides get_settings() to load from database instead of Django settings.
    """

    def get_settings(self, attr, *args):
        """
        Override get_settings to load from database.
        This is called by parent __init__ and other methods.
        """
        logger.info(f"!!! CustomOIDCAuthenticationCallbackView.get_settings() called with attr={attr}")

        try:
            sso_config = SSOConfiguration.objects.filter(is_enabled=True).first()
            logger.info(f"!!! SSO Config loaded: {sso_config is not None}")

            if not sso_config:
                logger.warning(f"!!! No SSO config found, falling back to parent")
                # Fall back to Django settings if no config
                return super().get_settings(attr, *args)

            tenant_id = sso_config.tenant_id
            logger.info(f"!!! Tenant ID: {tenant_id}, Client ID: {sso_config.client_id}")

            # Map setting names to database values - ONLY override what we need
            settings_map = {
                'OIDC_RP_CLIENT_ID': sso_config.client_id,
                'OIDC_RP_CLIENT_SECRET': settings.FERNET.decrypt(sso_config.encrypted_client_secret.encode()).decode(),
                'OIDC_OP_AUTHORIZATION_ENDPOINT': f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize',
                'OIDC_OP_TOKEN_ENDPOINT': f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token',
                'OIDC_OP_USER_ENDPOINT': 'https://graph.microsoft.com/v1.0/me',
                'OIDC_OP_JWKS_ENDPOINT': f'https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys',
                'OIDC_RP_SIGN_ALGO': 'RS256',
                'OIDC_RP_SCOPES': 'openid profile email',
                'OIDC_AUTHENTICATION_CALLBACK_URL': 'oidc_authentication_callback',
            }

            if attr in settings_map:
                value = settings_map[attr]
                logger.info(f"!!! Returning {attr} = {value[:50] if isinstance(value, str) and len(value) > 50 else value}")
                return value

        except Exception as e:
            logger.error(f"!!! Error loading SSO config for {attr}: {e}", exc_info=True)

        # For any setting not in our map, use parent's default
        result = super().get_settings(attr, *args)
        logger.info(f"!!! Parent get_settings({attr}) returned: {result}")
        return result

    def get(self, request):
        """Check that SSO is configured before processing"""
        logger.info(f"!!! CustomOIDCAuthenticationCallbackView.get() called")

        sso_config = SSOConfiguration.objects.filter(is_enabled=True).first()

        if not sso_config:
            return HttpResponse("SSO is not configured or enabled.", status=400)

        logger.info(f"!!! SSO callback received for tenant: {sso_config.tenant_id}, client_id: {sso_config.client_id}")

        # Call parent to handle OIDC authentication
        response = super().get(request)

        # If authentication was successful, generate JWT tokens
        if request.user.is_authenticated:
            logger.info(f"!!! User authenticated: {request.user.email}, generating JWT tokens")

            # Generate JWT tokens for the authenticated user
            refresh = RefreshToken.for_user(request.user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)

            logger.info(f"!!! JWT tokens generated, redirecting to /sso/callback with tokens")

            # Redirect to frontend callback route with tokens in query params
            redirect_url = f"/sso/callback?access={access_token}&refresh={refresh_token}"
            return redirect(redirect_url)

        return response
