import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const htmlFiles=(await readdir(root)).filter(name=>name.endsWith('.html'));
const missing=[];
const insecure=[];
for(const file of htmlFiles){
  const html=await readFile(path.join(root,file),'utf8');
  for(const match of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)){
    const raw=match[1].trim();
    if(!raw||raw.startsWith('#')||/^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(raw))continue;
    const clean=decodeURIComponent(raw.split('#')[0].split('?')[0]);
    if(!clean||clean==='./')continue;
    const target=path.resolve(root,clean.replace(/^\.\//,''));
    try{await stat(target)}catch{missing.push(file+' -> '+raw)}
  }
  const externalHttp=[...html.matchAll(/(?:src|href)\s*=\s*["'](http:\/\/[^"']+)["']/gi)].map(m=>m[1]);
  externalHttp.forEach(url=>insecure.push(file+' -> '+url));
}
if(missing.length){
  console.error('Missing local references:\n'+missing.join('\n'));
  process.exitCode=1;
}
if(insecure.length){
  console.error('Insecure HTTP references:\n'+insecure.join('\n'));
  process.exitCode=1;
}
if(!process.exitCode)console.log('Static references OK for',htmlFiles.length,'HTML files.');
