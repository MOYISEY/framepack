import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import ts from 'typescript';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
await page.goto('about:blank');
const coreScript=ts.transpileModule(await fs.readFile('src/core.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const coreUrl=`data:text/javascript;base64,${Buffer.from(coreScript).toString('base64')}`;
const result=await page.evaluate(async(coreUrl)=>{
  const core=await import(coreUrl);
  const rejected = fn => { try { fn(); return 'unexpected success'; } catch(e){return e.message;} };
  const png=new Uint8Array(45);png.set([137,80,78,71,13,10,26,10]);const pdv=new DataView(png.buffer);pdv.setUint32(8,12);png.set([73,72,68,82],12);pdv.setUint32(16,20);pdv.setUint32(20,20);png.set([73,69,78,68],37);
  const pngLength=rejected(()=>core.inspect(png));
  const sof=[255,192,0,17,8,0,40,0,60,3,1,17,0,2,17,0,3,17,0];
  const jpegMultipleSOF=rejected(()=>core.inspect(new Uint8Array([255,216,...sof,...sof,255,218])));
  const webp=new Uint8Array(48);webp.set([82,73,70,70]);new DataView(webp.buffer).setUint32(4,40,true);webp.set([87,69,66,80,86,80,56,88],8);new DataView(webp.buffer).setUint32(16,10,true);webp[24]=19;webp[27]=19;webp.set([86,80,56,32],30);new DataView(webp.buffer).setUint32(34,10,true);webp.set([0,0,0,157,1,42,60,0,40,0],38);
  const webpMismatch=rejected(()=>core.inspect(webp));
  const abort=new AbortController();let activeRead;
  const read=core.readBlob(new Blob([new Uint8Array(64*1024**2)]),abort.signal);abort.abort();
  try{await read;activeRead='unexpected success';}catch(e){activeRead=e.name;}
  let preAbortedRead;try{await core.readBlob(new Blob(['x']),abort.signal);preAbortedRead='unexpected success';}catch(e){preAbortedRead=e.name;}
  const c=document.createElement('canvas');c.width=120;c.height=80;const ctx=c.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,120,80);
  const file=new File([await core.encode(c,'image/png',1)],'budget.png',{type:'image/png'});
  const actualToBlob=HTMLCanvasElement.prototype.toBlob;let encoderCalls=0;
  HTMLCanvasElement.prototype.toBlob=function(...args){encoderCalls++;return actualToBlob.apply(this,args);};
  let byteBudget;try{await core.processImage(file,'budget',{widths:[40,60,120],format:'png',quality:80,background:'#ffffff'},new AbortController().signal,()=>{},1);byteBudget='unexpected success';}catch(e){byteBudget=e.message;}finally{HTMLCanvasElement.prototype.toBlob=actualToBlob;}
  const previews=[];
  for(const [width,height] of [[256,8192],[8192,256],[1,8192],[50,20]]) {
    c.width=width;c.height=height;ctx.fillStyle='red';ctx.fillRect(0,0,width,height);
    const sourceFile=new File([await core.encode(c,'image/png',1)],'preview.png',{type:'image/png'});
    const output=await core.processImage(sourceFile,'preview',{widths:[640,1280,1920],format:'png',quality:80,background:'#ffffff'},new AbortController().signal,()=>{});
    const preview=await createImageBitmap(output.preview),variant=await createImageBitmap(output.variants.at(-1).blob);
    const expectedWidth=Math.min(width,1920),expectedHeight=Math.max(1,Math.round(height*expectedWidth/width));
    previews.push({source:[width,height],preview:[preview.width,preview.height],variant:[variant.width,variant.height],expectedVariant:[expectedWidth,expectedHeight],pass:preview.width>=1&&preview.width<=256&&preview.height>=1&&preview.height<=256&&preview.width<=width&&preview.height<=height&&variant.width===expectedWidth&&variant.height===expectedHeight});
    preview.close();variant.close();
  }
  c.width=0;c.height=0;
  return {pngLength,jpegMultipleSOF,webpMismatch,activeRead,preAbortedRead,byteBudget,encoderCalls,previews,pass:pngLength==='corrupt'&&jpegMultipleSOF==='corrupt'&&webpMismatch==='corrupt'&&activeRead==='AbortError'&&preAbortedRead==='AbortError'&&byteBudget==='output'&&encoderCalls===2&&previews.every(p=>p.pass)};
},coreUrl);
await fs.writeFile('qa/final-core-probe-results.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));await browser.close();
