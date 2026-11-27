const scope = self.registration.scope;
const cachePrefix = "miyako-photo-guide:" + scope + ":";
const cacheName = cachePrefix + "12:";
const appPage = new URL("index.html", scope).href;
const appPaths = new Set(["", "index.html", "miyako-photo-guide.html"].map(path => new URL(path, scope).pathname));
const assets = ["manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"]
  .map(path => new URL(path, scope).href);

self.addEventListener("install", event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll([
    ...[appPage, ...assets].map(url => new Request(url, { cache: "reload" }))
  ])));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const obsolete = (await caches.keys()).filter(key => key.startsWith(cachePrefix) && key !== cacheName);
    await Promise.all(obsolete.map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && appPaths.has(url.pathname)) {
    const network = fetch(request);
    const refresh = network.then(async response => {
      if (response.ok && !response.redirected && response.headers.get("Content-Type")?.includes("text/html")) {
        const copy = response.clone();
        const cache = await caches.open(cacheName);
        await cache.put(appPage, copy);
      }
    });
    event.waitUntil(refresh.catch(() => {}));
    event.respondWith(network.catch(async () => {
      const cache = await caches.open(cacheName);
      return await cache.match(appPage) ?? Response.error();
    }));
  } else if (assets.includes(url.href)) {
    event.respondWith(caches.open(cacheName).then(async cache => await cache.match(url.href) ?? fetch(request)));
  }
});
