// ══════════════════════════════════════════════════════
// SERVICE WORKER — Makro Order App
// ร้านข้าวซอยลำดวนฟ้าฮ่าม สาขาบรรทัดทอง
// ══════════════════════════════════════════════════════

const CACHE_NAME = 'makro-order-v2';

// ไฟล์ที่ต้อง cache ไว้ใช้ offline
const STATIC_ASSETS = [
  './makro_final.html',
  'https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Prompt:wght@400;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
];

// ══ INSTALL ══
// ดาวน์โหลด static assets ทั้งหมดลง cache
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets');
      // cache แบบ individual เพื่อไม่ให้ fail ทั้งหมดถ้า 1 file error
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(e => console.warn('[SW] Failed to cache:', url, e))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ══ ACTIVATE ══
// ลบ cache เก่าออก
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ══ FETCH ══
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  const url = event.request.url;

  // ── Network First: raw.githubusercontent.com (ข้อมูลสินค้า JSON)
  // ดึงจาก network เสมอ เพื่อให้ได้ข้อมูลล่าสุด
  if (url.includes('raw.githubusercontent.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request)) // offline → ใช้ cache แทน
    );
    return;
  }

  // ── Cache First: ไฟล์อื่นๆ (HTML, JS, CSS, รูป)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // อัปเดต cache ใน background (stale-while-revalidate)
        fetch(event.request)
          .then(fresh => {
            if (fresh && fresh.status === 200) {
              caches.open(CACHE_NAME).then(c => c.put(event.request, fresh.clone()));
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('./makro_final.html');
        }
      });
    })
  );
});
