"""
URL configuration for cerbyonvault project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from certs.views.sso_auth_views import CustomOIDCAuthenticationRequestView, CustomOIDCAuthenticationCallbackView
from mozilla_django_oidc.views import OIDCLogoutView
from certs.views.scim_views import (
    SCIMGroupsView, SCIMGroupDetailView,
    scim_service_provider_config, scim_resource_types, scim_schemas
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/',include('certs.urls')),
    path('api-auth/', include("rest_framework.urls")),
    # Custom SSO authentication endpoints with database config loading
    path('oidc/authenticate/', CustomOIDCAuthenticationRequestView.as_view(), name='oidc_authentication_init'),
    path('oidc/callback/', CustomOIDCAuthenticationCallbackView.as_view(), name='oidc_authentication_callback'),
    path('oidc/logout/', OIDCLogoutView.as_view(), name='oidc_logout'),
    # SCIM 2.0 endpoints for Azure AD provisioning
    path('scim/v2/Groups', SCIMGroupsView.as_view(), name='scim_groups'),
    path('scim/v2/Groups/<str:group_id>', SCIMGroupDetailView.as_view(), name='scim_group_detail'),
    path('scim/v2/ServiceProviderConfig', scim_service_provider_config, name='scim_service_provider_config'),
    path('scim/v2/ResourceTypes', scim_resource_types, name='scim_resource_types'),
    path('scim/v2/Schemas', scim_schemas, name='scim_schemas'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)