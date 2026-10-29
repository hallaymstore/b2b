(function(){
const API='https://prava-test-uz-pro.onrender.com';
const pricing=[{id:'week',label:'START',days:7,price:9900},{id:'month',label:'PLUS',days:30,price:24900},{id:'quarter',label:'MAX',days:90,price:59900}];
let token=localStorage.getItem('prava_pro_token')||'',account=null,checkoutReady=false,order=null,message='',watchTimer=null,processing=false;
const fmt=n=>new Intl.NumberFormat('uz-UZ').format(n)+' so‘m';
const active=()=>account?.isPro&&new Date(account.proUntil)>new Date();
function saveOrder(){if(order&&account)localStorage.setItem('prava_pending_order',JSON.stringify({owner:account.name,order}));else localStorage.removeItem('prava_pending_order')}
function restoreOrder(){try{const v=JSON.parse(localStorage.getItem('prava_pending_order')||'null');if(v&&account&&v.owner===account.name&&v.order?.orderId&&/^PRV-[a-f0-9]{24}$/.test(v.order.orderId))order=v.order;}catch{localStorage.removeItem('prava_pending_order')}}
function stopWatch(){if(watchTimer){clearInterval(watchTimer);watchTimer=null}}
async function syncPayment(){if(!order||!account)return;try{const p=await request('/api/payments/'+encodeURIComponent(order.orderId));if(p.status==='paid'){stopWatch();order=null;saveOrder();await refresh();message='✅ To‘lov tasdiqlandi. PRO obunangiz avtomatik faollashtirildi!';render()}else if(p.status==='cancel'){stopWatch();order=null;saveOrder();message='To‘lov muddati tugadi yoki bekor qilindi.';render()}else if(state.page==='pro'){message='⏳ To‘lov kutilmoqda. Karta o‘tkazmasi aniqlangach PRO avtomatik ochiladi.';render()}}catch(e){if(state.page==='pro'){message='To‘lovni tekshirishda uzilish: '+e.message;render()}}}
function watchOrder(){stopWatch();if(!order||!account)return;watchTimer=setInterval(syncPayment,5000);}
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const styles=document.createElement('style');
styles.textContent='.prpro{margin:12px 0 22px;padding:14px;background:#0f766e;color:#fff;border-radius:7px;display:flex;gap:16px;justify-content:space-between;align-items:center}.prpro button{border:1px solid #fff;background:#fff;color:#0e6058;border-radius:5px;padding:9px;font-weight:700;cursor:pointer}.prplans{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.prplan{background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:20px}.prplan.featured{border:2px solid #009e83}.prprice{font-size:25px;font-weight:800;margin:14px 0}.prplan li{margin:9px 0;font-size:12px}.prplan button{width:100%}.prgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0}.prfield{display:grid;gap:5px;margin:12px 0;font-size:13px}.prfield input{background:var(--paper);color:var(--ink);padding:12px;border-radius:5px;border:1px solid var(--line);width:100%}.prstatus{background:var(--paper);border:1px solid var(--line);padding:12px;border-radius:7px;margin:10px 0}.prtopic{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line);padding:12px 0}.prpro .button{background:white;color:#0d706b}@media(max-width:780px){.prplans,.prgrid{grid-template-columns:1fr}.prpro{align-items:flex-start;flex-direction:column}}body.pr-exam .sidebar{display:none}body.pr-exam .shell-main{margin-left:0}';
document.head.append(styles);
async function request(path,method='GET',data){
const r=await fetch(API+path,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{})});
const b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error||'Serverga ulanib bo‘lmadi');return b;
}
async function refresh(){
try{let x=await request('/api/config');checkoutReady=!!x.checkoutAvailable;if(token){try{account=(await request('/api/me')).user;if(!order)restoreOrder();if(order&&!watchTimer)watchOrder()}catch(e){account=null;stopWatch();message=e.message}}}
catch(e){checkoutReady=false;account=null;message='PRO serveri vaqtincha ishlamayapti.'}
if(state.page==='pro'||state.page==='analytics')render();
}
function proHTML(){
return heading('PREMIUM','PRAVA TEST PRO','Bepul imtihon va asosiy savollar ochiq. PRO faqat qo‘shimcha qulayliklar uchun.')+
'<div class="prstatus">'+(active()?'✅ PRO faol. Tugash sanasi: '+esc(new Date(account.proUntil).toLocaleDateString('uz-UZ')):checkoutReady?'💳 Hamyon bilan bir martalik to‘lov — avtomatik yechib olish yo‘q.':'⏳ Hamyon to‘lov sozlamalari hali ulanmagan. Hozir pul qabul qilinmaydi.')+'</div>'+
'<div class="prplans">'+pricing.map(p=>'<div class="prplan '+(p.id==='month'?'featured':'')+'"><div class="eyebrow">PRO '+p.label+'</div><h3>'+p.days+' kun</h3><div class="prprice">'+fmt(p.price)+'</div><ul><li>60 savolli marafon</li><li>Zaif mavzular tahlili</li><li>CSV natijalar eksporti</li><li>Reja va tavsiyalar</li></ul><button class="button" data-prplan="'+p.id+'" '+(!checkoutReady?'disabled':'')+'>PRO ni tanlash</button></div>').join('')+'</div>'+
'<div class="prgrid"><div class="card panel"><h3>Akkaunt</h3>'+(account?'<p>Login: <b>'+esc(account.name)+'</b></p><p>Status: '+(active()?'PRO':'Bepul')+'</p><button class="button secondary" data-prlogout>Chiqish</button>':'<form id="pr-login"><label class="prfield">Login<input required name="name" minlength="3" maxlength="24" autocomplete="username"></label><label class="prfield">Parol (kamida 10 belgi)<input type="password" name="password" minlength="10" required autocomplete="current-password"></label><button class="button" type="submit" value="login">Kirish</button> <button class="button secondary" type="submit" value="register">Ro‘yxatdan o‘tish</button></form>')+'<p style="font-size:12px;color:var(--muted);margin-top:10px">'+esc(message)+'</p></div>'+
'<div class="card panel"><h3>To‘lov holati</h3>'+(order?'<p>Buyurtma: <b>'+esc(order.orderId)+'</b></p><p>Karta: <b>'+esc(order.card)+'</b></p><p>Yakuniy summa: <b>'+fmt(order.amount)+'</b></p><p>Amal qilish muddati: 5 daqiqa.</p><p style="font-size:12px;color:var(--muted)">Pul kartaga tushganidan so‘ng PRO avtomatik yoqiladi. Ushbu sahifani ochiq qoldiring.</p><button class="button secondary" data-prcopy="card">Kartani nusxalash</button> <button class="button secondary" data-prcopy="amount">Summani nusxalash</button> <button class="button" data-prcheck>Holatni yangilash</button>':'<p>To‘lov uchun akkauntga kiring va yuqoridagi tariflardan birini tanlang.</p>')+'</div></div>'+
'<p class="muted" style="font-size:12px">Hozirgi baza: '+questions.length+' ta mustaqil o‘quv savoli. Bu rasmiy imtihon savollari banki emas. PRO xarid qilish imtihondan o‘tishni kafolatlamaydi.</p>';
}
function analyticsHTML(){
if(!active())return heading('PRO','Batafsil statistika','PRO bilan shaxsiy tahlilni oching.')+emptyView('chart','PRO talab etiladi','Tarifni tanlab, tahlil bo‘limini oching.','pro','PRO tariflar');
let sets=[...new Set(questions.map(q=>q.category))].map(cat=>{let a=questions.filter(q=>q.category===cat);return {cat,total:a.length,seen:a.filter(q=>user.solved[q.id]).length,wrong:a.filter(q=>user.mistakes.includes(q.id)).length}}).sort((a,b)=>(b.wrong/(b.seen||1))-(a.wrong/(a.seen||1)));
let exams=user.history.filter(x=>x.mode==='exam');let last=exams.slice(-5);let avg=last.length?Math.round(last.reduce((v,x)=>v+x.score/x.total*100,0)/last.length):0;
return heading('PRO TAHIL','Mavzular va natijalar','Zaif mavzularni ko‘rib, ustuvor mashqlarni tanlang.')+'<div class="stats-grid">'+statCard('chart',avg+'%','So‘nggi 5 imtihon')+statCard('alert',user.mistakes.length,'Xatolar')+statCard('check',Object.keys(user.solved).length,'Ishlangan savollar')+statCard('clipboard',exams.length,'Imtihonlar')+'</div><div class="card panel"><h3>Zaif mavzular</h3>'+sets.map(x=>'<div class="prtopic"><b>'+esc(x.cat)+'</b><span>'+x.seen+'/'+x.total+' ko‘rildi · '+x.wrong+' xato</span></div>').join('')+'<p style="margin-top:15px">Tavsiya: '+(sets[0]&&sets[0].wrong?'Avval '+esc(sets[0].cat)+' mavzusini mustahkamlang.':'Ko‘proq sinov ishlang; tahlil avtomatik yangilanadi.')+'</p><button class="button" data-prcsv>Natijalarni CSVga chiqarish</button></div>';
}
function marathonHTML(){
return heading('PRO MARAFON','60 savollik marafon','O‘quv bazasidan tasodifiy savollar bilan davomli mashq.')+'<div class="card panel"><h3>60 ta savol · javoblarga izoh</h3><p>Hozirgi bankda '+questions.length+' ta savol mavjud. Savollar har safar aralashtiriladi.</p><button class="button" '+(active()?'data-prmarathon':'data-nav="pro"')+'>'+(active()?'Marafonni boshlash':'PRO tariflarni ko‘rish')+'</button></div>';
}
function runMarathon(){
if(!active()){navigate('pro');return;}
let pool=mix(questions).slice(0,60);
state.session={mode:'practice',title:'PRO marafon',categoryB:'B',questions:pool.map(prep),responses:Array(pool.length).fill(null),current:0,started:Date.now(),limitSec:0,finished:false};state.page='quiz';storeSession();render();window.scrollTo({top:0});
}
function csv(){
let lines=[['sana','nomi','togri','jami','foiz'],...user.history.map(x=>[x.date,x.title,x.score,x.total,Math.round(100*x.score/x.total)])];
const csv='\uFEFF'+lines.map(x=>x.map(s=>'"'+String(s).replaceAll('"','""')+'"').join(',')).join('\r\n');
const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='prava-natijalar.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function boot(){
if(typeof render!=='function'||typeof NAV==='undefined'||typeof state==='undefined'){setTimeout(boot,100);return;}
PAGES.pro='PRO tariflar';PAGES.analytics='PRO tahlil';PAGES.marathon='Marafon';
NAV.splice(NAV.length-1,0,['marathon','award'],['analytics','chart'],['pro','spark']);
const prior=render;
render=function(){
document.body.classList.toggle('pr-exam',state.page==='quiz'&&state.session?.mode==='exam');
if(state.page==='pro'||state.page==='analytics'||state.page==='marathon'){
document.body.classList.toggle('dark',user.theme==='dark');const page=state.page;document.querySelector('#app').innerHTML=shell(page==='pro'?proHTML():page==='analytics'?analyticsHTML():marathonHTML());document.title=PAGES[page]+' | PRAVA TEST UZ';return;
}
prior();
if(state.page==='home'){const content=document.querySelector('.content');if(content){let e=document.createElement('div');e.className='prpro';e.innerHTML='<div><strong>⭐ PRAVA TEST PRO</strong><p>60 savolli marafon, kengaytirilgan statistika va o‘qish rejasi</p></div><button data-nav="pro">Tariflarni ko‘rish</button>';const stats=content.querySelector('.stats-grid');if(stats)stats.after(e)}}
};
render();refresh();
document.addEventListener('click',async e=>{
let b=e.target.closest('[data-prplan],[data-prlogout],[data-prcheck],[data-prcsv],[data-prmarathon],[data-prcopy]');if(!b)return;e.preventDefault();
if(b.hasAttribute('data-prlogout')){stopWatch();token='';account=null;order=null;localStorage.removeItem('prava_pro_token');saveOrder();message='Akkauntdan chiqildi';render();return}
if(b.hasAttribute('data-prmarathon')){runMarathon();return}
if(b.hasAttribute('data-prcsv')){if(active())csv();return}
if(b.hasAttribute('data-prcopy')){const value=b.dataset.prcopy==='card'?order?.card:order?.amount;if(value){try{await navigator.clipboard.writeText(String(value));message='Nusxalandi.'}catch{message='Nusxalash uchun HTTPS yoki brauzer ruxsatini tekshiring.'}render()}return}
if(processing)return;processing=true;try{
if(b.hasAttribute('data-prplan')){
if(!account){message='Avval ro‘yxatdan o‘ting yoki tizimga kiring.';render();return;}
order=await request('/api/checkout','POST',{plan:b.dataset.prplan});saveOrder();watchOrder();message='To‘lov yaratildi. Karta raqami va aniq summani tekshiring. To‘lov avtomatik kuzatiladi.';
}else if(b.hasAttribute('data-prcheck')&&order){
await syncPayment();
}
}catch(err){message=err.message}finally{processing=false}render();
});
document.addEventListener('submit',async e=>{
if(e.target.id!=='pr-login')return;e.preventDefault();const fd=new FormData(e.target);
try{const result=await request('/api/auth/'+(e.submitter?.value==='register'?'register':'login'),'POST',{name:fd.get('name'),password:fd.get('password')});token=result.token;account=result.user;localStorage.setItem('prava_pro_token',token);restoreOrder();watchOrder();message='Akkauntga kirildi.'}catch(err){message=err.message}render();
});
}
boot();
})();