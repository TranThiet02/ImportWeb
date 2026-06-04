import React, { useEffect, useState, useCallback } from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router-dom'
import {fetchAIInvoices, createAIInvoice, fetchAIOcrStatus, deleteAIInvoice, createAIBatch} from '../../reducer/invoiceai/InvoiceAIActions'
import '../../css/import.css'
import { buildMediaUrl } from '../../config/api'
import ConfidenceBadge from '../../component/ConfidenceBadge'
import QualityCheckAll from '../../component/QualityCheckAll'
import { qualityCheckAll } from '../../reducer/invoicesupgrade/InvoiceActions'
import BatchUpload from '../../component/BatchUpload'
import InvoiceCard from '../../component/InvoiceCard'

const ImportAI = (props) => {
    const { aiInvoices } = props

    const [file, setFile] = useState(null)
    const [preview, setPreview] = useState(null)
    const [dragOver, setDragOver] = useState(false)
    const [note, setNote] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState({ text: '', type: '' })
    const [ocrLoading, setOcrLoading] = useState(false)
    const [autoSaveCount, setAutoSaveCount] = useState(0)
    const [manualCheckCount, setManualCheckCount] = useState(0)
    const [qcAllResult, setQcAllResult] = useState(null)
    const [showQCAll, setShowQCAll] = useState(false)
    const [checkingAll, setCheckingAll] = useState(false)
    const [showBatch, setShowBatch] = useState(false)

    useEffect(() => {
        props.fetchAIInvoices()
    }, [])

    useEffect(() => {
        if (aiInvoices && aiInvoices.length > 0) {
            const autoSave = aiInvoices.filter(
                inv => inv.ocr_result?.auto_saved === true
            ).length
            const manualCheck = aiInvoices.filter(
                inv => inv.ocr_result?.auto_saved === false
                && inv.ocr_result
            ).length
            setAutoSaveCount(autoSave)
            setManualCheckCount(manualCheck)
        }
    }, [aiInvoices])

    const handleQCAll = async () => {
        setCheckingAll(true)
        const result = await props.qualityCheckAll('ai')
        setCheckingAll(false)
        if (result.success) {
            setQcAllResult(result.data)
            setShowQCAll(true)
        }
    }

    const handleFile = (selectedFile) => {
        if (!selectedFile) return
        const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
        if (!allowed.includes(selectedFile.type)) {
            setMessage({ text: 'Chỉ chấp nhận PDF, JPG, PNG', type: 'error' })
            return
        }
        if (selectedFile.size > 10 * 1024 * 1024) {
            setMessage({ text: 'File không được vượt quá 10MB', type: 'error' })
            return
        }
        setFile(selectedFile)
        setPreview(URL.createObjectURL(selectedFile))
        setMessage({ text: '', type: '' })
    }

    const handleDrop = useCallback((e) => {
        e.preventDefault()
        setDragOver(false)
        handleFile(e.dataTransfer.files[0])
    }, [])

    const handleReset = () => {
        setFile(null)
        setPreview(null)
        setNote('')
        setMessage({ text: '', type: '' })
    }

    const handleSubmit = async () => {
        if (!file) {
            setMessage({ text: 'Vui lòng chọn file', type: 'error' })
            return
        }

        const formData = new FormData()
        formData.append('file', file)
        formData.append('note', note)
        formData.append('document_type', 'invoice')
        formData.append('detail_data', JSON.stringify({}))

        setSubmitting(true)
        const result = await props.createAIInvoice(formData)
        setSubmitting(false)

        if (result.success) {
            const invoiceId = result.data?.id
            setMessage({
                text: 'Upload thành công! YOLO đang phân tích...',
                type: 'success'
            })
            handleReset()
            setOcrLoading(true)

            let pollCount = 0
            const maxPolls = 60
            const startTime = Date.now()

            const poll = setInterval(async () => {
                pollCount++
                try {
                    const status = await props.fetchAIOcrStatus(invoiceId)
                    if (!status) {
                        console.log('Không có response từ server')
                        return
                    }

                    if (status.ocr_status === 'done') {
                        clearInterval(poll)
                        setOcrLoading(false)

                        const confidence = status.invoice?.ocr_result?.confidence_score
                        const autoSaved = status.invoice?.ocr_result?.auto_saved

                        console.log(`OCR DONE - Confidence: ${confidence}%, AutoSaved: ${autoSaved}`)

                        if (autoSaved) {
                            setMessage({
                                text: `Tự động lưu thành công (độ tin cậy ${confidence}%)!`,
                                type: 'success'
                            })
                        } else {
                            setMessage({
                                text: `YOLO đọc xong (${confidence}%). Vào chi tiết để xem và chỉnh sửa.`,
                                type: 'warning'
                            })
                        }

                        props.fetchAIInvoices()
                    } else if (status.ocr_status === 'failed') {
                        clearInterval(poll)
                        setOcrLoading(false)
                        console.log('OCR FAILED')
                        setMessage({
                            text: 'YOLO đọc thất bại. Vui lòng nhập thủ công.',
                            type: 'error'
                        })
                        props.fetchAIInvoices()
                    } else {
                        console.log(`Trạng thái: ${status.ocr_status}`)
                    }

                } catch (error) {
                    console.error(`Poll error:`, error)
                    setMessage({
                        text: `Lỗi khi kiểm tra trạng thái: ${error.message}`,
                        type: 'error'
                    })
                }

                if (pollCount >= maxPolls) {
                    clearInterval(poll)
                    setOcrLoading(false)
                    console.log('TIMEOUT - OCR quá lâu')
                    setMessage({
                        text: 'OCR quá lâu (>3 phút). Vui lòng thử lại hoặc nhập thủ công.',
                        type: 'error'
                    })
                    props.fetchAIInvoices()
                }
            }, 3000)

        } else {
            setMessage({ text: 'Upload thất bại!', type: 'error' })
        }
    }

    const handleDelete = async (id) => {
        if (window.confirm('Bạn chắc muốn xóa?')) {
            await props.deleteAIInvoice(id)
        }
    }

    const getOcrBadge = (status) => {
        const map = {
            done: { class: 'ocr-badge done', label: 'Done' },
            failed: { class: 'ocr-badge failed', label: 'Failed' },
            processing: { class: 'ocr-badge processing', label: 'Processing' },
            pending: { class: 'ocr-badge pending', label: 'Pending' },
        }
        return map[status] || map.pending
    }

    return (
        <div className="import-page">
            <div className="import-header">
                <div className="import-header-left">
                    <span className="import-invoice-number">
                        Import <span>AI</span>
                    </span>
                    <span className="import-status-badge">YOLO + EassyOCR</span>
                </div>
                <div className="import-header-right ai-header-actions">
                    <button
                        className={`btn-batch ${showBatch ? 'active' : ''}`}
                        onClick={() => setShowBatch(prev => !prev)}
                    >
                        {showBatch ? 'Đơn lẻ' : 'Nhiều file'}
                    </button>
                    <button
                        className="btn-qc-all"
                        onClick={handleQCAll}
                        disabled={checkingAll}
                    >
                        {checkingAll
                            ? 'Đang kiểm tra...'
                            : 'Kiểm tra tất cả'}
                    </button>
                    {/* <button className="btn-reset" onClick={handleReset}>
                        Xóa
                    </button> */}
                    <button
                        className="btn-save"
                        onClick={handleSubmit}
                        disabled={submitting || ocrLoading}
                    >
                        {submitting ? 'Đang upload...' :
                         ocrLoading ? 'AI đang đọc...' : 'Upload & AI Đọc'}
                    </button>
                </div>
            </div>

            {message.text && (
                <div className={`import-alert ${message.type}`}>
                    {message.text}
                </div>
            )}

            {ocrLoading && (
                <div className="ocr-loading-bar">
                    <div className="ocr-loading-inner"></div>
                    <span>AI đang phân tích hóa đơn...</span>
                </div>
            )}

            <div className="import-card" style={{ marginBottom: '24px' }}>
                <div className="import-card-header">Upload File Hóa Đơn</div>
                <div className="import-card-body">
                    <div
                        className={`upload-zone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
                        onDrop={handleDrop}
                        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onClick={() => document.getElementById('fileInputAI').click()}
                    >
                        <input
                            id="fileInputAI"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            style={{ display: 'none' }}
                            onChange={e => handleFile(e.target.files[0])}
                        />
                        {file ? (
                            <>
                                <div className="upload-title success">{file.name}</div>
                                <div className="upload-sub">
                                    {(file.size/1024/1024).toFixed(2)} MB · Click để đổi
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="upload-title">Kéo thả hoặc click để chọn file</div>
                                <div className="upload-sub">AI sẽ tự động đọc thông tin</div>
                                <div className="upload-sub">PDF, JPG, PNG · Tối đa 10MB</div>
                            </>
                        )}
                    </div>

                    {preview && (
                        <div className="detail-main-layout" style={{ marginTop: '16px' }}>
                            <div className="upload-preview">
                                {file?.type === 'application/pdf'
                                    ? <iframe src={preview} title="preview" />
                                    : <img src={preview} alt="preview" />
                                }
                            </div>
                            <div>
                                <label className="form-label">Ghi Chú</label>
                                <textarea
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    className="form-textarea"
                                    placeholder="Ghi chú thêm (tuỳ chọn)..."
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {showBatch ? (
                <BatchUpload
                    source="ai"
                    onBatchSubmit={props.createAIBatch}
                    fetchInvoices={props.fetchAIInvoices}
                    pollStatus={props.fetchAIOcrStatus}
                    onComplete={() => props.fetchAIInvoices()}
                />
            ) : (
                <div className="import-card">...</div>
            )}
            <div className="import-table-card">
                <div className="import-table-header">
                    <div className="import-table-title">
                        Danh Sách Import bằng AI
                    </div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        {autoSaveCount > 0 && (
                            <span style={{ fontSize: '13px', color: '#6b7280', marginRight: '12px' }}>
                                Tự động: <strong>{autoSaveCount}</strong>
                            </span>
                        )}
                        {manualCheckCount > 0 && (
                            <span style={{ fontSize: '13px', color: '#6b7280' }}>
                                Cần xem: <strong>{manualCheckCount}</strong>
                            </span>
                        )}
                        <span className="import-count-badge">{aiInvoices.length} hóa đơn</span>
                    </div>
                </div>
                <table className="import-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Công Ty</th>
                            <th>Ghi chú</th>
                            <th>Confidence</th>
                            <th>OCR Status</th>
                            <th>Ngày tạo</th>
                            <th>Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {aiInvoices.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="import-table-empty">
                                    Chưa có hóa đơn nào
                                </td>
                            </tr>
                        ) : (
                            aiInvoices.map((inv, index) => {
                                const badge = getOcrBadge(inv.ocr_status)
                                return (
                                    <tr key={inv.id}>
                                        <td>{index + 1}</td>
                                        <td className="company-name">
                                            {inv.company_detail?.name || '—'}
                                        </td>
                                         <td>
                                            <ConfidenceBadge
                                                confidence={inv.ocr_result?.confidence_score}
                                                autoSaved={inv.ocr_result?.auto_saved}
                                            />
                                        </td>
                                        <td>{inv.note || '—'}</td>
                                        <td>
                                            <span className={badge.class}>
                                                {badge.label}
                                            </span>
                                        </td>
                                        <td>{new Date(inv.created_at).toLocaleDateString('vi-VN')}</td>
                                        {/* <td>
                                            <a
                                                href={buildMediaUrl(inv.file)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn-view"
                                            >
                                                File
                                            </a>
                                        </td> */}
                                        <td>
                                            <Link
                                                to={`/invoicedetail/${inv.id}`}
                                                className="btn-view"
                                                style={{ marginRight: '6px' }}
                                            >
                                                Xem
                                            </Link>
                                            <button
                                                className="btn-del"
                                                onClick={() => handleDelete(inv.id)}
                                            >
                                                Xóa
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
                <div className="import-card-list">
                    {aiInvoices.map(inv => (
                        <InvoiceCard
                            key={inv.id}
                            inv={inv}
                            onDelete={handleDelete}
                            getOcrBadge={getOcrBadge}
                        />
                    ))}
                </div>
            </div>
            {showQCAll && qcAllResult && (
                <QualityCheckAll
                    result={qcAllResult}
                    onClose={() => setShowQCAll(false)}
                    onRecheck={async () => {
                        const result = await props.qualityCheckAll('ai')
                        if (result.success) setQcAllResult(result.data)
                    }}
                />
            )}
        </div>
    )
}

const mapStateToProps = (state) => ({
    aiInvoices: state.InvoiceAIReducer?.aiInvoices || [],
})

export default connect(mapStateToProps, {
    fetchAIInvoices, createAIInvoice,
    fetchAIOcrStatus, deleteAIInvoice,
    qualityCheckAll, createAIBatch,
})(ImportAI)