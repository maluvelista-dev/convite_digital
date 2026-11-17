import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../apps/api/worker.mjs';
test('Worker: login, distribuição, reservas, troca e preservação de reserva sem vaga',async()=>{
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');sqlite.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
 const prepare=(sql,values=[])=>({bind(...args){return prepare(sql,args);},async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){return {meta:sqlite.prepare(sql).run(...values)};}});
 const env={DB:{prepare,async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}},ADMIN_PASSWORD:'senha-de-teste',ASSETS:{fetch:async()=>new Response('convite')}};
 const call=async(p,method='GET',data,cookie)=>{const response=await worker.fetch(new Request('https://benicio.example'+p,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined}),env);return {response,data:await response.json()};};
 try{
 assert.equal((await call('/api/admin')).response.status,401);
 assert.equal((await call('/api/login','POST',{password:'errada'})).response.status,401);
 const login=await call('/api/login','POST',{password:env.ADMIN_PASSWORD});assert.equal(login.response.status,200);const cookie=login.response.headers.get('set-cookie').split(';')[0];
 for(const name of ['Manta','Toalha'])assert.equal((await call('/api/admin/gifts','POST',{name,image:'https://example.com/img.jpg',url:'https://example.com',capacity:1},cookie)).response.status,201);
 const ids=[];for(let i=0;i<102;i++){const r=await call('/api/rsvp','POST',{name:'Família '+i,companions:[],noCompanions:true});assert.equal(r.response.status,201);ids.push(r.data.id);}
 const counts=sqlite.prepare('SELECT diaper,COUNT(*) AS n FROM families GROUP BY diaper').all();assert.deepEqual(Object.fromEntries(counts.map(r=>[r.diaper,r.n])),{G:35,M:35,P:12,RN:8,XG:12});
 const admin=await call('/api/admin','GET',undefined,cookie);const [g,h]=admin.data.gifts;
 assert.equal((await call(`/api/families/${ids[0]}/reserve`,'POST',{giftId:g.id})).response.status,200);
 assert.equal((await call(`/api/families/${ids[1]}/reserve`,'POST',{giftId:g.id})).response.status,409);
 assert.equal((await call(`/api/families/${ids[1]}/reserve`,'POST',{giftId:h.id})).response.status,200);
 assert.equal((await call(`/api/families/${ids[0]}/reserve`,'POST',{giftId:h.id})).response.status,409);
 assert.equal((await call(`/api/families/${ids[0]}`)).data.family.giftId,g.id);
 assert.equal((await call(`/api/families/${ids[0]}/reserve`,'POST',{giftId:g.id})).response.status,200);
 assert.equal((await call('/api/admin/gifts/'+g.id,'DELETE',undefined,cookie)).response.status,400);
 assert.equal((await worker.fetch(new Request('https://benicio.example/admin'),env)).status,200);
 }finally{sqlite.close();}
});
