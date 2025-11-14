from django.urls import include, path
from rest_framework.routers import DefaultRouter
from certs.views import (
    CertificateListView,
    CertificateDetailView,
    DeleteCertifiactesView,
    PrivateKeyDetailView,
    TeamListView,
    UploadCertFilePreviewView,
    ImportCertMetadataView,
    PrivateKeyListView,
    DeleteKeysView,
    ManageCertificatesView,
    ManageKeyView,
    UserInfoView,
    MyTokenObtainPairView,
    CertificateWebsiteListCreateView,
    WebsiteDetailView,
    WebsiteListView,
    CertificateExportView,
    CertificateTestView,
    CreateTeamView,
    CreateUserView,
    DeleteTeamView,
    DeleteUserView,
    TeamUpdateMembersView,
    SendPasswordResetLinkView,
    UserListView,
    UserUpdateView,
    RegisterFromInviteView,
    GenerateInviteView,
    TeamDetailView,
    EmailConfigViewSet,
    NotificationConfigViewSet,
    CertificateNotificationViewSet,
    SecretNotificationViewSet,
    NotificationLogViewSet,
)
from certs.views.dashboard_views import (
    certificates_overview,
    certificates_expiring_soon,
    certificates_list,
    certificates_top_expiry,
    secrets_overview,
    secrets_expiring_soon,
    secrets_list,
)
from certs.views.sso_settings_views import SSOConfigurationView, SSOTestConnectionView, SSOStatusView
from certs.views.secrets_views import SecretListCreateView, SecretDetailView, SecretRevealView
from rest_framework_simplejwt.views import TokenRefreshView

# Create router for ViewSets
router = DefaultRouter()
router.register(r'notifications/email-config', EmailConfigViewSet, basename='email-config')
router.register(r'notifications/configs', NotificationConfigViewSet, basename='notification-config')
router.register(r'notifications/certificate-configs', CertificateNotificationViewSet, basename='certificate-notification')
router.register(r'notifications/secret-configs', SecretNotificationViewSet, basename='secret-notification')
router.register(r'notifications/logs', NotificationLogViewSet, basename='notification-log')


urlpatterns = [
    #MANAGE CERTIFICATE
    path('certificates/delete/', DeleteCertifiactesView.as_view(), name='certificates-delete'),
    path('certificates/<int:cert_id>/update-certificate/', ManageCertificatesView.as_view(), name='certificate-update'),
    path('certificates/<int:cert_id>/websites/',CertificateWebsiteListCreateView.as_view(),name='cert-website-list-create'),
    path('websites/<int:pk>/',WebsiteDetailView.as_view(),name='website-detail'),

    #MANAGE KEY
    path('keys/<int:key_id>/update-privatekey/', ManageKeyView.as_view(),name='key-update'),
    path('keys/delete/',DeleteKeysView.as_view(),name='keys-delete'),

    #UPLOAD CERTIFICATE
    path('upload-cert-file/', UploadCertFilePreviewView.as_view(), name='upload-file-cert'),
    path('import-cert-metadata/', ImportCertMetadataView.as_view(), name='import-file-cert'),

    #VIEW CERTIFICATE DETAILS
    path('keys/<int:key_id>/',PrivateKeyDetailView.as_view(),name='PrivateKey-detail'),
    path('certificates/',CertificateListView.as_view(),name='certificate-create-list'),
    path('certificates/<int:cert_id>/',CertificateDetailView.as_view(),name='certificate-detail'),
    path('keys/',PrivateKeyListView.as_view(),name='privatekey-list'),

    #TEAMS VIEW
    path('teams/', TeamListView.as_view(), name='team-list'),

    #USER VIEW
    path('users/user-info/', UserInfoView.as_view(), name='user-info'),
    path("users/me/", UserInfoView.as_view(), name="user-info"),
    path('users/', UserListView.as_view()),

    #TEST VIEW
    path('token/', MyTokenObtainPairView.as_view()),
    path('token/refresh/',TokenRefreshView.as_view()),

    #Export VIEW
    path('certificates/<int:cert_id>/export/', CertificateExportView.as_view(), name='certificate-export'),
    path('certificates/<int:cert_id>/test/',CertificateTestView.as_view(), name='certificate-test' ),

    #ADMIN MANAGEMENT
    path('admin/users/', CreateUserView.as_view()),
    path('admin/users/<int:pk>/send_reset_link/', SendPasswordResetLinkView.as_view()),
    path('admin/users/<int:pk>/delete/', DeleteUserView.as_view()),
    path("admin/users/<int:pk>/update/", UserUpdateView.as_view()),
    path('admin/teams/', CreateTeamView.as_view()),
    path("teams/<int:pk>/", TeamDetailView.as_view(), name="team-detail"),
    path('admin/teams/<int:pk>/update_members/', TeamUpdateMembersView.as_view()),
    path('admin/teams/<int:pk>/delete/', DeleteTeamView.as_view()),
    path('register/<uuid:token>/', RegisterFromInviteView.as_view()),
    path('admin/invite/', GenerateInviteView.as_view()),

    #SSO CONFIGURATION
    path('admin/sso-settings/', SSOConfigurationView.as_view(), name='sso-settings'),
    path('admin/sso-settings/test/', SSOTestConnectionView.as_view(), name='sso-test-connection'),
    path('sso/status/', SSOStatusView.as_view(), name='sso-status'),  # Public endpoint

    #WEBSITE VIEW
    path('websites/', WebsiteListView.as_view()),

    #SECRETS MANAGEMENT
    path('secrets/', SecretListCreateView.as_view(), name='secret-list-create'),
    path('secrets/<int:pk>/', SecretDetailView.as_view(), name='secret-detail'),
    path('secrets/<int:pk>/reveal/', SecretRevealView.as_view(), name='secret-reveal'),

    #DASHBOARD VIEW
    path('dashboard/certificates-overview/', certificates_overview, name='certificates-overview'),
    path('dashboard/certificates-expiring-soon/', certificates_expiring_soon, name='certificates-expiring-soon'),
    path('dashboard/certificates-list/', certificates_list, name='certificates-list'),
    path('dashboard/certificates-top-expiry/', certificates_top_expiry, name='certificates-top-expiry'),
    path('dashboard/secrets-overview/', secrets_overview, name='secrets-overview'),
    path('dashboard/secrets-expiring-soon/', secrets_expiring_soon, name='secrets-expiring-soon'),
    path('dashboard/secrets-list/', secrets_list, name='secrets-list'),

]

# Include router URLs for notification system
urlpatterns += router.urls