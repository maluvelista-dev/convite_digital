import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../apps/web/public/app.js',import.meta.url),'utf8');
function node(){return {innerHTML:'',style:{},children:[],classList:{add(){},remove(){}},addEventListener(){},querySelector(){return node();},querySelectorAll(){return [];},append(child){this.children.push(child);}};}
async function open(status){
 const elements=new Map();const storage=new Map([['benicio-family','a'.repeat(48)]]);let path;
 const context={document:{querySelector(s){if(!elements.has(s))elements.set(s,node());return elements.get(s);},createElement:node},localStorage:{getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},location:{pathname:'/',search:''},history:{replaceState(a,b,p){path=p;}},URLSearchParams,setTimeout(){},clearTimeout(){},fetch:async()=>({ok:false,status,json:async()=>({error:status===404?'Confirmação não encontrada.':'Banco indisponível.'})})};
 vm.runInNewContext(source,context);
 await new Promise(resolve=>setImmediate(resolve));
 return {elements,storage,path};
}
test('confirmação apagada volta ao formulário e remove referência antiga do navegador',async()=>{
 const r=await open(404);assert.equal(r.storage.has('benicio-family'),false);assert.equal(r.path,'/?novo=1');assert.match(r.elements.get('#app').innerHTML,/id="rsvp"/);
});
test('falha temporária no banco preserva o link da confirmação',async()=>{
 const r=await open(503);assert.equal(r.storage.has('benicio-family'),true);assert.match(r.elements.get('#app').innerHTML,/Banco indisponível/);
});
