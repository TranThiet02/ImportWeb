import TYPE from '../Type'
import axios from 'axios'

const BASE_URL = 'http://localhost:8000/userup'

const authHeader = () => ({
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('access')}`
    }
})

const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) return null
    try {
        const res = await axios.post(
            'http://localhost:8000/dj-rest-auth/token/refresh/',
            { refresh: refreshToken },
            { headers: { 'Content-Type': 'application/json' } }
        )
        localStorage.setItem('access', res.data.access)
        return res.data.access
    } catch {
        localStorage.removeItem('access')
        localStorage.removeItem('refresh_token')
        return null
    }
}

axios.interceptors.response.use(
    res => res,
    async error => {
        const originalRequest = error.config
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true
            const newToken = await refreshAccessToken()
            if (newToken) {
                originalRequest.headers['Authorization'] = `Bearer ${newToken}`
                return axios(originalRequest)
            }
        }
        return Promise.reject(error)
    }
)

export const fetchCompanies = () => async dispatch => {
    try {
        const res = await axios.get(`${BASE_URL}/companiesup/`, authHeader())
        dispatch({ type: TYPE.FETCH_COMPANIES_SUCCESS, payload: res.data })
    } catch {
        dispatch({ type: TYPE.FETCH_COMPANIES_FAIL })
    }
}

export const fetchInvoices = (filters = {}) => async dispatch => {
    try {
        const params = new URLSearchParams(filters).toString()
        const res = await axios.get(
            `${BASE_URL}/invoicesup/${params ? '?' + params : ''}`,
            authHeader()
        )
        dispatch({ type: TYPE.FETCH_MANUAL_INVOICES_SUCCESS, payload: res.data })
    } catch {
        dispatch({ type: TYPE.FETCH_MANUAL_INVOICES_FAIL })
    }
}

export const createInvoice = (formData) => async dispatch => {
    try {
        const res = await axios.post(`${BASE_URL}/invoicesup/`, formData, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'Content-Type': 'multipart/form-data'
            }
        })
        dispatch({ type: TYPE.CREATE_MANUAL_INVOICE_SUCCESS, payload: res.data })
        return { success: true }
    } catch (err) {
        dispatch({ type: TYPE.CREATE_MANUAL_INVOICE_FAIL })
        return { success: false, error: err.response?.data }
    }
}

export const deleteInvoice = (id) => async dispatch => {
    try {
        await axios.delete(`${BASE_URL}/invoicesup/${id}/`, authHeader())
        dispatch({ type: TYPE.DELETE_MANUAL_INVOICE_SUCCESS, payload: id })
    } catch {
        dispatch({ type: TYPE.DELETE_MANUAL_INVOICE_FAIL })
    }
}

export const updateInvoice = (id, formData) => async dispatch => {
    try {
        const res = await axios.put(`${BASE_URL}/invoicesup/${id}/`, formData, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'Content-Type': 'multipart/form-data'
            }
        })
        dispatch({ type: TYPE.UPDATE_INVOICE_SUCCESS, payload: res.data })
        return { success: true }
    } catch (err) {
        dispatch({ type: TYPE.UPDATE_INVOICE_FAIL })
        return { success: false, error: err.response?.data }
    }
}

export const fetchInvoiceById = (id) => async dispatch => {
    try {
        const res = await axios.get(`${BASE_URL}/invoicesup/${id}/`, authHeader())
        console.log('DATA', res.data)
        dispatch({ type: TYPE.FETCH_INVOICE_DETAIL_SUCCESS, payload: res.data })
        console.log(TYPE.FETCH_INVOICE_DETAIL_SUCCESS)
    } catch (err) {
        console.log(err)
        dispatch({ type: TYPE.FETCH_INVOICE_DETAIL_FAIL })
    }
}

export const updateInvoiceDetail = (id, formData) => async dispatch => {
    try {
        const res = await axios.put(`${BASE_URL}/invoicesup/${id}/`, formData, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'Content-Type': 'multipart/form-data'
            }
        })
        dispatch({ type: TYPE.UPDATE_INVOICE_SUCCESS, payload: res.data })
        return { success: true }
    } catch (err) {
        dispatch({ type: TYPE.UPDATE_INVOICE_FAIL })
        return { success: false, error: err.response?.data }
    }
}