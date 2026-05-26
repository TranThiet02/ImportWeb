import TYPE from '../Type'

const initialState = {
    companies:       [],
    manualInvoices:  [],
    currentInvoice:  null,
    error:           null,
}

const InvoiceManualReducer = (state = initialState, action) => {
    const { type, payload } = action
    switch (type) {

        case TYPE.FETCH_COMPANIES_SUCCESS:
            return { ...state, companies: payload }
        case TYPE.FETCH_COMPANIES_FAIL:
            return { ...state, companies: [] }

        case TYPE.FETCH_MANUAL_INVOICES_SUCCESS:
            return { ...state, manualInvoices: payload }
        case TYPE.FETCH_MANUAL_INVOICES_FAIL:
            return { ...state, manualInvoices: [] }

        case TYPE.CREATE_MANUAL_INVOICE_SUCCESS:
            return { ...state, manualInvoices: [payload, ...state.manualInvoices] }
        case TYPE.CREATE_MANUAL_INVOICE_FAIL:
            return { ...state, error: 'Tạo thất bại' }

        case TYPE.DELETE_MANUAL_INVOICE_SUCCESS:
            return {
                ...state,
                manualInvoices: state.manualInvoices.filter(inv => inv.id !== payload)
            }
        case TYPE.DELETE_MANUAL_INVOICE_FAIL:
            return { ...state, error: 'Xóa thất bại' }

        case TYPE.FETCH_INVOICE_DETAIL_SUCCESS:
            return { ...state, currentInvoice: payload }
        case TYPE.FETCH_INVOICE_DETAIL_FAIL:
            return { ...state, currentInvoice: null }

        case TYPE.UPDATE_INVOICE_SUCCESS:
            return {
                ...state,
                currentInvoice: payload,
                manualInvoices: state.manualInvoices.map(inv =>
                    inv.id === payload.id ? payload : inv
                )
            }

        default:
            return state
    }
}

export default InvoiceManualReducer