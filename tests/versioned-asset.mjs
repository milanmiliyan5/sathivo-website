import assert from 'node:assert/strict';

// A subsequent release may rename its cache key. Keep checking the asset and
// the minimum release date that contains the behavior under test.
export function assertVersionedAsset(source, asset, minimumDate) {
  const references = [...source.matchAll(/["']([^"']+\?v=(\d{8})-[\w.-]+)["']/g)]
    .filter(match => match[1].split('?')[0] === asset);
  assert.ok(references.length, 'Missing versioned asset ' + asset);
  for (const match of references) {
    assert.ok(match[2] >= minimumDate, 'Stale version of ' + asset);
  }
}
