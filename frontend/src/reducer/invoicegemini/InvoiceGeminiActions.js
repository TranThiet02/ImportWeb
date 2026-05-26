import TYPE from '../Type'
import axios from 'axios'

const BASE_URL = 'http://localhost:8000/api/gemini'

const authHeader = () => ({
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('access')}`
    }
})

export const fetchGeminiInvoices = () => async dispatch => {
    try {
        const res = await axios.get(`${BASE_URL}/invoices-gemini/`, authHeader())
        dispatch({ type: TYPE.FETCH_GEMINI_INVOICES_SUCCESS, payload: res.data })
    } catch {
        dispatch({ type: TYPE.FETCH_GEMINI_INVOICES_FAIL })
    }
}

export const createGeminiInvoice = (formData) => async dispatch => {
    try {
        const res = await axios.post(`${BASE_URL}/invoices-gemini/`, formData, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'Content-Type': 'multipart/form-data'
            }
        })
        dispatch({ type: TYPE.CREATE_GEMINI_INVOICE_SUCCESS, payload: res.data })
        return { success: true, data: res.data }
    } catch (err) {
        dispatch({ type: TYPE.CREATE_GEMINI_INVOICE_FAIL })
        return { success: false, error: err.response?.data }
    }
}

export const fetchGeminiOcrStatus = (id) => async dispatch => {
    try {
        const res = await axios.get(
            `${BASE_URL}/invoices-gemini/${id}/ocr-status/`,
            authHeader()
        )
        return res.data
    } catch {
        return null
    }
}

export const deleteGeminiInvoice = (id) => async dispatch => {
    try {
        await axios.delete(`${BASE_URL}/invoices-gemini/${id}/`, authHeader())
        dispatch({ type: TYPE.DELETE_GEMINI_INVOICE_SUCCESS, payload: id })
    } catch {
        dispatch({ type: TYPE.DELETE_GEMINI_INVOICE_FAIL })
    }
}