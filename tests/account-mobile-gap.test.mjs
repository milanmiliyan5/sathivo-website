import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('mobile account story resets inherited desktop inset and stays in normal flow',async()=>{
 const css=await readFile(new URL('../account.css',import.meta.url),'utf8');
 const html=await readFile(new URL('../account.html',import.meta.url),'utf8');
 assert.match(css,/\.account-story\{[^}]*position:sticky;top:116px/);
 assert.match(css,/@media\(max-width:850px\)\{\s*body\.account-page\.sathivo-2d:not\(\.home-2d\) \.account-story\{[^}]*position:static;\s*top:auto;/);
 assert.match(css,/body\.account-page \.account-layout\{[^}]*padding-block-start:24px;[^}]*row-gap:20px/);
 assert.match(css,/body\.account-page \.account-story h1 br\{display:initial\}/);
 assert.match(html,/account\.css\?v=20261126-clean-menu-1/);
 assert.match(html,/Good company\.<br><em>A fresh chapter\.<\/em>/);
});
