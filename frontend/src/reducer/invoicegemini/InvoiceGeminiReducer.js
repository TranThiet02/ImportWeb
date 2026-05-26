import TYPE from '../Type'

const initialState = {
    geminiInvoices: [],
    error: null,
}

const InvoiceGeminiReducer = (state = initialState, action) => {
    const { type, payload } = action
    switch (type) {
        case TYPE.FETCH_GEMINI_INVOICES_SUCCESS:
            return { ...state, geminiInvoices: payload }
        case TYPE.FETCH_GEMINI_INVOICES_FAIL:
            return { ...state, geminiInvoices: [] }
        case TYPE.CREATE_GEMINI_INVOICE_SUCCESS:
            return { ...state, geminiInvoices: [payload, ...state.geminiInvoices] }
        case TYPE.CREATE_GEMINI_INVOICE_FAIL:
            return { ...state, error: 'Tạo thất bại' }
        case TYPE.DELETE_GEMINI_INVOICE_SUCCESS:
            return {
                ...state,
                geminiInvoices: state.geminiInvoices.filter(inv => inv.id !== payload)
            }
        case TYPE.DELETE_GEMINI_INVOICE_FAIL:
            return { ...state, error: 'Xóa thất bại' }
        default:
            return state
    }
}

export default InvoiceGeminiReducer