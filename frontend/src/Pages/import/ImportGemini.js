import React, { useEffect, useState, useCallback } from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router-dom'
import {
    fetchGeminiInvoices, createGeminiInvoice,
    fetchGeminiOcrStatus, deleteGeminiInvoice
} from '../../reducer/invoicegemini/InvoiceGeminiActions'
import '../../css/import.css'

const DOCUMENT_TYPES = [
    { value: 'invoice',   label: 'Hóa đơn' },
    { value: 'receipt',   label: 'Phiếu thu' },
    { value: 'payment',   label: 'Phiếu chi' },
    { value: 'warehouse', label: 'Phiếu nhập kho' },
]

const ImportGemini = (props) => {
    const { geminiInvoices } = props

    const [file,       setFile]       = useState(null)
    const [preview,    setPreview]    = useState(null)
    const [dragOver,   setDragOver]   = useState(false)
    const [note,       setNote]       = useState('')
    const [docType,    setDocType]    = useState('invoice')
    const [submitting, setSubmitting] = useState(false)
    const [ocrLoading, setOcrLoading] = useState(false)
    const [message,    setMessage]    = useState({ text: '', type: '' })

    useEffect(() => {
        props.fetchGeminiInvoices()
    }, [])

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
        formData.append('file',          file)
        formData.append('note',          note)
        formData.append('document_type', docType)
        formData.append('detail_data',   JSON.stringify({}))

        setSubmitting(true)
        const result = await props.createGeminiInvoice(formData)
        setSubmitting(false)

        if (result.success) {
            const invoiceId = result.data?.id
            setMessage({ text: 'Upload thành công! Gemini đang phân tích...', type: 'success' })
            handleReset()
            setOcrLoading(true)

            // Polling mỗi 3 giây
            const poll = setInterval(async () => {
                const status = await props.fetchGeminiOcrStatus(invoiceId)
                if (!status) return clearInterval(poll)

                if (status.ocr_status === 'done') {
                    clearInterval(poll)
                    setOcrLoading(false)
                    setMessage({ text: 'Gemini đọc xong! Vào chi tiết để xem và chỉnh sửa.', type: 'success' })
                    props.fetchGeminiInvoices()
                } else if (status.ocr_status === 'failed') {
                    clearInterval(poll)
                    setOcrLoading(false)
                    setMessage({ text: 'Gemini đọc thất bại!', type: 'error' })
                    props.fetchGeminiInvoices()
                }
            }, 3000)

            setTimeout(() => clearInterval(poll), 300000)
        } else {
            setMessage({ text: 'Upload thất bại!', type: 'error' })
        }
    }

    const handleDelete = async (id) => {
        if (window.confirm('Bạn chắc muốn xóa?')) {
            await props.deleteGeminiInvoice(id)
        }
    }

    const getOcrBadge = (status) => {
        const map = {
            done:       { cls: 'ocr-badge done',       label: '✓ Done' },
            failed:     { cls: 'ocr-badge failed',     label: '✕ Failed' },
            processing: { cls: 'ocr-badge processing', label: '⟳ Processing' },
            pending:    { cls: 'ocr-badge pending',    label: 'Pending' },
        }
        return map[status] || map.pending
    }

    return (
        <div className="import-page">

            {/* ── Header ── */}
            <div className="import-header">
                <div className="import-header-left">
                    <span className="import-invoice-number">
                        Import <span>Gemini AI</span>
                    </span>
                    <span className="import-status-badge">Google Gemini Vision</span>
                </div>
                <div className="import-header-right">
                    <button className="btn-reset" onClick={handleReset}>✕ Xóa</button>
                    <button
                        className="btn-save"
                        onClick={handleSubmit}
                        disabled={submitting || ocrLoading}
                    >
                        {submitting  ? 'Đang upload...' :
                         ocrLoading  ? 'Gemini đang đọc...' :
                         'Upload & Gemini Đọc'}
                    </button>
                </div>
            </div>

            {/* ── Alert ── */}
            {message.text && (
                <div className={`import-alert ${message.type}`}>
                    {message.text}
                </div>
            )}

            {/* ── OCR Loading ── */}
            {ocrLoading && (
                <div className="ocr-loading-bar">
                    <div className="ocr-loading-inner"></div>
                    <span>Gemini Vision đang phân tích hóa đơn...</span>
                </div>
            )}

            {/* ── Chọn loại chứng từ ── */}
            <div className="doc-type-bar">
                {DOCUMENT_TYPES.map(dt => (
                    <button
                        key={dt.value}
                        className={`doc-type-btn ${docType === dt.value ? 'active' : ''}`}
                        onClick={() => setDocType(dt.value)}
                    >
                        {dt.label}
                    </button>
                ))}
            </div>

            {/* ── Upload + Preview ── */}
            <div className="import-main-layout">
                <div className="import-card">
                    <div className="import-card-header">Upload File</div>
                    <div className="import-card-body">
                        <div
                            className={`upload-zone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
                            onDrop={handleDrop}
                            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                            onDragLeave={() => setDragOver(false)}
                            onClick={() => document.getElementById('fileInputGemini').click()}
                        >
                            <input
                                id="fileInputGemini"
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
                                    <div className="upload-title">Kéo thả hoặc click để chọn</div>
                                    <div className="upload-sub">Gemini Vision sẽ tự đọc toàn bộ thông tin</div>
                                    <div className="upload-sub">PDF, JPG, PNG · Tối đa 10MB</div>
                                </>
                            )}
                        </div>

                        {preview && (
                            <div className="upload-preview" style={{ marginTop: '16px' }}>
                                {file?.type === 'application/pdf'
                                    ? <iframe src={preview} title="preview" />
                                    : <img src={preview} alt="preview" />
                                }
                            </div>
                        )}
                    </div>
                </div>

                {/* Ghi chú */}
                <div className="import-card">
                    <div className="import-card-header">Ghi Chú</div>
                    <div className="import-card-body">
                        <div className="form-group">
                            <label className="form-label">Ghi Chú Thêm</label>
                            <textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                className="form-textarea"
                                rows={6}
                                placeholder="Ghi chú thêm (tuỳ chọn)..."
                            />
                        </div>
                        <div className="gemini-info-box">
                            <p><strong>Gemini Vision</strong> sẽ tự động:</p>
                            <ul>
                                <li>Phân loại loại chứng từ</li>
                                <li>Đọc tên cửa hàng, ngày, tổng tiền</li>
                                <li>Liệt kê danh sách mặt hàng</li>
                                <li>Fill vào form để bạn kiểm tra</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Danh sách ── */}
            {/* <div className="import-table-card">
                <div className="import-table-header">
                    <div className="import-table-title">✨ Danh Sách Import Gemini</div>
                    <span className="import-count-badge">{geminiInvoices.length} hóa đơn</span>
                </div>
                <table className="import-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Công Ty</th>
                            <th>Loại</th>
                            <th>Ghi chú</th>
                            <th>Gemini Status</th>
                            <th>Ngày tạo</th>
                            <th>File</th>
                            <th>Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {geminiInvoices.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="import-table-empty">
                                    📭 Chưa có hóa đơn nào
                                </td>
                            </tr>
                        ) : (
                            geminiInvoices.map((inv, index) => {
                                const badge = getOcrBadge(inv.ocr_status)
                                return (
                                    <tr key={inv.id}>
                                        <td>{index + 1}</td>
                                        <td className="company-name">
                                            {inv.company_detail?.name || '—'}
                                        </td>
                                        <td>
                                            <span className="doc-type-label">
                                                {DOCUMENT_TYPES.find(d => d.value === inv.document_type)?.label || inv.document_type}
                                            </span>
                                        </td>
                                        <td>{inv.note || '—'}</td>
                                        <td>
                                            <span className={badge.cls}>
                                                {badge.label}
                                            </span>
                                        </td>
                                        <td>{new Date(inv.created_at).toLocaleDateString('vi-VN')}</td>
                                        <td>
                                            <a
                                                href={`http://localhost:8000${inv.file}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn-view"
                                            >
                                                📄 File
                                            </a>
                                        </td>
                                        <td>
                                            <Link
                                                to={`/invoicedetail/${inv.id}`}
                                                className="btn-view"
                                                style={{ marginRight: '6px' }}
                                            >
                                                👁 Xem
                                            </Link>
                                            <button
                                                className="btn-del"
                                                onClick={() => handleDelete(inv.id)}
                                            >
                                                🗑 Xóa
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div> */}
        </div>
    )
}

const mapStateToProps = (state) => ({
    geminiInvoices: state.InvoiceGeminiReducer?.geminiInvoices || [],
})

export default connect(mapStateToProps, {
    fetchGeminiInvoices, createGeminiInvoice,
    fetchGeminiOcrStatus, deleteGeminiInvoice,
})(ImportGemini)