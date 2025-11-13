# Entra ID SSO Implementation Guide

This guide documents the implementation of Microsoft Entra ID (Azure AD) Single Sign-On (SSO) for CerbyonVault.

## 📋 Overview

The implementation provides a hybrid authentication system:
- **Admin Account**: Local username/password authentication for bootstrapping and SSO configuration
- **Regular Users**: Authenticate via Microsoft Entra ID SSO
- **Settings Panel**: Admin-only interface to configure SSO parameters

---

## ✅ Completed Tasks

### Backend Changes

1. **✓ Database Models Updated**
   - Added `is_sso_user` and `sso_subject_id` fields to `CustomUser` model
   - Created `SSOConfiguration` model to store Entra ID settings (tenant ID, client ID, encrypted client secret)
   - File: `backend/certs/models.py`

2. **✓ SSO Configuration Serializer Created**
   - Handles encryption/decryption of client secret using Fernet
   - File: `backend/certs/serializers.py`

3. **✓ SSO Settings API Endpoints Created**
   - `GET /api/admin/sso-settings/` - Retrieve SSO configuration
   - `POST /api/admin/sso-settings/` - Create/update SSO configuration
   - `POST /api/admin/sso-settings/test/` - Test connection to Entra ID
   - File: `backend/certs/views/sso_settings_views.py`

4. **✓ URL Routes Configured**
   - Added SSO endpoints to URL configuration
   - File: `backend/certs/urls.py`

5. **✓ Security Headers Added**
   - HTTPS enforcement (production only)
   - Secure cookies (httpOnly, secure, SameSite)
   - Security headers (X-Content-Type-Options, X-Frame-Options, XSS-Filter)
   - File: `backend/cerbyonvault/settings.py`

### Frontend Changes

1. **✓ SSO Settings Component Created**
   - Admin interface to configure Entra ID settings
   - Test connection functionality
   - Form validation and error handling
   - File: `frontend/src/components/admin/SSOSettings.tsx`

2. **✓ Admin Page Updated**
   - Added "SSO Settings" tab to admin panel
   - Integrated SSO Settings component
   - File: `frontend/src/pages/Admin.tsx`

3. **✓ Security Fix Applied**
   - Removed JWT token logging from console
   - Files: `frontend/src/context/AuthContext.tsx`, `frontend/src/pages/Login.tsx`

---

## 🔧 Pending Tasks

### 1. Install Dependencies

Add the following packages to your Docker container:

**Backend** (`backend/requirements.txt`):
```bash
mozilla-django-oidc==4.0.0
requests==2.32.3
```

Or use the provided file: `backend/SSO_REQUIREMENTS.txt`

**Frontend** (`frontend/package.json`):
```bash
npm install @azure/msal-browser @azure/msal-react
```

### 2. Run Database Migrations

After Docker is running, execute:

```bash
# Create migrations
docker-compose exec backend python manage.py makemigrations certs

# Apply migrations
docker-compose exec backend python manage.py migrate

# Verify migrations
docker-compose exec backend python manage.py showmigrations certs
```

This will create tables for:
- `SSOConfiguration` model
- Add `is_sso_user` and `sso_subject_id` fields to `CustomUser`

### 3. Configure Django OIDC Backend

Add to `backend/cerbyonvault/settings.py`:

```python
# Add to INSTALLED_APPS
INSTALLED_APPS = [
    # ... existing apps ...
    'mozilla_django_oidc',
]

# OIDC Configuration
OIDC_RP_CLIENT_ID = ''  # Will be set dynamically from database
OIDC_RP_CLIENT_SECRET = ''  # Will be set dynamically from database
OIDC_OP_AUTHORIZATION_ENDPOINT = ''  # Will be set dynamically
OIDC_OP_TOKEN_ENDPOINT = ''  # Will be set dynamically
OIDC_OP_USER_ENDPOINT = ''  # Will be set dynamically
OIDC_OP_JWKS_ENDPOINT = ''  # Will be set dynamically

# Add custom OIDC authentication backend
AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',  # Keep for admin accounts
    'certs.authentication.EntraIDAuthenticationBackend',  # New SSO backend
]
```

### 4. Create Custom OIDC Authentication Backend

Create file: `backend/certs/authentication_backend.py`

