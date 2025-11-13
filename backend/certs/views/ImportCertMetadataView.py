from django.conf import settings
from django.db import IntegrityError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from cryptography import x509
from cryptography.hazmat.primitives import serialization
from certs.models import Certificate, PrivateKey, UploadedFile, Team
from certs.utils import (
    create_uploaded_file,
    create_certificate, create_private_key,certificate_relationship
)
import uuid
from django.core.files.base import ContentFile




class ImportCertMetadataView(APIView):
    """View for importing certificate metadata from a session.
    This view allows users to import certificates and private keys that were previously uploaded    
    and stored in the session. It processes the session data, creates certificate and key models,
    and handles any necessary relationships between them.   
    The view expects a session key and the certificate and key data in the request body.
    If the session data is valid, it creates the corresponding models and cleans up the session.    
    If any errors occur during the import process, it returns appropriate error messages.
    """
    permission_classes = [IsAuthenticated]

    def post(self,request):
        session_key = request.data.get("session_key")
        certs_data = request.data.get("certs",[])
        key_data = request.data.get("key")
        print("🛬 Received session_key:", session_key)
        session_data = request.session.get(session_key)
        print("📦 Session data found?", session_data is not None)


        print("Received session_key:", session_key)
        print("Certs from session:", list(session_data["certs"].keys()))
        print("Key from session:", list(session_data["key"].keys()))
        if not session_data:
            return Response({"error": "Invalid or expired session."}, status=400)
        
        cert_models = {}
        skipped_certs = []
        for cert_input in certs_data:
            temp_id = cert_input["temp_id"]
            name = cert_input["name"]
            teams = cert_input["teams"]
            urls=cert_input["urls"]

            pem_data = session_data["certs"].get(temp_id)
            if not pem_data:
                continue

            cert_obj = x509.load_pem_x509_certificate(pem_data.encode("utf-8"))
            cert_bytes = cert_obj.public_bytes(encoding=settings.X509_ENCODING)
            uploaded_file = create_uploaded_file(cert_bytes, request.user)
            try:
                cert_model = create_certificate(
                    cert_obj=cert_obj,
                    uploaded_file=uploaded_file,
                    teams=teams,
                    user=request.user,
                    name_override=name,
                    urls=urls

                )
                cert_models[temp_id] = cert_model
            except IntegrityError:
                # Certificate already exists, skip it and continue
                skipped_certs.append(name)
                continue
        for temp_id, cert_model in cert_models.items():
            
                certificate_relationship(
                cert_type=cert_model.certificate_type,
                certificate=cert_model,
                issuer_hash=cert_model.issuer_hash,
                subject_hash=cert_model.subject_hash
            )
            
        key_imported = False
        key_skipped = False
        if key_data:
            key_pem = session_data["key"].get(key_data["temp_id"])
            key_name = key_data["filename"]
            if key_pem:
                key_obj = serialization.load_pem_private_key(
                    key_pem.encode("utf-8"),
                    password=None
                )

                linked_cert_temp_id = key_data.get("linked_cert_temp_id")
                if linked_cert_temp_id:
                    linked_cert = cert_models.get(linked_cert_temp_id)
                else:
                    linked_cert = None

                try:
                    create_private_key(
                        key_obj=key_obj,
                        user=request.user,
                        teams=key_data["teams"],
                        linked_certificate=linked_cert,
                        bit_length=key_data["bit_length"],
                        original_name=linked_cert.name if linked_cert else key_name
                    )
                    key_imported = True
                except IntegrityError:
                    # Private key already exists, skip it
                    key_skipped = True
                

        # ✅ Clean up session
        del request.session[session_key]
        request.session.modified = True

        # Build response message
        message_parts = []
        if len(cert_models) > 0:
            message_parts.append(f"{len(cert_models)} certificate(s) imported successfully")
        if len(skipped_certs) > 0:
            message_parts.append(f"{len(skipped_certs)} certificate(s) skipped (already exist): {', '.join(skipped_certs)}")
        if key_imported:
            message_parts.append("Private key imported successfully")
        if key_skipped:
            message_parts.append("Private key skipped (already exists)")

        if len(cert_models) == 0 and len(skipped_certs) > 0 and not key_imported:
            # All items were duplicates
            message = "All items already exist"
        else:
            message = ". ".join(message_parts) if message_parts else "No items processed"

        return Response({
            "message": message,
            "imported_count": len(cert_models),
            "skipped_count": len(skipped_certs),
            "skipped_certificates": skipped_certs,
            "key_imported": key_imported,
            "key_skipped": key_skipped
        }, status=status.HTTP_201_CREATED)