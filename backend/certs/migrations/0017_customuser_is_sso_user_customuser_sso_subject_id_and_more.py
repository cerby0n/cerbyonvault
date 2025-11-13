# Generated manually for SSO implementation

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('certs', '0016_alter_team_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='is_sso_user',
            field=models.BooleanField(default=False, help_text='True if user authenticates via Entra ID SSO'),
        ),
        migrations.AddField(
            model_name='customuser',
            name='sso_subject_id',
            field=models.CharField(blank=True, help_text='Unique identifier from SSO provider (sub claim)', max_length=255, null=True, unique=True),
        ),
        migrations.CreateModel(
            name='SSOConfiguration',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tenant_id', models.CharField(help_text='Azure AD Tenant ID', max_length=255)),
                ('client_id', models.CharField(help_text='Application (client) ID from Azure AD app registration', max_length=255)),
                ('encrypted_client_secret', models.TextField(help_text='Encrypted client secret from Azure AD app registration')),
                ('is_enabled', models.BooleanField(default=False, help_text='Enable/disable SSO authentication')),
                ('redirect_uri', models.URLField(blank=True, help_text='Redirect URI (auto-generated if empty)', null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'SSO Configuration',
                'verbose_name_plural': 'SSO Configurations',
            },
        ),
    ]
