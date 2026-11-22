import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {handleSupabase} from '../apps/api/supabase.mjs';
test('PostgreSQL real: permissões, API, distribuição e reservas transacionais',async()=>{
 const db=new PGlite();
 try{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  const sql=readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
  for(const role of ['anon','authenticated']){
   await db.exec('SET ROLE '+role);
   await assert.rejects(db.query("SELECT public.benicio_api('admin','{}')"),/permission denied/);
   await assert.rejects(db.query('SELECT * FROM benicio.families'),/permission denied/);
   await assert.rejects(db.query('SELECT public.benicio_public_event()'),/permission denied/);
   await db.exec('RESET ROLE');
  }
  await db.exec('SET ROLE service_role');
  const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test',ADMIN_PASSWORD:'uma-senha-de-teste'};
  const fetcher=async(url,opts)=>{const {p_action,p_data}=JSON.parse(opts.body);try{const r=await (String(url).endsWith('/benicio_public_event')?db.query('SELECT public.benicio_public_event() AS data'):db.query('SELECT public.benicio_api($1,$2::jsonb) AS data',[p_action,JSON.stringify(p_data)]));return Response.json(r.rows[0].data);}catch(e){return Response.json({code:e.code,message:e.message,details:e.detail},{status:400});}};
  const call=(url,method='GET',body,cookie,password=env.ADMIN_PASSWORD)=>handleSupabase({url,method,body,headers:{host:'test.example',cookie},socket:{remoteAddress:'127.0.0.1'}},{...env,ADMIN_PASSWORD:password},fetcher);
  const login=await call('/api/login','POST',{password:env.ADMIN_PASSWORD});assert.equal(login.status,200);const cookie=login.headers['Set-Cookie'].split(';')[0];
  assert.equal((await call('/api/admin','GET',undefined,cookie,'outra-senha')).status,401);
  assert.equal((await call('/api/admin/event','PUT',{date:'2027-01-20',time:'15:30',location:'Salão da família'},cookie)).status,200);
  const event=await call('/api/event');assert.equal(event.status,200);assert.equal(event.data.event.time,'15:30');assert.deepEqual(Object.keys(event.data),['event']);assert.deepEqual(Object.keys(event.data.event).sort(),['date','location','time']);
  for(const name of ['Manta','Toalha'])assert.equal((await call('/api/admin/gifts','POST',{name,image:'https://example.com/manta.jpg',url:'https://example.com',capacity:1},cookie)).status,201);
  const ids=[];for(let i=0;i<95;i++){const r=await call('/api/rsvp','POST',{name:'Família '+i,companions:i===0?['Bia']:[],noCompanions:i!==0});assert.equal(r.status,201);ids.push(r.data.id);}
  const counts=await db.query('SELECT diaper,count(*)::integer AS n FROM benicio.families GROUP BY diaper');assert.deepEqual(Object.fromEntries(counts.rows.map(r=>[r.diaper,r.n])),{RN:1,P:4,M:35,G:35,XG:20});
  const admin=await call('/api/admin','GET',undefined,cookie);assert.equal(admin.status,200);assert.equal(admin.data.families.length,95);const [g,h]=admin.data.gifts;
  assert.equal((await call('/api/families/'+ids[0])).data.event.location,'Salão da família');
  const reserve=(i,id)=>call('/api/families/'+ids[i]+'/reserve','POST',{giftId:id});
  assert.equal((await reserve(0,g.id)).status,200);assert.equal((await reserve(1,g.id)).status,409);
  assert.equal((await reserve(1,h.id)).status,200);assert.equal((await reserve(0,h.id)).status,409);
  assert.deepEqual((await call('/api/families/'+ids[0])).data.family.giftIds,[g.id]);
  assert.equal((await reserve(0,g.id)).status,200);
  assert.equal((await call('/api/admin/gifts/'+g.id,'DELETE',{},cookie)).status,400);
  assert.equal((await call('/api/families/'+ids[1]+'/reserve','DELETE',{giftId:h.id})).status,200);
  assert.equal((await reserve(0,h.id)).status,200);
  assert.equal((await reserve(0,h.id)).status,200);
  assert.deepEqual((await call('/api/families/'+ids[0])).data.family.giftIds.sort(),[g.id,h.id].sort());
  const multi=await call('/api/admin','GET',undefined,cookie);
  assert.equal(multi.data.families.length,95);
  assert.equal(multi.data.gifts.find(x=>x.id===h.id).reserved,1);
  assert.equal((await call('/api/families/'+ids[0]+'/reserve','DELETE',{giftId:g.id})).status,200);
  assert.deepEqual((await call('/api/families/'+ids[0])).data.family.giftIds,[h.id]);
  assert.equal((await reserve(1,g.id)).status,200);
  for(let i=0;i<19;i++)await call('/api/login','POST',{password:'errada'});
  assert.equal((await call('/api/login','POST',{password:env.ADMIN_PASSWORD})).status,429);
  const a=await call('/api/admin','GET',undefined,cookie);assert.equal(a.data.families.filter(f=>f.giftIds.length).length,2);
 }finally{await db.close();}
});
