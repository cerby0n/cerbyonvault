"""
SCIM 2.0 API endpoints for Azure AD provisioning.
Supports group provisioning and user-group membership management.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from functools import wraps
import logging

from ..models import Team, CustomUser, SSOConfiguration

logger = logging.getLogger(__name__)


def scim_auth_required(view_func):
    """
    Decorator to verify SCIM bearer token authentication.
    Azure AD sends: Authorization: Bearer <token>
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        auth_header = request.headers.get('Authorization', '')

        if not auth_header.startswith('Bearer '):
            logger.warning("SCIM request missing Bearer token")
            return JsonResponse({
                'schemas': ['urn:ietf:params:scim:api:messages:2.0:Error'],
                'status': '401',
                'detail': 'Authentication required'
            }, status=401)

        token = auth_header.replace('Bearer ', '')

        # Get SSO configuration and verify token
        try:
            config = SSOConfiguration.objects.filter(is_enabled=True).first()
            if not config or not config.scim_enabled:
                logger.warning("SCIM request but SCIM is not enabled")
                return JsonResponse({
                    'schemas': ['urn:ietf:params:scim:api:messages:2.0:Error'],
                    'status': '403',
                    'detail': 'SCIM provisioning is not enabled'
                }, status=403)

            if not config.scim_token or token != config.scim_token:
                logger.warning(f"SCIM authentication failed: invalid token")
                return JsonResponse({
                    'schemas': ['urn:ietf:params:scim:api:messages:2.0:Error'],
                    'status': '401',
                    'detail': 'Invalid authentication token'
                }, status=401)

            logger.info("SCIM authentication successful")
            return view_func(request, *args, **kwargs)

        except Exception as e:
            logger.error(f"SCIM authentication error: {e}")
            return JsonResponse({
                'schemas': ['urn:ietf:params:scim:api:messages:2.0:Error'],
                'status': '500',
                'detail': 'Internal server error'
            }, status=500)

    return wrapper


@method_decorator(csrf_exempt, name='dispatch')
@method_decorator(scim_auth_required, name='dispatch')
class SCIMGroupsView(APIView):
    """
    SCIM 2.0 Groups endpoint.
    Handles listing and creating groups from Azure AD.
    """

    def get(self, request):
        """
        List all groups (teams).
        Azure AD calls this to sync existing groups.
        """
        try:
            teams = Team.objects.filter(provisioned_from_azure=True)

            resources = []
            for team in teams:
                # Get member user IDs (Azure AD expects external IDs)
                members = []
                for user in team.members.filter(is_sso_user=True):
                    if user.sso_subject_id:
                        members.append({
                            'value': user.sso_subject_id,
                            '$ref': f'/scim/v2/Users/{user.sso_subject_id}',
                            'display': user.email
                        })

                resources.append({
                    'schemas': ['urn:ietf:params:scim:schemas:core:2.0:Group'],
                    'id': team.external_id or str(team.id),
                    'externalId': team.external_id,
                    'displayName': team.name,
                    'members': members,
                    'meta': {
                        'resourceType': 'Group'
                    }
                })

            response_data = {
                'schemas': ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
                'totalResults': len(resources),
                'Resources': resources,
                'startIndex': 1,
                'itemsPerPage': len(resources)
            }

            logger.info(f"SCIM: Listed {len(resources)} groups")
            return JsonResponse(response_data, status=200)

        except Exception as e:
            logger.error(f"SCIM list groups error: {e}")
            return JsonResponse({
                'schemas': ['urn:ietf:params:scim:api:messages:2.0:Error'],
                'status': '500',
                'detail': str(e)
            }, status=500)

    def post(self, request):
        """
        Create a new group (team).
        Azure AD calls this when you assign a group for provisioning.
        """
        try:
            data = request.data
            display_name = data.get('displayName')
            external_id = data.get('externalId')

            if not display_name:
                return JsonResponse({
                    'schemas': ['urn:ietf:params:scim:api:messages:2.0:Error'],
                    'status': '400',
                    'detail': 'displayName is required'
                }, status=400)

            # Create or update team
            team, created = Team.objects.get_or_create(
                external_id=external_id,
                defaults={
                    'name': display_name,
                    'provisioned_from_azure': True
                }
            )

            if not created:
                # Update existing team
                team.name = display_name
                team.provisioned_from_azure = True
                team.save()

            # Process members if provided
            members_data = data.get('members', [])
            for member in members_data:
                user_id = member.get('value')
                if user_id:
                    try:
                        user = CustomUser.objects.get(sso_subject_id=user_id, is_sso_user=True)
                        team.members.add(user)
                        logger.info(f"SCIM: Added user {user.email} to team {team.name}")
                    except CustomUser.DoesNotExist:
                        logger.warning(f"SCIM: User with SSO ID {user_id} not found")

            response_data = {
                'schemas': ['urn:ietf:params:scim:schemas:core:2.0:Group'],
                'id': team.external_id or str(team.id),
                'externalId': team.external_id,
                'displayName': team.name,
                'members': [
                    {
                        'value': user.sso_subject_id,
                        '$ref': f'/scim/v2/Users/{user.sso_subject_id}',
                        'display': user.email
                    }
                    for user in team.members.filter(is_sso_user=True) if user.sso_subject_id
                ],
                'meta': {
                    'resourceType': 'Group',
                    'created': team.name,
                    'location': f'/scim/v2/Groups/{team.external_id or team.id}'
                }
            }

            logger.info(f"SCIM: {'Created' if created else 'Updated'} team {team.name}")
            return JsonResponse(response_data, status=201 if created else 200)

        except Exception as e:
            logger.error(f"SCIM create group error: {e}")
            return JsonResponse({
                'schemas': ['urn:ietf:params:scim:api:messages:2.0:Error'],
                'status': '500',
                'detail': str(e)
            }, status=500)


