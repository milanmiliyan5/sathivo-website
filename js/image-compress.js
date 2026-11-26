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

function encode(canvas,type,quality){
  return new Promise(resolve=>canvas.toBlob(resolve,type,quality));
}

// Read encoded bytes, not the requested canvas format or object key.
// Safari may return PNG when WebP encoding is unavailable.
export async function encodedPhotoType(blob){
  const h=new Uint8Array(await blob.slice(0,12).arrayBuffer());
  if(h.length>=12&&String.fromCharCode(...h.slice(0,4))==='RIFF'&&String.fromCharCode(...h.slice(8,12))==='WEBP')return 'image/webp';
  if(h.length>=3&&h[0]===255&&h[1]===216&&h[2]===255)return 'image/jpeg';
  return null;
}

export async function encodePhoto(canvas,quality,preferred='image/webp'){
  for(const type of preferred==='image/jpeg'?['image/jpeg']:['image/webp','image/jpeg']){
    const blob=await encode(canvas,type,quality);
    if(!blob)continue;
    const actual=await encodedPhotoType(blob);
    if(actual!==type)continue;
    return {blob:blob.type===type?blob:blob.slice(0,blob.size,type),type,ext:type==='image/webp'?'webp':'jpg'};
  }
  throw Error('Photo compression is not supported in this browser. Try updating your browser.');
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
    let best=null,preferred='image/webp';

    for(let round=0;round<6;round++){
      const canvas=document.createElement('canvas');
      canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d',{alpha:false});
      if(!ctx)throw Error('Photo compression is not supported in this browser.');
      ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
      ctx.drawImage(decoded.source,0,0,width,height);

      for(const quality of [.84,.76,.68,.60,.52,.44]){
        const encoded=await encodePhoto(canvas,quality,preferred);
        preferred=encoded.type;
        const blob=encoded.blob;
        if(!best||blob.size<best.size)best=blob;
        if(blob.size<=maxBytes){
          return {...encoded,originalBytes:file.size,outputBytes:blob.size,width,height};
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

    throw Error('This photo could not be compressed below '+formatBytes(maxBytes)+'. Try another photo.');
  }finally{
    decoded.close();
  }
}
