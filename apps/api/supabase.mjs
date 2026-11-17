import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const str=(v,max=120)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail('Preencha os campos corretamente.');return v.trim();};
const safeUrl=v=>{try{const u=new URL(str(v,2000));if(u.protocol!=='https:')fail('Use um link HTTPS.');return u.href;}catch{fail('Use um link HTTPS válido.');}};
const hash=v=>createHash('sha256').update(v).digest();
export async function handleSupabase(req,env,fetcher=fetch){
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
 const reply=(status,data)=>({status,data,headers});
 try{
 if(!env.SUPABASE_URL||!env.SUPABASE_SECRET_KEY||!env.ADMIN_PASSWORD)fail('Configure o banco e a senha nas variáveis da Vercel.',503);
 const base=new URL(env.SUPABASE_URL);if(base.protocol!=='https:')fail('Configuração do banco inválida.',503);
 const method=req.method;
 const url=new URL(req.url,'https://'+(req.headers.host||'localhost'));
 const route=req.query?.route||url.searchParams.get('route');
 const p=route?'/api/'+(Array.isArray(route)?route.join('/'):route):url.pathname;
 const origin=req.headers.origin;
 if(['POST','PUT','DELETE'].includes(method)&&origin&&new URL(origin).host!==req.headers.host)fail('Origem inválida.',403);
 let body={};if(['POST','PUT'].includes(method)){
  if(req.body!==undefined){try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{fail('Dados inválidos.');}}
  else{let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>20000)fail('Conteúdo muito grande.',413);}try{body=JSON.parse(raw||'{}');}catch{fail('Dados inválidos.');}}
  if(Buffer.byteLength(JSON.stringify(body))>20000)fail('Conteúdo muito grande.',413);
  if(!body||typeof body!=='object'||Array.isArray(body))fail('Dados inválidos.');
 }
 const key=env.SUPABASE_SECRET_KEY;
 const rpc=async(action,data={})=>{
  const response=await fetcher(new URL('/rest/v1/rpc/benicio_api',base),{method:'POST',headers:{'Content-Type':'application/json',apikey:key,...(key.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+key})},body:JSON.stringify({p_action:action,p_data:data}),signal:AbortSignal.timeout(12000)});
  const result=await response.json();
  if(!response.ok){if(result.code==='P0001')fail(result.message,[400,401,404,409,429].includes(Number(result.details))?Number(result.details):400);throw new Error('Falha na comunicação com o banco.');}
  return result;
 };
 const scope=hash(env.ADMIN_PASSWORD).toString('hex');
 if(p==='/api/login'&&method==='POST'){
  const attempt=await rpc('login_attempt',{ip:req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim()||req.socket?.remoteAddress||'unknown'});
  if(attempt.blocked)fail('Tente novamente em 15 minutos.',429);
  if(typeof body.password!=='string'||!timingSafeEqual(hash(body.password),hash(env.ADMIN_PASSWORD)))fail('Senha incorreta.',401);
  const value=randomBytes(32).toString('hex');
  await rpc('session',{token:hash(value).toString('hex'),scope});
  headers['Set-Cookie']=`admin=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`;
  return reply(200,{ok:true});
 }
 let auth={};if(p.startsWith('/api/admin')){
  const value=req.headers.cookie?.match(/(?:^|; )admin=([^;]+)/)?.[1];if(!value)fail('Entre no painel para continuar.',401);
  auth={token:hash(value).toString('hex'),scope};
 }
 if(p==='/api/admin'&&method==='GET')return reply(200,await rpc('admin',auth));
 if(p==='/api/admin/event'&&method==='PUT'){
  const date=str(body.date,10),time=str(body.time,5),location=str(body.location,500);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||Number.isNaN(Date.parse(date)))fail('Data ou horário inválido.');
  return reply(200,await rpc('event',{...auth,date,time,location}));
 }
 if(p==='/api/admin/gifts'&&method==='POST'){
  if(!Number.isInteger(body.capacity)||body.capacity<1||body.capacity>10000)fail('Limite inválido.');
  return reply(201,await rpc('gift_add',{...auth,id:crypto.randomUUID(),name:str(body.name),image:safeUrl(body.image),url:safeUrl(body.url),capacity:body.capacity}));
 }
 if(p.startsWith('/api/admin/gifts/')&&method==='DELETE')return reply(200,await rpc('gift_delete',{...auth,id:str(p.split('/').pop())}));
 if(p==='/api/rsvp'&&method==='POST'){
  const name=str(body.name);if(typeof body.noCompanions!=='boolean'||!Array.isArray(body.companions)||body.companions.length>20)fail('Informe os acompanhantes.');
  const companions=body.companions.map(n=>str(n));if(body.noCompanions&&companions.length||!body.noCompanions&&!companions.length)fail('Informe os acompanhantes ou marque que não tem.');
  return reply(201,await rpc('rsvp',{id:randomBytes(24).toString('hex'),name,companions}));
 }
 const match=p.match(/^\/api\/families\/([a-f0-9]{48})(\/reserve)?$/);
 if(match){if(!match[2]&&method==='GET')return reply(200,await rpc('family',{id:match[1]}));
 if(match[2]&&method==='POST')return reply(200,await rpc('reserve',{id:match[1],giftId:str(body.giftId)}));}
 fail('Não encontrado.',404);
 }catch(e){if(!e.status)console.error('Erro na API Supabase:',e.name);return reply(e.status||503,{error:e.status?e.message:'Não foi possível acessar o banco. Verifique a configuração e tente novamente.'});}
}
