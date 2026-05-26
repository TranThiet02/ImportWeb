from django.urls import path
from . import views

urlpatterns = [
    path('invoices-ai/', views.invoice_ai_list, name='invoice-ai-list'),
    path('invoices-ai/<int:pk>/', views.invoice_ai_detail, name='invoice-ai-detail'),
    path('invoices-ai/<int:pk>/ocr-status/', views.invoice_ai_ocr_status, name='invoice-ai-ocr-status'),
]