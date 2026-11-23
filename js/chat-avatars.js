import {avatarAsset, isBuiltinAvatar} from './avatar-utils.js?v=20261121-avatars-1';

// Chat shows the other participant's CURRENT account avatar, not their
// separately consented Explore/listing photo snapshot. An authenticated,
// booking-scoped RPC exposes only contact avatar references.
export async function showChatAvatars(client, contacts) {
  const targets=(contacts||[]).filter(({userId,element})=>userId&&element);
  if(!targets.length)return;
  for(const {userId,element} of targets){
    if(!element.dataset.avatarInitial)element.dataset.avatarInitial=element.textContent.trim().slice(0,1)||'S';
    element.dataset.avatarContact=String(userId);
    element.dataset.avatarLoad=String(Number(element.dataset.avatarLoad||0)+1);
  }
  const ids=[...new Set(targets.map(({userId})=>userId))];
  for(let offset=0;offset<ids.length;offset+=100){
    const batch=ids.slice(offset,offset+100);
    try{
      const {data,error}=await client.rpc('sathivo_chat_contact_avatars',{p_user_ids:batch});
      if(error)throw error;
      const paths=new Map((data||[]).map(row=>[row.user_id,row.avatar_path]));
      const uploads=[...new Set([...paths.values()].filter(path=>path&&!isBuiltinAvatar(path)))];
      const signed=new Map();
      if(uploads.length){
        const result=await client.storage.from('profile-photos').createSignedUrls(uploads,300);
        if(result.error)throw result.error;
        for(const item of result.data||[])if(item.signedUrl)signed.set(item.path,item.signedUrl);
      }
      for(const {userId,element} of targets){
        if(!batch.includes(userId))continue;
        const token=element.dataset.avatarLoad;
        const current=()=>element.dataset.avatarLoad===token&&element.dataset.avatarContact===String(userId);
        const path=paths.get(userId);
        const src=avatarAsset(path)||signed.get(path);
        if(!src){
          if(current())element.textContent=element.dataset.avatarInitial||'S';
          continue;
        }
        const image=new Image();
        image.alt='';
        // Position the photo inside a constrained avatar frame. The parent's grid
        // layout must never stretch to the uploaded image's intrinsic ratio.
        image.className='chat-contact-photo';
        image.decoding='async';
        image.onload=()=>{
          if(current()&&element.isConnected)element.replaceChildren(image);
        };
        image.onerror=()=>{
          if(current())element.textContent=element.dataset.avatarInitial||'S';
        };
        image.src=src;
      }
    }catch(error){
      // Never fall back to an outdated public listing photo or leak a private
      // image. Chat stays available, with initials, if the avatar fetch fails.
      console.warn('Could not load current chat avatar:',error?.message||'Unavailable');
    }
  }
}
