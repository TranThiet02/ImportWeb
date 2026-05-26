from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from .managers import Users

class Users(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField("Email Address", unique=True, max_length=255)
    first_name = models.CharField("First Name", max_length=100)
    last_name = models.CharField("Last Name", max_length=100, null=True, blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name"]

    objects = Users()

    def __str__(self):
        return self.email