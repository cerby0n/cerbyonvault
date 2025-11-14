from datetime import timedelta
import uuid
from urllib.parse import urlparse
from django.conf import settings
from django.db import models
from django.contrib.auth.models import User,AbstractUser
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from .managers import CustomUserManager
from django.utils import timezone

def default_invite_expiry():
    return timezone.now() + timedelta(days=7)

class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    username = models.CharField(max_length=150, blank=True, null=True, unique=False)
    profile_image = models.ImageField(upload_to='profile_images/', blank=True, null=True, help_text="User profile picture")

    # SSO-related fields
    is_sso_user = models.BooleanField(default=False, help_text="True if user authenticates via Entra ID SSO")
    sso_subject_id = models.CharField(max_length=255, blank=True, null=True, unique=True, help_text="Unique identifier from SSO provider (sub claim)")

    objects=CustomUserManager()

    def __str__(self):
        return self.email

class Team(models.Model):
    name = models.CharField(max_length=255, unique=True)
    members = models.ManyToManyField(CustomUser, related_name='teams',blank=True)
    external_id = models.CharField(max_length=255, blank=True, null=True, unique=True, help_text="External identifier from Azure AD (used for SCIM provisioning)")
    provisioned_from_azure = models.BooleanField(default=False, help_text="True if this team was provisioned from Azure AD")

    def __str__(self):
        return self.name


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    is_company_admin = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username} Profile"

class Certificate(models.Model):
    name = models.CharField(max_length=255)
    comment = models.TextField(null=True, blank=True)
    subject = models.TextField()
    issuer = models.TextField()
    serial_number = models.CharField(max_length=255)
    not_before = models.DateTimeField()
    not_after = models.DateTimeField()
    is_expired = models.BooleanField(default=False)
    public_key_type = models.CharField(max_length=255, null=True, blank=True)
    public_key_length = models.IntegerField(null=True, blank=True)
    signature_algorithm = models.CharField(max_length=255)
    san = models.JSONField(default=list)
    file = models.ForeignKey('UploadedFile', on_delete=models.CASCADE, null=True, blank=True)
    file_format = models.CharField(max_length=20,default='PEM')
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='p_certificate')
    children = models.ManyToManyField('self', symmetrical=False, blank=True, related_name="c_certificate")
    original_filename = models.CharField(max_length=255, null=True, blank=True)
    access_teams = models.ManyToManyField(Team, related_name='certificates', blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.SET_NULL, null=True,blank=True)
    cert_hash = models.CharField(max_length=255,unique=True,blank=True,null=True)
    issuer_hash = models.CharField(max_length=255, null=True, blank=True)
    subject_hash = models.CharField(max_length=255, null=True, blank=True)
    certificate_type=models.CharField(
        max_length=20,
        choices=[
            ('RootCA','Root CA'),
            ('IntermediateCA','Intermediate CA'),
            ('Leaf', 'Leaf Certificate'),
        ],
        null=True,
        blank=True
    )
    @property
    def has_private_key(self):
        return getattr(self, 'private_key', None) is not None
    
    def __str__(self):
        return f"{self.name} ({self.subject})"
    
