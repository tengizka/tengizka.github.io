// Free layers on top of any post template: text, 3D emoji, mascot emotions and own PNGs.
// Drag with a finger, pinch to resize and twist to rotate; sliders for fine control; snapping to the centre lines.
// Layers are drawn on the canvas after the template (draw → drawBase + composite), the selection frame is HTML over it,
// so nothing of the editor gets into the exported picture.
const LY=(()=>{
const COLS={'#FFFFFF':'Белый','#0B0B0C':'Чёрный','#A3FF10':'Лайм','#FF8A1F':'Оранжевый','#E93E97':'Розовый','#5B7BFF':'Синий','#8B5BFF':'Фиолетовый'};
const FONTS={ub9:['900','UB','Жирный'],ub6:['600','UB','Обычный'],rs:['700','RS','Квадратный'],jb:['700','JB','Моно']};
const P=(pts,o='')=>`<polygon points="${pts}" ${o}/>`;
const star=(x,y=16.3,r=3.3)=>P(Array.from({length:10},(_,i)=>{const a=Math.PI/5*i-Math.PI/2,rr=i%2?r*.42:r;return `${(x+rr*Math.cos(a)).toFixed(2)},${(y+rr*Math.sin(a)).toFixed(2)}`}).join(' '));
const bar=(x,y=15,w=6.4,h=2.7)=>`<rect x="${x-w/2}" y="${y}" width="${w}" height="${h}"/>`;
const line=(d,w=1.4)=>`<path d="${d}" fill="none" stroke-width="${w}" stroke-linecap="square"/>`;
const heart=x=>`<path d="M${x},19 C${x-4.2},16 ${x-3.4},12.4 ${x-1.6},12.6 C${x-.6},12.7 ${x},13.6 ${x},14.4 C${x},13.6 ${x+.6},12.7 ${x+1.6},12.6 C${x+3.4},12.4 ${x+4.2},16 ${x},19Z"/>`;
const bolt=x=>P(`${x+.6},12.6 ${x-2.2},17.2 ${x-.1},17.2 ${x-1},20.4 ${x+2.3},15.6 ${x+.2},15.6 ${x+1.3},12.6`);
const coin=x=>`<circle cx="${x}" cy="16.3" r="3.45"/><circle cx="${x}" cy="16.3" r="2.5" fill="#000" stroke="#000"/><rect x="${x-.45}" y="14.6" width=".9" height="3.4"/>`;
const moon=x=>`<circle cx="${x}" cy="16.3" r="3.3"/><circle cx="${x+1.5}" cy="15.4" r="2.8" fill="#000" stroke="#000"/>`;
const L=19.7,R=30.1;
const M={flat:P('25.4032,32.9495 18.0918,32.9495 18.0918,35.6616 25.4032,35.6616'),smile:line('M18.4,32.4 V35 H25.1 V32.4'),sad:line('M18.4,35.6 V33 H25.1 V35.6'),open:`<rect x="19" y="31.8" width="5.6" height="4.6"/>`,o:`<rect x="20.4" y="32.3" width="2.8" height="3.4"/>`};
const EMO={
 normal:['Обычный',bar(L)+bar(R),M.flat],happy:['Радость',line(`M${L-3},17.6 L${L},14.6 L${L+3},17.6`)+line(`M${R-3},17.6 L${R},14.6 L${R+3},17.6`),M.smile],
 wink:['Подмигивает',star(L)+bar(R,15.6,6.4,1.4),M.smile],stars:['Звёзды',star(L)+star(R),M.open],love:['Влюблён',heart(L)+heart(R),M.smile],
 bolt:['Заряжен',bolt(L)+bolt(R),M.open],angry:['Злой',P(`${L-3.2},14 ${L+3.2},15.8 ${L+3.2},18.2 ${L-3.2},16.6`)+P(`${R+3.2},14 ${R-3.2},15.8 ${R-3.2},18.2 ${R+3.2},16.6`),M.sad],
 sleepy:['Сонный',bar(L,16.9,6.4,1.1)+bar(R,16.9,6.4,1.1),M.o],dead:['В отключке',line(`M${L-2.6},13.7 L${L+2.6},18.9 M${L+2.6},13.7 L${L-2.6},18.9`)+line(`M${R-2.6},13.7 L${R+2.6},18.9 M${R+2.6},13.7 L${R-2.6},18.9`),M.flat],
 shock:['В шоке',`<circle cx="${L}" cy="16.3" r="2.9" fill="none" stroke-width="1.2"/><circle cx="${L}" cy="16.3" r=".9"/><circle cx="${R}" cy="16.3" r="2.9" fill="none" stroke-width="1.2"/><circle cx="${R}" cy="16.3" r=".9"/>`,M.open],
 cry:['Плачет',bar(L,15.6,6.4,1.4)+bar(R,15.6,6.4,1.4)+`<path d="M${L},18.4 l-1,2.2 a1.05,1.05 0 1 0 2,0z" fill="#5B7BFF" stroke="#5B7BFF"/>`,M.sad],
 money:['Деньги',coin(L)+coin(R),M.smile],night:['Ночь',moon(L)+moon(R),M.flat]};
const BASE='<polygon points="4.62219,10.7343 4.0874,16.197 9.32084,8.74788 9.32084,12.7971 12.0713,12.7971 12.0713,0 4.62219,10.7343"/><polygon points="0,17.4576 0,22.309 2.75043,22.309 2.82684,18.9474 6.26485,18.9474 6.26485,16.2352 4.08744,16.197 4.62223,10.7344 0,17.4576"/><polygon points="33.6545,16.197 37.0162,16.197 42.2497,8.74788 42.2497,12.8353 45,12.8353 45,0 33.6545,16.197"/><polygon points="2.75043,33.3106 2.75043,22.309 0,22.309 0,42.1732 12.0713,24.6393 12.0713,12.7971 9.32088,12.7971 9.32088,23.7988 2.75043,33.3106"/><polygon points="35.6793,33.3107 35.6793,22.309 32.929,22.309 32.929,42.1733 44.962,24.6393 44.962,16.197 38.7353,16.197 38.7353,18.9474 42.2498,18.9474 42.2498,23.7988 35.6793,33.3107"/><polygon points="26.7404,28.3445 26.7404,18.1833 24.1045,18.1833 24.1045,28.3445 26.7404,28.3445"/><polygon points="24.1044,25.6707 20.0552,25.6707 20.0552,28.3446 24.1044,28.3446 24.1044,25.6707"/>';
const mascotSrc=(emo,col)=>{const e=EMO[emo]||EMO.normal;return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 47 45" width="470" height="450"><g fill="${col}" stroke="${col}" stroke-width=".12">${BASE}${e[1]}${e[2]}</g></svg>`)};
const imgs={};const img=src=>imgs[src]||(imgs[src]=new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=src}));
let sel=-1,base=null,cvs,ctx,emojiList=null,dirty=false;
const layers=()=>st.layers||(st.layers=[]);
const srcOf=l=>l.t==='masc'?mascotSrc(l.emo,l.col):l.src;
function lines(l){return String(l.text||' ').split(/\s+\/\s+/)}
function textBox(c,l){c.font=`${FONTS[l.font][0]} ${l.size}px ${FONTS[l.font][1]}`;const ls=lines(l);const w=Math.max(...ls.map(x=>c.measureText(x).width));const lh=l.size*1.08;return {w:w+(l.plate?l.size*.9:0),h:ls.length*lh+(l.plate?l.size*.5:0),ls,lh}}
async function size(l){if(l.t==='text'){const b=textBox(ctx,l);return [b.w,b.h]}const i=await img(srcOf(l));if(!i)return [l.w,l.w];return [l.w,l.w*i.height/i.width]}
async function drawLayer(c,l){c.save();c.translate(l.x,l.y);c.rotate((l.rot||0)*Math.PI/180);
 if(l.t==='text'){const b=textBox(c,l);if(l.plate){c.fillStyle=l.plate;c.fillRect(-b.w/2,-b.h/2,b.w,b.h)}c.fillStyle=l.col;c.textAlign='center';c.textBaseline='middle';
  if(l.font==='jb')c.letterSpacing=(l.size*.1)+'px';b.ls.forEach((t,i)=>c.fillText(l.font==='jb'?t.toUpperCase():t,0,-b.h/2+(l.plate?l.size*.25:0)+b.lh*(i+.5)));c.letterSpacing='0px'}
 else{const i=await img(srcOf(l));if(i){const h=l.w*i.height/i.width;if(l.shadow){c.shadowColor='rgba(0,0,0,.55)';c.shadowBlur=30;c.shadowOffsetY=14}c.drawImage(i,-l.w/2,-h/2,l.w,h)}}
 c.restore()}
async function composite(){if(!base)return;ctx.drawImage(base,0,0);for(const l of layers())await drawLayer(ctx,l);frame()}
async function after(){cvs=document.getElementById('cv');ctx=cvs.getContext('2d');base=base&&base.width===cvs.width&&base.height===cvs.height?base:Object.assign(document.createElement('canvas'),{width:cvs.width,height:cvs.height});
 base.getContext('2d').clearRect(0,0,base.width,base.height);base.getContext('2d').drawImage(cvs,0,0);await composite()}
// selection frame and centre guides over the canvas
let box,guideV,guideH;
function setupOverlay(){const pv=document.querySelector('.prev');pv.style.position='relative';box=document.createElement('div');box.className='lsel';guideV=document.createElement('div');guideV.className='lgv';guideH=document.createElement('div');guideH.className='lgh';pv.append(box,guideV,guideH)}
async function frame(){if(!box)return;const l=layers()[sel];if(!l){box.style.display='none';return}const k=cvs.clientWidth/cvs.width,[w,h]=await size(l);const off=cvs.offsetLeft;
 Object.assign(box.style,{display:'block',left:(off+l.x*k-w*k/2-6)+'px',top:(cvs.offsetTop+l.y*k-h*k/2-6)+'px',width:(w*k+12)+'px',height:(h*k+12)+'px',transform:`rotate(${l.rot||0}deg)`})}
async function hit(x,y){const ls=layers();for(let i=ls.length-1;i>=0;i--){const l=ls[i],[w,h]=await size(l),a=-(l.rot||0)*Math.PI/180,dx=x-l.x,dy=y-l.y,lx=dx*Math.cos(a)-dy*Math.sin(a),ly=dx*Math.sin(a)+dy*Math.cos(a);if(Math.abs(lx)<=w/2+20&&Math.abs(ly)<=h/2+20)return i}return -1}
function gestures(){const pts=new Map();let start=null;
 const pos=e=>{const r=cvs.getBoundingClientRect(),k=cvs.width/r.width;return {x:(e.clientX-r.left)*k,y:(e.clientY-r.top)*k}};
 cvs.style.touchAction='none';
 cvs.addEventListener('pointerdown',async e=>{cvs.setPointerCapture(e.pointerId);pts.set(e.pointerId,pos(e));
  if(pts.size===1){const p=pos(e),i=await hit(p.x,p.y);if(i!==sel){sel=i;panel()}const l=layers()[sel];start=l?{p,x:l.x,y:l.y}:null}
  else if(pts.size===2){const l=layers()[sel];if(!l)return;const [a,b]=[...pts.values()];start={pinch:Math.hypot(a.x-b.x,a.y-b.y),ang:Math.atan2(b.y-a.y,b.x-a.x),s:l.t==='text'?l.size:l.w,rot:l.rot||0}}
  frame()});
 cvs.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,pos(e));const l=layers()[sel];if(!l||!start)return;
  if(pts.size===1&&start.p){const p=pos(e);let x=start.x+p.x-start.p.x,y=start.y+p.y-start.p.y;const W=cvs.width,H=cvs.height;
   const sv=Math.abs(x-W/2)<14,sh=Math.abs(y-H/2)<14;if(sv)x=W/2;if(sh)y=H/2;guideV.style.display=sv?'block':'none';guideH.style.display=sh?'block':'none';l.x=Math.round(x);l.y=Math.round(y)}
  else if(pts.size===2&&start.pinch){const [a,b]=[...pts.values()],d=Math.hypot(a.x-b.x,a.y-b.y),ang=Math.atan2(b.y-a.y,b.x-a.x);const v=Math.max(12,Math.round(start.s*d/start.pinch));if(l.t==='text')l.size=v;else l.w=v;
   let r=start.rot+(ang-start.ang)*180/Math.PI;r=((r+540)%360)-180;if(Math.abs(r)<4)r=0;l.rot=Math.round(r)}
  schedule()});
 const end=e=>{pts.delete(e.pointerId);if(pts.size===0){start=null;guideV.style.display=guideH.style.display='none';panel(true)}else if(pts.size===1){const l=layers()[sel],p=[...pts.values()][0];start=l?{p,x:l.x,y:l.y}:null}};
 cvs.addEventListener('pointerup',end);cvs.addEventListener('pointercancel',end)}
