'use strict';
// Cloudflare results live in each visitor's browser; credentials are never stored.
window.CoverCloud=(()=>{
 let direct=false;
 const ready=(async()=>{
  let config=null;
  try{
   const r=await fetch('/api/config');
   if(!r.ok)throw new Error('服务配置读取失败。');
   config=await r.json();
  }catch(error){
   // 静态托管（GitHub Pages / Cloudflare Pages / Netlify）没有后端，这里回落到直连配置。
   if(window.COVER_DIRECT&&window.COVER_DIRECT.base){
    direct=true;
    config={runtime:'direct',models:{generate:window.COVER_DIRECT.model,split:window.COVER_DIRECT.splitModel||window.COVER_DIRECT.model}};
   }else throw error;
  }
  const cloud=direct?true:config.runtime==='cloudflare';
  window.CoverModels=config.models||null;
  if(cloud){
   document.querySelectorAll('[data-cloud-storage-note]').forEach(note=>{note.hidden=false;});
   const libraryHint=document.querySelector('.library-head p');
   if(libraryHint)libraryHint.textContent='生成图片与拆层结果，自动保存在当前浏览器。';
  }
  if(config.runtime==='local'&&config.default_key){
   const input=document.getElementById('api-key');
   if(input&&!input.value.trim())input.value=config.default_key;
   const note=document.querySelector('#key-panel p');
   if(note)note.textContent='已载入本机默认 Key，仅用于本地测试。这里的修改不会覆盖本机配置。';
  }
  if(direct&&window.COVER_DIRECT.key){
   const input=document.getElementById('api-key');
   if(input&&!input.value.trim())input.value=window.COVER_DIRECT.key;
  }
  return cloud;
 })();
 // Handle startup failures even if the user has not opened the library yet.
 ready.catch(()=>{});
 let database;
 function db(){return database||(database=new Promise((resolve,reject)=>{const request=indexedDB.open('cover-studio-assets',1);request.onupgradeneeded=()=>request.result.createObjectStore('assets',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('浏览器存储不可用，请下载保存当前作品。'));}));}
 async function transaction(mode,action){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('assets',mode),store=tx.objectStore('assets');let result;const request=action(store);request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(new Error('素材保存失败，请检查浏览器存储空间。'));tx.onabort=tx.onerror;});}
 const write=record=>transaction('readwrite',store=>store.put(record));
 async function list(){return (await transaction('readonly',store=>store.getAll())).filter(r=>!r.deleted).sort((a,b)=>b.created_at-a.created_at).map(r=>({...r,zip_url:r.kind==='split'?zipURL(r):null}));}
 async function change(id,action){const record=await transaction('readonly',store=>store.get(id));if(!record)throw new Error('素材不存在。');record.deleted=action==='delete';await write(record);}
 const zipCache=new Map();
 const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
 function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
 function zipURL(record){
  if(zipCache.has(record.id))return zipCache.get(record.id);
  const locals=[],central=[];let offset=0,centralSize=0;
  const files=record.images.map(image=>({name:image.name,bytes:Uint8Array.from(atob(image.url.split(',')[1]),c=>c.charCodeAt(0))}));
  files.push({name:'prompt.txt',bytes:new TextEncoder().encode(record.prompt)});
  for(const file of files){
   const name=new TextEncoder().encode(file.name),crc=crc32(file.bytes),header=new Uint8Array(30+name.length),h=new DataView(header.buffer);
   h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint32(14,crc,true);h.setUint32(18,file.bytes.length,true);h.setUint32(22,file.bytes.length,true);h.setUint16(26,name.length,true);header.set(name,30);
   const entry=new Uint8Array(46+name.length),v=new DataView(entry.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint32(16,crc,true);v.setUint32(20,file.bytes.length,true);v.setUint32(24,file.bytes.length,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);entry.set(name,46);
   locals.push(header,file.bytes);central.push(entry);offset+=header.length+file.bytes.length;centralSize+=entry.length;
  }
  const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
  const url=URL.createObjectURL(new Blob([...locals,...central,end],{type:'application/zip'}));zipCache.set(record.id,url);return url;
 }
 const SIZE_STD={'1:1':'1024x1024','3:4':'1024x1536','4:3':'1536x1024','9:16':'1024x1792','16:9':'1792x1024','5:2':'1536x640'};
 function directSize(ratio){
  const cfg=window.COVER_DIRECT||{};
  if(cfg.sizeMode==='none')return null;
  if(cfg.sizeMode==='ratio'){
   const parts=String(ratio||'').split(':');if(parts.length!==2)return null;
   const a=parseFloat(parts[0]),b=parseFloat(parts[1]);if(!a||!b)return null;
   const long=1536,round16=n=>Math.max(16,Math.round(n/16)*16);
   return a>=b?`${long}x${round16(long*b/a)}`:`${round16(long*a/b)}x${long}`;
  }
  return SIZE_STD[ratio]||null;
 }
 function dataURLToBlob(value){
  const parts=String(value).split(','),mime=(parts[0].match(/data:([^;]+);/)||[])[1]||'image/png';
  const binary=atob(parts[1]||''),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return new Blob([bytes],{type:mime});
 }
 function urlToBase64(url){
  return fetch(url).then(response=>{
   if(!response.ok)throw new Error(`图片下载失败（HTTP ${response.status}）。`);
   return response.blob();
  }).then(blob=>new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onload=()=>{const text=String(reader.result);resolve(text.slice(text.indexOf(',')+1));};
   reader.onerror=()=>reject(new Error('图片转码失败。'));
   reader.readAsDataURL(blob);
  }));
 }
 async function directImages(payload){
  const cfg=window.COVER_DIRECT||{};
  const base=String(cfg.base||'').replace(/\/+$/,'');
  const key=String(cfg.key||payload.key||'').trim();
  if(!base)throw new Error('未配置接口地址。');
  if(!key)throw new Error('请先填写 API Key。');
  let response;
  if(payload.kind==='split'){
   const form=new FormData();
   form.set('model',cfg.splitModel||cfg.model);
   form.set('prompt',payload.prompt);
   form.set('n','1');
   const blob=dataURLToBlob(payload.image);
   const ext=blob.type.indexOf('jpeg')>=0?'jpg':blob.type.indexOf('webp')>=0?'webp':'png';
   form.set('image',blob,`input.${ext}`);
   response=await fetch(`${base}/images/edits`,{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form});
  }else{
   const fields={model:cfg.model,prompt:payload.prompt,n:1};
   const size=directSize(payload.ratio);if(size)fields.size=size;
   if(cfg.body&&typeof cfg.body==='object')Object.assign(fields,cfg.body);
   response=await fetch(`${base}/images/generations`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify(fields)});
  }
  const text=await response.text();let result=null;
  try{result=JSON.parse(text);}catch(error){result=null;}
  if(!response.ok){
   const detail=(result&&result.error&&(result.error.message||result.error))||(result&&result.message)||text.slice(0,300);
   throw new Error(`HTTP ${response.status} · ${typeof detail==='string'?detail:'模型请求失败。'}`);
  }
  const items=(result&&Array.isArray(result.data)&&result.data)||(result&&result.url?[{url:result.url}]:[])||[];
  if(!items.length)throw new Error('模型未返回图片。');
  const data=[];
  for(const item of items){
   if(typeof item==='string'){
    data.push({b64_json:item.startsWith('data:')?item.slice(item.indexOf(',')+1):await urlToBase64(item)});
    continue;
   }
   const inline=item.b64_json||item.b64;
   if(inline){data.push({b64_json:String(inline).replace(/^data:image\/[^;]+;base64,/i,'')});continue;}
   if(item.url){
    data.push({b64_json:item.url.startsWith('data:')?item.url.slice(item.url.indexOf(',')+1):await urlToBase64(item.url)});
   }
  }
  if(!data.length)throw new Error('模型未返回可用的图片数据。');
  return {data};
 }
 async function submit(payload){
  const started=Date.now();let result;
  try{
   if(direct){result=await directImages(payload);}
   else{
    const response=await fetch(`/api/images/${payload.kind}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    result=await response.json();
    if(!response.ok)throw new Error(result.error||'模型请求失败。');
   }
  }finally{payload.key='';}
  if(!Array.isArray(result.data)||!result.data.length)throw new Error('模型未返回图片。');
  const images=result.data.map((item,i)=>{
   const magic=atob(item.b64_json.slice(0,16));let ext,mime;
   if(magic.startsWith('\x89PNG')){ext='png';mime='image/png';}else if(magic.startsWith('\xff\xd8\xff')){ext='jpg';mime='image/jpeg';}else if(magic.startsWith('RIFF')&&magic.slice(8,12)==='WEBP'){ext='webp';mime='image/webp';}else throw new Error('模型返回了不支持的图片格式。');
   return {name:`${payload.kind==='generate'?'image':'layer'}-${String(i+1).padStart(2,'0')}.${ext}`,url:`data:${mime};base64,${item.b64_json}`};
  });
  const record={id:crypto.randomUUID(),kind:payload.kind,prompt:payload.prompt,ratio:payload.ratio,created_at:Date.now()/1000,elapsed:Math.round((Date.now()-started)/100)/10,images,source_url:payload.kind==='split'?payload.image:null};
  let storage_warning;try{await write(record);}catch(error){storage_warning='图片已完成，但素材库保存失败，请及时下载当前作品。';}
  return {...record,zip_url:payload.kind==='split'?zipURL(record):null,storage_warning};
 }
 return {ready,submit,list,change};
})();
