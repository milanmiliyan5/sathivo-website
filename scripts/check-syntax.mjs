import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const files=['script.js','sw.js'];
for(const entry of await readdir('js',{withFileTypes:true})){
  if(entry.isFile()&&entry.name.endsWith('.js'))files.push('js/'+entry.name);
}
let failed=false;
for(const file of files.sort()){
  const r=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
  if(r.status!==0)failed=true;
}
if(failed)process.exit(1);
console.log('Syntax OK for',files.length,'JavaScript files.');
