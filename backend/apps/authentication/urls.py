from django.urls import path
from .views import LoginView, LogoutView, RefreshTokenView, MeView

app_name = "auth"

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("token/refresh/", RefreshTokenView.as_view(), name="token-refresh"),
    path("me/", MeView.as_view(), name="me"),
]