@method_decorator(csrf_exempt, name='dispatch')
@method_decorator(scim_auth_required, name='dispatch')
class SCIMGroupDetailView(APIView):
    """
    SCIM 2.0 Group detail endpoint.
    Handles getting, updating, and deleting individual groups.
    """

    def get(self, request, group_id):
        """
        Get a specific group by ID.
        """
        try:
            team = Team.objects.get(external_id=group_id, provisioned_from_azure=True)

            members = []
            for user in team.members.filter(is_sso_user=True):
                if user.sso_subject_id:
                    members.append({
                        'value': user.sso_subject_id,
                        '$ref': f'/scim/v2/Users/{user.sso_subject_id}',
                        'display': user.email
                    })

            response_data = {
                'schemas': ['urn:ietf:params:scim:schemas:core:2.0:Group'],
                'id': team.external_id,
                'externalId': team.external_id,
                'displayName': team.name,
                'members': members,
                'meta': {
                    'resourceType': 'Group',
                    'location': f'/scim/v2/Groups/{team.external_id}'
                }
            }

            logger.info(f"SCIM: Retrieved team {team.name}")
            return JsonResponse(response_data, status=200)

        except Team.DoesNotExist:
            logger.warning(f"SCIM: Team with external_id {group_id} not found")
            return JsonResponse({
                'schemas': ['urn:ietf:params:scim:api:messages:2.0:Error'],
                'status': '404',
                'detail': 'Group not found'
            }, status=404)
        except Exception as e:
            logger.error(f"SCIM get group error: {e}")
            return JsonResponse({
                'schemas': ['urn:ietf:params:scim:api:messages:2.0:Error'],
                'status': '500',
                'detail': str(e)
            }, status=500)

    def put(self, request, group_id):
        """
        Update a group (replace all attributes).
        Azure AD uses this to update group name and members.
        """
        try:
            team = Team.objects.get(external_id=group_id, provisioned_from_azure=True)
            data = request.data

            # Update display name
            display_name = data.get('displayName')
            if display_name:
                team.name = display_name
                team.save()

            # Replace members
            members_data = data.get('members', [])
            team.members.clear()  # Remove all existing members

            for member in members_data:
                user_id = member.get('value')
                if user_id:
                    try:
                        user = CustomUser.objects.get(sso_subject_id=user_id, is_sso_user=True)
                        team.members.add(user)
                        logger.info(f"SCIM: Added user {user.email} to team {team.name}")
                    except CustomUser.DoesNotExist:
                        logger.warning(f"SCIM: User with SSO ID {user_id} not found")

            response_data = {
                'schemas': ['urn:ietf:params:scim:schemas:core:2.0:Group'],
                'id': team.external_id,
                'externalId': team.external_id,
                'displayName': team.name,
                'members': [
                    {
                        'value': user.sso_subject_id,
                        '$ref': f'/scim/v2/Users/{user.sso_subject_id}',
                        'display': user.email
                    }
                    for user in team.members.filter(is_sso_user=True) if user.sso_subject_id
                ],
                'meta': {
                    'resourceType': 'Group',
                    'location': f'/scim/v2/Groups/{team.external_id}'
                }
            }

            logger.info(f"SCIM: Updated team {team.name}")
            return JsonResponse(response_data, status=200)

        except Team.DoesNotExist:
            logger.warning(f"SCIM: Team with external_id {group_id} not found")
            return JsonResponse({
                'schemas': ['urn:ietf:params:scim:api:messages:2.0:Error'],
                'status': '404',
                'detail': 'Group not found'
            }, status=404)
        except Exception as e:
            logger.error(f"SCIM update group error: {e}")
            return JsonResponse({
                'schemas': ['urn:ietf:params:scim:api:messages:2.0:Error'],
                'status': '500',
                'detail': str(e)
            }, status=500)

    def patch(self, request, group_id):
        """
        Patch a group (partial update).
        Azure AD uses this to add/remove members from groups.
        """
        try:
            team = Team.objects.get(external_id=group_id, provisioned_from_azure=True)
            data = request.data

            operations = data.get('Operations', [])

            for operation in operations:
                op = operation.get('op', '').lower()
                path = operation.get('path', '')
                value = operation.get('value')

                if op == 'add' and 'members' in path.lower():
                    # Add members
                    if isinstance(value, list):
                        for member in value:
                            user_id = member.get('value')
                            if user_id:
                                try:
                                    user = CustomUser.objects.get(sso_subject_id=user_id, is_sso_user=True)
                                    team.members.add(user)
                                    logger.info(f"SCIM PATCH: Added user {user.email} to team {team.name}")
                                except CustomUser.DoesNotExist:
                                    logger.warning(f"SCIM PATCH: User with SSO ID {user_id} not found")

                elif op == 'remove' and 'members' in path.lower():
                    # Remove members
                    if isinstance(value, list):
                        for member in value:
                            user_id = member.get('value')
                            if user_id:
                                try:
                                    user = CustomUser.objects.get(sso_subject_id=user_id, is_sso_user=True)
                                    team.members.remove(user)
                                    logger.info(f"SCIM PATCH: Removed user {user.email} from team {team.name}")
                                except CustomUser.DoesNotExist:
                                    logger.warning(f"SCIM PATCH: User with SSO ID {user_id} not found")

                elif op == 'replace':
                    if 'displayname' in path.lower():
                        team.name = value
                        team.save()
                        logger.info(f"SCIM PATCH: Updated team name to {team.name}")

            response_data = {
                'schemas': ['urn:ietf:params:scim:schemas:core:2.0:Group'],
                'id': team.external_id,
                'externalId': team.external_id,
                'displayName': team.name,
                'members': [
                    {
                        'value': user.sso_subject_id,
                        '$ref': f'/scim/v2/Users/{user.sso_subject_id}',
                        'display': user.email
                    }
                    for user in team.members.filter(is_sso_user=True) if user.sso_subject_id
                ],
                'meta': {
                    'resourceType': 'Group',
                    'location': f'/scim/v2/Groups/{team.external_id}'
                }
            }

            logger.info(f"SCIM: Patched team {team.name}")
            return JsonResponse(response_data, status=200)

        except Team.DoesNotExist:
            logger.warning(f"SCIM: Team with external_id {group_id} not found")
            return JsonResponse({
                'schemas': ['urn:ietf:params:scim:api:messages:2.0:Error'],
                'status': '404',
                'detail': 'Group not found'
            }, status=404)
        except Exception as e:
            logger.error(f"SCIM patch group error: {e}")
            return JsonResponse({
                'schemas': ['urn:ietf:params:scim:api:messages:2.0:Error'],
                'status': '500',
                'detail': str(e)
            }, status=500)

    def delete(self, request, group_id):
        """
        Delete a group.
        Azure AD calls this when you remove a group from provisioning.
        """
        try:
            team = Team.objects.get(external_id=group_id, provisioned_from_azure=True)
            team_name = team.name
            team.delete()

            logger.info(f"SCIM: Deleted team {team_name}")
            return JsonResponse({}, status=204)

        except Team.DoesNotExist:
            logger.warning(f"SCIM: Team with external_id {group_id} not found for deletion")
            # Return 204 even if not found (idempotent delete)
            return JsonResponse({}, status=204)
        except Exception as e:
            logger.error(f"SCIM delete group error: {e}")
            return JsonResponse({
                'schemas': ['urn:ietf:params:scim:api:messages:2.0:Error'],
                'status': '500',
                'detail': str(e)
            }, status=500)


