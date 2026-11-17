import {DatabaseSync} from 'node:sqlite';
import {writeFileSync} from 'node:fs';
const db=new DatabaseSync(new URL('../data/benicio.sqlite',import.meta.url),{readOnly:true});
const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
try{
 const event=db.prepare('SELECT * FROM settings WHERE id=1').get();
 const gifts=db.prepare('SELECT * FROM gifts ORDER BY rowid').all();
 const statements=[
 '-- Transferencia dos dados da festa e dos mimos locais para o Supabase.',
 '-- Nao altera convidados ou reservas. Nao substitui dados da festa ja preenchidos.',
 'BEGIN;',
 'INSERT INTO benicio.settings(id) VALUES(1) ON CONFLICT DO NOTHING;'
 ];
 if(event)statements.push(`UPDATE benicio.settings SET date=CASE WHEN date='' THEN ${quote(event.date)} ELSE date END,time=CASE WHEN time='' THEN ${quote(event.time)} ELSE time END,location=CASE WHEN location='' THEN ${quote(event.location)} ELSE location END WHERE id=1;`);
 for(const gift of gifts)statements.push(`INSERT INTO benicio.gifts(id,name,image,url,capacity) VALUES(${quote(gift.id)},${quote(gift.name)},${quote(gift.image)},${quote(gift.url)},${Number(gift.capacity)}) ON CONFLICT(id) DO NOTHING;`);
 statements.push('COMMIT;');
 const path=new URL('../data/transferir-festa-e-mimos.sql',import.meta.url);
 writeFileSync(path,statements.join('\n')+'\n','utf8');
 console.log(`Arquivo preparado: data/transferir-festa-e-mimos.sql (${gifts.length} mimos).`);
}finally{db.close();}
