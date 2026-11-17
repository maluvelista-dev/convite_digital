import test from 'node:test';
import assert from 'node:assert/strict';
import {handleSupabase} from '../apps/api/supabase.mjs';
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test',ADMIN_PASSWORD:'senha-do-painel'};
const request=(url,method='GET',body,headers={})=>({url,method,body,headers:{host:'convite.example',...headers},socket:{remoteAddress:'127.0.0.1'}});
test('Vercel valida cadastro e encaminha somente campos permitidos à RPC',async()=>{
 const calls=[];const fetcher=async(url,opts)=>{calls.push({url:String(url),...opts});return Response.json({id:'familia'});};
 assert.equal((await handleSupabase(request('/api/rsvp','POST',{name:'Ana',companions:[],noCompanions:false}),env,fetcher)).status,400);
 const result=await handleSupabase(request('/api/index?route=rsvp','POST',{name:'Ana',companions:[],noCompanions:true,scope:'injetado'}),env,fetcher);
 assert.equal(result.status,201);assert.equal(calls.length,1);const data=JSON.parse(calls[0].body);assert.equal(data.p_action,'rsvp');assert.match(data.p_data.id,/^[a-f0-9]{48}$/);assert.equal(data.p_data.scope,undefined);
 assert.equal(calls[0].headers.apikey,env.SUPABASE_SECRET_KEY);assert.equal(calls[0].headers.Authorization,undefined);assert.ok(!JSON.stringify(result).includes(env.SUPABASE_SECRET_KEY));
});
test('login usa cookie seguro e limita tentativas sem depender de memória da função',async()=>{
 const calls=[];const fetcher=async(_,opts)=>{calls.push(JSON.parse(opts.body));return Response.json({ok:true});};
 const result=await handleSupabase(request('/api/login','POST',{password:env.ADMIN_PASSWORD}),env,fetcher);
 assert.equal(result.status,200);assert.match(result.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);assert.deepEqual(calls.map(c=>c.p_action),['login_attempt','session']);
 const rawToken=result.headers['Set-Cookie'].match(/admin=([^;]+)/)[1];assert.notEqual(rawToken,calls[1].p_data.token);assert.ok(!JSON.stringify(calls).includes(env.ADMIN_PASSWORD));
 assert.equal((await handleSupabase(request('/api/login','POST',{password:'errada'}),env,fetcher)).status,401);
 const blocked=await handleSupabase(request('/api/login','POST',{password:env.ADMIN_PASSWORD}),env,async()=>Response.json({blocked:true}));assert.equal(blocked.status,429);
});
test('protege painel, origem e erros privados do banco',async()=>{
 let called=false;const fetcher=async()=>{called=true;return Response.json({code:'P0001',message:'Mimo esgotado.',details:'409'},{status:400});};
 assert.equal((await handleSupabase(request('/api/admin'),env,fetcher)).status,401);assert.equal(called,false);
 assert.equal((await handleSupabase(request('/api/login','POST',{}, {origin:'https://outro.example'}),env,fetcher)).status,403);
 const reserved=await handleSupabase(request('/api/families/'+'a'.repeat(48)+'/reserve','POST',{giftId:'manta'}),env,fetcher);assert.equal(reserved.status,409);
 const unconfigured=await handleSupabase(request('/api/admin'),{},fetcher);assert.equal(unconfigured.status,503);
});
