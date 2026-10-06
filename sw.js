// Plán 70 kg: offline režim. Appka se načítá z mezipaměti a na pozadí si stahuje novou verzi.
const V = 'plan70-a4529f4bc6';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('plan70-') && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Plán 70 kg', {
    body: d.body || '', tag: d.tag || 'plan70', renotify: true, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: d.url || './' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  // appka už běží: přenést ji dopředu a předat odkaz (otevře zápis jídla); jinak ji otevřít rovnou na odkazu
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async cs => {
    for (const c of cs) {
      if (!('focus' in c)) continue;
      try { await c.focus(); } catch (_) { }
      c.postMessage({ type: 'nav', url });
      return;
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (/\/(version\.json|widget-core\.js)$/.test(url.pathname)) return; // vždy ze sítě
  if (req.mode === 'navigate') { // stránka: nejdřív síť (nejnovější verze), bez signálu z mezipaměti
    e.respondWith((async () => {
      const c = await caches.open(V);
      try {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 4000);
        const r = await fetch(url.origin + url.pathname, { signal: ctl.signal, cache: 'no-store', credentials: 'same-origin' });
        clearTimeout(t);
        if (r && r.ok) { await c.put('./', r.clone()); return r; }
      } catch (_) { }
      return (await c.match('./')) || (await c.match(req, { ignoreSearch: true })) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })());
    return;
  }
  e.respondWith(caches.open(V).then(async c => {
    const hit = (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await c.match('./') : null);
    const net = fetch(req).then(r => { if (r && r.ok && r.type === 'basic') c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});
