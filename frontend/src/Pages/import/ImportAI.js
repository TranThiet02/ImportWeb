import React, { useEffect, useState, useCallback } from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router-dom'
import {fetchAIInvoices, createAIInvoice, fetchAIOcrStatus, deleteAIInvoice} from '../../reducer/invoiceai/InvoiceAIActions'
import '../../css/import.css'

const ImportAI = (props) => {
    const { aiInvoices } = props

    const [file, setFile] = useState(null)
    const [preview, setPreview] = useState(null)
    const [dragOver, setDragOver] = useState(false)
    const [note, setNote] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState({ text: '', type: '' })
    const [ocrLoading, setOcrLoading] = useState(false)

    useEffect(() => {
        props.fetchAIInvoices()
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
        formData.append('file', file)
        formData.append('note', note)
        formData.append('document_type', 'invoice')
        formData.append('detail_data', JSON.stringify({}))

        setSubmitting(true)
        const result = await props.createAIInvoice(formData)
        setSubmitting(false)

        if (result.success) {
            const invoiceId = result.data?.id
            setMessage({ text: 'Upload thành công! AI đang phân tích...', type: 'success' })
            handleReset()
            setOcrLoading(true)

            const poll = setInterval(async () => {
                const status = await props.fetchAIOcrStatus(invoiceId)
                if (!status) return clearInterval(poll)

                if (status.ocr_status === 'done') {
                    clearInterval(poll)
                    setOcrLoading(false)
                    setMessage({ text: 'AI đọc xong! Vào chi tiết để xem và chỉnh sửa.', type: 'success' })
                    props.fetchAIInvoices()
                } else if (status.ocr_status === 'failed') {
                    clearInterval(poll)
                    setOcrLoading(false)
                    setMessage({ text: 'AI đọc thất bại, nhập thủ công.', type: 'error' })
                    props.fetchAIInvoices()
                }
            }, 3000)

            // Dừng polling sau 5 phút
            setTimeout(() => clearInterval(poll), 300000)
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
            done:       { class: 'ocr-badge done',       label: '✓ Done' },
            failed:     { class: 'ocr-badge failed',     label: '✕ Failed' },
            processing: { class: 'ocr-badge processing', label: '⟳ Processing' },
            pending:    { class: 'ocr-badge pending',    label: '⏳ Pending' },
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
                    <span className="import-status-badge">YOLO + PaddleOCR</span>
                </div>
                <div className="import-header-right">
                    <button className="btn-reset" onClick={handleReset}>
                        ✕ Xóa
                    </button>
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

            {/* <div className="import-table-card">
                <div className="import-table-header">
                    <div className="import-table-title">
                        Danh Sách Import bằng AI
                    </div>
                    <span className="import-count-badge">{aiInvoices.length} hóa đơn</span>
                </div>
                <table className="import-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Công Ty</th>
                            <th>Ghi chú</th>
                            <th>OCR Status</th>
                            <th>Ngày tạo</th>
                            <th>File</th>
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
                                        <td>{inv.note || '—'}</td>
                                        <td>
                                            <span className={badge.class}>
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
                                                File
                                            </a>
                                        </td>
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
            </div> */}
        </div>
    )
}

const mapStateToProps = (state) => ({
    aiInvoices: state.InvoiceAIReducer?.aiInvoices || [],
})

export default connect(mapStateToProps, {
    fetchAIInvoices, createAIInvoice,
    fetchAIOcrStatus, deleteAIInvoice,
})(ImportAI)