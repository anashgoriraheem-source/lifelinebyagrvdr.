/* Public fallback only. No dynamic HTML, health records, provider requests,
 * auth responses, account pages or contacts are ever put into Cache Storage. */
const CACHE='lifeline-public-offline-rc1';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.add('/offline.html'))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('lifeline-public-offline-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||event.request.mode!=='navigate')return;
 event.respondWith((async()=>{try{return await fetch(event.request)}catch{return (await caches.open(CACHE)).match('/offline.html').then(response=>response??Response.error())}})());
});
