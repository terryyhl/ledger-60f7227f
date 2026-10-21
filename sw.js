const V="ledger-v6",SHELL=["./","index.html","app.css","extra.css","app.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","icons/apple-touch-icon.png","icons/favicon-32.png","icons/icon.svg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:"reload"})))).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(e.request.method!=="GET"||u.origin!==location.origin)return;
 if(u.pathname.includes("/data/")){const key=u.origin+u.pathname;
  const fromCache=tag=>caches.match(key).then(c=>{if(!c)return null;const h=new Headers(c.headers);h.set("X-From-Cache",tag);return c.blob().then(b=>new Response(b,{status:200,headers:h}))});
  e.respondWith(fetch(e.request,{cache:"no-store"}).then(r=>{if(r.ok){const c=r.clone();caches.open(V).then(k=>k.put(key,c));return r}
   if(r.status>=500)return fromCache("5xx").then(c=>c||r);return r})
   .catch(()=>fromCache("1").then(c=>{if(!c)throw new Error("offline");return c})));return}
 e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request)))});
