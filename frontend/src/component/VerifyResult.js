import React from 'react'
import '../css/VerifyResult.css'

const STATUS_CONFIG = {
    match: { class: 'match', label: 'Khớp' },
    mismatch: { class: 'mismatch', label: 'Không khớp' },
    partial_match: { class: 'partial', label: 'Gần khớp' },
    unverified: { class: 'unverified',  label: 'Không đọc được' },
    missing_in_form: { class: 'missing', label: 'Thiếu trong form' },
}

const OVERALL_CONFIG = {
    passed: { class: 'passed' },
    failed: { class: 'failed' },
    partial: { class: 'partial' },
    unverified: { class: 'unverified' },
}

const VerifyResult = ({ result, onClose, onFixField }) => {
    if (!result) return null

    const { overall, overall_label, comparisons,
            summary, confidence_note } = result
    const overallConfig = OVERALL_CONFIG[overall]

    const mismatches = comparisons.filter(
        c => c.status === 'mismatch' || c.status === 'missing_in_form'
    )
    const partials = comparisons.filter(c => c.status === 'partial_match')
    const matches = comparisons.filter(c => c.status === 'match')
    const others = comparisons.filter(c => c.status === 'unverified')

    return (
        <div className="vr-overlay" onClick={onClose}>
            <div className="vr-modal" onClick={e => e.stopPropagation()}>

                {/* ── Header ── */}
                <div className={`vr-header vr-header-${overallConfig.class}`}>
                    <div className="vr-header-left">
                        <span className="vr-title">
                            Xác minh với Ảnh gốc
                        </span>
                        <span className="vr-subtitle">
                            Gemini Vision so sánh dữ liệu nhập với file gốc
                        </span>
                    </div>
                    <button className="vr-close" onClick={onClose}>✕</button>
                </div>

                <div className="vr-body">

                    {/* ── Overall Status ── */}
                    <div className={`vr-overall vr-overall-${overallConfig.class}`}>
                        <span className="vr-overall-icon">
                            {overallConfig.icon}
                        </span>
                        <div className="vr-overall-info">
                            <div className="vr-overall-label">
                                {overall_label}
                            </div>
                            <div className="vr-overall-counts">
                                {summary.mismatch > 0 && (
                                    <span className="vr-badge mismatch">
                                        {summary.mismatch} sai
                                    </span>
                                )}
                                {summary.partial > 0 && (
                                    <span className="vr-badge partial">
                                        {summary.partial} gần đúng
                                    </span>
                                )}
                                {summary.match > 0 && (
                                    <span className="vr-badge match">
                                        {summary.match} khớp
                                    </span>
                                )}
                                {summary.unverified > 0 && (
                                    <span className="vr-badge unverified">
                                        {summary.unverified} không đọc được
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Ghi chú độ rõ ảnh ── */}
                    {confidence_note && (
                        <div className="vr-confidence-note">
                            {confidence_note}
                        </div>
                    )}

                    {/* ── Sai / Thiếu ── */}
                    {mismatches.length > 0 && (
                        <div className="vr-section">
                            <div className="vr-section-title mismatch">
                                Cần sửa ngay ({mismatches.length})
                            </div>
                            {mismatches.map((c, i) => (
                                <CompareCard
                                    key={i}
                                    item={c}
                                    onFix={onFixField}
                                />
                            ))}
                        </div>
                    )}

                    {/* ── Gần khớp ── */}
                    {partials.length > 0 && (
                        <div className="vr-section">
                            <div className="vr-section-title partial">
                                Kiểm tra lại ({partials.length})
                            </div>
                            {partials.map((c, i) => (
                                <CompareCard key={i} item={c} onFix={onFixField} />
                            ))}
                        </div>
                    )}

                    {/* ── Không đọc được ── */}
                    {others.length > 0 && (
                        <div className="vr-section">
                            <div className="vr-section-title unverified">
                                Không xác minh được ({others.length})
                            </div>
                            {others.map((c, i) => (
                                <CompareCard key={i} item={c} />
                            ))}
                        </div>
                    )}

                    {/* ── Khớp ── */}
                    {matches.length > 0 && (
                        <div className="vr-section">
                            <div className="vr-section-title match">
                                Đã xác minh khớp ({matches.length})
                            </div>
                            <div className="vr-matches-grid">
                                {matches.map((c, i) => (
                                    <div key={i} className="vr-match-item">
                                        {c.label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Actions ── */}
                    <div className="vr-actions">
                        <button className="vr-btn-close" onClick={onClose}>
                            Đóng lại để sửa
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

const CompareCard = ({ item, onFix }) => {
    const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.unverified

    // Item comparison (mặt hàng)
    if (item.item_no !== undefined) {
        return (
            <div className={`vr-card vr-card-${config.class}`}>
                <span className="vr-card-icon">{config.icon}</span>
                <span className="vr-card-message">{item.message}</span>
            </div>
        )
    }

    return (
        <div className={`vr-card vr-card-${config.class}`}>
            <div className="vr-card-header">
                <span className="vr-card-icon">{config.icon}</span>
                <span className="vr-card-label">{item.label}</span>
                {/* Nút sửa nhanh nếu có giá trị từ ảnh */}
                {onFix && item.from_image &&
                 item.status === 'mismatch' && (
                    <button
                        className="vr-btn-fix"
                        onClick={() => onFix(item.field, item.from_image)}
                        title="Dùng giá trị từ ảnh"
                    >
                        Dùng từ ảnh
                    </button>
                )}
            </div>
            <div className="vr-card-body">
                {item.entered !== undefined && item.entered !== null && (
                    <div className="vr-compare-row">
                        <span className="vr-compare-label">Đã nhập:</span>
                        <span className="vr-compare-value entered">
                            {String(item.entered) || '(trống)'}
                        </span>
                    </div>
                )}
                {item.from_image !== undefined && item.from_image !== null && (
                    <div className="vr-compare-row">
                        <span className="vr-compare-label">Từ ảnh:</span>
                        <span className="vr-compare-value from-image">
                            {String(item.from_image)}
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}

export default VerifyResult