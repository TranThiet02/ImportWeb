const normalizeBaseUrl = (url) => url.replace(/\/+$/, '')

const buildDefaultApiOrigin = () => {
    if (typeof window === 'undefined') return 'http://localhost:8000'

    const { protocol, hostname } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8000'
    }
    return `${protocol}//${hostname}:8000`
}

export const API_ORIGIN = normalizeBaseUrl(
    process.env.REACT_APP_API_URL || buildDefaultApiOrigin()
)

export const buildApiUrl = (path = '') => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    return `${API_ORIGIN}${cleanPath}`
}

export const buildMediaUrl = (path = '') => {
    if (!path) return API_ORIGIN
    if (/^https?:\/\//i.test(path)) return path
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    return `${API_ORIGIN}${cleanPath}`
}
