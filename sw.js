const CACHE='kaplanlar-webar-v10-corporate';
const ASSETS=[
  './','./index.html','./styles.css','./app.js','./manifest.webmanifest',
  './assets/mascot_premium_idle.png','./assets/mascot_premium_ai.png','./assets/mascot_premium_wave.png',
  './assets/mascot_premium_spin_side.png','./assets/mascot_premium_spin_back.png'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))});
