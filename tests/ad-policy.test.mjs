import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {isAllowedAdPlacement} from '../js/ad-policy.js';

test('ad eligibility rejects private routes, unknown pages and obsolete slots', () => {
  for (const path of ['/', '/index.html']) {
    assert.equal(isAllowedAdPlacement(path, 'home-mid'), true);
  }
  for (const path of ['/bookings.html', '/chat.html', '/account.html',
    '/companions.html', '/notifications.html', '/unknown.html']) {
    assert.equal(isAllowedAdPlacement(path, 'home-mid'), false);
  }
  for (const slot of ['booking-confirm', 'bookings-top', 'directory-inline', '', undefined]) {
    assert.equal(isAllowedAdPlacement('/', slot), false);
  }
});

test('only the homepage loads advertising scripts or contains placements', async () => {
  const root = new URL('../', import.meta.url);
  for (const file of (await readdir(root)).filter(file => file.endsWith('.html'))) {
    if (file === 'index.html') continue;
    const html = await readFile(new URL(file, root), 'utf8');
    assert.doesNotMatch(html, /pagead2\.googlesyndication|js\/ads\.js|data-ad-slot/, file);
  }
});
