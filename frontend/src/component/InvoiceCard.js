import React from 'react'
import { Link } from 'react-router-dom'
import ConfidenceBadge from './ConfidenceBadge'

const InvoiceCard = ({ inv, onDelete, getOcrBadge }) => {
    const badge = getOcrBadge(inv.ocr_status)

    return (
        <div className="inv-card">
            <div className="inv-card-header">
                <div className="inv-card-company">
                    {inv.company_detail?.name || '—'}
                </div>
                <span className={badge.class}>{badge.label}</span>
            </div>

            <div className="inv-card-body">
                {inv.ocr_result?.confidence_score && (
                    <ConfidenceBadge
                        confidence={inv.ocr_result.confidence_score}
                        autoSaved={inv.ocr_result.auto_saved}
                    />
                )}
                <div className="inv-card-date">
                    {new Date(inv.created_at).toLocaleDateString('vi-VN')}
                </div>
                {inv.note && (
                    <div className="inv-card-note">{inv.note}</div>
                )}
            </div>

            <div className="inv-card-actions">
                <a
                    href={`http://localhost:8000${inv.file}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inv-card-btn view"
                >
                    Xem file
                </a>
                <Link
                    to={`/invoicedetail/${inv.id}`}
                    className="inv-card-btn detail"
                >
                    Chi tiết
                </Link>
                <button
                    className="inv-card-btn delete"
                    onClick={() => onDelete(inv.id)}
                >
                    Xóa
                </button>
            </div>
        </div>
    )
}

export default InvoiceCard