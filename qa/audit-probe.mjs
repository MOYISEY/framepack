import { chromium, firefox, webkit } from 'playwright';
import fs from 'node:fs/promises';

const browserName = process.env.AUDIT_BROWSER || 'chromium';
const browser = await ({ chromium, firefox, webkit })[browserName].launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:4175/framepack/');
const result = await page.evaluate(async () => {
  const core = await import('/framepack/src/core.ts');
  const { makePack } = await import('/framepack/src/export.ts');
  const settings = { widths: [40, 60, 120], format: 'png', quality: 80, background: '#ffffff' };
  const c = document.createElement('canvas'); c.width = 120; c.height = 80;
  const ctx = c.getContext('2d');
  const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
  colors.forEach((color, i) => { ctx.fillStyle = color; ctx.fillRect((i % 2) * 60, Math.floor(i / 2) * 40, 60, 40); });
  const original = new Uint8Array(await (await core.encode(c, 'image/jpeg', 1)).arrayBuffer());
  const expected = [[0,1,2,3],[1,0,3,2],[3,2,1,0],[2,3,0,1],[0,2,1,3],[2,0,3,1],[3,1,2,0],[1,3,0,2]];
  const palette = [[255,0,0],[0,255,0],[0,0,255],[255,255,0]];
  const read = async blob => {
    const bitmap = await createImageBitmap(blob); const dst = document.createElement('canvas'); dst.width = bitmap.width; dst.height = bitmap.height;
    const d = dst.getContext('2d'); d.drawImage(bitmap, 0, 0); bitmap.close();
    const pixels = [[5,5],[dst.width-6,5],[5,dst.height-6],[dst.width-6,dst.height-6]].map(([x,y])=>[...d.getImageData(x,y,1,1).data]);
    const quadrants = pixels.map(p=>palette.map(rgb=>rgb.reduce((s,n,i)=>s+(n-p[i])**2,0)).reduce((best,n,i,a)=>n<a[best]?i:best,0));
    dst.width = 0; dst.height = 0; return {pixels, quadrants};
  };
  const orientation = [];
  for(let o=1;o<=8;o++) {
    const exif = new Uint8Array([255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,o,0,0,0,0,0,0,0]);
    const f = new File([original.slice(0,2),exif,original.slice(2)],`orientation-${o}.jpg`,{type:'image/jpeg'});
    const out = await core.processImage(f,`o-${o}`,settings,new AbortController().signal,()=>{});
    const sample = await read(out.variants.at(-1).blob);
    orientation.push({o,source:out.source,quadrants:sample.quadrants,expected:expected[o-1],pass:JSON.stringify(sample.quadrants)===JSON.stringify(expected[o-1])});
  }
  c.width = 120; c.height = 80; ctx.clearRect(0,0,120,80); ctx.fillStyle='#ff0000';ctx.fillRect(25,25,30,30);
  const transparentFile = new File([await core.encode(c,'image/png',1)],'transparent.png',{type:'image/png'});
  const transparency=[];
  for(const format of ['png','webp','jpeg']) {
    const out = await core.processImage(transparentFile,'alpha',{...settings,format,background:'#ffffff'},new AbortController().signal,()=>{});
    const sample = await read(out.variants.at(-1).blob);
    transparency.push({format,type:out.variants.at(-1).type,corner:sample.pixels[0],pass:format==='jpeg'?sample.pixels[0].every(n=>n===255):sample.pixels[0][3]===0});
  }
  const actualToBlob = HTMLCanvasElement.prototype.toBlob;
  let mimeFallback;
  HTMLCanvasElement.prototype.toBlob = function(cb,type,quality){actualToBlob.call(this,cb,type==='image/webp'?'image/png':type,quality);};
  try { await core.processImage(transparentFile,'alpha',{...settings,format:'webp'},new AbortController().signal,()=>{}); mimeFallback='unexpected success'; }
  catch(e){mimeFallback=e.message;} finally{HTMLCanvasElement.prototype.toBlob=actualToBlob;}
  let decoderCalls=0;const actualDecode=window.createImageBitmap;
  window.createImageBitmap = (...args)=>{decoderCalls++;return actualDecode(...args);};
  const large = new Uint8Array(45);large.set([137,80,78,71,13,10,26,10]);const dv=new DataView(large.buffer);dv.setUint32(8,13);large.set([73,72,68,82],12);dv.setUint32(16,5000);dv.setUint32(20,3000);large.set([73,69,78,68],37);
  let preflight;try{await core.processImage(new File([large],'large.png'),'large',settings,new AbortController().signal,()=>{});preflight='unexpected success';}catch(e){preflight=e.message;}finally{window.createImageBitmap=actualDecode;}
  const controller = new AbortController(); const blob = new Blob([new Uint8Array(64*1024**2)],{type:'image/png'});
  const item = {name:'pack-probe.png',alt:'',bytes:blob.size,output:{source:{width:1,height:1,format:'png',orientation:1},settings,preview:blob,variants:[{name:'pack-probe-1w.png',width:1,height:1,bytes:blob.size,type:blob.type,blob}]}};
  let abortRan=false, stageAt=0, finishedAt=0; let packResult;
  try { const packed = await makePack([item],controller.signal,n=>{if(n===50){stageAt=performance.now();setTimeout(()=>{abortRan=true;controller.abort();},0);}});finishedAt=performance.now();packResult={resolved:true,bytes:packed.size,abortRanBeforeResolve:abortRan,synchronousPackMs:finishedAt-stageAt}; }
  catch(e){packResult={resolved:false,error:e.name,abortRanBeforeResolve:abortRan};}
  await new Promise(resolve=>setTimeout(resolve,10));packResult.abortRanEventually=abortRan;
  c.width=0;c.height=0;
  return {browser:navigator.userAgent,orientation,transparency,mimeFallback,preflight,decoderCalls,packResult};
});
result.engine = browserName;
await fs.writeFile(`qa/audit-probe-results${browserName==='chromium'?'':`-${browserName}`}.json`, JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
await browser.close();
