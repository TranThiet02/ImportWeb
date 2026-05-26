import TYPE from '../Type'

const initialState = {
    aiInvoices: [],
    error: null,
}

const InvoiceAIReducer = (state = initialState, action) => {
    const { type, payload } = action
    switch (type) {
        case TYPE.FETCH_AI_INVOICES_SUCCESS:
            return { ...state, aiInvoices: payload }
        case TYPE.FETCH_AI_INVOICES_FAIL:
            return { ...state, aiInvoices: [] }

        case TYPE.CREATE_AI_INVOICE_SUCCESS:
            return { ...state, aiInvoices: [payload, ...state.aiInvoices] }
        case TYPE.CREATE_AI_INVOICE_FAIL:
            return { ...state, error: 'Tạo thất bại' }

        case TYPE.DELETE_AI_INVOICE_SUCCESS:
            return {
                ...state,
                aiInvoices: state.aiInvoices.filter(inv => inv.id !== payload)
            }
        case TYPE.DELETE_AI_INVOICE_FAIL:
            return { ...state, error: 'Xóa thất bại' }

        default:
            return state
    }
}

export default InvoiceAIReducer