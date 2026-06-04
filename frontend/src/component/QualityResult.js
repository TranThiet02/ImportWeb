import React from 'react'
import '../css/QualityResult.css'

const LEVEL_CONFIG = {
    error:   {label: 'Lỗi',    class: 'error'   },
    warning: {label: 'Cảnh báo', class: 'warning' },
    info:    {label: 'Gợi ý',  class: 'info'    },
}

const QualityResult = ({ result, onClose, onSave }) => {
    if (!result) return null

    const { status, status_label, can_save,
            issues, summary } = result

    const errors   = issues.filter(i => i.level === 'error')
    const warnings = issues.filter(i => i.level === 'warning')
    const infos    = issues.filter(i => i.level === 'info')

    return (
        <div className="qc-overlay" onClick={onClose}>
            <div className="qc-modal" onClick={e => e.stopPropagation()}>

                {/* ── Header ── */}
                <div className={`qc-header qc-header-${status}`}>
                    <div className="qc-header-left">
                        <span className="qc-title">
                            Kiểm tra Chất lượng Dữ liệu
                        </span>
                    </div>
                    <button className="qc-close" onClick={onClose}>✕</button>
                </div>

                <div className="qc-body">

                    {/* ── Status Banner ── */}
                    <div className={`qc-status-banner qc-status-${status}`}>
                        <span className="qc-status-label">
                            {status_label}
                        </span>
                        <div className="qc-summary-counts">
                            {summary.errors > 0 && (
                                <span className="qc-count error">
                                    {summary.errors} lỗi
                                </span>
                            )}
                            {summary.warnings > 0 && (
                                <span className="qc-count warning">
                                    {summary.warnings} cảnh báo
                                </span>
                            )}
                            {summary.infos > 0 && (
                                <span className="qc-count info">
                                    {summary.infos} gợi ý
                                </span>
                            )}
                            {summary.total === 0 && (
                                <span className="qc-count valid">
                                    Không có vấn đề
                                </span>
                            )}
                        </div>
                    </div>

                    {/* ── Danh sách lỗi ── */}
                    {errors.length > 0 && (
                        <div className="qc-section">
                            <div className="qc-section-title error">
                                Lỗi cần sửa ({errors.length})
                            </div>
                            {errors.map((issue, i) => (
                                <IssueCard key={i} issue={issue} />
                            ))}
                        </div>
                    )}

                    {/* ── Cảnh báo ── */}
                    {warnings.length > 0 && (
                        <div className="qc-section">
                            <div className="qc-section-title warning">
                                Cảnh báo ({warnings.length})
                            </div>
                            {warnings.map((issue, i) => (
                                <IssueCard key={i} issue={issue} />
                            ))}
                        </div>
                    )}

                    {/* ── Gợi ý ── */}
                    {infos.length > 0 && (
                        <div className="qc-section">
                            <div className="qc-section-title info">
                                Gợi ý ({infos.length})
                            </div>
                            {infos.map((issue, i) => (
                                <IssueCard key={i} issue={issue} />
                            ))}
                        </div>
                    )}

                    {/* ── Không có vấn đề ── */}
                    {issues.length === 0 && (
                        <div className="qc-all-good">
                            <div className="qc-all-good-text">
                                Dữ liệu đầy đủ và chính xác
                            </div>
                            <div className="qc-all-good-sub">
                                Có thể lưu vào hệ thống
                            </div>
                        </div>
                    )}

                    {/* ── Actions ── */}
                    <div className="qc-actions">
                        <button className="qc-btn-close" onClick={onClose}>
                            Đóng lại để sửa
                        </button>
                        {can_save && onSave && (
                            <button className="qc-btn-save" onClick={onSave}>
                                {status === 'warning'
                                    ? 'Lưu dù có cảnh báo'
                                    : 'Lưu vào hệ thống'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

const IssueCard = ({ issue }) => {
    const config = LEVEL_CONFIG[issue.level]
    return (
        <div className={`qc-issue qc-issue-${config.class}`}>
            <div className="qc-issue-header">
                <span className="qc-issue-icon">{config.icon}</span>
                <span className="qc-issue-message">{issue.message}</span>
            </div>
            {issue.suggestion && (
                <div className="qc-issue-suggestion">
                    {issue.suggestion}
                </div>
            )}
        </div>
    )
}

export default QualityResult