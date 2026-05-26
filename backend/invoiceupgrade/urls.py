from django.urls import path
from . import views

urlpatterns = [
    path('companiesup/', views.company_list, name='company-list'),
    path('companiesup/<int:pk>/', views.company_detail, name='company-detail'),
    path('invoicesup/', views.invoice_list, name='invoice-list'),
    path('invoicesup/<int:pk>/', views.invoice_detail, name='invoice-detail'),
]