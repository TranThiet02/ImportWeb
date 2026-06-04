import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import '../css/QualityCheckAll.css'

const SOURCE_LABEL = {
    manual: 'Thủ công',
    ai: 'YOLO AI',
    gemini: 'Gemini',
}

const DOC_TYPE_LABEL = {
    invoice: 'Hóa đơn',
    receipt: 'Phiếu thu',
    payment: 'Phiếu chi',
    warehouse: 'Phiếu nhập kho',
}

const STATUS_CONFIG = {
    valid: { label: 'Hợp lệ', class: 'valid',   priority: 3 },
    warning: { label: 'Cần xem lại', class: 'warning', priority: 2 },
    invalid: { label: 'Có lỗi', class: 'invalid', priority: 1 },
    error: { label: 'Lỗi hệ thống', class: 'error',  priority: 0 },
}

const LEVEL_CONFIG = {
    error: { class: 'error'   },
    warning: { class: 'warning' },
    info: { class: 'info'    },
}

const OcrStatusBadge = ({ ocrStatus }) => {
    if (!ocrStatus || ocrStatus === 'done') return null
    const map = {
        failed: { label: 'OCR thất bại', class: 'ocr-failed'     },
        processing: { label: 'Đang xử lý', class: 'ocr-processing'  },
        pending: { label: 'Chưa OCR', class: 'ocr-pending'     },
    }
    const config = map[ocrStatus]
    if (!config) return null
    return (
        <span className={`qca-ocr-badge ${config.class}`}>
            {config.label}
        </span>
    )
}

