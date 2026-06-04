import TYPE from "./Type"
import axios from "axios"
import { buildApiUrl } from "../config/api"

axios.defaults.withCredentials = true

export const closeAlert = () => dispatch => {
    dispatch({
        type: TYPE.CLOSE_ALERT
    })
}

export const login = (email, password) => async dispatch => {
    const config = {
        headers: {
            "Content-Type": "application/json"
        }
    }
    const body = JSON.stringify({ email, password })
    try {
        const res = await axios.post(buildApiUrl("/dj-rest-auth/login/"), body, config)

        localStorage.setItem('access', res.data.access)
        localStorage.setItem('refresh_token', res.data.refresh)

        dispatch({
            type: TYPE.LOGIN_SUCCESS,
            payload: res.data
        })
    } catch (err) {
        dispatch({
            type: TYPE.LOGIN_FAIL
        })
    }
}

export const refresh = () => async dispatch => {
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
        dispatch({ type: TYPE.LOGOUT })
        return
    }
    try {
        const res = await axios.post(
            buildApiUrl('/dj-rest-auth/token/refresh/'),
            { refresh: refreshToken },
            { headers: { 'Content-Type': 'application/json' } }
        )
        localStorage.setItem('access', res.data.access)
        dispatch({ type: TYPE.REFRESH_SUCCESS, payload: res.data })
    } catch {
        localStorage.removeItem('access')
        localStorage.removeItem('refresh_token')
        dispatch({ type: TYPE.REFRESH_FAIL })
    }
}

export const verify = () => async dispatch => {
    if (localStorage.getItem('access')) {
        const config = {
            headers: {
                "Content-Type": "application/json"
            }
        }
        const body = JSON.stringify({ 'token': localStorage.getItem('access') })
        try {
            await axios.post(buildApiUrl('/dj-rest-auth/token/verify/'), body, config)
            dispatch({ type: TYPE.VERIFY_SUCCESS })
        } catch (err) {
            dispatch({ type: TYPE.VERIFY_FAIL })
            await dispatch(refresh())
        }
    } else {
        dispatch({ type: TYPE.GUEST_VIEW })
    }
}

export const getUser = () => async dispatch => {
    if (localStorage.getItem('access')) {
        const config = {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem('access')}`
            }
        }
        try {
            const res = await axios.get(buildApiUrl('/dj-rest-auth/user/'), config)
            dispatch({
                type: TYPE.GET_USER_SUCCESS,
                payload: res.data
            })
        } catch (err) {
            dispatch({ type: TYPE.GET_USER_FAIL })
        }
    } else {
        dispatch({ type: TYPE.GUEST_VIEW })
    }
}

export const logout = () => async dispatch => {
    const config = {
        headers: {
            "Content-Type": "application/json"
        }
    }
    try {
        await axios.post(buildApiUrl('/dj-rest-auth/logout/'), config)
    } catch (err) {}

    localStorage.removeItem('access')
    localStorage.removeItem('refresh_token')

    dispatch({ type: TYPE.LOGOUT })
}

export const googleLogin = (credential) => async dispatch => {
    const config = {
        headers: { "Content-Type": "application/json" }
    }
    const body = JSON.stringify({ credential })
    try {
        const res = await axios.post(
            buildApiUrl('/api/auth/google/'),
            body,
            config
        )

        localStorage.setItem('access', res.data.access)
        localStorage.setItem('refresh_token', res.data.refresh)

        dispatch({
            type: TYPE.LOGIN_SUCCESS,
            payload: res.data
        })
    } catch (err) {
        dispatch({ type: TYPE.LOGIN_FAIL })
    }
}