import {avatarAsset, isBuiltinAvatar} from './avatar-utils.js?v=20261121-avatars-1';

// Show the same published portrait as Explore. Keep the initial until it loads.
export async function showChatAvatars(client, contacts) {
  const ids = [...new Set(contacts.map(contact => contact.userId).filter(Boolean))];
  for (let offset = 0; offset < ids.length; offset += 100) {
    try {
      const {data, error} = await client.from('companion_listings')
        .select('user_id,photo_path').in('user_id', ids.slice(offset, offset + 100))
        .eq('published', true).eq('moderation_status', 'active');
      if (error) continue;
      const paths = new Map(data.map(row => [row.user_id, row.photo_path]));
      const uploads = [...new Set([...paths.values()].filter(path => path && !isBuiltinAvatar(path)))];
      const signed = new Map();
      if (uploads.length) {
        const result = await client.storage.from('listing-photos').createSignedUrls(uploads, 600);
        for (const item of result.data || []) signed.set(item.path, item.signedUrl);
      }
      for (const {userId, element} of contacts) {
        const path = paths.get(userId);
        const src = avatarAsset(path) || signed.get(path);
        if (!src) continue;
        const image = new Image();
        image.alt = '';
        image.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;border-radius:50%';
        image.onload = () => element.replaceChildren(image);
        image.src = src;
      }
    } catch {
      // A failed photo request must leave the conversation usable.
    }
  }
}
