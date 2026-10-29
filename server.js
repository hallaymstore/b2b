'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {MongoClient,ObjectId}=require('mongodb');
const PORT=Number(process.env.PORT||10000),ROOT=__dirname;
const URI=process.env.MONGODB_URI||'',SECRET=process.env.SESSION_SECRET||'',SHOP=process.env.HAMYON_SHOP_ID||'',KEY=process.env.HAMYON_SHOP_KEY||'';
const READY=!!(URI&&SECRET.length>=32&&SHOP&&KEY);
const PLANS={week:{days:7,price:9900},month:{days:30,price:24900},quarter:{days:90,price:59900}};
const ALLOWED=new Set(['https://prava-test-uz.onrender.com','https://prava-test-uz-pro.onrender.com','http://localhost:3000','http://localhost:10000']);
let db=null;const limits=new Map();
setInterval(()=>{const now=Date.now();for(const [k,v] of limits)if(now-v.start>120000)limits.delete(k)},60000).unref();
const random=()=>crypto.randomBytes(12).toString('hex');
function send(res,status,data,cors){const body=JSON.stringify(data);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),'cache-control':'no-store',...cors});res.end(body)}
function signature(id,amount){return crypto.createHash('md5').update(String(SHOP)+String(id)+String(amount)+String(KEY)).digest('hex')}
function same(a,b){if(!/^[a-fA-F0-9]{32}$/.test(String(a))||!/^[a-fA-F0-9]{32}$/.test(String(b)))return false;return crypto.timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'))}
function pwHash(p,salt){return crypto.scryptSync(p,salt,64).toString('hex')}
function tokenFor(user){const body=Buffer.from(JSON.stringify({id:String(user._id),exp:Date.now()+2592000000})).toString('base64url');return body+'.'+crypto.createHmac('sha256',SECRET).update(body).digest('base64url')}
function tokenId(tok){try{if(!tok||tok.length>4096||!SECRET)return null;const [body,mac]=tok.split('.'),sig=crypto.createHmac('sha256',SECRET).update(body).digest('base64url');if(mac.length!==sig.length||!crypto.timingSafeEqual(Buffer.from(mac),Buffer.from(sig)))return null;const data=JSON.parse(Buffer.from(body,'base64url'));return data.exp>Date.now()&&/^[a-f0-9]{24}$/.test(data.id)?new ObjectId(data.id):null}catch{return null}}
async function bodyOf(req){return new Promise((yes,no)=>{let bytes=0,parts=[];req.on('data',x=>{bytes+=x.length;if(bytes>32768){no(new Error('Body too large'));req.destroy();return}parts.push(x)});req.on('end',()=>{try{const data=Buffer.concat(parts).toString();yes(String(req.headers['content-type']||'').includes('application/json')?JSON.parse(data||'{}'):Object.fromEntries(new URLSearchParams(data)))}catch{no(new Error('Invalid body'))}});req.on('error',no)})}
function publicUser(u){return {name:u.name,isPro:new Date(u.proUntil||0).getTime()>Date.now(),proUntil:u.proUntil||null}}
async function credit(payment){
for(let n=0;n<12;n++){
const u=await db.collection('users').findOne({_id:payment.userId});if(!u)return;
if((u.appliedPayments||[]).includes(payment.paymentId))return;
const expiry=new Date(Math.max(Date.now(),new Date(u.proUntil||0).getTime())+PLANS[payment.plan].days*86400000);
const ok=await db.collection('users').updateOne({_id:u._id,version:u.version||0,appliedPayments:{$ne:payment.paymentId}},{$set:{proUntil:expiry},$addToSet:{appliedPayments:payment.paymentId},$inc:{version:1}});
if(ok.modifiedCount){await db.collection('payments').updateOne({_id:payment._id},{$set:{credited:true}});return;}
}
throw new Error('Entitlement concurrency conflict')
}
async function api(req,res,url){
const origin=req.headers.origin,cors=origin?{'access-control-allow-origin':origin,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'authorization,content-type','vary':'Origin'}:{};
if(origin&&!ALLOWED.has(origin))return send(res,403,{error:'Origin denied'},{});
if(req.method==='OPTIONS')return send(res,200,{ok:true},cors);
const done=(code,data)=>send(res,code,data,cors),route=url.pathname;
if(route==='/api/health')return done(200,{ok:true,storage:!!db,checkout:READY&&!!db});
if(route==='/api/config')return done(200,{checkoutAvailable:READY&&!!db,plans:Object.entries(PLANS).map(([id,p])=>({id,...p}))});
if(!db)return done(503,{error:'Akkaunt va to‘lov bazasi hali sozlanmagan'});
const ip=String(req.socket.remoteAddress||'');const limitKey=ip+route,now=Date.now(),old=limits.get(limitKey)||{start:now,count:0};
if(now-old.start>60000){old.start=now;old.count=0}old.count++;limits.set(limitKey,old);
if(old.count>(route.includes('/auth/')?12:60))return done(429,{error:'So‘rovlar juda ko‘p'});
if(route==='/api/hamyon/prepare'||route==='/api/hamyon/complete'){
if(req.method!=='POST')return done(405,{error:'Method not allowed'});
const p=await bodyOf(req),id=String(p.payment_id||''),amount=String(p.amount||'');
if(!READY||String(p.shop_id)!==SHOP||!same(p.sign,signature(id,amount)))return done(403,{error:'Invalid payment signature'});
const order=await db.collection('payments').findOne({paymentId:id,amount:Number(amount)});
if(!order||String(p.order_id||order.orderId)!==order.orderId)return done(404,{error:'Unknown payment'});
if(route.endsWith('/prepare'))return done(200,{ok:true});
if(!['paid','cancel'].includes(p.status))return done(400,{error:'Invalid payment status'});
if(p.status==='paid'){
 if(order.status==='cancel')return done(409,{error:'Payment already canceled'});
 await db.collection('payments').updateOne({_id:order._id,status:{$in:['pending','paid']}},{$set:{status:'paid',paidAt:new Date()}});
 await credit(order);
}else if(order.status==='pending')await db.collection('payments').updateOne({_id:order._id,status:'pending'},{$set:{status:'cancel'}});
return done(200,{ok:true})
}
if(route==='/api/auth/register'||route==='/api/auth/login'){
if(req.method!=='POST')return done(405,{error:'Method not allowed'});
const p=await bodyOf(req),name=String(p.name||'').trim().toLowerCase(),password=String(p.password||'');
if(!/^[a-z0-9_.-]{3,24}$/.test(name)||password.length<10||password.length>128)return done(400,{error:'Login 3-24 belgidan, parol 10-128 belgidan iborat bo‘lsin'});
let u;if(route.endsWith('/register')){
const salt=crypto.randomBytes(24).toString('hex');
try{const inserted=await db.collection('users').insertOne({name,salt,passwordHash:pwHash(password,salt),proUntil:new Date(0),version:0,appliedPayments:[],createdAt:new Date()});u=await db.collection('users').findOne({_id:inserted.insertedId})}catch(e){if(e.code===11000)return done(409,{error:'Login band'});throw e}
}else{u=await db.collection('users').findOne({name});if(!u)return done(401,{error:'Login yoki parol xato'});const got=Buffer.from(pwHash(password,u.salt),'hex'),expected=Buffer.from(u.passwordHash,'hex');if(got.length!==expected.length||!crypto.timingSafeEqual(got,expected))return done(401,{error:'Login yoki parol xato'})}
return done(200,{token:tokenFor(u),user:publicUser(u)})
}
const bearer=(req.headers.authorization||'').match(/^Bearer (.+)$/),id=tokenId(bearer?.[1]);
const user=id?await db.collection('users').findOne({_id:id}):null;
if(!user)return done(401,{error:'Avval akkauntga kiring'});
if(route==='/api/me'&&req.method==='GET')return done(200,{user:publicUser(user)});
if(route==='/api/checkout'&&req.method==='POST'){
if(!READY)return done(503,{error:'Hamyon sozlanmagan'});
const {plan}=await bodyOf(req);if(!PLANS[plan])return done(400,{error:'Tarif topilmadi'});
await db.collection('payments').updateMany({status:'pending',createdAt:{$lt:new Date(Date.now()-6*60000)}},{$set:{status:'cancel'}});
let saved=null;
for(let tries=0;tries<80;tries++){
const amount=PLANS[plan].price+crypto.randomInt(0,200),orderId='PRV-'+random();
try{const add=await db.collection('payments').insertOne({orderId,userId:user._id,plan,amount,status:'pending',createdAt:new Date(),credited:false});saved={orderId,amount,id:add.insertedId};break}catch(e){if(e.code!==11000)throw e}
}
if(!saved)return done(503,{error:'To‘lov navbati band'});
try{
const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);let r;
try{r=await fetch('https://hamyon-api.uz/payment/create',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({shop_id:SHOP,shop_key:KEY,amount:String(saved.amount),order_id:saved.orderId}),signal:controller.signal})}finally{clearTimeout(timer)}
const result=await r.json();if(!r.ok||!result.payment_id||!result.card)throw Error('Provider rejected');
await db.collection('payments').updateOne({_id:saved.id},{$set:{paymentId:String(result.payment_id),card:String(result.card),expiresAt:new Date(Date.now()+300000)}});
return done(200,{orderId:saved.orderId,amount:saved.amount,card:String(result.card),expiresIn:300});
}catch(e){await db.collection('payments').updateOne({_id:saved.id},{$set:{status:'cancel'}});return done(502,{error:'To‘lov yaratilmadi'})}
}
const m=route.match(/^\/api\/payments\/([A-Z0-9-]+)$/);
if(m&&req.method==='GET'){
const p=await db.collection('payments').findOne({orderId:m[1],userId:user._id});if(!p)return done(404,{error:'Buyurtma topilmadi'});
return done(200,{status:p.status,orderId:p.orderId,amount:p.amount,plan:p.plan,proUntil:(await db.collection('users').findOne({_id:user._id})).proUntil})
}
return done(404,{error:'Endpoint topilmadi'})
}
http.createServer(async(req,res)=>{
res.setHeader('x-content-type-options','nosniff');res.setHeader('x-frame-options','DENY');res.setHeader('referrer-policy','strict-origin-when-cross-origin');
try{const url=new URL(req.url,'http://localhost');
if(url.pathname.startsWith('/api/'))return await api(req,res,url);
if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'Method not allowed'});
const part=decodeURIComponent(url.pathname==='/'?'index.html':url.pathname.substring(1));
if(part.includes('..')||part.includes('\\')||!['index.html','premium.js'].includes(part))return send(res,404,{error:'Not found'});
const file=path.join(ROOT,part);
const stat=await fs.promises.stat(file).catch(()=>null);if(!stat)return send(res,404,{error:'Not found'});
res.writeHead(200,{'content-type':part.endsWith('.js')?'application/javascript; charset=utf-8':'text/html; charset=utf-8','cache-control':'no-cache'});fs.createReadStream(file).pipe(res)
}catch(err){console.error(err.message);if(!res.headersSent)send(res,400,{error:'So‘rov xatosi'});else res.end()}
}).listen(PORT,'0.0.0.0',()=>console.log('PRAVA PRO server listening on '+PORT+', checkout configured: '+READY));
if(URI){
const client=new MongoClient(URI,{serverSelectionTimeoutMS:7000});
client.connect().then(async()=>{db=client.db(process.env.MONGODB_DB||'prava_test');
await Promise.all([db.collection('users').createIndex({name:1},{unique:true}),db.collection('payments').createIndex({orderId:1},{unique:true}),db.collection('payments').createIndex({paymentId:1},{unique:true,sparse:true}),db.collection('payments').createIndex({amount:1},{unique:true,partialFilterExpression:{status:'pending'}})]);
console.log('MongoDB connected')}).catch(e=>{db=null;console.error('MongoDB unavailable',e.message)})
}