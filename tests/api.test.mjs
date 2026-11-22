import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('confirmação, privacidade, reserva concorrente e painel',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'benicio-'));const port=31979;
 const child=spawn(process.execPath,['apps/api/server.mjs'],{env:{...process.env,PORT:String(port),DB_PATH:join(dir,'test.sqlite'),ADMIN_PASSWORD:'teste-integracao'},stdio:['ignore','pipe','pipe']});
 try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Servidor não iniciou')),10000);child.stdout.on('data',d=>{if(d.toString().includes('Convite:')){clearTimeout(timer);resolve();}});child.on('error',reject);child.on('exit',c=>{clearTimeout(timer);reject(new Error('Servidor encerrou: '+c));});});
 const request=async(path,method='GET',body,cookie)=>{const res=await fetch(`http://127.0.0.1:${port}${path}`,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});return {res,data:await res.json()};};
 assert.equal((await fetch(`http://127.0.0.1:${port}`)).status,200);
 assert.equal((await request('/api/admin')).res.status,401);
 assert.equal((await request('/api/rsvp','POST',{name:'Ana',companions:[],noCompanions:false})).res.status,400);
 const login=await request('/api/login','POST',{password:'teste-integracao'});const cookie=login.res.headers.get('set-cookie').split(';')[0];
 await request('/api/admin/event','PUT',{date:'2027-01-20',time:'15:00',location:'Salão da família'},cookie);
 assert.equal((await request('/api/admin/gifts','POST',{name:'Manta',image:'javascript:alert(1)',url:'https://example.com',capacity:1},cookie)).res.status,400);
 await request('/api/admin/gifts','POST',{name:'Manta',image:'https://example.com/manta.jpg',url:'https://example.com',capacity:1},cookie);
 const a=await request('/api/rsvp','POST',{name:'Ana',companions:[],noCompanions:true});const b=await request('/api/rsvp','POST',{name:'Bruno',companions:['Bia'],noCompanions:false});
 const info=await request('/api/families/'+a.data.id);assert.equal(info.data.event.location,'Salão da família');assert.equal(info.data.family.name,'Ana');const giftId=info.data.gifts[0].id;
 const result=await Promise.all([a,b].map(f=>request('/api/families/'+f.data.id+'/reserve','POST',{giftId})));assert.deepEqual(result.map(r=>r.res.status).sort(),[200,409]);
 const admin=await request('/api/admin','GET',undefined,cookie);assert.equal(admin.data.families.length,2);assert.equal(admin.data.gifts[0].reserved,1);assert.equal(admin.data.families.filter(f=>f.giftIds.length).length,1);
 assert.equal((await request('/api/admin/gifts/'+giftId,'DELETE',undefined,cookie)).res.status,400);
 const winner=result[0].res.status===200?a.data.id:b.data.id;
 await request('/api/admin/gifts','POST',{name:'Toalha',image:'https://example.com/toalha.jpg',url:'https://example.com',capacity:1},cookie);
 const updated=await request('/api/families/'+winner);const second=updated.data.gifts.find(g=>g.id!==giftId).id;
 assert.equal((await request('/api/families/'+winner+'/reserve','POST',{giftId:second})).res.status,200);
 assert.equal((await request('/api/families/'+winner+'/reserve','POST',{giftId:second})).res.status,200);
 assert.deepEqual((await request('/api/families/'+winner)).data.family.giftIds.sort(),[giftId,second].sort());
 assert.equal((await request('/api/families/'+winner+'/reserve','DELETE',{giftId})).res.status,200);
 assert.deepEqual((await request('/api/families/'+winner)).data.family.giftIds,[second]);
 }finally{child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));rmSync(dir,{recursive:true,force:true});}
});
