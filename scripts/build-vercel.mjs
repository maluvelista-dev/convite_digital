import {cpSync,mkdirSync} from 'node:fs';
mkdirSync(new URL('../dist/',import.meta.url),{recursive:true});
cpSync(new URL('../apps/web/public/',import.meta.url),new URL('../dist/',import.meta.url),{recursive:true});
console.log('Front preparado em dist. A API será publicada como Vercel Function.');
