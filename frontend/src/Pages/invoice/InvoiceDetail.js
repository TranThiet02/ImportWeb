import React, { useEffect, useState } from 'react'
import { connect } from 'react-redux'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchInvoiceById, updateInvoiceDetail, updateInvoice } from '../../reducer/invoicesupgrade/InvoiceActions'
import '../../css/ImportDetail.css'
// import AuditResult from '../../component/AuditResult'
// import { auditInvoice } from '../../reducer/invoicesupgrade/InvoiceActions'
import QualityResult from '../../component/QualityResult'
import { qualityCheckInvoice } from '../../reducer/invoicesupgrade/InvoiceActions'
import { qualityCheckAIInvoice } from '../../reducer/invoiceai/InvoiceAIActions'
import { qualityCheckGeminiInvoice } from '../../reducer/invoicegemini/InvoiceGeminiActions'
import { buildMediaUrl } from '../../config/api'
import VerifyResult from '../../component/VerifyResult'
import { verifyInvoiceImage } from '../../reducer/invoicesupgrade/InvoiceActions'
import { verifyAIInvoiceImage } from '../../reducer/invoiceai/InvoiceAIActions'
import { verifyGeminiInvoiceImage } from '../../reducer/invoicegemini/InvoiceGeminiActions'

const DOCUMENT_TYPES = [
    { value: 'invoice', label: 'Hóa đơn VAT' },
    { value: 'receipt', label: 'Phiếu thu' },
    { value: 'payment', label: 'Phiếu chi' },
    { value: 'warehouse', label: 'Phiếu nhập kho' },
]

const DETAIL_FIELDS = {
    invoice: [
        { name: 'invoice_date', label: 'Ngày', type: 'date'   },
        { name: 'seller_name', label: 'Tên cửa hàng',    type: 'text'   },
        { name: 'payment_method', label: 'Phương thức TT',  type: 'text'   },
        { name: 'subtotal', label: 'Tạm tính', type: 'number' },
        { name: 'total_discount', label: 'Tổng giảm giá',   type: 'number' },
        { name: 'tax_amount', label: 'Thuế', type: 'number' },
        { name: 'total_amount', label: 'Tổng tiền', type: 'number' },
        { name: 'received_amount',label: 'Tiền khách đưa',  type: 'number' },
        { name: 'change_amount', label: 'Tiền thừa', type: 'number' },
    ],
    receipt: [
        { name: 'invoice_code', label: 'Số phiếu', type: 'text'   },
        { name: 'receipt_date', label: 'Ngày thu', type: 'date'   },
        { name: 'payer_name', label: 'Tên người nộp', type: 'text'   },
        { name: 'payer_address', label: 'Địa chỉ', type: 'text' },
        { name: 'reason', label: 'Lý do thu', type: 'text'   },
        { name: 'payment_method', label: 'Hình thức TT', type: 'text'   },
        { name: 'total_amount', label: 'Số tiền', type: 'number' },
        { name: 'cashier', label: 'Thu ngân', type: 'text'   },
        { name: 'accountant', label: 'Kế toán', type: 'text'   },
    ],
    payment: [
        { name: 'invoice_code', label: 'Số phiếu', type: 'text'   },
        { name: 'payment_date', label: 'Ngày chi', type: 'date'   },
        { name: 'payee_name', label: 'Tên người nhận',  type: 'text'   },
        { name: 'payee_address', label: 'Địa chỉ', type: 'text'   },
        { name: 'reason', label: 'Lý do chi', type: 'text'   },
        { name: 'payment_method', label: 'Hình thức TT', type: 'text'   },
        { name: 'total_amount', label: 'Số tiền', type: 'number' },
        { name: 'cashier', label: 'Thủ quỹ', type: 'text'   },
        { name: 'accountant', label: 'Kế toán', type: 'text'   },
    ],
    warehouse: [
        { name: 'invoice_code', label: 'Số phiếu', type: 'text'   },
        { name: 'warehouse_date', label: 'Ngày nhập', type: 'date'   },
        { name: 'warehouse_name', label: 'Tên kho', type: 'text'   },
        { name: 'supplier_name', label: 'Nhà cung cấp', type: 'text'   },
        { name: 'supplier_address', label: 'Địa chỉ NCC', type: 'text'   },
        { name: 'delivery_person', label: 'Người giao hàng', type: 'text'   },
        { name: 'total_quantity', label: 'Tổng số lượng', type: 'number' },
        { name: 'total_amount', label: 'Tổng tiền', type: 'number' },
        { name: 'warehouse_keeper', label: 'Thủ kho', type: 'text'   },
        { name: 'accountant', label: 'Kế toán', type: 'text'   },
    ],
}

