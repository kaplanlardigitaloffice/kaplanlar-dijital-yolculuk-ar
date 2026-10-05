const CACHE='kaplanlar-webar-v3';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./assets/mascot_1.png','./assets/mascot_2.png','./assets/mascot_3.png','./assets/mascot_4.png','./assets/mascot_5.png','./assets/mascot_6.png','./assets/mascot_7.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))})
