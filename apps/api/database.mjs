import { DatabaseSync } from 'node:sqlite';
export const weights = { RN:8, P:12, M:35, G:35, XG:12 };
export function nextSize(rows) {
  const counts = Object.fromEntries(Object.keys(weights).map(k=>[k,0]));
  for(const row of rows) counts[row.diaper]++;
  return Object.keys(weights).sort((a,b)=> ((rows.length+1)*weights[b]/102-counts[b])-((rows.length+1)*weights[a]/102-counts[a]))[0];
}
export function database(path) {
 const db = new DatabaseSync(path);
 db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS families(id TEXT PRIMARY KEY,name TEXT NOT NULL,companions TEXT NOT NULL,diaper TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS gifts(id TEXT PRIMARY KEY,name TEXT NOT NULL,image TEXT NOT NULL,url TEXT NOT NULL,capacity INTEGER NOT NULL CHECK(capacity>0));
 CREATE TABLE IF NOT EXISTS reservations(family_id TEXT PRIMARY KEY REFERENCES families(id),gift_id TEXT NOT NULL REFERENCES gifts(id));
 CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),date TEXT NOT NULL DEFAULT '',time TEXT NOT NULL DEFAULT '',location TEXT NOT NULL DEFAULT '');
 INSERT OR IGNORE INTO settings(id) VALUES(1);`);
 return db;
}
