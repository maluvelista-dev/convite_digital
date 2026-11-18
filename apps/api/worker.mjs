const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const str=(v,max=120)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail('Preencha os campos corretamente.');return v.trim();};
const safeUrl=v=>{try{const u=new URL(str(v,2000));if(u.protocol!=='https:')fail('Use um link HTTPS.');return u.href;}catch{fail('Use um link HTTPS válido.');}};
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async v=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
async function equal(a,b){const [x,y]=await Promise.all([digest(a),digest(b)]);let n=0;for(let i=0;i<x.length;i++)n|=x[i]^y[i];return n===0;}
const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; img-src 'self' https:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
const json=(status,data,headers={})=>Response.json(data,{status,headers:{...security,'Cache-Control':'no-store',...headers}});
export default {async fetch(request,env){
 try{
 const url=new URL(request.url),p=url.pathname,method=request.method;
 if(!p.startsWith('/api/')){
   const asset=new URL(request.url);if(p==='/admin'||p==='/')asset.pathname='/index.html';
   const response=await env.ASSETS.fetch(new Request(asset,request));const headers=new Headers(response.headers);for(const [k,v]of Object.entries(security))headers.set(k,v);
   if(p==='/'||p==='/admin'||p==='/index.html')headers.set('Cache-Control','no-cache');
   return new Response(response.body,{status:response.status,headers});
 }
 if(!env.DB||!env.ADMIN_PASSWORD)fail('A hospedagem ainda precisa ser configurada.',503);
 const db=env.DB;
 const query=(sql,...values)=>db.prepare(sql).bind(...values);
 const first=(sql,...values)=>query(sql,...values).first();
 const all=async(sql,...values)=>(await query(sql,...values).all()).results;
 const run=(sql,...values)=>query(sql,...values).run();
 let body={};if(['POST','PUT'].includes(method)){const reader=request.body?.getReader();let size=0;const chunks=[];if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>20000){await reader.cancel();fail('Conteúdo muito grande.',413);}chunks.push(value);}}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}try{body=JSON.parse(new TextDecoder().decode(bytes)||'{}');}catch{fail('Dados inválidos.');}}
 if(['POST','PUT','DELETE'].includes(method)&&request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)fail('Origem inválida.',403);
 const family=async id=>{const f=await first('SELECT f.*,r.gift_id AS giftId FROM families f LEFT JOIN reservations r ON r.family_id=f.id WHERE f.id=?',id);if(!f)fail('Confirmação não encontrada.',404);return {...f,companions:JSON.parse(f.companions)};};
 const gifts=()=>all('SELECT g.*,(SELECT COUNT(*) FROM reservations r WHERE r.gift_id=g.id) AS reserved FROM gifts g ORDER BY rowid');
 if(p==='/api/login'&&method==='POST'){
  const now=Date.now();const ip=request.headers.get('CF-Connecting-IP')||'local';
  await db.batch([query('DELETE FROM sessions WHERE expires<?',now),query('DELETE FROM login_attempts WHERE expires<?',now)]);
  const attempt=await first('INSERT INTO login_attempts VALUES(?,1,?) ON CONFLICT(ip) DO UPDATE SET n=n+1 RETURNING n',ip,now+900000);if(attempt.n>20)fail('Tente novamente em 15 minutos.',429);
  if(typeof body.password!=='string'||!await equal(body.password,env.ADMIN_PASSWORD))fail('Senha incorreta.',401);
  const value=token();await run('INSERT INTO sessions VALUES(?,?)',value,now+28800000);
  return json(200,{ok:true},{'Set-Cookie':`admin=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`});
 }
 if(p.startsWith('/api/admin')){
  const value=request.headers.get('Cookie')?.match(/(?:^|; )admin=([^;]+)/)?.[1];if(!value||!await first('SELECT 1 FROM sessions WHERE token=? AND expires>?',value,Date.now()))fail('Entre no painel para continuar.',401);
  if(p==='/api/admin'&&method==='GET'){const rows=await all('SELECT f.*,r.gift_id AS giftId FROM families f LEFT JOIN reservations r ON r.family_id=f.id ORDER BY created DESC');return json(200,{families:rows.map(f=>({...f,companions:JSON.parse(f.companions)})),gifts:await gifts(),event:await first('SELECT * FROM settings')});}
  if(p==='/api/admin/event'&&method==='PUT'){const date=str(body.date,10),time=str(body.time,5),location=str(body.location,500);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))fail('Data ou horário inválido.');await run('UPDATE settings SET date=?,time=?,location=? WHERE id=1',date,time,location);return json(200,{ok:true});}
  if(p==='/api/admin/gifts'&&method==='POST'){if(!Number.isInteger(body.capacity)||body.capacity<1||body.capacity>10000)fail('Limite inválido.');await run('INSERT INTO gifts VALUES(?,?,?,?,?)',crypto.randomUUID(),str(body.name),safeUrl(body.image),safeUrl(body.url),body.capacity);return json(201,{ok:true});}
  if(p.startsWith('/api/admin/gifts/')&&method==='DELETE'){const id=p.split('/').pop();const result=await run('DELETE FROM gifts WHERE id=? AND NOT EXISTS(SELECT 1 FROM reservations WHERE gift_id=?)',id,id);if(!result.meta.changes&&await first('SELECT 1 FROM gifts WHERE id=?',id))fail('Este mimo já tem reservas.');return json(200,{ok:true});}
 }
 if(p==='/api/rsvp'&&method==='POST'){
  const name=str(body.name);if(typeof body.noCompanions!=='boolean'||!Array.isArray(body.companions)||body.companions.length>20)fail('Informe os acompanhantes.');
  const companions=body.companions.map(n=>str(n));if(body.noCompanions&&companions.length||!body.noCompanions&&!companions.length)fail('Informe os acompanhantes ou marque que não tem.');
  const id=token();
  // Calcula e insere numa única instrução: confirmações simultâneas não leem a mesma contagem.
  await run(`INSERT INTO families(id,name,companions,diaper,created)
    SELECT ?,?,?,size,? FROM (
      SELECT 'RN' AS size,1 AS weight,0 AS ord UNION ALL SELECT 'P',4,1
      UNION ALL SELECT 'M',35,2 UNION ALL SELECT 'G',35,3 UNION ALL SELECT 'XG',20,4
    ) ORDER BY ((SELECT COUNT(*)+1 FROM families)*weight/95.0-(SELECT COUNT(*) FROM families WHERE diaper=size)) DESC,ord LIMIT 1`,id,name,JSON.stringify(companions),new Date().toISOString());
  return json(201,{id});
 }
 const match=p.match(/^\/api\/families\/([a-f0-9]{48})(\/reserve)?$/);
 if(match){const f=await family(match[1]);
  if(!match[2]&&method==='GET')return json(200,{family:f,event:await first('SELECT * FROM settings'),gifts:await gifts()});
  if(match[2]&&method==='POST'){
   const id=str(body.giftId);
   // Só altera a reserva quando há vaga; a escolha anterior permanece se estiver esgotado.
   const result=await run(`INSERT INTO reservations(family_id,gift_id)
     SELECT ?,id FROM gifts WHERE id=? AND (
       (SELECT COUNT(*) FROM reservations WHERE gift_id=gifts.id)<capacity
       OR EXISTS(SELECT 1 FROM reservations WHERE family_id=? AND gift_id=gifts.id)
     ) ON CONFLICT(family_id) DO UPDATE SET gift_id=excluded.gift_id`,f.id,id,f.id);
   if(!result.meta.changes){if(!await first('SELECT 1 FROM gifts WHERE id=?',id))fail('Mimo não encontrado.',404);fail('Esse mimo acabou de ser reservado. Escolha outro.',409);}
   return json(200,{ok:true});
  }
 }
 fail('Não encontrado.',404);
 }catch(e){if(!e.status)console.error(e);return json(e.status||500,{error:e.status?e.message:'Não foi possível concluir. Tente novamente.'});}
}};
