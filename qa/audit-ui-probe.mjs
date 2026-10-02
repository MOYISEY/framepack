import { chromium } from 'playwright';
import { unzipSync, strFromU8 } from 'fflate';
import sharp from 'sharp';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.addInitScript(() => {
  localStorage.setItem('framepack-lang','en');
  window.__auditUrls = new Map();
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = blob => { const url=create(blob); window.__auditUrls.set(url,blob.type); return url; };
  URL.revokeObjectURL = url => { window.__auditUrls.delete(url); return revoke(url); };
});
await page.goto('http://127.0.0.1:4175/framepack/');
await page.getByRole('button',{name:'Try a demo',exact:true}).click();
await page.locator('.queue-row').nth(2).waitFor();
await page.getByRole('button',{name:'Build assets',exact:true}).click();
await page.waitForFunction(()=>document.querySelectorAll('.status.complete').length===3);
const urlsAfterBuild = await page.evaluate(()=>[...window.__auditUrls.values()]);
const sourcePreview = await page.locator('.compare-grid img').first().evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight}));
await page.locator('.queue-row').nth(2).locator('.thumb').click();
await page.getByLabel('Alt text',{exact:true}).fill('"<img src=x onerror=alert(1)>&\'');
const download = page.waitForEvent('download');
await page.getByRole('button',{name:/Download ZIP/}).click();
await (await download).saveAs('qa/audit-demo-pack.zip');
const packed=unzipSync(new Uint8Array(await fs.readFile('qa/audit-demo-pack.zip')));
const manifest=JSON.parse(strFromU8(packed['manifest.json']));
const html=strFromU8(packed['responsive.html']);
const variants=[];
for(const image of manifest.images) for(const v of image.variants) {
  const asset=packed[v.path]; const meta=await sharp(asset).metadata();
  variants.push({path:v.path,actualBytes:asset.length,manifestBytes:v.bytes,actualWidth:meta.width,actualHeight:meta.height,manifestWidth:v.width,manifestHeight:v.height,actualFormat:meta.format,mime:v.type,pass:asset.length===v.bytes&&meta.width===v.width&&meta.height===v.height&&v.type===`image/${meta.format}`&&html.includes(`${v.path} ${v.width}w`)});
}
await page.getByRole('button',{name:'Clear queue',exact:true}).click();
await page.waitForFunction(()=>document.querySelectorAll('.queue-row').length===0);
const urlsAfterClear = await page.evaluate(async()=>{
  const active=[];
  for(const [url,type] of window.__auditUrls) {
    try { await fetch(url); active.push(type); } catch {}
  }
  return active;
});
const noImageUrlLeaks = urlsAfterClear.every(t=>t==='application/zip');
await page.getByRole('button',{name:'Try a demo',exact:true}).click();
await page.locator('.queue-row').nth(2).waitFor();
await page.evaluate(()=>{
  const actual=HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob=function(cb,type,q){actual.call(this,blob=>setTimeout(()=>cb(blob),150),type,q);};
});
await page.getByRole('button',{name:'Build assets',exact:true}).click();
await page.getByRole('button',{name:'Cancel',exact:true}).click();
await page.waitForFunction(()=>document.querySelectorAll('.status.cancelled').length===3);
await page.getByRole('button',{name:'Retry: color-study.jpg',exact:true}).click();
await page.waitForFunction(()=>document.querySelectorAll('.status.complete').length===1);
const retryStatuses=await page.locator('.status').allTextContents();
const result={urlsAfterBuild,sourcePreview,variants,allVariantsPass:variants.every(v=>v.pass),assetTotalMatches:manifest.assetsBytes===variants.reduce((s,v)=>s+v.actualBytes,0),htmlEscapes:html.includes('&quot;&lt;img src=x onerror=alert(1)&gt;&amp;&#39;')&&!html.includes('alt=""<img'),urlsAfterClear,noImageUrlLeaks,cancelledAll:true,retryStatuses};
await fs.writeFile('qa/audit-ui-probe-results.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
await browser.close();
