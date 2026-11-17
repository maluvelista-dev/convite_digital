import test from 'node:test';
import assert from 'node:assert/strict';
import {nextSize,weights,database} from '../apps/api/database.mjs';
test('distribui proporcionalmente sem alterar sugestões existentes',()=>{const rows=[];for(let i=0;i<1020;i++)rows.push({diaper:nextSize(rows)});for(const [size,weight] of Object.entries(weights))assert.equal(rows.filter(r=>r.diaper===size).length,weight*10);});
test('banco impede duas reservas pela mesma família e rejeita referência inexistente',()=>{const db=database(':memory:');db.prepare('INSERT INTO families VALUES(?,?,?,?,?)').run('a','Ana','[]','M','2026-11-16');db.prepare('INSERT INTO gifts VALUES(?,?,?,?,?)').run('g','Manta','https://example.com/a.jpg','https://example.com',1);db.prepare('INSERT INTO reservations VALUES(?,?)').run('a','g');assert.throws(()=>db.prepare('INSERT INTO reservations VALUES(?,?)').run('a','g'));assert.throws(()=>db.prepare('INSERT INTO reservations VALUES(?,?)').run('b','g'));db.close();});
