import React, { useEffect, useState, useCallback } from 'react'
import { connect } from 'react-redux'
import {fetchCompanies, fetchInvoices, createInvoice, deleteInvoice, qualityCheckAll} from '../../reducer/invoicesupgrade/InvoiceActions'
import '../../css/import.css'
import { Link } from 'react-router-dom'
import QualityCheckAll from '../../component/QualityCheckAll'

const DOCUMENT_TYPES = [
    { value: 'invoice', label: 'Hóa đơn' },
    { value: 'receipt', label: 'Phiếu thu' },
    { value: 'payment', label: 'Phiếu chi' },
    { value: 'warehouse', label: 'Phiếu nhập kho' },
]

const DETAIL_FIELDS = {
    invoice: [
        { name: 'invoice_date', label: 'Ngày', type: 'date'   },
        { name: 'seller_name', label: 'Tên cửa hàng', type: 'text'   },
        { name: 'payment_method', label: 'Phương thức TT',  type: 'text'   },
        { name: 'subtotal', label: 'Tạm tính', type: 'number' },
        { name: 'total_discount', label: 'Tổng giảm giá', type: 'number' },
        { name: 'tax_amount', label: 'Thuế', type: 'number' },
        { name: 'total_amount', label: 'Tổng tiền', type: 'number' },
        { name: 'received_amount',label: 'Tiền khách đưa', type: 'number' },
        { name: 'change_amount', label: 'Tiền thừa', type: 'number' },
    ],
    receipt: [
        { name: 'invoice_code', label: 'Số phiếu', type: 'text' },
        { name: 'receipt_date', label: 'Ngày thu', type: 'date' },
        { name: 'payer_name', label: 'Tên người nộp', type: 'text' },
        { name: 'payer_address', label: 'Địa chỉ', type: 'text' },
        { name: 'reason', label: 'Lý do thu', type: 'text' },
        { name: 'payment_method', label: 'Hình thức TT', type: 'text' },
        { name: 'total_amount', label: 'Số tiền', type: 'number' },
        { name: 'cashier', label: 'Thu ngân', type: 'text' },
        { name: 'accountant', label: 'Kế toán', type: 'text' },
    ],
    payment: [
        { name: 'invoice_code', label: 'Số phiếu', type: 'text' },
        { name: 'payment_date', label: 'Ngày chi', type: 'date' },
        { name: 'payee_name', label: 'Tên người nhận', type: 'text' },
        { name: 'payee_address', label: 'Địa chỉ', type: 'text' },
        { name: 'reason', label: 'Lý do chi', type: 'text' },
        { name: 'payment_method', label: 'Hình thức TT', type: 'text' },
        { name: 'total_amount', label: 'Số tiền', type: 'number' },
        { name: 'cashier', label: 'Thủ quỹ', type: 'text' },
        { name: 'accountant', label: 'Kế toán', type: 'text' },
    ],
    warehouse: [
        { name: 'invoice_code', label: 'Số phiếu', type: 'text' },
        { name: 'warehouse_date', label: 'Ngày nhập', type: 'date' },
        { name: 'warehouse_name', label: 'Tên kho', type: 'text' },
        { name: 'supplier_name', label: 'Nhà cung cấp', type: 'text' },
        { name: 'supplier_address', label: 'Địa chỉ NCC', type: 'text' },
        { name: 'delivery_person', label: 'Người giao hàng',type: 'text' },
        { name: 'total_quantity', label: 'Tổng số lượng', type: 'number' },
        { name: 'total_amount', label: 'Tổng tiền', type: 'number' },
        { name: 'warehouse_keeper', label: 'Thủ kho', type: 'text' },
        { name: 'accountant', label: 'Kế toán', type: 'text' },
    ],
}

const DEFAULT_ITEM = {
    item_name: '', unit: '', quantity: '',
    unit_price: '', total_price: '', tax_rate: '', note: ''
}

