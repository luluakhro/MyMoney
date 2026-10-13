const CACHE='mymoney-v2';
const ASSETS=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./payment-enhancements.js'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  const isPage=e.request.mode==='navigate'||u.pathname.endsWith('/MyMoney/')||u.pathname.endsWith('/MyMoney/index.html');
  if(isPage){
    e.respondWith(fetch(e.request).then(async r=>{
      let text=await r.text();
      if(!text.includes('payment-enhancements.js')) text=text.replace('</body>','<script src="./payment-enhancements.js?v=2"></script></body>');
      const out=new Response(text,{status:r.status,statusText:r.statusText,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'}});
      caches.open(CACHE).then(c=>c.put(e.request,out.clone()));
      return out;
    }).catch(()=>caches.match(e.request).then(async r=>{if(!r)return caches.match('./index.html');let text=await r.text();if(!text.includes('payment-enhancements.js'))text=text.replace('</body>','<script src="./payment-enhancements.js?v=2"></script></body>');return new Response(text,{headers:{'Content-Type':'text/html; charset=utf-8'}})})));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)));
});
