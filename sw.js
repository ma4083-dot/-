// ═══════════════════════════════════════════════════
//  معمل النخبة — Service Worker (sw.js)
//  ⚠️ لا تعدّل هذا الملف يدوياً — النسخة تأتي تلقائياً من الـ HTML
// ═══════════════════════════════════════════════════

// اسم الكاش الافتراضي — سيتم تحديثه تلقائياً عبر postMessage من الـ HTML
let CACHE = 'elitelab-init';

const CDN_URLS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com'
];

const GOOGLE_URLS = [
  'script.google.com',
  'googleapis.com'
];

// ─── استقبال الـ version من الـ HTML ────────────────
// الـ HTML يحسب hash من محتواه ويرسله هنا
// لو الـ version اتغيّر → امسح الكاش القديم وحمّل من جديد
self.addEventListener('message', async e => {
  if (e.data && e.data.type === 'APP_VERSION') {
    const newCache = 'elitelab-' + e.data.version;
    if (newCache !== CACHE) {
      console.log('[SW] نسخة جديدة:', newCache, '← كانت:', CACHE);
      const oldCache = CACHE;
      CACHE = newCache;
      // احذف الكاش القديم
      await caches.delete(oldCache);
      // احفظ الصفحة في الكاش الجديد
      const cache = await caches.open(CACHE);
      await cache.addAll(['./','./index.html']).catch(() => {});
      console.log('[SW] كاش جديد جاهز:', CACHE);
    }
  }
});

// ─── INSTALL ─────────────────────────────────────────
self.addEventListener('install', e => {
  console.log('[SW] Installing...');
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled([
        './',
        './index.html',
        'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&family=Tajawal:wght@300;400;500;700&display=swap',
        'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      ].map(url => fetch(url).then(r => { if (r.ok) c.put(url, r); }).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE: احذف كل الكاشات القديمة ──────────────
self.addEventListener('activate', e => {
  console.log('[SW] Activating...');
  e.waitUntil(
    caches.keys()
      .then(keys => {
        const old = keys.filter(k => k !== CACHE);
        if (old.length) console.log('[SW] حذف كاش قديم:', old);
        return Promise.all(old.map(k => caches.delete(k)));
      })
      .then(() => self.clients.claim())
  );
});

// ─── FETCH ───────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // 1. Google APIs — Network Only
  if (GOOGLE_URLS.some(u => url.includes(u))) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ status: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // 2. CDN / Fonts — Cache First
  if (CDN_URLS.some(u => url.includes(u))) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200)
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // 3. التطبيق — Network First + Cache Fallback (أوف لاين)
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200)
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => {
        console.log('[SW] أوف لاين — من الكاش:', url);
        return caches.match(e.request);
      })
  );
});
