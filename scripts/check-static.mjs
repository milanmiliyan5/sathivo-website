import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const htmlFiles=(await readdir(root)).filter(name=>name.endsWith('.html'));
const missing=[];
const insecure=[];
const assetVersions=new Map();

for(const file of htmlFiles){
  const html=await readFile(path.join(root,file),'utf8');
  for(const match of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)){
    const raw=match[1].trim();
    if(!raw||raw.startsWith('#')||/^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(raw))continue;
    const [withoutHash]=raw.split('#');
    const [cleanRaw,query='']=withoutHash.split('?');
    const clean=decodeURIComponent(cleanRaw);
    if(!clean||clean==='./')continue;
    const target=path.resolve(root,clean.replace(/^\.\//,''));
    try{await stat(target)}catch{missing.push(file+' -> '+raw)}

    if(/\.(?:css|js)$/i.test(clean)){
      if(!assetVersions.has(clean))assetVersions.set(clean,new Map());
      const versions=assetVersions.get(clean);
      const version=query||'(none)';
      if(!versions.has(version))versions.set(version,[]);
      versions.get(version).push(file);
    }
  }

  const externalHttp=[...html.matchAll(/(?:src|href)\s*=\s*["'](http:\/\/[^"']+)["']/gi)].map(m=>m[1]);
  externalHttp.forEach(url=>insecure.push(file+' -> '+url));
}

const inconsistent=[];
for(const [asset,versions] of assetVersions){
  if(versions.size<=1)continue;
  inconsistent.push(
    asset+' uses multiple cache versions: '+
    [...versions.entries()].map(([version,files])=>version+' ['+files.join(', ')+']').join(' | ')
  );
}

if(missing.length){
  console.error('Missing local references:\n'+missing.join('\n'));
  process.exitCode=1;
}
if(insecure.length){
  console.error('Insecure HTTP references:\n'+insecure.join('\n'));
  process.exitCode=1;
}
if(inconsistent.length){
  console.error('Inconsistent static asset cache versions:\n'+inconsistent.join('\n'));
  process.exitCode=1;
}
if(!process.exitCode)console.log('Static references and asset versions OK for',htmlFiles.length,'HTML files.');
