export const LIMITS = { count: 20, fileBytes: 15 * 1024 ** 2, totalBytes: 80 * 1024 ** 2, pixels: 12_000_000, side: 8192, outputBytes: 80 * 1024 ** 2 };
export type Format = 'webp' | 'jpeg' | 'png';
export const MIME: Record<Format, string> = { webp: 'image/webp', jpeg: 'image/jpeg', png: 'image/png' };
export type Meta = { width: number; height: number; format: Format; orientation: number };
export type Settings = { widths: number[]; format: Format; quality: number; background: string };
export type Variant = { name: string; width: number; height: number; bytes: number; type: string; blob: Blob };
export type Output = { source: Meta; variants: Variant[]; preview: Blob; settings: Settings };
export class ImageError extends Error { constructor(public code: string) { super(code); } }
function fail(code: string): never { throw new ImageError(code); }
const textAt = (a: Uint8Array, start: number, length: number) => String.fromCharCode(...a.subarray(start, start + length));
export function inspect(a: Uint8Array): Meta {
  const v = new DataView(a.buffer, a.byteOffset, a.byteLength);
  const bounds = (p: number, n: number) => { if (p < 0 || p + n > a.length) fail('corrupt'); };
  let width = 0, height = 0, orientation = 1, format: Format;
  if (a.length >= 8 && a[0] === 137 && textAt(a, 1, 7) === 'PNG\r\n\x1a\n') {
    bounds(0,33);
    format = 'png';
    if (textAt(a, 12, 4) !== 'IHDR' || v.getUint32(8) !== 13) fail('corrupt');
    width = v.getUint32(16); height = v.getUint32(20);
    let p = 8, ended = false;
    while (p < a.length) { bounds(p, 12); const size = v.getUint32(p); bounds(p, size + 12); const type = textAt(a, p + 4, 4); if (type === 'acTL') fail('animated'); if (type === 'eXIf') fail('metadata'); if (type === 'IEND') { ended = true; break; } p += size + 12; }
    if (!ended) fail('corrupt');
  } else if (a.length >= 20 && textAt(a, 0, 4) === 'RIFF' && textAt(a, 8, 4) === 'WEBP') {
    format = 'webp'; if (v.getUint32(4, true) + 8 !== a.length) fail('corrupt');
    let p = 12;
    while (p < a.length) {
      bounds(p, 8); const type = textAt(a, p, 4), size = v.getUint32(p + 4, true), s = p + 8; bounds(s, size);
      if (type === 'ANIM' || type === 'ANMF') fail('animated');
      const acceptDimensions=(w:number,h:number)=>{if(width && (width!==w||height!==h))fail('corrupt');if(w>LIMITS.side||h>LIMITS.side||w*h>LIMITS.pixels)fail('large');width=w;height=h;};
      if (type === 'VP8X') { bounds(s, 10); if (a[s] & 2) fail('animated'); acceptDimensions(1 + a[s+4] + (a[s+5] << 8) + (a[s+6] << 16),1 + a[s+7] + (a[s+8] << 8) + (a[s+9] << 16)); }
      if (type === 'VP8 ') { bounds(s, 10); if (a[s+3] !== 157 || a[s+4] !== 1 || a[s+5] !== 42) fail('corrupt'); acceptDimensions(v.getUint16(s+6, true) & 16383,v.getUint16(s+8, true) & 16383); }
      if (type === 'VP8L') { bounds(s, 5); if (a[s] !== 47) fail('corrupt'); const bits = v.getUint32(s+1, true); acceptDimensions(1 + (bits & 16383),1 + ((bits >>> 14) & 16383)); }
      // EXIF in PNG/WebP may rotate too. Reject instead of silently publishing wrong descriptors.
      if (type === 'EXIF') fail('metadata');
      p = s + size + (size % 2);
    }
  } else if (a.length > 4 && a[0] === 255 && a[1] === 216) {
    format = 'jpeg'; let p = 2;
    while (p < a.length) {
      if (a[p++] !== 255) fail('corrupt'); while (p < a.length && a[p] === 255) p++;
      bounds(p, 1); const marker = a[p++]; if (marker === 217 || marker === 218) break; if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      bounds(p, 2); const size = v.getUint16(p); if (size < 2) fail('corrupt'); bounds(p, size);
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) { if(size < 8 || width) fail('corrupt'); height = v.getUint16(p+3); width = v.getUint16(p+5); if(width>LIMITS.side||height>LIMITS.side||width*height>LIMITS.pixels)fail('large'); }
      if (marker === 225 && size >= 16 && textAt(a, p+2, 6) === 'Exif\0\0') {
        const base = p+8, end = p+size, le = textAt(a, base, 2) === 'II';
        if (!le && textAt(a, base, 2) !== 'MM') fail('corrupt');
        const exBounds = (q:number,n:number) => { if(q < base || q+n > end) fail('corrupt'); };
        exBounds(base,8); if(v.getUint16(base+2,le) !== 42) fail('corrupt'); const dir = base+v.getUint32(base+4,le); exBounds(dir,2); const count = v.getUint16(dir,le); exBounds(dir+2,count*12);
        for(let i=0;i<count;i++) { const q=dir+2+i*12; if(v.getUint16(q,le)===274) { if(v.getUint16(q+2,le)!==3 || v.getUint32(q+4,le)!==1) fail('corrupt'); orientation=v.getUint16(q+8,le); if(orientation < 1 || orientation > 8) fail('corrupt'); } }
      }
      p += size;
    }
  } else fail('unsupported');
  if (!width || !height) fail('corrupt');
  if (width > LIMITS.side || height > LIMITS.side || width * height > LIMITS.pixels) fail('large');
  if (orientation >= 5) [width, height] = [height, width];
  return { width, height, format, orientation };
}
export function widthsFor(sourceWidth: number, requested: number[]) { return [...new Set(requested.map(w => Math.min(sourceWidth, w)))].sort((a,b)=>a-b); }
export function safeStem(name: string, used: Set<string>) {
  let stem = name.normalize('NFKD').replace(/\.[^.]*$/, '').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]/g,'-').replace(/-+/g,'-').replace(/^[-_]+|[-_]+$/g,'').toLowerCase().slice(0,60) || 'image';
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(stem)) stem = `image-${stem}`;
  let next=stem, n=2; while(used.has(next)) next=`${stem}-${n++}`; used.add(next); return next;
}
export function saving(source: number, result: number) { return source ? (source-result)/source*100 : 0; }
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function responsiveHtml(variants: Pick<Variant, 'name'|'width'|'height'>[], alt: string) {
  const last = variants.at(-1)!;
  return `<img\n  src="assets/${escapeHtml(last.name)}"\n  srcset="${variants.map(v=>`assets/${escapeHtml(v.name)} ${v.width}w`).join(', ')}"\n  sizes="(max-width: ${last.width}px) 100vw, ${last.width}px"\n  width="${last.width}" height="${last.height}"\n  alt="${escapeHtml(alt)}"\n  loading="lazy" decoding="async"\n>`;
}
export function checkAbort(signal: AbortSignal) { if (signal.aborted) throw new DOMException('Cancelled','AbortError'); }
export function readBlob(blob:Blob, signal?:AbortSignal):Promise<ArrayBuffer> {
  if(signal)checkAbort(signal);
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();const cleanup=()=>signal?.removeEventListener('abort',abort);
    const abort=()=>reader.abort();reader.onload=()=>{cleanup();resolve(reader.result as ArrayBuffer);};
    reader.onerror=()=>{cleanup();reject(reader.error||new ImageError('corrupt'));};
    reader.onabort=()=>{cleanup();reject(new DOMException('Cancelled','AbortError'));};
    signal?.addEventListener('abort',abort,{once:true});reader.readAsArrayBuffer(blob);
  });
}
export function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve,reject)=>canvas.toBlob(blob=> { if(!blob) reject(new ImageError('encode')); else if(blob.type!==type) reject(new ImageError('encoder')); else resolve(blob); },type,quality));
}
export async function processImage(file: File, stem: string, settings: Settings, signal: AbortSignal, progress: (n:number)=>void, byteBudget=LIMITS.outputBytes): Promise<Output> {
  checkAbort(signal); if(file.size > LIMITS.fileBytes) fail('file');
  const source = inspect(new Uint8Array(await readBlob(file,signal))); checkAbort(signal);
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation:'from-image' }); } catch { fail('corrupt'); }
  const canvas = document.createElement('canvas');
  try {
    checkAbort(signal); if(bitmap.width!==source.width || bitmap.height!==source.height) fail('orientation');
    const ctx = canvas.getContext('2d'); if(!ctx) fail('encode');
    const draw = (width:number, background:boolean) => { canvas.width=width; canvas.height=Math.max(1,Math.round(source.height*width/source.width)); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high'; if(background) { ctx.fillStyle=settings.background; ctx.fillRect(0,0,canvas.width,canvas.height); } ctx.drawImage(bitmap,0,0,canvas.width,canvas.height); };
    draw(Math.min(256,source.width),false); const preview = await encode(canvas,'image/png',1); checkAbort(signal);
    const widths=widthsFor(source.width,settings.widths), variants: Variant[]=[];let encodedBytes=0;
    for(let i=0;i<widths.length;i++) {
      checkAbort(signal); draw(widths[i],settings.format==='jpeg');
      const blob=await encode(canvas,MIME[settings.format],settings.quality/100); checkAbort(signal);
      encodedBytes+=blob.size;if(encodedBytes>byteBudget)fail('output');
      variants.push({name:`${stem}-${canvas.width}w.${settings.format==='jpeg'?'jpg':settings.format}`,width:canvas.width,height:canvas.height,bytes:blob.size,type:blob.type,blob}); progress((i+1)/widths.length*100);
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    return {source,variants,preview,settings:structuredClone(settings)};
  } finally { bitmap.close(); canvas.width=0; canvas.height=0; }
}
