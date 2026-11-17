import http from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { database, nextSize } from './database.mjs';
const root = fileURLToPath(new URL('../../',import.meta.url));
mkdirSync(root+'data',{recursive:true});
const db=database(process.env.DB_PATH||root+'data/benicio.sqlite');
const password=process.env.ADMIN_PASSWORD||randomBytes(18).toString('base64url');
if(!process.env.ADMIN_PASSWORD) console.log('Senha administrativa temporária: '+password);
const sessions=new Map(); const attempts=new Map();
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const str=(v,max=120)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max) fail('Preencha os campos corretamente.');return v.trim();};
const safeUrl=v=>{if(!v)return '';try{const u=new URL(v);if(!['https:','http:'].includes(u.protocol))fail('Link inválido.');return u.href;}catch{fail('Link inválido.');}};
function family(id){ const f=db.prepare('SELECT * FROM families WHERE id=?').get(id);if(!f)fail('Confirmação não encontrada.',404);return {...f,companions:JSON.parse(f.companions),giftId:db.prepare('SELECT gift_id FROM reservations WHERE family_id=?').get(id)?.gift_id||null};}
function gifts(){return db.prepare('SELECT g.*, (SELECT COUNT(*) FROM reservations r WHERE r.gift_id=g.id) AS reserved FROM gifts g ORDER BY rowid').all();}
function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' https: http:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
 try {
 const url=new URL(req.url,'http://localhost'); const p=url.pathname;
 let body={}; if(['POST','PUT'].includes(req.method)){let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>20000)fail('Conteúdo muito grande.',413);}try{body=JSON.parse(raw||'{}');}catch{fail('Dados inválidos.');}}
 if(p==='/api/login'&&req.method==='POST'){
 const ip=req.socket.remoteAddress;const a=attempts.get(ip)||{n:0,until:Date.now()+900000};if(a.until<Date.now()){a.n=0;a.until=Date.now()+900000;}if(++a.n>20)fail('Tente novamente em 15 minutos.',429);attempts.set(ip,a);
 const x=Buffer.from(String(body.password||'')),y=Buffer.from(password);if(x.length!==y.length||!timingSafeEqual(x,y))fail('Senha incorreta.',401);
 const token=randomBytes(32).toString('hex');sessions.set(token,Date.now()+8*3600000);res.setHeader('Set-Cookie',`admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${req.socket.encrypted||req.headers['x-forwarded-proto']==='https'?'; Secure':''}`);return json(res,200,{ok:true});}
 if(p.startsWith('/api/admin')){const token=req.headers.cookie?.match(/(?:^|; )admin=([^;]+)/)?.[1];if(!token||!(sessions.get(token)>Date.now()))fail('Entre no painel para continuar.',401);if(['POST','PUT','DELETE'].includes(req.method)&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)fail('Origem inválida.',403);
 if(p==='/api/admin'&&req.method==='GET')return json(res,200,{families:db.prepare('SELECT id FROM families ORDER BY created DESC').all().map(f=>family(f.id)),gifts:gifts(),event:db.prepare('SELECT * FROM settings').get()});
 if(p==='/api/admin/event'&&req.method==='PUT'){const date=str(body.date,10),time=str(body.time,5),location=str(body.location,500);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))fail('Data ou horário inválido.');db.prepare('UPDATE settings SET date=?,time=?,location=? WHERE id=1').run(date,time,location);return json(res,200,{ok:true});}
 if(p==='/api/admin/gifts'&&req.method==='POST'){const name=str(body.name),image=safeUrl(str(body.image,2000)),link=safeUrl(str(body.url,2000));if(!Number.isInteger(body.capacity)||body.capacity<1||body.capacity>10000)fail('Limite inválido.');db.prepare('INSERT INTO gifts VALUES(?,?,?,?,?)').run(randomUUID(),name,image,link,body.capacity);return json(res,201,{ok:true});}
 if(p.startsWith('/api/admin/gifts/')&&req.method==='DELETE'){const id=p.split('/').pop();if(db.prepare('SELECT 1 FROM reservations WHERE gift_id=?').get(id))fail('Este mimo já tem reservas.');db.prepare('DELETE FROM gifts WHERE id=?').run(id);return json(res,200,{ok:true});}
 }
 if(p==='/api/rsvp'&&req.method==='POST'){
 const name=str(body.name);if(typeof body.noCompanions!=='boolean'||!Array.isArray(body.companions)||body.companions.length>20)fail('Informe os acompanhantes.');
 const companions=body.companions.map(n=>str(n));if(body.noCompanions&&companions.length||!body.noCompanions&&!companions.length)fail('Informe os acompanhantes ou marque que não tem.');
 const id=transaction(()=>{const id=randomBytes(24).toString('hex');const diaper=nextSize(db.prepare('SELECT diaper FROM families').all());db.prepare('INSERT INTO families VALUES(?,?,?,?,?)').run(id,name,JSON.stringify(companions),diaper,new Date().toISOString());return id;});return json(res,201,{id});}
 const match=p.match(/^\/api\/families\/([a-f0-9]{48})(\/reserve)?$/);
 if(match){const f=family(match[1]);if(!match[2]&&req.method==='GET')return json(res,200,{family:f,event:db.prepare('SELECT * FROM settings').get(),gifts:gifts()});
 if(match[2]&&req.method==='POST'){transaction(()=>{const gift=db.prepare('SELECT * FROM gifts WHERE id=?').get(str(body.giftId));if(!gift)fail('Mimo não encontrado.',404);const old=db.prepare('SELECT gift_id FROM reservations WHERE family_id=?').get(f.id);if(old?.gift_id===gift.id)return;if(db.prepare('SELECT COUNT(*) AS n FROM reservations WHERE gift_id=?').get(gift.id).n>=gift.capacity)fail('Esse mimo acabou de ser reservado. Escolha outro.',409);db.prepare('INSERT INTO reservations VALUES(?,?) ON CONFLICT(family_id) DO UPDATE SET gift_id=excluded.gift_id').run(f.id,gift.id);});return json(res,200,{ok:true});}}
 if(p.startsWith('/api/'))fail('Não encontrado.',404);
 if(req.method!=='GET')fail('Método não permitido.',405);
 const files={'/':'index.html','/admin':'index.html','/app.js':'app.js','/style.css':'style.css','/convite.jpeg':'convite.jpeg'};const file=files[p];if(!file)fail('Não encontrado.',404);
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'image/jpeg');res.end(readFileSync(root+'apps/web/public/'+file));
 }catch(e){if(!e.status)console.error(e);json(res,e.status||500,{error:e.status?e.message:'Não foi possível concluir. Tente novamente.'});}
});
server.listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log(`Convite: http://localhost:${process.env.PORT||3000} • Painel: /admin`));
