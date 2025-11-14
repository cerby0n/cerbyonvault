from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import get_user_model
from .models import (
    Certificate, InviteToken, PrivateKey, CustomUser, Team, UploadedFile,
    UserProfile, Website, SSOConfiguration, Secret, EmailConfig,
    NotificationConfig, CertificateNotification, SecretNotification, NotificationLog
)
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer,TokenRefreshSerializer
from django.contrib.auth import authenticate

User = get_user_model()

class TeamMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ['id', 'name']

class UserSerializer(serializers.ModelSerializer):
    is_admin = serializers.SerializerMethodField()
    teams = TeamMiniSerializer(many=True, read_only=True)
    profile_image = serializers.ImageField(required=False, allow_null=True)
    class Meta:
        model= CustomUser
        fields = ['id', 'email', 'username', 'first_name', 'last_name', 'is_admin', 'teams', 'profile_image']
        extra_kwargs = {"password": {"write_only":True}}

    def create(self, validated_data):
        user = CustomUser.objects.create_user(**validated_data)
        return user

    def get_is_admin(self, obj):
        return obj.is_staff

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        token['email'] = user.email
        token['username'] = user.username
        token['first_name'] = user.first_name
        token['last_name'] = user.last_name
        # Add teams to token
        token['teams'] = [{'id': team.id, 'name': team.name} for team in user.teams.all()]
        return token

class LoginUserSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(**data)
        if user and user.is_active:
            return user
        raise serializers.ValidationError('Incorrect credentials')

class TeamSerializer(serializers.ModelSerializer):
    members = UserSerializer(many=True, read_only=True)
    class Meta:
        model = Team
        fields = ['id', 'name', 'members']

class TeamDetailSerializer(serializers.ModelSerializer):
    members = UserSerializer(many=True, read_only=True)

    class Meta:
        model = Team
        fields = ['id', 'name', 'members']

class CertificateMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Certificate
        fields = ['id', 'name', 'not_after', 'subject']  

class WebsiteSerializer(serializers.ModelSerializer):
    certificate = CertificateMiniSerializer(read_only=True)
    class Meta:
        model = Website
        fields = ['id', 'url', 'domain', 'certificate']
        read_only_fields = ['id', 'domain']
        
class CertificateSerializer(serializers.ModelSerializer):
    access_teams= TeamSerializer(many=True, read_only=True)
    websites     = WebsiteSerializer(many=True, read_only=True)
    has_private_key = serializers.SerializerMethodField()
    class Meta:
        model = Certificate
        fields = '__all__'
    def get_has_private_key(self, obj):
        return obj.has_private_key

class CertificateMetaSerializer(serializers.Serializer):
    file = serializers.IntegerField()
    name = serializers.CharField(max_length=255, allow_blank=True, required=False)
    teams = serializers.ListField(child=serializers.IntegerField(), required=True)
    password = serializers.CharField(required=False, allow_blank=True)
    certificate_id = serializers.IntegerField(required=False)

class UploadFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UploadedFile
        fields =['id','file','uploaded_at']
    
    def create(self, validated_data):
        validated_data['uploaded_by'] = self.context['request'].user
        return UploadedFile.objects.create(**validated_data)


class PrivateKeyDetailSerializer(serializers.ModelSerializer):
    certificate = CertificateMiniSerializer(read_only=True)
    access_teams= TeamSerializer(many=True, read_only=True)
    class Meta:
        model = PrivateKey
        fields = '__all__'


class PrivateKeyUploadSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    key_file = serializers.FileField()
    certificate_id = serializers.IntegerField(required=False)
    password = serializers.CharField(required=False, allow_blank=True)


class UploadedFileProcessSerializer(serializers.Serializer):
    file_id = serializers.IntegerField()
    teams = serializers.ListField(child=serializers.IntegerField(), required=True)
    password = serializers.CharField(required=False, allow_blank=True)
    name = serializers.CharField(required=False, allow_blank=True)


class CertificateUpdateSerializer(serializers.ModelSerializer):
    access_teams = serializers.PrimaryKeyRelatedField(queryset=Team.objects.all(), many=True, required=False)

    class Meta:
        model = Certificate
        fields = ['name', 'access_teams', 'comment']
    
    def upadte (self,instance,validated_data):
        teams_data = validated_data.pop('access_teams', None)
        instance = super().update(instance, validated_data)
        if teams_data is not None:
            instance.access_teams.set(teams_data)
        instance.save()
        return instance