```python
from mozilla_django_oidc.auth import OIDCAuthenticationBackend
from .models import CustomUser, SSOConfiguration

class EntraIDAuthenticationBackend(OIDCAuthenticationBackend):
    """
    Custom authentication backend for Microsoft Entra ID
    """

    def get_settings(self, attr, *args):
        """Load OIDC settings from database"""
        try:
            config = SSOConfiguration.objects.filter(is_enabled=True).first()
            if not config:
                return None

            tenant_id = config.tenant_id

            settings_map = {
                'OIDC_RP_CLIENT_ID': config.client_id,
                'OIDC_RP_CLIENT_SECRET': self.decrypt_secret(config.encrypted_client_secret),
                'OIDC_OP_AUTHORIZATION_ENDPOINT': f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize',
                'OIDC_OP_TOKEN_ENDPOINT': f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token',
                'OIDC_OP_USER_ENDPOINT': 'https://graph.microsoft.com/v1.0/me',
                'OIDC_OP_JWKS_ENDPOINT': f'https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys',
            }

            return settings_map.get(attr)
        except Exception:
            return None

    def decrypt_secret(self, encrypted_secret):
        """Decrypt the client secret"""
        from django.conf import settings
        return settings.FERNET.decrypt(encrypted_secret.encode()).decode()

    def create_user(self, claims):
        """Create a new SSO user"""
        email = claims.get('email') or claims.get('preferred_username')
        user = CustomUser.objects.create_user(
            email=email,
            username=email.split('@')[0],
            first_name=claims.get('given_name', ''),
            last_name=claims.get('family_name', ''),
            is_sso_user=True,
            sso_subject_id=claims.get('sub')
        )
        return user

    def update_user(self, user, claims):
        """Update existing SSO user"""
        user.first_name = claims.get('given_name', user.first_name)
        user.last_name = claims.get('family_name', user.last_name)
        user.email = claims.get('email') or claims.get('preferred_username')
        user.save()
        return user

    def filter_users_by_claims(self, claims):
        """Return users matching the SSO subject ID"""
        sub = claims.get('sub')
        if not sub:
            return self.UserModel.objects.none()

        try:
            return self.UserModel.objects.filter(sso_subject_id=sub, is_sso_user=True)
        except self.UserModel.DoesNotExist:
            return self.UserModel.objects.none()
```

### 5. Add SSO Login Endpoints

Add to `backend/certs/urls.py`:

```python
from mozilla_django_oidc.urls import urlpatterns as oidc_urls

urlpatterns = [
    # ... existing patterns ...

    # SSO Authentication endpoints
    path('auth/sso/', include(oidc_urls)),
]
```

### 6. Update Frontend Login Page

Modify `frontend/src/pages/Login.tsx` to add "Sign in with Microsoft" button:

```tsx
// Add state for SSO config
const [ssoEnabled, setSsoEnabled] = useState(false);

// Check if SSO is enabled on mount
useEffect(() => {
  checkSSOEnabled();
}, []);

const checkSSOEnabled = async () => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/sso-settings/`);
    const data = await response.json();
    setSsoEnabled(data.is_enabled);
  } catch (error) {
    // SSO not configured, use regular login only
  }
};

// Add Microsoft SSO button before the form
{ssoEnabled && (
  <>
    <button
      type="button"
      onClick={() => window.location.href = `${import.meta.env.VITE_API_URL}/auth/sso/authenticate`}
      className="w-full py-2 bg-blue-600 text-white font-bold rounded-md mb-4"
    >
      Sign in with Microsoft
    </button>
    <div className="divider">OR</div>
  </>
)}
```

### 7. Frontend Package Installation

Install MSAL libraries (optional for advanced SSO features):

```bash
cd frontend
npm install @azure/msal-browser @azure/msal-react
```

---

## 🚀 Deployment Steps

### Step 1: Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com) → Azure Active Directory
2. Navigate to **App registrations** → **New registration**
3. Fill in the details:
   - **Name**: CerbyonVault SSO
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: `https://your-domain.com/auth/sso/callback/`
4. Click **Register**
5. Copy the following from the Overview page:
   - **Application (client) ID**
   - **Directory (tenant) ID**
