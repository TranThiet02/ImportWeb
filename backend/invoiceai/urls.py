from django.urls import path
from . import views

urlpatterns = [
    path('invoices-ai/', views.invoice_ai_list, name='invoice-ai-list'),
    path('invoices-ai/<int:pk>/', views.invoice_ai_detail, name='invoice-ai-detail'),
    path('invoices-ai/<int:pk>/ocr-status/', views.invoice_ai_ocr_status, name='invoice-ai-ocr-status'),
    path('invoices-ai/<int:pk>/quality-check/', views.quality_check_ai, name='invoice-ai-quality-check'),
    path('invoices-ai/<int:pk>/verify/', views.verify_ai_image, name='invoice-ai-verify'),
    path('invoices-ai/batch/', views.invoice_ai_batch, name='invoice-ai-batch'),
]