@csrf_exempt
@scim_auth_required
def scim_service_provider_config(request):
    """
    SCIM ServiceProviderConfig endpoint.
    Azure AD queries this to understand what SCIM features are supported.
    """
    config = {
        'schemas': ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
        'documentationUri': 'https://docs.microsoft.com/en-us/azure/active-directory/app-provisioning/use-scim-to-provision-users-and-groups',
        'patch': {
            'supported': True
        },
        'bulk': {
            'supported': False,
            'maxOperations': 0,
            'maxPayloadSize': 0
        },
        'filter': {
            'supported': False,
            'maxResults': 200
        },
        'changePassword': {
            'supported': False
        },
        'sort': {
            'supported': False
        },
        'etag': {
            'supported': False
        },
        'authenticationSchemes': [
            {
                'type': 'oauthbearertoken',
                'name': 'OAuth Bearer Token',
                'description': 'Authentication scheme using the OAuth Bearer Token Standard',
                'specUri': 'https://www.rfc-editor.org/rfc/rfc6750.txt',
                'documentationUri': 'https://docs.microsoft.com/en-us/azure/active-directory/app-provisioning/use-scim-to-provision-users-and-groups',
                'primary': True
            }
        ]
    }

    return JsonResponse(config, status=200)


@csrf_exempt
@scim_auth_required
def scim_resource_types(request):
    """
    SCIM ResourceTypes endpoint.
    Describes the resource types available (Groups only for now).
    """
    resource_types = {
        'schemas': ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        'totalResults': 1,
        'Resources': [
            {
                'schemas': ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
                'id': 'Group',
                'name': 'Group',
                'endpoint': '/scim/v2/Groups',
                'description': 'SCIM Group resource for team provisioning',
                'schema': 'urn:ietf:params:scim:schemas:core:2.0:Group',
                'meta': {
                    'resourceType': 'ResourceType',
                    'location': '/scim/v2/ResourceTypes/Group'
                }
            }
        ]
    }

    return JsonResponse(resource_types, status=200)