let raf=0;function schedule(){if(raf)return;raf=requestAnimationFrame(async()=>{raf=0;await composite()})}
// panel
const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e};
function chipsRow(obj,cur,on,lab=v=>v){const d=el('div','chips f');for(const k in obj){const b=el('button','chip'+(cur===k?' on':''),lab(obj[k]));b.onclick=()=>{on(k);schedule();panel()};d.appendChild(b)}return d}
function colorRow(cur,on,none){const d=el('div','lcols f');if(none){const b=el('button','lcol'+(!cur?' on':''),'✕');b.onclick=()=>{on(null);schedule();panel()};d.appendChild(b)}
 for(const c in COLS){const b=el('button','lcol'+(cur===c?' on':''));b.style.background=c;b.title=COLS[c];b.onclick=()=>{on(c);schedule();panel()};d.appendChild(b)}return d}
function slider(lab,min,max,val,on){const w=el('div','lsl');const t=el('span',null,lab);const r=el('input');r.type='range';r.min=min;r.max=max;r.value=val;r.oninput=()=>{on(+r.value);schedule()};w.append(t,r);return w}
function panel(soft){const p=document.getElementById('lyPanel');if(!p)return;const ls=layers();
 const list=document.getElementById('lyList');list.innerHTML='';ls.forEach((l,i)=>{const b=el('button','chip'+(i===sel?' on':''),l.t==='text'?'Т: '+String(l.text).slice(0,14):l.t==='masc'?'Маскот':l.name||'Картинка');b.onclick=()=>{sel=i;panel();frame()};list.appendChild(b)});
 if(soft&&p.dataset.sel==String(sel))return;p.dataset.sel=sel;p.innerHTML='';const l=ls[sel];if(!l){p.appendChild(el('div','hint','Добавь слой кнопками выше или нажми на слой на картинке. Двигай пальцем, двумя пальцами меняй размер и поворачивай.'));return}
 if(l.t==='text'){const i=el('input');i.type='text';i.value=l.text;i.setAttribute('enterkeyhint','done');i.placeholder='Текст ( / новая строка)';i.oninput=()=>{l.text=i.value||' ';schedule()};p.appendChild(i);
  p.appendChild(chipsRow(FONTS,l.font,k=>l.font=k,v=>v[2]));p.appendChild(el('div','sub','Цвет'));p.appendChild(colorRow(l.col,c=>l.col=c));
  p.appendChild(el('div','sub','Подложка'));p.appendChild(colorRow(l.plate,c=>l.plate=c,true));p.appendChild(slider('Размер',16,260,l.size,v=>l.size=v))}
 if(l.t==='masc'){p.appendChild(chipsRow(Object.fromEntries(Object.entries(EMO).map(([k,v])=>[k,v[0]])),l.emo,k=>l.emo=k));p.appendChild(el('div','sub','Цвет'));p.appendChild(colorRow(l.col,c=>l.col=c));p.appendChild(slider('Размер',60,1000,l.w,v=>l.w=v))}
 if(l.t==='img'){p.appendChild(slider('Размер',40,1400,l.w,v=>l.w=v));const s=el('button','chip'+(l.shadow?' on':''),'Тень');s.onclick=()=>{l.shadow=!l.shadow;schedule();panel()};p.appendChild(s)}
 p.appendChild(slider('Поворот',-180,180,l.rot||0,v=>l.rot=v));
 const acts=el('div','chips f');const act=(t,f)=>{const b=el('button','chip',t);b.onclick=()=>{f();schedule();panel()};acts.appendChild(b)};
 act('По центру',()=>{l.x=cvs.width/2});act('Вперёд',()=>{if(sel<ls.length-1){[ls[sel],ls[sel+1]]=[ls[sel+1],ls[sel]];sel++}});act('Назад',()=>{if(sel>0){[ls[sel],ls[sel-1]]=[ls[sel-1],ls[sel]];sel--}});
 act('Копия',()=>{ls.push({...l,x:l.x+40,y:l.y+40});sel=ls.length-1});act('Удалить',()=>{ls.splice(sel,1);sel=-1});p.appendChild(acts)}