const Import = (props) => {
    const { companies, invoices } = props

    const [documentType, setDocumentType] = useState('invoice')
    const [companyName, setCompanyName] = useState('')
    const [detailData,   setDetailData] = useState({})
    const [items, setItems] = useState([{ ...DEFAULT_ITEM }])
    const [note, setNote] = useState('')
    const [file, setFile] = useState(null)
    const [preview, setPreview] = useState(null)
    const [dragOver, setDragOver] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [qcAllResult, setQcAllResult] = useState(null)
    const [showQCAll,   setShowQCAll] = useState(false)
    const [checkingAll, setCheckingAll] = useState(false)
    const [message, setMessage] = useState({ text: '', type: '' })

    useEffect(() => {
        props.fetchCompanies()
        props.fetchInvoices()
    }, [])

    useEffect(() => {
        setDetailData({})
        setItems([{ ...DEFAULT_ITEM }])
    }, [documentType])

    const handleQCAll = async () => {
        setCheckingAll(true)
        const result = await props.qualityCheckAll('manual')
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

    const handleDetailChange = (e) => {
        setDetailData({ ...detailData, [e.target.name]: e.target.value })
    }

    const handleItemChange = (index, e) => {
        const newItems = [...items]
        newItems[index][e.target.name] = e.target.value
        if (e.target.name === 'quantity' || e.target.name === 'unit_price') {
            const qty   = parseFloat(newItems[index].quantity)   || 0
            const price = parseFloat(newItems[index].unit_price) || 0
            newItems[index].total_price = (qty * price).toString()
        }
        setItems(newItems)
    }

    const addItem    = () => setItems([...items, { ...DEFAULT_ITEM }])
    const removeItem = (index) => setItems(items.filter((_, i) => i !== index))

    const handleReset = () => {
        setCompanyName('')
        setDetailData({})
        setItems([{ ...DEFAULT_ITEM }])
        setNote('')
        setFile(null)
        setPreview(null)
        setMessage({ text: '', type: '' })
    }

    const handleSubmit = async () => {
        if (!file) {
            setMessage({ text: 'Vui lòng chọn file', type: 'error' })
            return
        }

        const finalDetail = (documentType === 'invoice' || documentType === 'warehouse')
            ? { ...detailData, items }
            : { ...detailData }

        const formData = new FormData()
        formData.append('file', file)
        formData.append('document_type', documentType)
        formData.append('company_name', companyName)
        formData.append('note', note)
        formData.append('detail_data', JSON.stringify(finalDetail))

        setSubmitting(true)
        const result = await props.createInvoice(formData)
        setSubmitting(false)

        if (result.success) {
            setMessage({ text: 'Upload thành công!', type: 'success' })
            handleReset()
        } else {
            setMessage({ text: 'Upload thất bại, thử lại!', type: 'error' })
        }
    }

    const handleDelete = async (id) => {
        if (window.confirm('Bạn chắc muốn xóa?')) {
            await props.deleteInvoice(id)
        }
    }

    const getOcrClass = (status) => `ocr-badge ${status || 'pending'}`
    const getOcrLabel = (status) => {
        const map = {
            done: 'Done', failed: 'Failed',
            processing: 'Processing', pending: 'Pending'
        }
        return map[status] || 'Pending'
    }
    const getUploadZoneClass = () => {
        if (dragOver) return 'upload-zone drag-over'
        if (file)     return 'upload-zone has-file'
        return 'upload-zone'
    }
    const hasItems = documentType === 'invoice' || documentType === 'warehouse'

    return (
        <div className="import-page">
            <div className="import-header">
                <div className="import-header-left">
                    <span className="import-invoice-number">
                        Invoice <span>#Import</span>
                    </span>
                    <span className="import-status-badge">New</span>
                </div>
                <div className="import-header-right">
                    <button
                        className="btn-qc-all"
                        onClick={handleQCAll}
                        disabled={checkingAll}
                    >
                        {checkingAll
                            ? 'Đang kiểm tra...'
                            : 'Kiểm tra tất cả'}
                    </button>
                    <button className="btn-reset" onClick={handleReset}>
                        Xóa Form
                    </button>
                    <button className="btn-save" onClick={handleSubmit} disabled={submitting}>
                        {submitting ? 'Đang lưu...' : 'Lưu'}
                    </button>
                </div>
            </div>
            {message.text && (
                <div className={`import-alert ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="doc-type-bar">
                {DOCUMENT_TYPES.map(dt => (
                    <button
                        key={dt.value}
                        className={`doc-type-btn ${documentType === dt.value ? 'active' : ''}`}
                        onClick={() => setDocumentType(dt.value)}
                    >
                        {dt.label}
                    </button>
                ))}
            </div>

            <div className="import-main-layout">
                <div className="import-card">
                    <div className="import-card-header">
                        {DOCUMENT_TYPES.find(d => d.value === documentType)?.label}
                    </div>
                    <div className="import-card-body">
                        <div className="form-group">
                            <label className="form-label">Tên Công Ty</label>
                            <input
                                list="companies-list"
                                value={companyName}
                                onChange={e => setCompanyName(e.target.value)}
                                className="form-input"
                                placeholder="Chọn hoặc nhập tên công ty mới..."
                            />
                            <datalist id="companies-list">
                                {companies.map(c => (
                                    <option key={c.id} value={c.name} />
                                ))}
                            </datalist>
                            <small className="form-hint">
                                Nhập tên mới sẽ tự động tạo công ty
                            </small>
                        </div>
                        <div className="form-grid">
                            {DETAIL_FIELDS[documentType].map(field => (
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
                                        {documentType === 'invoice'
                                            ? 'Danh sách mặt hàng'
                                            : 'Danh sách hàng hóa'}
                                    </span>
                                    <button className="btn-add-item" onClick={addItem}>
                                        + Thêm hàng
                                    </button>
                                </div>
                                <div className={`item-row item-row-header ${documentType === 'invoice' ? 'item-row-invoice' : 'item-row-warehouse'}`}>
                                    <span>Tên hàng</span>
                                    <span>ĐVT</span>
                                    <span>SL</span>
                                    <span>Đơn giá</span>
                                    {documentType === 'invoice' && <span>% Thuế</span>}
                                    <span>Thành tiền</span>
                                    <span></span>
                                </div>
                                {items.map((item, index) => (
                                    <div key={index} className={`item-row ${documentType === 'invoice' ? 'item-row-invoice' : 'item-row-warehouse'}`}>
                                        <input
                                            name="item_name"
                                            value={item.item_name}
                                            onChange={e => handleItemChange(index, e)}
                                            className="form-input"
                                            placeholder="Tên hàng"
                                        />
                                        <input
                                            name="unit"
                                            value={item.unit}
                                            onChange={e => handleItemChange(index, e)}
                                            className="form-input"
                                            placeholder="ĐVT"
                                        />
                                        <input
                                            name="quantity"
                                            type="number"
                                            value={item.quantity}
                                            onChange={e => handleItemChange(index, e)}
                                            className="form-input"
                                            placeholder="0"
                                        />
                                        <input
                                            name="unit_price"
                                            type="number"
                                            value={item.unit_price}
                                            onChange={e => handleItemChange(index, e)}
                                            className="form-input"
                                            placeholder="0"
                                        />
                                        {documentType === 'invoice' && (
                                            <input
                                                name="tax_rate"
                                                type="number"
                                                value={item.tax_rate}
                                                onChange={e => handleItemChange(index, e)}
                                                className="form-input"
                                                placeholder="%"
                                            />
                                        )}
                                        <input
                                            name="total_price"
                                            type="number"
                                            value={item.total_price}
                                            className="form-input"
                                            placeholder="0"
                                            readOnly
                                        />
                                        {items.length > 1 && (
                                            <button
                                                className="btn-remove-item"
                                                onClick={() => removeItem(index)}
                                            >
                                                ✕
                                            </button>
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
                                placeholder="Ghi chú thêm (tuỳ chọn)..."
                            />
                        </div>
                    </div>
                </div>

                <div className="import-card">
                    <div className="import-card-header">Upload File</div>
                    <div className="import-card-body">
                        <div
                            className={getUploadZoneClass()}
                            onDrop={handleDrop}
                            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                            onDragLeave={() => setDragOver(false)}
                            onClick={() => document.getElementById('fileInput').click()}
                        >
                            <input
                                id="fileInput"
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                style={{ display: 'none' }}
                                onChange={e => handleFile(e.target.files[0])}
                            />
                            {file ? (
                                <>
                                    <div className="upload-title success">{file.name}</div>
                                    <div className="upload-sub">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB · Click để đổi
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="upload-title">Kéo thả file vào đây</div>
                                    <div className="upload-sub">hoặc click để chọn</div>
                                    <div className="upload-sub">PDF, JPG, PNG · Tối đa 10MB</div>
                                </>
                            )}
                        </div>
                        {preview && (
                            <div className="upload-preview">
                                {file?.type === 'application/pdf'
                                    ? <iframe src={preview} title="preview" />
                                    : <img src={preview} alt="preview" />
                                }
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="import-table-card">
                <div className="import-table-header">
                    <div className="import-table-title">
                        Danh Sách Đã Import
                    </div>
                    <span className="import-count-badge">{invoices.length} Dữ liệu</span>
                </div>
                <table className="import-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Công Ty</th>
                            <th>Loại</th>
                            <th>Ghi chú</th>
                            {/* <th>OCR</th> */}
                            <th>Ngày tạo</th>
                            <th>Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoices.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="import-table-empty">
                                    Chưa có chứng từ nào được import
                                </td>
                            </tr>
                        ) : (
                            invoices.map((inv, index) => (
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
                                    {/* <td>
                                        <span className={getOcrClass(inv.ocr_status)}>
                                            {getOcrLabel(inv.ocr_status)}
                                        </span>
                                    </td> */}
                                    <td>{new Date(inv.created_at).toLocaleDateString('vi-VN')}</td>
                                    <td>
                                        <Link
                                            to={`/invoicedetail/${inv.id}`}
                                            className="btn-view"
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
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {showQCAll && qcAllResult && (
                <QualityCheckAll
                    result={qcAllResult}
                    onClose={() => setShowQCAll(false)}
                    onRecheck={async () => {
                        const result = await props.qualityCheckAll('manual')
                        if (result.success) setQcAllResult(result.data)
                    }}
                />
            )}
        </div>
    )
}

const mapStateToProps = (state) => ({
    companies: state.InvoiceManualReducer.companies,
    invoices:  state.InvoiceManualReducer.manualInvoices,
})

export default connect(mapStateToProps, {
    fetchCompanies,
    fetchInvoices,
    createInvoice,
    deleteInvoice,
    qualityCheckAll,
})(Import)