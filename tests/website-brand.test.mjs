import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
test('all public website wordmarks use sathivo.co and preserve brand navigation',async()=>{
 const pages=(await readdir(root)).filter(p=>p.endsWith('.html')&&!['admin.html','email-signature.html'].includes(p));
 let count=0;
 for(const page of pages){
  const html=await readFile(new URL(page,root),'utf8');
  const brands=[...html.matchAll(/<a class="brand"[^>]*>[\s\S]*?<\/a>/g)];
  if(page==='contribute.html'||page==='support-chat.html'){
   const back=page==='contribute.html'?'href="./?view=home" aria-label="Back to home"':'href="chats.html" aria-label="Back to Chats"';
   assert.ok(html.includes(back),page+' preserves contextual navigation');
   assert.ok(html.includes(page==='contribute.html'?'Support Sathivo':'Sathivo Official'),page+' identifies Sathivo');
   assert.ok(html.includes('styles.css?v=20261119-brand-co'));
   continue;
  }
  if(page==='top-companions.html'){
   assert.match(html,/<h1>Top Companions<\/h1>/);
   assert.match(html,/href="companions.html" aria-label="Back to Explore"/);
   assert.ok(html.includes('styles.css?v=20261119-brand-co'));
   continue;
  }
  assert.ok(brands.length,page+' has brand');
  for(const [brand] of brands){
   assert.match(brand,/sathivo<span class="brand-period">\.co<\/span>/,page);
   assert.match(brand,/class="brand-mark"/,page);
   count++;
  }
  assert.ok(html.includes('styles.css?v=20261119-brand-co'),page+' loads updated CSS');
 }
 assert.ok(count>=24);
});
