from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model

User = get_user_model()

class LoginRateThrottle(AnonRateThrottle):
    rate = '5/minute'
    scope = 'login'

class GoogleLogin(APIView):
    throttle_classes = [LoginRateThrottle]
    permission_classes = []
    def post(self, request):
        credential = request.data.get('credential')
        if not credential:
            return Response({'error': 'credential required'}, status=400)
        try:
            idinfo = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                ''
            )
            email = idinfo['email']
            first_name = idinfo.get('given_name', '')
            last_name = idinfo.get('family_name', '')

            user, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': first_name,
                    'last_name': last_name,
                }
            )

            refresh = RefreshToken.for_user(user)
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': {
                    'email': user.email,
                    'first_name': user.first_name,
                }
            })

        except ValueError as e:
            return Response({'error': str(e)}, status=400)
