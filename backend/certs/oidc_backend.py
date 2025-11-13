"""
Custom OIDC Authentication Backend for Microsoft Entra ID (Azure AD)
"""
from mozilla_django_oidc.auth import OIDCAuthenticationBackend
from django.conf import settings
from django.contrib.auth import get_user_model
from .models import SSOConfiguration, UserProfile
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


class EntraIDAuthenticationBackend(OIDCAuthenticationBackend):
    """
    Custom authentication backend for Microsoft Entra ID.
    Loads configuration from database and creates/updates SSO users.
    """

    def __init__(self, *args, **kwargs):
        self.sso_config = None
        super().__init__(*args, **kwargs)

    def get_sso_config(self):
        """Get enabled SSO configuration from database"""
        if self.sso_config is None:
            try:
                self.sso_config = SSOConfiguration.objects.filter(is_enabled=True).first()
            except Exception as e:
                logger.error(f"Failed to load SSO configuration: {e}")
                return None
        return self.sso_config

    def get_settings(self, attr, *args):
        """
        Override to load OIDC settings from database instead of Django settings.
        This allows dynamic configuration through the admin panel.
        """
        config = self.get_sso_config()

        if not config:
            # No config, use parent's defaults
            return super().get_settings(attr, *args)

        tenant_id = config.tenant_id

        # Map setting names to their values - ONLY override what we need
        settings_map = {
            'OIDC_RP_CLIENT_ID': config.client_id,
            'OIDC_RP_CLIENT_SECRET': self.decrypt_secret(config.encrypted_client_secret),
            'OIDC_OP_AUTHORIZATION_ENDPOINT': f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize',
            'OIDC_OP_TOKEN_ENDPOINT': f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token',
            'OIDC_OP_USER_ENDPOINT': 'https://graph.microsoft.com/v1.0/me',
            'OIDC_OP_JWKS_ENDPOINT': f'https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys',
            'OIDC_RP_SIGN_ALGO': 'RS256',
            'OIDC_RP_SCOPES': 'openid profile email',
            # IMPORTANT: Use the view name, not the full URL - Django will call reverse() on this
            'OIDC_AUTHENTICATION_CALLBACK_URL': 'oidc_authentication_callback',
        }

        # If the setting is in our map, return it
        if attr in settings_map:
            return settings_map[attr]

        # For any setting not in our map, use parent's default
        return super().get_settings(attr, *args)

    def decrypt_secret(self, encrypted_secret):
        """Decrypt the client secret using Fernet"""
        try:
            return settings.FERNET.decrypt(encrypted_secret.encode()).decode()
        except Exception as e:
            logger.error(f"Failed to decrypt client secret: {e}")
            return None

    def get_email_from_claims(self, claims):
        """
        Extract email from claims. Entra ID can send email in different claim fields.
        Microsoft Graph API uses 'mail' and 'userPrincipalName'.
        ID token uses 'email' and 'preferred_username'.
        """
        return (
            claims.get('mail') or                    # Microsoft Graph API
            claims.get('userPrincipalName') or       # Microsoft Graph API (UPN)
            claims.get('email') or                   # ID token
            claims.get('preferred_username') or      # ID token
            claims.get('upn') or                     # Alternative
            claims.get('unique_name')                # Alternative
        )

    def get_user_id_from_claims(self, claims):
        """
        Extract user ID from claims.
        Microsoft Graph API uses 'id'.
        ID token uses 'sub'.
        """
        return claims.get('id') or claims.get('sub')

    def verify_claims(self, claims):
        """
        Verify that the claims we got from the ID token are valid.
        For Entra ID, we need to verify the email exists.
        """
        # Log all claims for debugging
        logger.info(f"Received claims: {list(claims.keys())}")
        logger.info(f"Claims content: {claims}")

        email = self.get_email_from_claims(claims)

        if not email:
            logger.error(f"No email found in claims. Available claims: {list(claims.keys())}")
            return False

        logger.info(f"Email found in claims: {email}")
        # Additional claim verification can be added here
        # For example, check if email domain is allowed

        return True

    def filter_users_by_claims(self, claims):
        """
        Return users matching the SSO subject ID.
        This is called to find existing users based on OIDC claims.
        """
        user_id = self.get_user_id_from_claims(claims)

        if not user_id:
            logger.error(f"No user ID found in claims. Available claims: {list(claims.keys())}")
            return self.UserModel.objects.none()

        try:
            # Find user by SSO subject ID
            users = self.UserModel.objects.filter(
                sso_subject_id=user_id,
                is_sso_user=True
            )
            return users
        except Exception as e:
            logger.error(f"Error filtering users by claims: {e}")
            return self.UserModel.objects.none()

    def create_user(self, claims):
        """
        Create a new SSO user from OIDC claims.
        This is called when a user logs in via SSO for the first time.
        """
        email = self.get_email_from_claims(claims)
        user_id = self.get_user_id_from_claims(claims)

        if not email or not user_id:
            logger.error(f"Missing required claims (email or user_id). Claims: {list(claims.keys())}")
            logger.error(f"email={email}, user_id={user_id}")
            return None

        try:
            # Check if user with this email already exists (non-SSO user)
            existing_user = User.objects.filter(email=email, is_sso_user=False).first()

            if existing_user:
                # Convert existing user to SSO user
                existing_user.is_sso_user = True
                existing_user.sso_subject_id = user_id
                existing_user.first_name = claims.get('givenName') or claims.get('given_name') or existing_user.first_name
                existing_user.last_name = claims.get('surname') or claims.get('family_name') or existing_user.last_name
                existing_user.save()
                logger.info(f"Converted existing user {email} to SSO user")
                return existing_user

            # Create new SSO user
            username = email.split('@')[0]

            # Ensure username is unique
            base_username = username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1

            user = User.objects.create_user(
                email=email,
                username=username,
                first_name=claims.get('givenName') or claims.get('given_name') or '',
                last_name=claims.get('surname') or claims.get('family_name') or '',
                is_sso_user=True,
                sso_subject_id=user_id,
                is_active=True
            )

            # Create user profile
            UserProfile.objects.get_or_create(user=user, defaults={'is_company_admin': False})

            logger.info(f"Created new SSO user: {email}")
            return user

        except Exception as e:
            logger.error(f"Failed to create SSO user: {e}")
            return None

    def update_user(self, user, claims):
        """
        Update existing SSO user with latest claims from Entra ID.
        This is called every time an SSO user logs in.
        """
        try:
            # Handle both Microsoft Graph API names (givenName, surname) and ID token names (given_name, family_name)
            user.first_name = claims.get('givenName') or claims.get('given_name') or user.first_name
            user.last_name = claims.get('surname') or claims.get('family_name') or user.last_name
            email = self.get_email_from_claims(claims)
            if email:
                user.email = email
            user.save()

            logger.info(f"Updated SSO user: {user.email}")
            return user
        except Exception as e:
            logger.error(f"Failed to update SSO user: {e}")
            return user

    def authenticate(self, request, **kwargs):
        """
        Override authenticate to check if SSO is enabled before processing.
        """
        config = self.get_sso_config()

        if not config or not config.is_enabled:
            logger.warning("SSO authentication attempted but SSO is not enabled")
            return None

        return super().authenticate(request, **kwargs)
