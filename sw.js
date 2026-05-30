// ═══════════════════════════════════════════════════
//  معمل النخبة — Service Worker (sw.js)
//  ارفع هذا الملف جنب index.html على GitHub
// ═══════════════════════════════════════════════════

const CACHE = 'elitelab-v5';  // رُقِّم للـ v5 عشان يمسح كاش v4 القديم

// الموارد اللي نكشها عند التثبيت
const PRECACHE = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&family=Tajawal:wght@300;400;500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// ─── INSTALL: احفظ كل الموارد في الكاش ─────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(
        PRECACHE.map(url =>
          fetch(url).then(r => { if (r.ok) c.put(url, r); }).catch(() => {})
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE: امسح الكاش القديم ────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── FETCH: استراتيجية الكاش لكل نوع طلب ───────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // 1. Google Sheets API — network only (مش نكش API calls)
  if (url.includes('script.google.com') || url.includes('googleapis.com')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ status: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // 2. CDN والـ Fonts — Cache First
  if (
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com') ||
    url.includes('cdnjs.cloudflare.com')
  ) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // 3. التطبيق (HTML + assets) — Network First مع Cache Fallback
  //    يكاش أي نسخة جديدة لما النت موجود، يرجع الكاش لما يكون أوف لاين
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