const QualityCheckAll = ({ result, onClose, onRecheck }) => {
    const [filterStatus, setFilterStatus] = useState('all')
    const [filterSource, setFilterSource] = useState('all')
    const [expandedId, setExpandedId] = useState(null)
    const [checking, setChecking] = useState(false)

    if (!result) return null

    const { summary, results } = result

    let filtered = results.filter(r => {
        const statusMatch = filterStatus === 'all' || r.status === filterStatus
        const sourceMatch = filterSource === 'all' || r.source === filterSource
        return statusMatch && sourceMatch
    })

    filtered = filtered.sort((a, b) => {
        const pa = STATUS_CONFIG[a.status]?.priority ?? 0
        const pb = STATUS_CONFIG[b.status]?.priority ?? 0
        return pa - pb
    })

    const toggleExpand = (id) => {
        setExpandedId(prev => prev === id ? null : id)
    }

    const handleRecheck = async () => {
        setChecking(true)
        await onRecheck()
        setChecking(false)
    }

    return (
        <div className="qca-overlay" onClick={onClose}>
            <div className="qca-modal" onClick={e => e.stopPropagation()}>
                <div className="qca-header">
                    <div className="qca-header-left">
                        <span className="qca-title">
                            Kiểm tra Chất lượng Toàn bộ
                        </span>
                        <span className="qca-subtitle">
                            {summary.total} hóa đơn được kiểm tra
                        </span>
                    </div>
                    <div className="qca-header-right">
                        <button
                            className="qca-btn-recheck"
                            onClick={handleRecheck}
                            disabled={checking}
                        >
                            {checking ? 'Đang kiểm tra...' : 'Kiểm tra lại'}
                        </button>
                        <button className="qca-close" onClick={onClose}>✕</button>
                    </div>
                </div>

                <div className="qca-body">

                    {/* ── Summary Cards ── */}
                    <div className="qca-summary">
                        <div
                            className={`qca-sum-card total ${filterStatus === 'all' ? 'active' : ''}`}
                            onClick={() => setFilterStatus('all')}
                        >
                            <div className="qca-sum-number">{summary.total}</div>
                            <div className="qca-sum-label">Tổng</div>
                        </div>
                        <div
                            className={`qca-sum-card invalid ${filterStatus === 'invalid' ? 'active' : ''}`}
                            onClick={() => setFilterStatus('invalid')}
                        >
                            <div className="qca-sum-number">{summary.invalid}</div>
                            <div className="qca-sum-label">Có lỗi</div>
                        </div>
                        <div
                            className={`qca-sum-card warning ${filterStatus === 'warning' ? 'active' : ''}`}
                            onClick={() => setFilterStatus('warning')}
                        >
                            <div className="qca-sum-number">{summary.warning}</div>
                            <div className="qca-sum-label">Cần xem</div>
                        </div>
                        <div
                            className={`qca-sum-card valid ${filterStatus === 'valid' ? 'active' : ''}`}
                            onClick={() => setFilterStatus('valid')}
                        >
                            <div className="qca-sum-number">{summary.valid}</div>
                            <div className="qca-sum-label">Hợp lệ</div>
                        </div>
                        {summary.ocr_failed > 0 && (
                            <div className="qca-sum-card ocr-failed">
                                <div className="qca-sum-number">{summary.ocr_failed}</div>
                                <div className="qca-sum-label">OCR lỗi</div>
                            </div>
                        )}
                    </div>

                    {/* ── Filter source ── */}
                    <div className="qca-filter-row">
                        <span className="qca-filter-label">Lọc theo nguồn:</span>
                        {['all', 'manual', 'ai', 'gemini'].map(s => (
                            <button
                                key={s}
                                className={`qca-filter-btn ${filterSource === s ? 'active' : ''}`}
                                onClick={() => setFilterSource(s)}
                            >
                                {s === 'all' ? 'Tất cả' : SOURCE_LABEL[s]}
                            </button>
                        ))}
                    </div>

                    {/* ── Thông báo nếu tất cả hợp lệ ── */}
                    {summary.invalid === 0 && summary.warning === 0 && (
                        <div className="qca-all-valid">
                            <div className="qca-all-valid-text">
                                Tất cả hóa đơn đều hợp lệ!
                            </div>
                            <div className="qca-all-valid-sub">
                                Không phát hiện lỗi nào trong {summary.total} hóa đơn
                            </div>
                        </div>
                    )}

                    {/* ── Danh sách kết quả ── */}
                    <div className="qca-list">
                        {filtered.map(item => {
                            const config  = STATUS_CONFIG[item.status] || STATUS_CONFIG.error
                            const isOpen  = expandedId === item.invoice_id
                            const errors  = item.issues?.filter(i => i.level === 'error')   || []
                            const warnings = item.issues?.filter(i => i.level === 'warning') || []
                            const infos   = item.issues?.filter(i => i.level === 'info')    || []

                            return (
                                <div
                                    key={item.invoice_id}
                                    className={`qca-item qca-item-${config.class}`}
                                >
                                    {/* ── Row chính ── */}
                                    <div
                                        className="qca-item-header"
                                        onClick={() => toggleExpand(item.invoice_id)}
                                    >
                                        <div className="qca-item-left">
                                            <span className="qca-item-status-icon">
                                                {config.icon}
                                            </span>
                                            <div className="qca-item-info">
                                                <div className="qca-item-title">
                                                    <span className="qca-item-company">
                                                        {item.company}
                                                    </span>
                                                    <span className={`qca-source-tag qca-source-${item.source}`}>
                                                        {SOURCE_LABEL[item.source]}
                                                    </span>
                                                    <span className="qca-doc-type">
                                                        {DOC_TYPE_LABEL[item.document_type]}
                                                    </span>
                                                    <OcrStatusBadge ocrStatus={item.ocr_status} />
                                                </div>
                                                <div className="qca-item-counts">
                                                    {errors.length > 0 && (
                                                        <span className="qca-mini-badge error">
                                                            {errors.length} lỗi
                                                        </span>
                                                    )}
                                                    {warnings.length > 0 && (
                                                        <span className="qca-mini-badge warning">
                                                            {warnings.length} cảnh báo
                                                        </span>
                                                    )}
                                                    {infos.length > 0 && (
                                                        <span className="qca-mini-badge info">
                                                            {infos.length} gợi ý
                                                        </span>
                                                    )}
                                                    {item.issues?.length === 0 && (
                                                        <span className="qca-mini-badge valid">
                                                            Hợp lệ
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="qca-item-right">
                                            <Link
                                                to={`/invoicedetail/${item.invoice_id}`}
                                                className="qca-btn-goto"
                                                onClick={onClose}
                                            >
                                                Sửa →
                                            </Link>
                                            <span className="qca-expand-icon">
                                                {isOpen ? '▲' : '▼'}
                                            </span>
                                        </div>
                                    </div>

                                    {isOpen && item.issues?.length > 0 && (
                                        <div className="qca-item-detail">
                                            {item.issues.map((issue, i) => {
                                                const lConfig = LEVEL_CONFIG[issue.level]
                                                return (
                                                    <div
                                                        key={i}
                                                        className={`qca-issue-row qca-issue-${lConfig.class}`}
                                                    >
                                                        <span className="qca-issue-icon">
                                                            {lConfig.icon}
                                                        </span>
                                                        <div className="qca-issue-content">
                                                            <span className="qca-issue-msg">
                                                                {issue.message}
                                                            </span>
                                                            {issue.suggestion && (
                                                                <span className="qca-issue-suggestion">
                                                                    {issue.suggestion}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {isOpen && item.issues?.length === 0 && (
                                        <div className="qca-item-detail qca-item-ok">
                                            Không phát hiện vấn đề nào
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {filtered.length === 0 && (
                            <div className="qca-empty">
                                Không có kết quả nào phù hợp với bộ lọc
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default QualityCheckAll