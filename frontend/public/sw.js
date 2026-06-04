const CACHE_NAME = 'importweb-v1'
const STATIC_CACHE = 'importweb-static-v1'
const API_CACHE = 'importweb-api-v1'

// Files cần cache khi install
const STATIC_FILES = [
    '/',
    '/index.html',
    '/static/js/main.chunk.js',
    '/static/js/bundle.js',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
]

// ── Install: Cache static files ──
self.addEventListener('install', event => {
    console.log('[SW] Installing...')
    event.waitUntil(
        caches.open(STATIC_CACHE).then(cache => {
            console.log('[SW] Caching static files')
            return cache.addAll(STATIC_FILES).catch(err => {
                console.log('[SW] Cache error (ignored):', err)
            })
        })
    )
    self.skipWaiting()
})

// ── Activate: Xóa cache cũ ──
self.addEventListener('activate', event => {
    console.log('[SW] Activating...')
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key =>
                    key !== STATIC_CACHE && key !== API_CACHE
                ).map(key => {
                    console.log('[SW] Deleting old cache:', key)
                    return caches.delete(key)
                })
            )
        )
    )
    self.clients.claim()
})

// ── Fetch: Strategy theo loại request ──
self.addEventListener('fetch', event => {
    const { request } = event
    const url = new URL(request.url)

    // Bỏ qua Chrome extensions và non-http
    if (!request.url.startsWith('http')) return

    // API requests → Network first, fallback cache
    if (url.hostname === 'localhost' && url.port === '8000') {
        event.respondWith(networkFirst(request))
        return
    }

    // Static files → Cache first
    if (request.destination === 'script' ||
        request.destination === 'style'  ||
        request.destination === 'image') {
        event.respondWith(cacheFirst(request))
        return
    }

    // HTML → Network first
    event.respondWith(networkFirst(request))
})

// ── Strategy: Network First ──
async function networkFirst(request) {
    try {
        const response = await fetch(request)
        if (response.ok && request.method === 'GET') {
            const cache = await caches.open(API_CACHE)
            cache.put(request, response.clone())
        }
        return response
    } catch (err) {
        const cached = await caches.match(request)
        if (cached) return cached

        // Offline fallback cho HTML
        if (request.destination === 'document') {
            return caches.match('/index.html')
        }

        return new Response(
            JSON.stringify({ error: 'Offline — không có kết nối mạng' }),
            { headers: { 'Content-Type': 'application/json' } }
        )
    }
}

// ── Strategy: Cache First ──
async function cacheFirst(request) {
    const cached = await caches.match(request)
    if (cached) return cached

    try {
        const response = await fetch(request)
        if (response.ok) {
            const cache = await caches.open(STATIC_CACHE)
            cache.put(request, response.clone())
        }
        return response
    } catch (err) {
        return new Response('', { status: 404 })
    }
}

// ── Background Sync (cho upload khi offline) ──
self.addEventListener('sync', event => {
    if (event.tag === 'sync-invoices') {
        event.waitUntil(syncPendingUploads())
    }
})

async function syncPendingUploads() {
    console.log('[SW] Syncing pending uploads...')
}