function add(l){if(!cvs)cvs=document.getElementById('cv');l.x??=cvs.width/2;l.y??=cvs.height/2;l.rot=0;layers().push(l);sel=layers().length-1;panel();schedule();document.getElementById('cv').scrollIntoView({behavior:'smooth',block:'center'})}
let list3d=null;
const MY_KEY='ly_my_png';
function myPngs(){try{return JSON.parse(localStorage.getItem(MY_KEY)||'[]')}catch(e){return[]}}
function saveMy(src,name){try{const a=myPngs().filter(x=>x.src!==src);a.unshift({src,name});while(a.length){try{localStorage.setItem(MY_KEY,JSON.stringify(a.slice(0,12)));break}catch(e){a.pop()}}}catch(e){}}
function delMy(src){try{localStorage.setItem(MY_KEY,JSON.stringify(myPngs().filter(x=>x.src!==src)))}catch(e){}}
// shrink big uploads so they fit in storage and stay fast
function shrink(dataUrl,max=900){return new Promise(r=>{const i=new Image();i.onload=()=>{const k=Math.min(1,max/Math.max(i.width,i.height));if(k===1&&dataUrl.length<700000)return r({src:dataUrl,w:i.width});const c=document.createElement('canvas');c.width=Math.round(i.width*k);c.height=Math.round(i.height*k);c.getContext('2d').drawImage(i,0,0,c.width,c.height);r({src:c.toDataURL('image/webp',.9),w:c.width})};i.src=dataUrl})}
async function emojiSheet(){const sh=document.getElementById('lySheet');
 if(!emojiList)emojiList=await (await fetch('stickers/emoji.json')).json();if(!list3d)list3d=await (await fetch('stickers/3d.json')).json();
 const g=sh.querySelector('.lgrid');g.innerHTML='';
 const sec=t=>{const h=el('div','lsec',t);g.appendChild(h)};
 const tile=(src,t,fn,big)=>{const i=el('img');i.src=src;i.title=t;i.loading='lazy';if(big)i.className='big';i.onclick=()=>{close();fn()};g.appendChild(i);return i};
 const my=myPngs();sec('Мои PNG');
 const up=el('button','lup','+ Загрузить PNG');up.onclick=()=>{close();document.getElementById('lyFile').click()};g.appendChild(up);
 for(const m of my){const w=el('div','lmy');const i=el('img');i.src=m.src;i.onclick=()=>{close();add({t:'img',src:m.src,name:m.name||'PNG',w:420})};const x=el('button','lx','×');x.onclick=e=>{e.stopPropagation();delMy(m.src);emojiSheet()};w.append(i,x);g.appendChild(w)}
 sec('3D объекты');for(const [k,t] of list3d)tile('stickers/3d/'+k+'.webp',t,()=>add({t:'img',src:'stickers/3d/'+k+'.webp',name:t,w:420,shadow:true}),1);
 sec('Банки');tile('stickers/gorilla.png','Банка Gorilla',()=>add({t:'img',src:'stickers/gorilla.png',name:'Банка Gorilla',w:360,shadow:true}),1);
 sec('Эмодзи');for(const n of emojiList)tile('stickers/emoji/'+n+'.webp','Эмодзи',()=>add({t:'img',src:'stickers/emoji/'+n+'.webp',name:'Эмодзи',w:240}));
 sh.classList.add('on');function close(){sh.classList.remove('on')}sh.querySelector('.lclose').onclick=close}
