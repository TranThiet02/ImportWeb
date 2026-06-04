export function register() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            const swUrl = `${process.env.PUBLIC_URL}/sw.js`

            navigator.serviceWorker.register(swUrl)
                .then(registration => {
                    console.log('[SW] Registered:', registration.scope)

                    // Kiểm tra update
                    registration.onupdatefound = () => {
                        const worker = registration.installing
                        if (!worker) return

                        worker.onstatechange = () => {
                            if (worker.state === 'installed' &&
                                navigator.serviceWorker.controller) {
                                console.log('[SW] New version available!')
                                // Thông báo có version mới
                                window.dispatchEvent(
                                    new CustomEvent('sw-update-available')
                                )
                            }
                        }
                    }
                })
                .catch(err => {
                    console.error('[SW] Registration failed:', err)
                })
        })
    }
}

export function unregister() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
            .then(registration => registration.unregister())
    }
}