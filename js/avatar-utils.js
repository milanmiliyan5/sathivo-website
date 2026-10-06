export const avatarOptions = [
  {id:'male-1', label:'Male avatar 1', src:'assets/avatar-male-1.webp?v=20261007-1'},
  {id:'male-2', label:'Male avatar 2', src:'assets/avatar-male-2.webp?v=20261007-1'},
  {id:'male-3', label:'Male avatar 3', src:'assets/avatar-male-3.webp?v=20261007-1'},
  {id:'female-1', label:'Female avatar 1', src:'assets/avatar-female-1.webp?v=20261007-1'},
  {id:'female-2', label:'Female avatar 2', src:'assets/avatar-female-2.webp?v=20261007-1'},
  {id:'female-3', label:'Female avatar 3', src:'assets/avatar-female-3.webp?v=20261007-1'}
];
export const avatarMarker = id => 'builtin:'+id;
export const isBuiltinAvatar = value => typeof value === 'string' && value.startsWith('builtin:');
export function avatarAsset(value){
  if(!isBuiltinAvatar(value)) return null;
  const id=value.slice(8);
  return avatarOptions.find(item=>item.id===id)?.src||null;
}
