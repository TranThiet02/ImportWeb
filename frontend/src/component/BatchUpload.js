// src/component/BatchUpload.jsx
import React, { useState, useCallback } from 'react'
import '../css/BatchUpload.css'

const BatchUpload = ({
    source,
    onBatchSubmit,
    onComplete,
    fetchInvoices,
    pollStatus,
}) => {

    const [files, setFiles] = useState([])
    const [dragOver, setDragOver] = useState(false)
    const [docType, setDocType] = useState('invoice')
    const [note, setNote] = useState('')
    const [uploading, setUploading] = useState(false)
    const [batchResult, setBatchResult] = useState(null)
    const [processing, setProcessing] = useState([])
    const [done, setDone] = useState([])
    const [message, setMessage] = useState(null)

    const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    const MAX_SIZE = 10 * 1024 * 1024 
    const MAX_FILES = 5

    const handleFiles = useCallback((selectedFiles) => {
        const fileArr = Array.from(selectedFiles)
        const valid   = []
        const invalid = []

        fileArr.forEach(f => {
            if (!ALLOWED_TYPES.includes(f.type)) {
                invalid.push(`${f.name}: Không hỗ trợ định dạng`)
            } else if (f.size > MAX_SIZE) {
                invalid.push(`${f.name}: File > 10MB`)
            } else {
                valid.push(f)
            }
        })

        if (invalid.length > 0) {
            setMessage({ type: 'error', text: invalid.join(', ') })
        }

        setFiles(prev => {
            const combined = [...prev, ...valid]
            if (combined.length > MAX_FILES) {
                setMessage({ type: 'warning', text: `Tối đa ${MAX_FILES} file` })
                return combined.slice(0, MAX_FILES)
            }
            return combined
        })
    }, [])

    const handleDrop = useCallback((e) => {
        e.preventDefault()
        setDragOver(false)
        handleFiles(e.dataTransfer.files)
    }, [handleFiles])

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index))
    }

    const handleSubmit = async () => {
        if (files.length === 0) {
            setMessage({ type: 'error', text: 'Chọn ít nhất 1 file' })
            return
        }

        setUploading(true)
        setMessage(null)
        setBatchResult(null)

        const formData = new FormData()
        files.forEach(f => formData.append('files', f))
        formData.append('document_type', docType)
        formData.append('note', note)

        const result = await onBatchSubmit(formData)
        setUploading(false)

        if (result.success) {
            const { created, errors, success, failed } = result.data
            setBatchResult(result.data)
            setFiles([])

            if (errors.length > 0) {
                setMessage({
                    type: 'warning',
                    text: `Upload ${success} thành công, ${failed} thất bại`
                })
            } else {
                setMessage({
                    type: 'success',
                    text: `Upload ${success} file thành công! Đang OCR...`
                })
            }

            // Bắt đầu polling cho từng invoice
            setProcessing(created.map(c => ({
                ...c,
                percent: 0,
                stage: 'Đang chờ...',
                confidence: null,
                autoSaved: null,
            })))

            _pollBatch(created)

        } else {
            setMessage({ type: 'error', text: 'Upload thất bại!' })
        }
    }

    // Poll trạng thái từng invoice trong batch
    const _pollBatch = (createdList) => {
        const pollMap = {}  // id → interval

        createdList.forEach(item => {
            let count = 0
            const maxCount = 240  // 6 phút

            pollMap[item.id] = setInterval(async () => {
                count++
                try {
                    const res = await pollStatus(item.id)
                    if (!res) return

                    const { ocr_status, progress, percent, confidence_score, auto_saved } = res

                    // Update progress
                    setProcessing(prev => prev.map(p =>
                        p.id === item.id
                            ? { ...p, percent: percent || 0, stage: progress || '...' }
                            : p
                    ))

                    // Xong
                    if (ocr_status === 'done' || ocr_status === 'failed') {
                        clearInterval(pollMap[item.id])

                        setProcessing(prev => prev.filter(p => p.id !== item.id))
                        setDone(prev => [...prev, {
                            ...item,
                            ocr_status,
                            confidence_score,
                            auto_saved,
                            stage: ocr_status === 'done'
                                ? (auto_saved ? 'Tự động lưu' : 'Cần xem lại')
                                : 'Thất bại',
                        }])

                        fetchInvoices()
                    }

                } catch (e) {
                    console.error(e)
                }

                if (count >= maxCount) {
                    clearInterval(pollMap[item.id])
                    setProcessing(prev => prev.filter(p => p.id !== item.id))
                    setDone(prev => [...prev, {
                        ...item,
                        ocr_status: 'failed',
                        stage: 'Timeout',
                    }])
                }
            }, 1500)
        })
    }

    const DOC_TYPES = [
        { value: 'invoice',   label: 'Hóa đơn' },
        { value: 'receipt',   label: 'Phiếu thu' },
        { value: 'payment',   label: 'Phiếu chi' },
        { value: 'warehouse', label: 'Phiếu nhập kho' },
    ]

    return (
        <div className="batch-container">
            {/* ── Header ── */}
            <div className="batch-header">
                <div className="batch-title">
                    {source === 'gemini' ? 'Batch Import Gemini' : 'Batch Import AI'}
                </div>
                <div className="batch-subtitle">
                    Upload nhiều file, OCR tự động và tự đánh giá chất lượng
                </div>
            </div>

            {/* ── Config ── */}
            <div className="batch-config">
                <div className="batch-config-item">
                    <label className="batch-label">Loại chứng từ</label>
                    <div className="batch-doc-types">
                        {DOC_TYPES.map(d => (
                            <button
                                key={d.value}
                                className={`batch-doc-btn ${docType === d.value ? 'active' : ''}`}
                                onClick={() => setDocType(d.value)}
                            >
                                {d.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="batch-config-item">
                    <label className="batch-label">Ghi chú (áp dụng cho tất cả)</label>
                    <input
                        type="text"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        className="batch-note-input"
                        placeholder="Ghi chú chung..."
                    />
                </div>
            </div>

            {/* ── Drop Zone ── */}
            <div
                className={`batch-dropzone ${dragOver ? 'drag-over' : ''} ${files.length > 0 ? 'has-files' : ''}`}
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => document.getElementById(`batch-input-${source}`).click()}
            >
                <input
                    id={`batch-input-${source}`}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    style={{ display: 'none' }}
                    onChange={e => handleFiles(e.target.files)}
                />
                {files.length === 0 ? (
                    <>
                        <div className="batch-drop-title">
                            Kéo thả nhiều file vào đây hoặc click để chọn
                        </div>
                        <div className="batch-drop-sub">
                            PDF, JPG, PNG · Tối đa {MAX_FILES} file · 10MB/file
                        </div>
                    </>
                ) : (
                    <div className="batch-drop-count">
                        {files.length} file đã chọn — Click để thêm
                    </div>
                )}
            </div>

            {/* ── File list ── */}
            {files.length > 0 && (
                <div className="batch-file-list">
                    {files.map((f, i) => (
                        <div key={i} className="batch-file-item">
                            {/* <span className="batch-file-icon">
                                {f.type === 'application/pdf' ? '📄' : '🖼️'}
                            </span> */}
                            <span className="batch-file-name">{f.name}</span>
                            <span className="batch-file-size">
                                {(f.size / 1024 / 1024).toFixed(1)}MB
                            </span>
                            <button
                                className="batch-file-remove"
                                onClick={e => { e.stopPropagation(); removeFile(i) }}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Message ── */}
            {message && (
                <div className={`batch-message batch-message-${message.type}`}>
                    {message.text}
                </div>
            )}

            {/* ── Submit ── */}
            <div className="batch-actions">
                {files.length > 0 && (
                    <button
                        className="batch-btn-clear"
                        onClick={() => setFiles([])}
                    >
                        Xóa tất cả
                    </button>
                )}
                <button
                    className="batch-btn-submit"
                    onClick={handleSubmit}
                    disabled={uploading || files.length === 0}
                >
                    {uploading
                        ? `Đang upload ${files.length} file...`
                        : `Upload & OCR ${files.length} file`}
                </button>
            </div>

            {/* ── Processing list ── */}
            {processing.length > 0 && (
                <div className="batch-processing">
                    <div className="batch-section-title">
                        Đang xử lý ({processing.length})
                    </div>
                    {processing.map(item => (
                        <div key={item.id} className="batch-process-item">
                            <div className="batch-process-header">
                                <span className="batch-process-name">
                                    {item.file_name}
                                </span>
                                <span className="batch-process-stage">
                                    {item.stage}
                                </span>
                                <span className="batch-process-pct">
                                    {item.percent}%
                                </span>
                            </div>
                            <div className="batch-progress-bar">
                                <div
                                    className="batch-progress-fill"
                                    style={{ width: `${item.percent}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Done list ── */}
            {done.length > 0 && (
                <div className="batch-done">
                    <div className="batch-section-title">
                        Đã xử lý ({done.length})
                    </div>
                    {done.map(item => (
                        <div
                            key={item.id}
                            className={`batch-done-item ${
                                item.ocr_status === 'failed' ? 'failed' :
                                item.auto_saved ? 'auto-saved' : 'need-review'
                            }`}
                        >
                            <span className="batch-done-name">{item.file_name}</span>
                            <div className="batch-done-right">
                                {item.confidence_score && (
                                    <span className={`batch-confidence ${
                                        item.confidence_score >= 80 ? 'high' :
                                        item.confidence_score >= 60 ? 'medium' : 'low'
                                    }`}>
                                        {item.confidence_score}%
                                    </span>
                                )}
                                <span className="batch-done-stage">
                                    {item.stage}
                                </span>
                                {item.ocr_status === 'done' && (
                                    <a
                                        href={`/invoicedetail/${item.id}`}
                                        className="batch-done-link"
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Xem
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default BatchUpload