class PrivateKeyUpdateSerializer(serializers.ModelSerializer):
    access_teams = serializers.PrimaryKeyRelatedField(queryset=Team.objects.all(), many=True, required=False)
    certificate = serializers.PrimaryKeyRelatedField(queryset=Certificate.objects.all(), required=False)

    class Meta:
        model = PrivateKey
        fields = ['name', 'comment', 'access_teams', 'certificate']

    def update(self, instance, validated_data):
        teams_data = validated_data.pop('access_teams', None)
        cert_data = validated_data.pop('certificate', None)

        instance = super().update(instance, validated_data)

        if teams_data is not None:
            instance.access_teams.set(teams_data)

        if cert_data is not None:
            instance.certificate = cert_data

        instance.save()
        return instance

class AdminUserCreateSerializer(serializers.ModelSerializer):
    is_admin = serializers.BooleanField(write_only=True, required=False)
    class Meta:
        model = CustomUser
        fields = ['id', 'email', 'username', 'first_name', 'last_name', 'is_admin']

    def create(self, validated_data):
        is_admin = validated_data.pop("is_admin", False)
        user = CustomUser.objects.create_user(**validated_data)
        user.is_staff = is_admin
        user.save()
        return user
    
class AdminUserUpdateSerializer(serializers.ModelSerializer):
    is_admin = serializers.BooleanField(write_only=True, required=False)
    profile_image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = CustomUser
        fields = ["email", "username", "first_name", "last_name", "is_admin", "profile_image"]

    def update(self, instance, validated_data):
        is_admin = validated_data.pop("is_admin", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if is_admin is not None:
            instance.is_staff = is_admin
        instance.save()
        return instance
    
class RegistrationSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    email = serializers.EmailField(read_only=True)  # shown, not typed
    username = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate_token(self, value):
        try:
            invite = InviteToken.objects.get(token=value, is_used=False)
        except InviteToken.DoesNotExist:
            raise serializers.ValidationError("Invalid or expired invitation link.")
        self.invite = invite
        return value

    def validate(self, data):
        if data["password"] != data["confirm_password"]:
            raise serializers.ValidationError("Passwords do not match.")
        
        validate_password(data["password"])
        return data

    def create(self, validated_data):
        user = User.objects.create_user(
            email=self.invite.email,
            username=validated_data["username"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            password=validated_data["password"]
        )
        UserProfile.objects.create(user=user)  # Default profile

        self.invite.is_used = True
        self.invite.save()
        return user

class SSOConfigurationSerializer(serializers.ModelSerializer):
    """
    Serializer for SSO Configuration.
    Handles encryption/decryption of client secret.
    """
    client_secret = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = SSOConfiguration
        fields = ['id', 'tenant_id', 'client_id', 'client_secret', 'is_enabled', 'redirect_uri', 'scim_enabled', 'scim_token', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def to_representation(self, instance):
        """Don't return the encrypted client secret"""
        data = super().to_representation(instance)
        # Return a masked version to indicate secret is set
        if instance.encrypted_client_secret:
            data['client_secret_set'] = True
        else:
            data['client_secret_set'] = False
        return data

    def create(self, validated_data):
        from django.conf import settings
        client_secret = validated_data.pop('client_secret', None)

        if client_secret:
            # Encrypt the client secret using Fernet
            encrypted_secret = settings.FERNET.encrypt(client_secret.encode()).decode()
            validated_data['encrypted_client_secret'] = encrypted_secret

        return super().create(validated_data)

    def update(self, instance, validated_data):
        from django.conf import settings
        client_secret = validated_data.pop('client_secret', None)

        if client_secret:
            # Encrypt the new client secret
            encrypted_secret = settings.FERNET.encrypt(client_secret.encode()).decode()
            validated_data['encrypted_client_secret'] = encrypted_secret

        return super().update(instance, validated_data)


class SecretMiniSerializer(serializers.ModelSerializer):
    """
    Minimal serializer for secrets used in dashboard lists.
    """
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = Secret
        fields = ['id', 'name', 'application', 'expiry_date', 'is_expired']


class SecretSerializer(serializers.ModelSerializer):
    """
    Serializer for listing and retrieving secrets.
    Does not expose the decrypted secret value.
    """
    access_teams = TeamMiniSerializer(many=True, read_only=True)
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = Secret
        fields = ['id', 'name', 'application', 'expiry_date', 'access_teams', 'comment', 'created_at', 'updated_at', 'created_by_email', 'is_expired']
        read_only_fields = ['id', 'created_at', 'updated_at']


class SecretDetailSerializer(serializers.ModelSerializer):
    """
    Serializer for retrieving secret details including the decrypted value.
    Only used when explicitly requesting the secret value.
    """
    access_teams = TeamMiniSerializer(many=True, read_only=True)
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)
    secret_value = serializers.SerializerMethodField()
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = Secret
        fields = ['id', 'name', 'secret_value', 'application', 'expiry_date', 'access_teams', 'comment', 'created_at', 'updated_at', 'created_by_email', 'is_expired']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_secret_value(self, obj):
        """Decrypt and return the secret value"""
        from django.conf import settings
        try:
            decrypted_bytes = settings.FERNET.decrypt(obj.encrypted_secret_value.encode())
            return decrypted_bytes.decode()
        except Exception:
            return None


class SecretCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating new secrets.
    Accepts plain-text secret_value and encrypts it before saving.
    """
    secret_value = serializers.CharField(write_only=True, required=True)
    access_teams = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)

    class Meta:
        model = Secret
        fields = ['name', 'secret_value', 'application', 'expiry_date', 'access_teams', 'comment']

    def create(self, validated_data):
        from django.conf import settings

        # Extract and encrypt the secret value
        secret_value = validated_data.pop('secret_value')
        encrypted_secret = settings.FERNET.encrypt(secret_value.encode()).decode()
        validated_data['encrypted_secret_value'] = encrypted_secret

        # Extract team IDs
        team_ids = validated_data.pop('access_teams', [])

        # Set created_by from request context
        validated_data['created_by'] = self.context['request'].user

        # Create the secret
        secret = Secret.objects.create(**validated_data)

        # Add teams
        if team_ids:
            secret.access_teams.set(Team.objects.filter(id__in=team_ids))

        return secret


class SecretUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating secrets.
    Can optionally update the secret value (will be re-encrypted).
    """
    secret_value = serializers.CharField(write_only=True, required=False)
    access_teams = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)

    class Meta:
        model = Secret
        fields = ['name', 'secret_value', 'application', 'expiry_date', 'access_teams', 'comment']

    def update(self, instance, validated_data):
        from django.conf import settings

        # Handle secret value update if provided
        secret_value = validated_data.pop('secret_value', None)
        if secret_value:
            encrypted_secret = settings.FERNET.encrypt(secret_value.encode()).decode()
            instance.encrypted_secret_value = encrypted_secret

        # Handle teams update
        team_ids = validated_data.pop('access_teams', None)
        if team_ids is not None:
            instance.access_teams.set(Team.objects.filter(id__in=team_ids))

        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance


# =============================================================================
# NOTIFICATION SYSTEM SERIALIZERS
# =============================================================================

class EmailConfigSerializer(serializers.ModelSerializer):
    """
    Serializer for email configuration.
    Supports both SMTP and Microsoft Graph API methods.
    """
    smtp_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    graph_client_secret = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = EmailConfig
        fields = [
            'id', 'method', 'smtp_host', 'smtp_port', 'smtp_username',
            'smtp_password', 'smtp_use_tls', 'smtp_from_email',
            'graph_tenant_id', 'graph_client_id', 'graph_client_secret',
            'graph_from_email', 'daily_check_time', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def to_representation(self, instance):
        """Don't return sensitive credentials"""
        data = super().to_representation(instance)
        # Indicate if passwords/secrets are set without exposing them
        data['smtp_password_set'] = bool(instance.smtp_password)
        data['graph_client_secret_set'] = bool(instance.graph_client_secret)
        # Remove the actual sensitive fields from response
        data.pop('smtp_password', None)
        data.pop('graph_client_secret', None)
        return data

    def validate(self, data):
        """Validate that required fields are present based on selected method"""
        method = data.get('method', 'smtp')

        if method == 'smtp':
            # SMTP required fields
            required_fields = ['smtp_host', 'smtp_port', 'smtp_from_email']
            for field in required_fields:
                if not data.get(field) and not (self.instance and getattr(self.instance, field, None)):
                    raise serializers.ValidationError({
                        field: f'This field is required when using SMTP method.'
                    })
        elif method == 'graph':
            # Microsoft Graph required fields
            required_fields = ['graph_tenant_id', 'graph_client_id', 'graph_client_secret', 'graph_from_email']
            for field in required_fields:
                if not data.get(field) and not (self.instance and getattr(self.instance, field, None)):
                    raise serializers.ValidationError({
                        field: f'This field is required when using Microsoft Graph method.'
                    })

        return data


class NotificationConfigSerializer(serializers.ModelSerializer):
    """
    Serializer for notification configuration (team-based or global).
    """
    team_name = serializers.CharField(source='team.name', read_only=True)

    class Meta:
        model = NotificationConfig
        fields = [
            'id', 'team', 'team_name', 'is_global', 'enabled',
            'recipients', 'notify_expiring', 'expiry_thresholds',
            'notify_expired', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_recipients(self, value):
        """Validate that recipients is a list of valid email addresses"""
        if not isinstance(value, list):
            raise serializers.ValidationError('Recipients must be a list of email addresses.')

        for email in value:
            if not isinstance(email, str):
                raise serializers.ValidationError('All recipients must be valid email addresses.')
            # Basic email validation
            if '@' not in email or '.' not in email.split('@')[-1]:
                raise serializers.ValidationError(f'Invalid email address: {email}')

        return value

    def validate_expiry_thresholds(self, value):
        """Validate that expiry_thresholds is a list of positive integers"""
        if not isinstance(value, list):
            raise serializers.ValidationError('Expiry thresholds must be a list of numbers.')

        for threshold in value:
            if not isinstance(threshold, int) or threshold <= 0:
                raise serializers.ValidationError('All expiry thresholds must be positive integers.')

        # Sort thresholds in ascending order
        return sorted(value)

    def validate(self, data):
        """Validate that only one global config can exist"""
        if data.get('is_global', False):
            # Check if another global config exists (excluding current instance if updating)
            existing_global = NotificationConfig.objects.filter(is_global=True)
            if self.instance:
                existing_global = existing_global.exclude(pk=self.instance.pk)

            if existing_global.exists():
                raise serializers.ValidationError({
                    'is_global': 'Only one global notification configuration can exist.'
                })

            # Global config cannot have a team
            if data.get('team'):
                raise serializers.ValidationError({
                    'team': 'Global configuration cannot be associated with a team.'
                })

        return data


class CertificateNotificationSerializer(serializers.ModelSerializer):
    """
    Serializer for per-certificate notification overrides.
    """
    certificate_name = serializers.CharField(source='certificate.name', read_only=True)

    class Meta:
        model = CertificateNotification
        fields = [
            'id', 'certificate', 'certificate_name', 'override_enabled',
            'recipients', 'notify_expiring', 'expiry_thresholds',
            'notify_expired', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_recipients(self, value):
        """Validate that recipients is a list of valid email addresses"""
        if not isinstance(value, list):
            raise serializers.ValidationError('Recipients must be a list of email addresses.')

        for email in value:
            if not isinstance(email, str):
                raise serializers.ValidationError('All recipients must be valid email addresses.')
            if '@' not in email or '.' not in email.split('@')[-1]:
                raise serializers.ValidationError(f'Invalid email address: {email}')

        return value

    def validate_expiry_thresholds(self, value):
        """Validate that expiry_thresholds is a list of positive integers"""
        if not isinstance(value, list):
            raise serializers.ValidationError('Expiry thresholds must be a list of numbers.')

        for threshold in value:
            if not isinstance(threshold, int) or threshold <= 0:
                raise serializers.ValidationError('All expiry thresholds must be positive integers.')

        return sorted(value)


class SecretNotificationSerializer(serializers.ModelSerializer):
    """
    Serializer for per-secret notification overrides.
    """
    secret_name = serializers.CharField(source='secret.name', read_only=True)

    class Meta:
        model = SecretNotification
        fields = [
            'id', 'secret', 'secret_name', 'override_enabled',
            'recipients', 'notify_expiring', 'expiry_thresholds',
            'notify_expired', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_recipients(self, value):
        """Validate that recipients is a list of valid email addresses"""
        if not isinstance(value, list):
            raise serializers.ValidationError('Recipients must be a list of email addresses.')

        for email in value:
            if not isinstance(email, str):
                raise serializers.ValidationError('All recipients must be valid email addresses.')
            if '@' not in email or '.' not in email.split('@')[-1]:
                raise serializers.ValidationError(f'Invalid email address: {email}')

        return value

    def validate_expiry_thresholds(self, value):
        """Validate that expiry_thresholds is a list of positive integers"""
        if not isinstance(value, list):
            raise serializers.ValidationError('Expiry thresholds must be a list of numbers.')

        for threshold in value:
            if not isinstance(threshold, int) or threshold <= 0:
                raise serializers.ValidationError('All expiry thresholds must be positive integers.')

        return sorted(value)


class NotificationLogSerializer(serializers.ModelSerializer):
    """
    Serializer for notification logs (read-only).
    Used for audit trail and debugging.
    """
    class Meta:
        model = NotificationLog
        fields = [
            'id', 'notification_type', 'resource_type', 'resource_id',
            'resource_name', 'recipients', 'days_until_expiry',
            'status', 'error_message', 'sent_at'
        ]
        read_only_fields = fields  # All fields are read-only