6. Go to **Certificates & secrets** → **New client secret**
   - Description: CerbyonVault Client Secret
   - Expires: Choose appropriate expiration
   - Click **Add**
   - **Copy the secret value immediately** (it won't be shown again)

### Step 2: Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
3. Add the following permissions:
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
4. Click **Grant admin consent** (if you have admin rights)

### Step 3: Configure Redirect URIs

1. Go to **Authentication** in your app registration
2. Under **Web** platform, add:
   - `https://your-domain.com/auth/sso/callback/`
   - `http://localhost/auth/sso/callback/` (for local testing)
3. Under **Implicit grant and hybrid flows**, enable:
   - ✓ ID tokens

### Step 4: Install Backend Dependencies

```bash
# Add SSO requirements to the container
docker-compose exec backend pip install mozilla-django-oidc==4.0.0 requests==2.32.3

# Or rebuild the container after updating requirements.txt
docker-compose down
docker-compose up --build
```

### Step 5: Run Migrations

```bash
docker-compose exec backend python manage.py makemigrations certs
docker-compose exec backend python manage.py migrate
```

### Step 6: Configure SSO in Admin Panel

1. Login to CerbyonVault admin account: `http://localhost/admin`
2. Go to **Admin** → **SSO Settings** tab
3. Enter the values from Azure:
   - **Tenant ID**: From Azure AD Overview
   - **Client ID**: Application (client) ID from app registration
   - **Client Secret**: The secret value you copied
   - **Redirect URI**: `https://your-domain.com/auth/sso/callback/`
4. Click **Test Connection** to verify
5. Enable SSO by checking "Enable SSO Authentication"
6. Click **Save Configuration**

### Step 7: Test SSO Login

1. Logout from admin account
2. Go to login page
3. You should see "Sign in with Microsoft" button
4. Click the button to test SSO flow
5. Login with your Microsoft account
6. You should be redirected back and logged in

---

## 🔒 Security Considerations

### Production Deployment Checklist

- [ ] Set `DJANGO_DEBUG=False` in `.env`
- [ ] Use HTTPS for all endpoints (SSO requires HTTPS)
- [ ] Configure proper `DJANGO_ALLOWED_HOSTS`
- [ ] Update `DJANGO_CORS_ALLOWED_ORIGINS` to include your domain
- [ ] Ensure `KEY_ENCRYPTION_SECRET` is a secure Fernet key
- [ ] Use strong passwords for admin accounts
- [ ] Regularly rotate client secrets in Azure AD
- [ ] Monitor SSO login attempts and failures
- [ ] Implement rate limiting on authentication endpoints
- [ ] Review Azure AD audit logs periodically

### Security Headers

The following headers are already configured in `settings.py`:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- HTTPS enforcement (production only)
- Secure cookies (production only)

---

## 🐛 Troubleshooting

### SSO Login Fails

1. **Check Azure AD Configuration**:
   - Verify Tenant ID, Client ID, and Client Secret are correct
   - Ensure redirect URI matches exactly (including trailing slash)
   - Check API permissions are granted

2. **Check Backend Logs**:
   ```bash
   docker-compose logs backend
   ```

3. **Verify OIDC Settings**:
   - Test connection from SSO Settings page
   - Check that discovery endpoint is reachable

### Users Can't Login After Enabling SSO

- Admin accounts still use local authentication
- SSO only applies to regular users
- Ensure `is_sso_user=False` for admin accounts

### Client Secret Decryption Fails

- Verify `KEY_ENCRYPTION_SECRET` in `.env` is valid base64-encoded Fernet key
- Regenerate key if needed: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`

---

## 📚 Additional Resources

- [Microsoft Entra ID Documentation](https://learn.microsoft.com/en-us/entra/identity/)
- [mozilla-django-oidc Documentation](https://mozilla-django-oidc.readthedocs.io/)
- [Azure AD App Registration Guide](https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)

---

## 🎉 Next Steps

After SSO is working:
1. Invite users to register via SSO
2. Deprecate old JWT authentication for regular users
3. Set up certificate renewal alerts (existing feature)
4. Implement audit logging for SSO logins
5. Configure multi-factor authentication in Azure AD

---

**Need Help?** Check the troubleshooting section or review Azure AD audit logs for authentication errors.
