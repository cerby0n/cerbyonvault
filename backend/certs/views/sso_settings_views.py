from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from ..models import SSOConfiguration
from ..serializers import SSOConfigurationSerializer


class SSOConfigurationView(APIView):
    """
    API endpoint to manage SSO configuration.
    Only company admins can access this endpoint.
    GET: Retrieve current SSO configuration
    POST: Create or update SSO configuration
    """
    permission_classes = [IsAuthenticated]

    def check_admin_permission(self, request):
        """Check if user is a staff/admin user"""
        return request.user.is_staff

    def get(self, request):
        """Retrieve SSO configuration"""
        if not self.check_admin_permission(request):
            return Response(
                {"error": "You do not have permission to access SSO settings."},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            sso_config = SSOConfiguration.objects.first()
            if sso_config:
                serializer = SSOConfigurationSerializer(sso_config)
                return Response(serializer.data, status=status.HTTP_200_OK)
            else:
                return Response(
                    {"message": "SSO not configured yet."},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e:
            return Response(
                {"error": f"Failed to retrieve SSO configuration: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request):
        """Create or update SSO configuration"""
        if not self.check_admin_permission(request):
            return Response(
                {"error": "You do not have permission to modify SSO settings."},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            sso_config = SSOConfiguration.objects.first()

            if sso_config:
                # Update existing configuration
                serializer = SSOConfigurationSerializer(
                    sso_config,
                    data=request.data,
                    partial=True
                )
            else:
                # Create new configuration
                serializer = SSOConfigurationSerializer(data=request.data)

            if serializer.is_valid():
                serializer.save(created_by=request.user)
                return Response(
                    {
                        "message": "SSO configuration saved successfully.",
                        "data": serializer.data
                    },
                    status=status.HTTP_200_OK if sso_config else status.HTTP_201_CREATED
                )
            else:
                return Response(
                    {"error": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": f"Failed to save SSO configuration: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SSOTestConnectionView(APIView):
    """
    Test SSO connection with provided configuration.
    """
    permission_classes = [IsAuthenticated]

    def check_admin_permission(self, request):
        """Check if user is a staff/admin user"""
        return request.user.is_staff

    def post(self, request):
        """Test connection to Entra ID"""
        if not self.check_admin_permission(request):
            return Response(
                {"error": "You do not have permission to test SSO connection."},
                status=status.HTTP_403_FORBIDDEN
            )

        tenant_id = request.data.get('tenant_id')
        client_id = request.data.get('client_id')

        if not tenant_id or not client_id:
            return Response(
                {"error": "Tenant ID and Client ID are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Test connection to Entra ID discovery endpoint
            import requests
            discovery_url = f"https://login.microsoftonline.com/{tenant_id}/v2.0/.well-known/openid-configuration"
            response = requests.get(discovery_url, timeout=10)

            if response.status_code == 200:
                return Response(
                    {
                        "success": True,
                        "message": "Successfully connected to Entra ID tenant."
                    },
                    status=status.HTTP_200_OK
                )
            else:
                return Response(
                    {
                        "success": False,
                        "message": f"Failed to connect to Entra ID. Status code: {response.status_code}"
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        except requests.exceptions.Timeout:
            return Response(
                {
                    "success": False,
                    "message": "Connection timeout. Please check your network and try again."
                },
                status=status.HTTP_408_REQUEST_TIMEOUT
            )
        except Exception as e:
            return Response(
                {
                    "success": False,
                    "message": f"Connection test failed: {str(e)}"
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class SSOStatusView(APIView):
    """
    Public endpoint to check if SSO is enabled.
    Used by the frontend to show/hide SSO login button.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        """Check if SSO is enabled"""
        try:
            sso_config = SSOConfiguration.objects.filter(is_enabled=True).first()

            if sso_config:
                return Response(
                    {
                        "sso_enabled": True,
                        "login_url": "/oidc/authenticate/",
                    },
                    status=status.HTTP_200_OK
                )
            else:
                return Response(
                    {
                        "sso_enabled": False,
                        "login_url": None,
                    },
                    status=status.HTTP_200_OK
                )
        except Exception as e:
            return Response(
                {
                    "sso_enabled": False,
                    "login_url": None,
                    "error": str(e)
                },
                status=status.HTTP_200_OK
            )
