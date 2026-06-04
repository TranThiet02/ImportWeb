import TYPE from '../Type'
import axios from 'axios'
import { buildApiUrl } from '../../config/api'

const BASE_URL = buildApiUrl('/api/ai')

const authHeader = () => ({
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('access')}`
    }
})

export const fetchAIInvoices = () => async dispatch => {
    try {
        const res = await axios.get(`${BASE_URL}/invoices-ai/`, authHeader())
        dispatch({ type: TYPE.FETCH_AI_INVOICES_SUCCESS, payload: res.data })
    } catch {
        dispatch({ type: TYPE.FETCH_AI_INVOICES_FAIL })
    }
}

// Upload file → trigger OCR
export const createAIInvoice = (formData) => async dispatch => {
    try {
        const res = await axios.post(`${BASE_URL}/invoices-ai/`, formData, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access')}`,
                'Content-Type': 'multipart/form-data'
            }
        })
        dispatch({ type: TYPE.CREATE_AI_INVOICE_SUCCESS, payload: res.data })
        return { success: true, data: res.data }
    } catch (err) {
        dispatch({ type: TYPE.CREATE_AI_INVOICE_FAIL })
        return { success: false, error: err.response?.data }
    }
}

export const fetchAIOcrStatus = (id) => async dispatch => {
    try {
        const res = await axios.get(
            `${BASE_URL}/invoices-ai/${id}/ocr-status/`,
            authHeader()
        )
        return res.data
    } catch {
        return null
    }
}

export const deleteAIInvoice = (id) => async dispatch => {
    try {
        await axios.delete(`${BASE_URL}/invoices-ai/${id}/`, authHeader())
        dispatch({ type: TYPE.DELETE_AI_INVOICE_SUCCESS, payload: id })
    } catch {
        dispatch({ type: TYPE.DELETE_AI_INVOICE_FAIL })
    }
}

export const qualityCheckAIInvoice = (id) => async dispatch => {
    try {
        const res = await axios.get(
            `${BASE_URL}/invoices-ai/${id}/quality-check/`,
            authHeader()
        )
        return { success: true, data: res.data }
    } catch (err) {
        return { success: false, error: err.response?.data }
    }
}

export const verifyAIInvoiceImage = (id) => async dispatch => {
    try {
        const res = await axios.get(
            `${BASE_URL}/invoices-ai/${id}/verify/`,
            authHeader()
        )
        return { success: true, data: res.data }
    } catch (err) {
        return { success: false, error: err.response?.data }
    }
}

export const createAIBatch = (formData) => async dispatch => {
    try {
        const res = await axios.post(
            `${BASE_URL}/invoices-ai/batch/`,
            formData,
            {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access')}`,
                    'Content-Type': 'multipart/form-data',
                }
            }
        )
        return { success: true, data: res.data }
    } catch (err) {
        return { success: false, error: err.response?.data }
    }
}