// Shared tab bar for all maker sections. Include as <script src=".../nav.js" data-cur="posts" data-root="../"></script>
(()=>{const me=document.currentScript,cur=me.dataset.cur,root=me.dataset.root||'';
const T=[['posts','Посты',''],['price','Прайс','price/'],['gizmo','Gizmo','gizmo/'],['texts','Тексты','texts/'],['plan','План','plan/']];
const css=document.createElement('style');css.textContent='.navbar{display:flex;gap:6px;overflow-x:auto;margin:0 -16px 14px;padding:2px 16px 4px;scrollbar-width:none}.navbar::-webkit-scrollbar{display:none}.navbar a{flex:none;color:rgba(255,255,255,.75);text-decoration:none;font:800 12px UB,system-ui;letter-spacing:.02em;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:9px 14px;background:#16161A}.navbar a.on{background:#A3FF10;color:#000;border-color:#A3FF10}';
document.head.appendChild(css);
const go=()=>{const m=document.querySelector('main');if(!m)return;const n=document.createElement('nav');n.className='navbar';
 for(const [k,t,h] of T){const a=document.createElement('a');a.href=root+h;a.textContent=t;if(k===cur)a.className='on';n.appendChild(a)}m.prepend(n)};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',go):go()})();
