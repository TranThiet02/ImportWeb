import TYPE from '../Type'

const initialState = {
    companies: [],
    invoiceTypes: [],
    categories: [],
    invoices: [],
    currentInvoice: null,
    loading: false,
    error: null
}

const InvoiceReducer = (state = initialState, action) => {
    // console.log('REDUCER STATE', state)
    // console.log('ACTION', action)
    const { type, payload } = action
    switch (type) {

        case TYPE.FETCH_COMPANIES_SUCCESS:
            return { ...state, companies: payload }
        case TYPE.FETCH_COMPANIES_FAIL:
            return { ...state, companies: [] }

        case TYPE.FETCH_INVOICE_TYPES_SUCCESS:
            return { ...state, invoiceTypes: payload }
        case TYPE.FETCH_INVOICE_TYPES_FAIL:
            return { ...state, invoiceTypes: [] }

        case TYPE.FETCH_CATEGORIES_SUCCESS:
            return { ...state, categories: payload }
        case TYPE.FETCH_CATEGORIES_FAIL:
            return { ...state, categories: [] }

        case TYPE.FETCH_INVOICES_SUCCESS:
            return { ...state, invoices: payload }
        case TYPE.FETCH_INVOICES_FAIL:
            return { ...state, invoices: [] }

        case TYPE.CREATE_INVOICE_SUCCESS:
            return { ...state, invoices: [payload, ...state.invoices] }
        case TYPE.CREATE_INVOICE_FAIL:
            return { ...state, error: 'tao hoa don that bai' }

        case TYPE.DELETE_INVOICE_SUCCESS:
            return {
                ...state,
                invoices: state.invoices.filter(inv => inv.id !== payload)
            }
        case TYPE.DELETE_INVOICE_FAIL:
            return { ...state, error: 'xoa hoa don that bai' }

        case TYPE.FETCH_INVOICE_DETAIL_SUCCESS:
            // console.log(TYPE.FETCH_INVOICE_DETAIL_SUCCESS)
            // console.log('SUCCESS REDUCER HIT')
            // console.log('PAYLOAD', payload)
            return { ...state, currentInvoice: payload }
        case TYPE.FETCH_INVOICE_DETAIL_FAIL:
            return { ...state, currentInvoice: null }

        case TYPE.UPDATE_INVOICE_SUCCESS:
            return {
                ...state,
                invoices: state.invoices.map(inv =>
                    inv.id === payload.id ? payload : inv
                )
            }
        case TYPE.UPDATE_INVOICE_FAIL:
            return { ...state, error: 'cap nhat hoa don that bai' }

        default:
            return state
    }
}

export default InvoiceReducer