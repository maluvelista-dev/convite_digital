import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {database} from '../apps/api/database.mjs';
test('migração SQLite mantém a reserva antiga e permite acrescentar outra',()=>{
 const dir=mkdtempSync(join(tmpdir(),'benicio-migration-')),path=join(dir,'test.sqlite');let db;
 try{
  db=new DatabaseSync(path);db.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
  db.prepare('INSERT INTO families VALUES(?,?,?,?,?)').run('a','Ana','[]','M','2026-11-21');
  for(const id of ['g','h'])db.prepare('INSERT INTO gifts VALUES(?,?,?,?,?)').run(id,id,'https://example.com/img','https://example.com',1);
  db.prepare('INSERT INTO reservations VALUES(?,?)').run('a','g');db.close();db=database(path);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM reservations').get().n,1);
  db.prepare('INSERT INTO reservations VALUES(?,?)').run('a','h');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM reservations').get().n,2);
 }finally{db?.close();rmSync(dir,{recursive:true,force:true});}
});
test('migração Supabase mantém as reservas existentes e pode ser repetida',async()=>{
 const db=new PGlite();
 try{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  await db.exec(readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
  await db.exec(`ALTER TABLE benicio.reservations DROP CONSTRAINT reservations_pkey;
   ALTER TABLE benicio.reservations ADD PRIMARY KEY(family_id);
   INSERT INTO benicio.families(id,name,companions,diaper) VALUES('a','Ana','[]','M');
   INSERT INTO benicio.gifts(id,name,image,url,capacity) VALUES('g','Manta','','',1),('h','Toalha','','',1);
   INSERT INTO benicio.reservations VALUES('a','g');`);
  const sql=readFileSync(new URL('../supabase/multiplos-mimos.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
  assert.equal((await db.query('SELECT count(*)::integer AS n FROM benicio.reservations')).rows[0].n,1);
  await db.query("SELECT public.benicio_api('reserve',$1::jsonb)",[JSON.stringify({id:'a',giftId:'h'})]);
  const r=await db.query("SELECT public.benicio_api('family',$1::jsonb) AS data",[JSON.stringify({id:'a'})]);
  assert.deepEqual(r.rows[0].data.family.giftIds,['g','h']);
 }finally{await db.close();}
});
