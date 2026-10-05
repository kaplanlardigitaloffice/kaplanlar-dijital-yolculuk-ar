const CACHE='kaplanlar-ar-v1';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest',
  './assets/mascot_1.png','./assets/mascot_2.png','./assets/mascot_3.png','./assets/mascot_4.png','./assets/mascot_5.png','./assets/mascot_6.png','./assets/mascot_7.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