function ui(){const host=document.getElementById('lyHost');host.innerHTML=`<div class="lab">Слои: текст, 3D, стикеры, маскот, свои PNG</div>
<div class="chips"><button class="chip" id="lyT">+ Текст</button><button class="chip" id="lyE">+ 3D и стикеры</button><button class="chip" id="lyM">+ Маскот</button><button class="chip" id="lyP">+ Своя PNG</button></div>
<div class="chips f" id="lyList"></div><div id="lyPanel" class="lpanel"></div><input type="file" id="lyFile" accept="image/png,image/webp,image/*" multiple hidden>`;
 const sheet=el('div','lsheet');sheet.id='lySheet';sheet.innerHTML='<div class="lsheet-in"><div class="lsheet-h"><b>3D, стикеры и твои PNG</b><button class="lclose">Готово</button></div><div class="lgrid"></div></div>';document.body.appendChild(sheet);
 document.getElementById('lyT').onclick=()=>add({t:'text',text:'Твой текст',font:'ub9',col:'#FFFFFF',plate:null,size:84});
 document.getElementById('lyE').onclick=emojiSheet;
 document.getElementById('lyM').onclick=()=>add({t:'masc',emo:'happy',col:'#A3FF10',w:320});
 document.getElementById('lyP').onclick=()=>document.getElementById('lyFile').click();
 document.getElementById('lyFile').onchange=e=>{const fs=[...e.target.files];e.target.value='';fs.forEach((f,n)=>{const r=new FileReader();r.onload=async()=>{const {src,w}=await shrink(r.result);const name=f.name.replace(/\.[^.]+$/,'').slice(0,14);saveMy(src,name);add({t:'img',src,name,w:Math.min(560,w),x:cvs.width/2+n*40,y:cvs.height/2+n*40})};r.readAsDataURL(f)})};
 const css=el('style');css.textContent=`.lsel{position:absolute;display:none;border:2px dashed #A3FF10;pointer-events:none;transform-origin:center;box-shadow:0 0 0 1px rgba(0,0,0,.5)}
.lgv,.lgh{position:absolute;display:none;background:#E93E97;pointer-events:none}.lgv{top:0;bottom:0;left:50%;width:1px}.lgh{left:0;right:0;top:50%;height:1px}
.lpanel{margin-top:10px;background:#16161A;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:12px}
.lcols{display:flex;gap:8px;flex-wrap:wrap}.lcol{width:34px;height:34px;border-radius:50%;border:2px solid rgba(255,255,255,.25);color:#fff;font-weight:800;background:#0f0f12}.lcol.on{outline:3px solid #A3FF10;outline-offset:2px}
.lsl{display:flex;align-items:center;gap:10px;margin-top:10px;color:rgba(255,255,255,.6);font:700 11px JB;text-transform:uppercase;letter-spacing:.1em}.lsl span{width:70px}.lsl input{flex:1}
.lsheet{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:30;display:none;align-items:flex-end}.lsheet.on{display:flex}
.lsheet-in{background:#16161A;width:100%;max-height:70vh;border-radius:18px 18px 0 0;padding:14px;overflow:auto}.lsheet-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.lclose{background:#A3FF10;border:0;border-radius:999px;padding:8px 14px;font-weight:800}.lgrid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.lgrid img{width:100%;aspect-ratio:1;object-fit:contain;background:#0f0f12;border-radius:10px;padding:6px;cursor:pointer}.lgrid img.big{grid-column:span 2;padding:10px}
.lsec{grid-column:1/-1;font:700 11px JB,monospace;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.55);margin:10px 0 2px}
.lup{grid-column:span 2;aspect-ratio:2/1;border:2px dashed #A3FF10;background:transparent;color:#A3FF10;border-radius:10px;font:800 13px system-ui}
.lmy{position:relative;grid-column:span 2}.lmy img{padding:10px}.lx{position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;border:0;background:#E93E97;color:#fff;font-weight:900;line-height:1}`;
 document.head.appendChild(css);cvs=document.getElementById('cv');ctx=cvs.getContext('2d');setupOverlay();gestures();panel()}
return {after,ui,add,mascotSrc,EMO,composite}})();
