export const avatarOptions = [
  {id:'male-1', label:'Male avatar 1', src:'assets/avatar-male-1.svg'},
  {id:'male-2', label:'Male avatar 2', src:'assets/avatar-male-2.svg'},
  {id:'male-3', label:'Male avatar 3', src:'assets/avatar-male-3.svg'},
  {id:'female-1', label:'Female avatar 1', src:'assets/avatar-female-1.svg'},
  {id:'female-2', label:'Female avatar 2', src:'assets/avatar-female-2.svg'},
  {id:'female-3', label:'Female avatar 3', src:'assets/avatar-female-3.svg'}
];
export const avatarMarker = id => 'builtin:'+id;
export const isBuiltinAvatar = value => typeof value === 'string' && value.startsWith('builtin:');
export function avatarAsset(value){
  if(!isBuiltinAvatar(value)) return null;
  const id=value.slice(8);
  return avatarOptions.find(item=>item.id===id)?.src||null;
}
