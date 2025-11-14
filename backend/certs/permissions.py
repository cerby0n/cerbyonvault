"""
Custom permissions for the certs app.
"""
from rest_framework import permissions


class IsAdminUser(permissions.BasePermission):
    """
    Permission to only allow admin users (staff) to access.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)
