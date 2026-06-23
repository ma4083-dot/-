// ═══════════════════════════════════════════════════
//  معمل النخبة — Service Worker (sw.js)
//  ⚠️ لا تعدّل هذا الملف يدوياً
// ═══════════════════════════════════════════════════

// اسم كاش ثابت دايماً — متغيرش لا بين النسخ ولا بعد إعادة تشغيل الـ Worker
// (المتغيرات العادية كانت بتتصفر كل ما المتصفح يقفل الـ Service Worker وقت الخمول،
//  فكان بيتعمل كاش جديد بالغلط بدل ما يتحدّث الكاش القديم نفسه → ده كان سبب
//  ظهور نسخة قديمة من الموقع وانت أوف لاين)
const CACHE = 'elitelab-cache-v1';

const APP_SHELL = ['./', './index.html'];

const CDN_URLS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com'
];

const GOOGLE_URLS = [
  'script.google.com',
  'googleapis.com'
];

// ─── استقبال نسخة جديدة من الـ HTML وانت أونلاين ────
// بدل ما نعمل كاش باسم جديد، بنحدّث نفس الكاش الثابت بمحتوى طازة من النت
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'APP_VERSION') {
    const updateCache = (async () => {
      try {
        const cache = await caches.open(CACHE);
        await Promise.all(APP_SHELL.map(async url => {
          try {
            const res = await fetch(url, { cache: 'reload' });
            if (res && res.ok) await cache.put(url, res.clone());
          } catch {}
        }));
        console.log('[SW] الكاش اتحدّث لآخر نسخة:', e.data.version);
      } catch (err) {
        console.log('[SW] فشل تحديث الكاش:', err);
      }
    })();
    if (e.waitUntil) e.waitUntil(updateCache);
  }
});

// ─── INSTALL ─────────────────────────────────────────
self.addEventListener('install', e => {
  console.log('[SW] Installing...');
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled([
        ...APP_SHELL,
        'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&family=Tajawal:wght@300;400;500;700&display=swap',
        'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      ].map(url => fetch(url, { cache: 'reload' }).then(r => { if (r.ok) c.put(url, r); }).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE: احذف أي كاش قديم بأي اسم غير الاسم الثابت ──
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

  // 2. CDN / Fonts — Cache First (من نفس الكاش الثابت دايماً)
  if (CDN_URLS.some(u => url.includes(u))) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(res => {
            if (res && res.status === 200) cache.put(e.request, res.clone());
            return res;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // 3. التطبيق — Network First + Cache Fallback (من نفس الكاش الثابت دايماً)
  e.respondWith(
    caches.open(CACHE).then(cache =>
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => {
          console.log('[SW] أوف لاين — من الكاش:', url);
          return cache.match(e.request)
            .then(r => r || cache.match('./index.html'));
        })
    )
  );
});
