const SUPPORTED_TYPES=new Set(['image/jpeg','image/png','image/webp']);
const DEFAULT_MAX_INPUT_BYTES=50*1024*1024;
const MAX_SOURCE_PIXELS=80000000;

export function formatBytes(bytes){
  const n=Number(bytes)||0;
  if(n<1024)return n+' B';
  if(n<1024*1024)return Math.max(1,Math.round(n/1024))+' KB';
  return (n/(1024*1024)).toFixed(n>=10*1024*1024?0:1)+' MB';
}

async function decode(file){
  if(typeof createImageBitmap==='function'){
    try{
      const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
      return {source:bitmap,width:bitmap.width,height:bitmap.height,close:()=>bitmap.close()};
    }catch{}
  }
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();
    image.decoding='async';
    image.src=url;
    await image.decode();
    return {source:image,width:image.naturalWidth,height:image.naturalHeight,close:()=>{}};
  }finally{
    URL.revokeObjectURL(url);
  }
}

function toWebp(canvas,quality){
  return new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
}

export async function compressImageFile(file,{
  maxBytes=480*1024,
  maxDimension=1600,
  minDimension=640,
  maxInputBytes=DEFAULT_MAX_INPUT_BYTES
}={}){
  if(!(file instanceof Blob))throw Error('Choose a photo first.');
  if(!SUPPORTED_TYPES.has(file.type))throw Error('Please choose a JPG, PNG or WebP image.');
  if(file.size>maxInputBytes)throw Error('This photo is extremely large. Please choose one under '+formatBytes(maxInputBytes)+'.');

  const decoded=await decode(file);
  try{
    if(!decoded.width||!decoded.height||decoded.width*decoded.height>MAX_SOURCE_PIXELS)throw Error('This photo is too large to process safely on this device.');

    const ratio=Math.min(1,maxDimension/Math.max(decoded.width,decoded.height));
    let width=Math.max(1,Math.round(decoded.width*ratio));
    let height=Math.max(1,Math.round(decoded.height*ratio));
    let best=null;

    for(let round=0;round<6;round++){
      const canvas=document.createElement('canvas');
      canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d',{alpha:false});
      if(!ctx)throw Error('Photo compression is not supported in this browser.');
      ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
      ctx.drawImage(decoded.source,0,0,width,height);

      for(const quality of [.84,.76,.68,.60,.52,.44]){
        const blob=await toWebp(canvas,quality);
        if(!blob)throw Error('Photo compression is not supported in this browser.');
        if(!best||blob.size<best.size)best=blob;
        if(blob.size<=maxBytes){
          return {blob,ext:'webp',type:'image/webp',originalBytes:file.size,outputBytes:blob.size,width,height};
        }
      }

      const longest=Math.max(width,height);
      if(longest<=minDimension)break;
      const shrink=Math.max(.72,Math.sqrt(maxBytes/Math.max(best?.size||maxBytes,maxBytes))*.92);
      width=Math.max(1,Math.round(width*shrink));
      height=Math.max(1,Math.round(height*shrink));
      if(Math.max(width,height)<minDimension){
        const minScale=minDimension/Math.max(width,height);
        width=Math.max(1,Math.round(width*minScale));
        height=Math.max(1,Math.round(height*minScale));
      }
    }

    if(best){
      return {blob:best,ext:'webp',type:'image/webp',originalBytes:file.size,outputBytes:best.size,width,height};
    }
    throw Error('This photo could not be compressed. Try another photo.');
  }finally{
    decoded.close();
  }
}