const DEFAULT_ITEM = {
    item_name: '', unit: '', quantity: '',
    unit_price: '', total_price: '', tax_rate: '', note: ''
}

const getDetailData = (invoice) => {
    if (!invoice) return {}
    const detailKey = {
        invoice: 'vat_detail',
        receipt: 'receipt_detail',
        payment: 'payment_detail',
        warehouse: 'warehouse_detail',
    }[invoice.document_type]
    return invoice[detailKey] || {}
}

const InvoiceDetail = (props) => {
    const { id } = useParams()
    const navigate = useNavigate()
    const { currentInvoice } = props

    const [companyName, setCompanyName] = useState('')
    const [detailData, setDetailData] = useState({})
    const [items, setItems] = useState([{ ...DEFAULT_ITEM }])
    const [note, setNote] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState({ text: '', type: '' })
    const [loading, setLoading] = useState(true)
    const [qcResult, setQcResult] = useState(null)
    const [checking,  setChecking] = useState(false)
    const [showQC, setShowQC] = useState(false)
    const [verifyResult, setVerifyResult] = useState(null)
    const [verifying, setVerifying] = useState(false)
    const [showVerify, setShowVerify] = useState(false)

    const getVerifyAction = () => {
        const source = currentInvoice?.source
        if (source === 'ai') return props.verifyAIInvoiceImage
        if (source === 'gemini') return props.verifyGeminiInvoiceImage
        return props.verifyInvoiceImage
    }

    const handleVerify = async () => {
        setVerifying(true)
        const action = getVerifyAction()
        const result = await action(id)
        setVerifying(false)
        if (result.success) {
            setVerifyResult(result.data)
            setShowVerify(true)
        }
    }

    const handleFixField = (field, valueFromImage) => {
        setDetailData(prev => ({
            ...prev,
            [field]: valueFromImage
        }))
        setShowVerify(false)
        setMessage({
            text: `Đã cập nhật "${field}" từ ảnh gốc. Nhớ bấm Lưu!`,
            type: 'success'
        })
    }

    useEffect(() => {
        if (!currentInvoice) return

        if (currentInvoice.ocr_result?.manual_edit) {
            setQcResult(null)
            setShowQC(false)
            return
        }

        // Nếu OCR có kết quả từ background task
        const ocr_result = currentInvoice.ocr_result
        if (ocr_result?.quality) {
            setQcResult(ocr_result.quality)
            if (ocr_result.quality.status === 'invalid') {
                setShowQC(true)
            }
        } else {
            // Không có kết quả sẵn chạy QC lần đầu
            handleQualityCheck()
        }
    }, [currentInvoice])

    const getQualityCheckAction = () => {
        const source = currentInvoice?.source
        if (source === 'ai') return props.qualityCheckAIInvoice
        if (source === 'gemini') return props.qualityCheckGeminiInvoice
        return props.qualityCheckInvoice
    }

    const handleQualityCheck = async () => {
        setChecking(true)
        const action = getQualityCheckAction()
        const result = await action(id)
        setChecking(false)
        if (result.success) {
            setQcResult(result.data)
        }
    }

    const handleSave = async () => {
        setSubmitting(true)
        const docType = currentInvoice.document_type
        const hasItems = docType === 'invoice' || docType === 'warehouse'

        const cleanItems = items
            .filter(item => item.item_name.trim() !== '')
            .map(item => ({
                ...item,
                quantity: item.quantity || 0,
                unit_price: item.unit_price || 0,
                total_price: item.total_price || 0,
                tax_rate: item.tax_rate || 0,
            }))

        const finalDetail = hasItems
            ? { ...detailData, items: cleanItems }
            : { ...detailData }

        const formData = new FormData()
        formData.append('document_type', docType)
        formData.append('company_name', companyName)
        formData.append('note', note)
        formData.append('detail_data', JSON.stringify(finalDetail))

        const saveResult = await props.updateInvoice(id, formData)
        setSubmitting(false)

        if (!saveResult.success) {
            setMessage({ text: 'Cập nhật thất bại!', type: 'error' })
            return
        }

        setMessage({ text: 'Cập nhật thành công!', type: 'success' })

        await props.fetchInvoiceById(id)

        setTimeout(async () => {
            const action = getQualityCheckAction()
            const result = await action(id)
            if (result.success) {
                setQcResult(result.data)
                if (result.data.status === 'invalid') {
                    setShowQC(true)
                    setMessage({
                        text: 'Đã lưu nhưng vẫn còn lỗi dữ liệu!',
                        type: 'warning'
                    })
                } else {
                    setShowQC(false)
                }
            }
        }, 500)
    }
    // const [auditResult, setAuditResult] = useState(null)
    // const [auditing, setAuditing] = useState(false)
    // const [showAudit, setShowAudit] = useState(false)

    // const handleAudit = async () => {
    //     setAuditing(true)
    //     const result = await props.auditInvoice(id)
    //     setAuditing(false)
    //     if (result.success) {
    //         setAuditResult(result.data)
    //         setShowAudit(true)
    //     }
    // }

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            await props.fetchInvoiceById(id)
            // const result = await props.fetchInvoiceById(id)
            setLoading(false)
            // console.log('loading', loading)
            // console.log('currentInvoice', currentInvoice)
        }
        load()
    }, [id])

    useEffect(() => {
        console.log('CURRENT INVOICE UPDATED', currentInvoice)
    }, [currentInvoice])

    useEffect(() => {
        if (!currentInvoice) return 

        setCompanyName(currentInvoice.company_detail?.name || '')
        setNote(currentInvoice.note || '')

        const detail = getDetailData(currentInvoice)
        const { items: detailItems, ...rest } = detail
        setDetailData(rest)

        if (detailItems && detailItems.length > 0) {
            setItems(detailItems.map(item => ({
                item_name: item.item_name || '',
                unit: item.unit || '',
                quantity: item.quantity || '',
                unit_price: item.unit_price || '',
                total_price: item.total_price || '',
                tax_rate: item.tax_rate || '',
                note: item.note || '',
            })))
        }
    }, [currentInvoice])

    const handleDetailChange = (e) => {
        setDetailData({ ...detailData, [e.target.name]: e.target.value })
    }

    const handleItemChange = (index, e) => {
        const newItems = [...items]
        newItems[index][e.target.name] = e.target.value
        if (e.target.name === 'quantity' || e.target.name === 'unit_price') {
            const qty = parseFloat(newItems[index].quantity) || 0
            const price = parseFloat(newItems[index].unit_price) || 0
            newItems[index].total_price = (qty * price).toString()
        }
        setItems(newItems)
    }

    const addItem = () => setItems([...items, { ...DEFAULT_ITEM }])
    const removeItem = (index) => setItems(items.filter((_, i) => i !== index))

    // const handleSubmit = async () => {
    //     const docType = currentInvoice.document_type
    //     const hasItems = docType === 'invoice' || docType === 'warehouse'

    //     const cleanItems = items
    //     .filter(item => item.item_name.trim() !== '')
    //     .map(item => ({
    //         ...item,
    //         quantity: item.quantity || 0,
    //         unit_price: item.unit_price || 0,
    //         total_price: item.total_price || 0,
    //         tax_rate: item.tax_rate || 0,
    //     }))

    //     const finalDetail = hasItems
    //         ? { ...detailData, items: cleanItems }
    //         : { ...detailData }

    //     const formData = new FormData()
    //     formData.append('document_type', docType)
    //     formData.append('company_name', companyName)
    //     formData.append('note', note)
    //     formData.append('detail_data', JSON.stringify(finalDetail))

    //     setSubmitting(true)
    //     const result = await props.updateInvoice(id, formData)
    //     setSubmitting(false)

    //     if (result.success) {
    //         setMessage({ text: 'Cập nhật thành công!', type: 'success' })
    //         await props.fetchInvoiceById(id)
    //     } else {
    //         setMessage({ text: 'Cập nhật thất bại!', type: 'error' })
    //     }
    // }

    if (loading) return (
        <div className="detail-loading">
            <div className="detail-spinner"></div>
            <p>Đang tải dữ liệu...</p>
        </div>
    )

    if (!loading && !currentInvoice) return (
        <div className="detail-loading">
            <p>Không tìm thấy hóa đơn</p>
        </div>
    )

    const docType = currentInvoice.document_type
    const hasItems = docType === 'invoice' || docType === 'warehouse'
    const fileUrl = buildMediaUrl(currentInvoice.file)
    const isPdf = currentInvoice.file?.toLowerCase().includes('.pdf')

    return (
        <div className="detail-page">
            <div className="detail-header">
                <div className="detail-header-left">
                    <button className="btn-back" onClick={() => navigate('/import')}>
                        Quay lại
                    </button>
                    <span className="detail-title">
                        Chi Tiết <span>#{id}</span>
                    </span>
                    <span className="detail-doc-badge">
                        {DOCUMENT_TYPES.find(d => d.value === docType)?.label}
                    </span>
                    <span className={`detail-ocr-badge ${currentInvoice.ocr_status}`}>
                        {currentInvoice.ocr_status}
                    </span>
                    {/* {auditResult && (
                        <span
                            className={`audit-mini-badge audit-mini-${auditResult.risk_score.color}`}
                            onClick={() => setShowAudit(true)}
                            style={{ cursor: 'pointer' }}
                        >
                            Risk: {auditResult.risk_score.score}/100
                        </span>
                    )} */}
                    {qcResult && (
                        <span
                            className={`qc-mini-badge qc-mini-${qcResult.status}`}
                            onClick={() => setShowQC(true)}
                            style={{ cursor: 'pointer' }}
                            title="Xem chi tiết kiểm tra"
                        >
                            {qcResult.status === 'valid'   && 'Hợp lệ'}
                            {qcResult.status === 'warning' && `${qcResult.summary.warnings} cảnh báo`}
                            {qcResult.status === 'invalid' && `${qcResult.summary.errors} lỗi`}
                        </span>
                    )}
                </div>
                <div className="detail-header-right">
                    {/* <button
                        className="btn-audit"
                        onClick={handleAudit}
                        disabled={auditing}
                    >
                        {auditing ? 'Đang phân tích...' : 'AI Audit'}
                    </button> */}
                    <button
                        className="btn-verify"
                        onClick={handleVerify}
                        disabled={verifying}
                    >
                        {verifying ? 'Đang xác minh...' : 'Xác minh ảnh'}
                    </button>
                    <button
                        className="btn-quality-check"
                        onClick={() => { handleQualityCheck(); setShowQC(true) }}
                        disabled={checking}
                    >
                        {checking ? 'Đang kiểm tra...' : 'Kiểm tra'}
                    </button>
                    <button
                        className="btn-save"
                        onClick={handleSave}
                        disabled={submitting}
                    >
                        {submitting ? 'Đang lưu...' : 'Lưu'}
                    </button>
                </div>
            </div>
            {message.text && (
                <div className={`detail-alert ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="detail-main-layout">

                <div className="detail-card">
                    <div className="detail-card-header">
                        Thông Tin Chứng Từ
                    </div>
                    <div className="detail-card-body">

                        <div className="form-group">
                            <label className="form-label">Tên Công Ty</label>
                            <input
                                value={companyName}
                                onChange={e => setCompanyName(e.target.value)}
                                className="form-input"
                                placeholder="Tên công ty..."
                            />
                        </div>

                        <div className="form-grid">
                            {DETAIL_FIELDS[docType]?.map(field => (
                                <div key={field.name} className="form-group">
                                    <label className="form-label">{field.label}</label>
                                    <input
                                        type={field.type}
                                        name={field.name}
                                        value={detailData[field.name] || ''}
                                        onChange={handleDetailChange}
                                        className="form-input"
                                        placeholder={field.label}
                                    />
                                </div>
                            ))}
                        </div>

                        {hasItems && (
                            <div className="items-section">
                                <div className="items-header">
                                    <span>
                                        {docType === 'invoice'
                                            ? 'Danh sách mặt hàng'
                                            : 'Danh sách hàng hóa'}
                                    </span>
                                    <button className="btn-add-item" onClick={addItem}>
                                        + Thêm hàng
                                    </button>
                                </div>

                                <div className={`item-row item-row-header ${docType === 'invoice' ? 'item-row-invoice' : 'item-row-warehouse'}`}>
                                    <span>Tên hàng</span>
                                    <span>ĐVT</span>
                                    <span>SL</span>
                                    <span>Đơn giá</span>
                                    {docType === 'invoice' && <span>% Thuế</span>}
                                    <span>Thành tiền</span>
                                    <span></span>
                                </div>

                                {items.map((item, index) => (
                                    <div key={index} className={`item-row ${docType === 'invoice' ? 'item-row-invoice' : 'item-row-warehouse'}`}>
                                        <input name="item_name"  value={item.item_name}  onChange={e => handleItemChange(index, e)} className="form-input" placeholder="Tên hàng" />
                                        <input name="unit"       value={item.unit}       onChange={e => handleItemChange(index, e)} className="form-input" placeholder="ĐVT" />
                                        <input name="quantity"   value={item.quantity}   onChange={e => handleItemChange(index, e)} className="form-input" type="number" placeholder="0" />
                                        <input name="unit_price" value={item.unit_price} onChange={e => handleItemChange(index, e)} className="form-input" type="number" placeholder="0" />
                                        {docType === 'invoice' && (
                                            <input name="tax_rate" value={item.tax_rate} onChange={e => handleItemChange(index, e)} className="form-input" type="number" placeholder="%" />
                                        )}
                                        <input name="total_price" value={item.total_price} className="form-input" type="number" placeholder="0" readOnly />
                                        {items.length > 1 && (
                                            <button className="btn-remove-item" onClick={() => removeItem(index)}>✕</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Ghi Chú</label>
                            <textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                className="form-textarea"
                                placeholder="Ghi chú..."
                            />
                        </div>
                    </div>
                </div>

                <div className="detail-card">
                    <div className="detail-card-header">
                        File
                        <a
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-open-file"
                        >
                            Mở file
                        </a>
                    </div>
                    <div className="detail-card-body detail-preview-body">
                        {isPdf ? (
                            <iframe
                                src={fileUrl}
                                title="invoice-preview"
                                className="detail-preview-iframe"
                            />
                        ) : (
                            <img
                                src={fileUrl}
                                alt="invoice"
                                className="detail-preview-img"
                            />
                        )}
                    </div>
                </div>
            </div>
            {/* {showAudit && auditResult && (
                <AuditResult
                    result={auditResult}
                    onClose={() => setShowAudit(false)}
                />
            )} */}
            {/* Modal Quality Check */}
            {showQC && qcResult && (
                <QualityResult
                    result={qcResult}
                    onClose={() => setShowQC(false)}
                    onSave={qcResult.can_save ? async () => {
                        setShowQC(false)
                        await handleSave()
                    } : null}
                />
            )}
            {showVerify && verifyResult && (
                <VerifyResult
                    result={verifyResult}
                    onClose={() => setShowVerify(false)}
                    onFixField={handleFixField}
                />
            )}
        </div>
    )
}

const mapStateToProps = (state) => ({
    currentInvoice: state.InvoiceManualReducer.currentInvoice,
})

export default connect(mapStateToProps, {
    fetchInvoiceById,
    updateInvoice,
    updateInvoiceDetail,
    // auditInvoice,
    qualityCheckInvoice,
    qualityCheckAIInvoice,
    qualityCheckGeminiInvoice,
    verifyInvoiceImage,
    verifyAIInvoiceImage,
    verifyGeminiInvoiceImage,
})(InvoiceDetail)