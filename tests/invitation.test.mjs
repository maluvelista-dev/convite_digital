import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../apps/web/public/app.js',import.meta.url),'utf8');
function node(){return {innerHTML:'',style:{},children:[],classList:{add(){},remove(){}},addEventListener(){},querySelector(){return node();},querySelectorAll(){return [];},append(child){this.children.push(child);}};}
async function open(status,event,familyData){
 const elements=new Map();const storage=new Map([['benicio-family','a'.repeat(48)]]);let path;
 const context={document:{querySelector(s){if(!elements.has(s))elements.set(s,node());return elements.get(s);},querySelectorAll(){return [];},createElement:node},localStorage:{getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},location:{pathname:'/',search:''},history:{replaceState(a,b,p){path=p;}},URLSearchParams,setTimeout(){},clearTimeout(){},fetch:async()=>({ok:false,status,json:async()=>({error:status===404?'Confirmação não encontrada.':'Banco indisponível.'})})};
 if(event)context.fetch=async path=>path==='/api/event'?{ok:true,json:async()=>({event})}:{ok:false,status:404,json:async()=>({error:'Confirmação não encontrada.'})};
 if(familyData)context.fetch=async()=>({ok:true,json:async()=>familyData});
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
test('dados da festa aparecem antes do formulário sem exigir confirmação',async()=>{
 const r=await open(404,{date:'2026-12-05',time:'14:00',location:'Salão <Família>'});
 const page=r.elements.get('#app').innerHTML;
 assert.ok(page.indexOf('id="event-info"')<page.indexOf('id="rsvp"'));
 const details=r.elements.get('#event-info').innerHTML;
 assert.match(details,/5 de dezembro de 2026/);assert.match(details,/14:00/);assert.match(details,/Salão &lt;Família&gt;/);
});
test('mimos ficam visíveis logo após a fralda, antes das ações de cadastro',async()=>{
 const r=await open(200,null,{family:{name:'Ana',companions:[],diaper:'M',giftIds:[]},event:{date:'2026-12-05',time:'14:00',location:'Salão'},gifts:[{id:'g',name:'Manta',image:'https://example.com/img',url:'https://example.com',capacity:1,reserved:0}]});
 const page=r.elements.get('#app').innerHTML;
 assert.ok(page.indexOf('class="diaper"')<page.indexOf('id="gift-section"'));
 assert.ok(page.indexOf('id="gift-section"')<page.indexOf('id="copy"'));
 assert.match(page,/<section class="panel" id="gift-section">/);
 assert.ok(!page.includes('id="show-gifts"'));
 assert.match(page,/Mimo por Pix/);assert.match(page,/Manta/);
});
