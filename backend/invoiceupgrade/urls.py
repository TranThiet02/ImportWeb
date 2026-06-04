from django.urls import path
from . import views

urlpatterns = [
    path('companiesup/', views.company_list, name='company-list'),
    path('companiesup/<int:pk>/', views.company_detail, name='company-detail'),
    path('invoicesup/', views.invoice_list, name='invoice-list'),
    path('invoicesup/<int:pk>/', views.invoice_detail, name='invoice-detail'),
    path('files/<int:pk>/', views.serve_invoice_file, name='serve-file'),
    # path('invoicesup/<int:pk>/audit/', views.audit_invoice, name='invoice-audit'),
    path('invoicesup/<int:pk>/quality-check/', views.quality_check_invoice, name='invoice-quality-check'),
    path('invoicesup/<int:pk>/verify/', views.verify_invoice_image, name='invoice-verify'),
    path('invoicesup/quality-check-all/', views.quality_check_all, name='invoice-quality-check-all'),
    path('invoicesup/<int:pk>/quality-check/', views.quality_check_invoice, name='invoice-quality-check'),
]