from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from certs.models import Secret
from certs.serializers import (
    SecretSerializer,
    SecretDetailSerializer,
    SecretCreateSerializer,
    SecretUpdateSerializer
)


class SecretListCreateView(ListCreateAPIView):
    """
    GET  /api/secrets/  → list all secrets (filtered by team access)
    POST /api/secrets/  → create a new secret
    """
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return SecretCreateSerializer
        return SecretSerializer

    def get_queryset(self):
        """
        Return secrets that the user has access to through their teams.
        Follows the same pattern as certificates - if secret has no teams, all can access.
        """
        user = self.request.user
        user_teams = user.teams.all()

        # Admins can see all secrets
        if user.is_staff:
            return Secret.objects.all()

        # Q1: Secret has no access_teams (accessible to all)
        q_no_teams = Q(access_teams__isnull=True)
        # Q2: Secret is accessible by user's teams
        q_user_teams = Q(access_teams__in=user_teams)

        return Secret.objects.filter(q_no_teams | q_user_teams).distinct()

    def perform_create(self, serializer):
        """Save the secret with the current user as creator"""
        serializer.save()


class SecretDetailView(RetrieveUpdateDestroyAPIView):
    """
    GET    /api/secrets/{pk}/  → retrieve secret details (without value)
    PUT    /api/secrets/{pk}/  → update secret
    PATCH  /api/secrets/{pk}/  → partial update
    DELETE /api/secrets/{pk}/  → delete secret
    """
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return SecretUpdateSerializer
        return SecretSerializer

    def get_queryset(self):
        """Filter secrets by team access"""
        user = self.request.user
        user_teams = user.teams.all()

        if user.is_staff:
            return Secret.objects.all()

        q_no_teams = Q(access_teams__isnull=True)
        q_user_teams = Q(access_teams__in=user_teams)

        return Secret.objects.filter(q_no_teams | q_user_teams).distinct()


class SecretRevealView(RetrieveAPIView):
    """
    GET /api/secrets/{pk}/reveal/  → retrieve secret with decrypted value

    This is a separate endpoint to explicitly reveal the secret value.
    Use with caution - only call when user explicitly requests to see the secret.
    """
    serializer_class = SecretDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter secrets by team access"""
        user = self.request.user
        user_teams = user.teams.all()

        if user.is_staff:
            return Secret.objects.all()

        q_no_teams = Q(access_teams__isnull=True)
        q_user_teams = Q(access_teams__in=user_teams)

        return Secret.objects.filter(q_no_teams | q_user_teams).distinct()

    def retrieve(self, request, *args, **kwargs):
        """Log when a secret is accessed"""
        instance = self.get_object()

        # TODO: Add audit logging here
        # logger.info(f"User {request.user.email} accessed secret {instance.name}")

        serializer = self.get_serializer(instance)
        return Response(serializer.data)
