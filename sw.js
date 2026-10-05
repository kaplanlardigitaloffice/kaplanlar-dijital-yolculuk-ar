const CACHE='kaplanlar-webar-v15-lifelike';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./assets/mascot_neutral.png','./assets/mascot_greeting.png','./assets/mascot_present_right.png','./assets/mascot_ai_hold.png','./assets/mascot_ai_look.png','./assets/mascot_hero.png','./assets/mascot_idle.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))});
