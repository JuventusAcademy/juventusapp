// Somente o ícone estático: nunca intercepta Auth, APIs, documentos ou financeiro.
const CACHE='futgestao-static-v2';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.add('/icon.svg')));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim()});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method==='GET'&&url.origin===self.location.origin&&url.pathname==='/icon.svg')event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)))});