@csrf_exempt
@scim_auth_required
def scim_schemas(request):
    """
    SCIM Schemas endpoint.
    Describes the schema for Group resources.
    """
    schemas = {
        'schemas': ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        'totalResults': 1,
        'Resources': [
            {
                'id': 'urn:ietf:params:scim:schemas:core:2.0:Group',
                'name': 'Group',
                'description': 'SCIM Group schema',
                'attributes': [
                    {
                        'name': 'displayName',
                        'type': 'string',
                        'multiValued': False,
                        'required': True,
                        'caseExact': False,
                        'mutability': 'readWrite',
                        'returned': 'default',
                        'uniqueness': 'none'
                    },
                    {
                        'name': 'members',
                        'type': 'complex',
                        'multiValued': True,
                        'required': False,
                        'subAttributes': [
                            {
                                'name': 'value',
                                'type': 'string',
                                'multiValued': False,
                                'required': True
                            },
                            {
                                'name': '$ref',
                                'type': 'reference',
                                'multiValued': False,
                                'required': False
                            },
                            {
                                'name': 'display',
                                'type': 'string',
                                'multiValued': False,
                                'required': False
                            }
                        ],
                        'mutability': 'readWrite',
                        'returned': 'default'
                    }
                ],
                'meta': {
                    'resourceType': 'Schema',
                    'location': '/scim/v2/Schemas/urn:ietf:params:scim:schemas:core:2.0:Group'
                }
            }
        ]
    }

    return JsonResponse(schemas, status=200)
