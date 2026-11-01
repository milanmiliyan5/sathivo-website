// Only reviewed, substantive public pages can host manual ad units.
export function isAllowedAdPlacement(pathname, slotName) {
  return ['/', '/index.html'].includes(pathname) && slotName === 'home-mid';
}
