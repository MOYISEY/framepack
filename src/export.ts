import { strToU8 } from 'fflate';
import { checkAbort, readBlob, LIMITS, responsiveHtml, type Output } from './core';
import ZipWorker from './zip.worker.ts?worker&inline';
export type ExportItem = { name: string; alt: string; bytes: number; output: Output };
export async function makePack(items: ExportItem[], signal: AbortSignal, progress: (n: number)=>void) {
  checkAbort(signal);
  const assetsBytes=items.reduce((s,i)=>s+i.output.variants.reduce((a,v)=>a+v.bytes,0),0);
  if(assetsBytes>LIMITS.outputBytes) throw new Error('output');
  const entries: Record<string, Uint8Array>={};
  const manifest={ schemaVersion:1, generator:'Framepack 1.0', assetsBytes, originalBytes:items.reduce((s,i)=>s+i.bytes,0), images:items.map(i=>({ originalName:i.name, originalBytes:i.bytes, source:i.output.source, alt:i.alt, settings:i.output.settings, variants:i.output.variants.map(({blob,...v})=>({...v,path:`assets/${v.name}`})) })) };
  const html='<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Framepack images</title></head>\n<body>\n<!-- Adjust sizes to your layout. Empty alt is only appropriate for decorative images. -->\n'+items.map(i=>responsiveHtml(i.output.variants,i.alt)).join('\n\n')+'\n</body>\n</html>\n';
  entries['manifest.json']=strToU8(JSON.stringify(manifest,null,2)); entries['responsive.html']=strToU8(html);
  entries['README.txt']=strToU8('Framepack image handoff\n\nCopy assets/ into your site and adapt responsive.html to your layout. Width descriptors match the encoded pixel dimensions. Edit sizes for your CSS layout. Empty alt means decorative; write meaningful alt text for content images.\n\nOriginal files are not included or modified. Canvas re-encoding can change color profiles and metadata; this is not a forensic metadata scrubber. Quality applies to JPEG/WebP; PNG is lossless. Variants can be larger than originals. The sum of a responsive set is not a per-image saving.\n');
  let n=0; const total=items.reduce((s,i)=>s+i.output.variants.length,0);
  for(const i of items) for(const v of i.output.variants) { checkAbort(signal); entries[`assets/${v.name}`]=new Uint8Array(await readBlob(v.blob,signal)); progress(++n/total*50); }
  checkAbort(signal);
  return new Promise<Blob>((resolve,reject)=> {
    const worker=new ZipWorker();
    const cleanup=()=>{signal.removeEventListener('abort',abort);worker.terminate();};
    const abort=()=>{cleanup();reject(new DOMException('Cancelled','AbortError'));};
    worker.onmessage=({data}:{data:{bytes?:Uint8Array<ArrayBuffer>;error?:string}})=>{cleanup();if(data.error||!data.bytes)reject(new Error('zip'));else{progress(100);resolve(new Blob([data.bytes],{type:'application/zip'}));}};
    worker.onerror=()=>{cleanup();reject(new Error('zip'));};
    signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}
    progress(65);worker.postMessage(entries,Object.values(entries).map(a=>a.buffer as ArrayBuffer));
  });
}
