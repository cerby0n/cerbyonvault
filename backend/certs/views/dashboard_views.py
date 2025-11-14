from rest_framework.decorators import api_view, permission_classes
from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta, date
from certs.models import Certificate, Secret
from certs.serializers import CertificateMiniSerializer, SecretMiniSerializer

def get_accessible_certificates(user):
    """Retrieve certificates accessible to the user based on their team memberships.
    This function filters certificates that are either accessible to the user's teams or have no team restrictions.
    Args:
        user (CustomUser): The user for whom to retrieve accessible certificates.
    Returns:
        QuerySet: A queryset of Certificate objects that the user can access.
    """
    user_teams = user.teams.all()
    return Certificate.objects.filter(
        Q(access_teams__in=user_teams) | Q(access_teams__isnull=True)
    ).distinct()

def get_accessible_secrets(user):
    """Retrieve secrets accessible to the user based on their team memberships.
    This function filters secrets that are either accessible to the user's teams or have no team restrictions.
    Args:
        user (CustomUser): The user for whom to retrieve accessible secrets.
    Returns:
        QuerySet: A queryset of Secret objects that the user can access.
    """
    if user.is_staff:
        return Secret.objects.all()
    user_teams = user.teams.all()
    return Secret.objects.filter(
        Q(access_teams__in=user_teams) | Q(access_teams__isnull=True)
    ).distinct()

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def certificates_overview(request):
    """Overview of certificates accessible to the user.
    This view provides a summary of the total number of certificates,
    the number of expired certificates, and the number of valid certificates.
    It retrieves the certificates based on the user's team memberships and returns the counts.
    Args:
        request (Request): The HTTP request object.
    Returns:
        Response: A JSON response containing the counts of total, expired, and valid certificates.
    """
    queryset = get_accessible_certificates(request.user)
    total_certificates = queryset.count()
    expired_certificates = queryset.filter(is_expired=True).count()
    valid_certificates = queryset.filter(is_expired=False).count()

    return Response({
        "total_certificates": total_certificates,
        "expired_certificates": expired_certificates,
        "valid_certificates": valid_certificates,
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def certificates_expiring_soon(request):
    """Count of certificates expiring soon.
    This view counts the number of certificates that are expiring within a specified number of days.    
    The number of days can be specified in the query parameters, defaulting to 30 days if not provided.
    Args:
        request (Request): The HTTP request object.
    Returns:
        Response: A JSON response containing the count of expiring soon certificates and the number of days selected.
    """
    try:
        days = int(request.query_params.get('days', 30))
    except ValueError:
        days = 30

    now = timezone.now()
    queryset = get_accessible_certificates(request.user)
    expiring_soon_certificates = queryset.filter(
        is_expired=False,
        not_after__gt=now,
        not_after__lte=now + timedelta(days=days)
    ).count()

    return Response({
        "expiring_soon_certificates": expiring_soon_certificates,
        "days_selected": days,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def certificates_list(request):
    """List certificates based on their type.
    This view retrieves a list of certificates based on the type specified in the query parameters.
    The type can be 'expired', 'valid', or 'expiring'. If the type is not specified or invalid, it returns an error.
    Args:
        request (Request): The HTTP request object.
    Returns:
        Response: A JSON response containing the list of certificates based on the specified type.
    """
    ctype = request.GET.get('type')
    now = timezone.now()
    queryset = get_accessible_certificates(request.user)

    if ctype == "expired":
        queryset = queryset.filter(is_expired=True)
    elif ctype == "valid":
        queryset = queryset.filter(is_expired=False)
    elif ctype == "expiring":
        try:
            days = int(request.GET.get('days', 30))
        except ValueError:
            days = 30
        queryset = queryset.filter(
            is_expired=False,
            not_after__gt=now,
            not_after__lte=now + timedelta(days=days)
        )
    else:
       
        return Response({"detail": "Invalid type parameter."}, status=400)

    data = CertificateMiniSerializer(queryset, many=True).data
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def certificates_top_expiry(request):
    """List the top certificates by expiry date.
    This view retrieves a limited number of certificates that are not expired, ordered by their expiry date.
    The number of certificates returned can be specified in the query parameters, defaulting to 20
    if not provided.
    Args:
        request (Request): The HTTP request object.
    Returns:
        Response: A JSON response containing a list of certificates ordered by their expiry date.
    """
    limit = int(request.GET.get('limit', 20))
    queryset = get_accessible_certificates(request.user).filter(is_expired=False).order_by('not_after')[:limit]
    data = CertificateMiniSerializer(queryset, many=True).data
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def secrets_overview(request):
    """Overview of secrets accessible to the user.
    This view provides a summary of the total number of secrets,
    the number of expired secrets, and the number of valid secrets.
    Args:
        request (Request): The HTTP request object.
    Returns:
        Response: A JSON response containing the counts of total, expired, and valid secrets.
    """
    today = date.today()
    queryset = get_accessible_secrets(request.user)
    total_secrets = queryset.count()
    # Expired: has expiry_date and it's in the past
    expired_secrets = queryset.filter(expiry_date__isnull=False, expiry_date__lt=today).count()
    # Valid: either no expiry or expiry is in the future
    valid_secrets = queryset.filter(Q(expiry_date__isnull=True) | Q(expiry_date__gte=today)).count()
    no_expiry_secrets = queryset.filter(expiry_date__isnull=True).count()

    return Response({
        "total_secrets": total_secrets,
        "expired_secrets": expired_secrets,
        "valid_secrets": valid_secrets,
        "no_expiry_secrets": no_expiry_secrets,
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def secrets_expiring_soon(request):
    """Count of secrets expiring soon.
    This view counts the number of secrets that are expiring within a specified number of days.
    The number of days can be specified in the query parameters, defaulting to 30 days if not provided.
    Args:
        request (Request): The HTTP request object.
    Returns:
        Response: A JSON response containing the count of expiring soon secrets and the number of days selected.
    """
    try:
        days = int(request.query_params.get('days', 30))
    except ValueError:
        days = 30

    today = date.today()
    queryset = get_accessible_secrets(request.user)
    expiring_soon_secrets = queryset.filter(
        expiry_date__isnull=False,
        expiry_date__gt=today,
        expiry_date__lte=today + timedelta(days=days)
    ).count()

    return Response({
        "expiring_soon_secrets": expiring_soon_secrets,
        "days_selected": days,
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def secrets_list(request):
    """List secrets based on their type.
    This view retrieves a list of secrets based on the type specified in the query parameters.
    The type can be 'expired', 'valid', or 'expiring'. If the type is not specified or invalid, it returns an error.
    Args:
        request (Request): The HTTP request object.
    Returns:
        Response: A JSON response containing the list of secrets based on the specified type.
    """
    stype = request.GET.get('type')
    today = date.today()
    queryset = get_accessible_secrets(request.user)

    if stype == "expired":
        # Expired: has expiry_date and it's in the past
        queryset = queryset.filter(expiry_date__isnull=False, expiry_date__lt=today)
    elif stype == "valid":
        # Valid: either no expiry or expiry is in the future
        queryset = queryset.filter(Q(expiry_date__isnull=True) | Q(expiry_date__gte=today))
    elif stype == "expiring":
        try:
            days = int(request.GET.get('days', 30))
        except ValueError:
            days = 30
        queryset = queryset.filter(
            expiry_date__isnull=False,
            expiry_date__gt=today,
            expiry_date__lte=today + timedelta(days=days)
        )
    else:
        return Response({"detail": "Invalid type parameter."}, status=400)

    data = SecretMiniSerializer(queryset, many=True).data
    return Response(data)