class PrivateKey(models.Model):
    name = models.CharField(max_length=255)
    comment = models.TextField(null=True, blank=True)
    encrypted_key_file = models.FileField(upload_to='keys/')
    created_at = models.DateTimeField(auto_now_add=True)
    certificate = models.OneToOneField('Certificate', on_delete=models.CASCADE, related_name='private_key', null=True, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    keysize = models.CharField(max_length=20,default=None, null=True,blank=True)
    file_format = models.CharField(max_length=20,default='PEM')
    original_filename = models.CharField(max_length=255, null=True, blank=True)
    access_teams = models.ManyToManyField(Team, related_name='private_key',blank=True)
    key_hash = models.CharField(max_length=255, unique=True, null=True, blank=True)

    def __str__(self):
        return f"{self.name}"
    
class UploadedFile(models.Model):
    file = models.FileField(upload_to='certificates/',null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    content_type = models.CharField(max_length=50, blank=True, null=True)
    original_filename = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"{self.file.name} by {self.uploaded_by.email}"
    
class Website(models.Model):
    url = models.URLField(max_length=200)
    certificate = models.ForeignKey(Certificate, on_delete=models.CASCADE,related_name="websites",blank=True, null=True)
    domain = models.CharField(max_length=255, blank=True, null=True)

    def save(self, *args, **kwargs):
        if self.url:
            parsed_url = urlparse(self.url)
            self.domain = parsed_url.netloc
            if self.domain.startswith("www."):
                self.domain = self.domain[4:] 
        super().save(*args, **kwargs)
        
    def __str__(self):
        return self.url
    
class InviteToken(models.Model):
    email = models.EmailField()
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(default=default_invite_expiry)
    is_used = models.BooleanField(default=False)

    def is_expired(self):
        return self.expires_at < timezone.now()

    def __str__(self):
        return f"{self.email} - {'used' if self.is_used else 'active'}"

class SSOConfiguration(models.Model):
    """
    Stores Entra ID (Azure AD) SSO configuration.
    Only one configuration should exist (enforced at application level).
    """
    tenant_id = models.CharField(max_length=255, help_text="Azure AD Tenant ID")
    client_id = models.CharField(max_length=255, help_text="Application (client) ID from Azure AD app registration")
    encrypted_client_secret = models.TextField(help_text="Encrypted client secret from Azure AD app registration")
    is_enabled = models.BooleanField(default=False, help_text="Enable/disable SSO authentication")
    redirect_uri = models.URLField(blank=True, null=True, help_text="Redirect URI (auto-generated if empty)")

    # SCIM provisioning settings
    scim_enabled = models.BooleanField(
        default=False,
        help_text="Enable SCIM provisioning for groups from Azure AD"
    )
    scim_token = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Bearer token for SCIM authentication (set in Azure AD app provisioning)"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name = "SSO Configuration"
        verbose_name_plural = "SSO Configurations"

    def __str__(self):
        return f"SSO Config - {'Enabled' if self.is_enabled else 'Disabled'}"

    def save(self, *args, **kwargs):
        # Ensure only one configuration exists
        if not self.pk and SSOConfiguration.objects.exists():
            raise ValueError("Only one SSO configuration can exist. Please update the existing configuration.")
        super().save(*args, **kwargs)


class Secret(models.Model):
    """
    Stores encrypted secrets (API keys, passwords, tokens, etc.) with team-based access control.
    Similar to Certificate model but for secret management.
    """
    name = models.CharField(max_length=255, help_text="Name or description of the secret")
    encrypted_secret_value = models.TextField(help_text="Encrypted secret value (API key, password, token, etc.)")
    application = models.CharField(max_length=255, help_text="Application or service this secret belongs to")
    expiry_date = models.DateField(blank=True, null=True, help_text="When this secret expires (optional)")
    access_teams = models.ManyToManyField(Team, related_name='secrets', blank=True, help_text="Teams that can access this secret")
    comment = models.TextField(blank=True, null=True, help_text="Additional notes about this secret")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_secrets')

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Secret"
        verbose_name_plural = "Secrets"

    def __str__(self):
        return f"{self.name} ({self.application})"

    @property
    def is_expired(self):
        """Check if the secret has expired"""
        if self.expiry_date:
            from django.utils import timezone
            return self.expiry_date < timezone.now().date()
        return False


@receiver(post_delete, sender=Certificate)
def delete_cert_file(sender, instance, **kwargs):
    if instance.file:
        instance.file.delete()


@receiver(post_delete, sender=PrivateKey)
def delete_key_file(sender, instance, **kwargs):
    if instance.encrypted_key_file:
        instance.encrypted_key_file.delete(save=False)


@receiver(post_delete, sender=UploadedFile)
def delete_file_on_model_delete(sender, instance, **kwargs):
    if instance.file:
        instance.file.delete(save=False)