from django.urls import path
from . import views

urlpatterns = [
    path('invoices-gemini/', views.invoice_gemini_list,   name='invoice-gemini-list'),
    path('invoices-gemini/<int:pk>/', views.invoice_gemini_detail, name='invoice-gemini-detail'),
    path('invoices-gemini/<int:pk>/ocr-status/', views.invoice_gemini_status, name='invoice-gemini-status'),
]