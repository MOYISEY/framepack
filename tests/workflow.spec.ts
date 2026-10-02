import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import sharp from 'sharp';
const folder='qa/generated';
const fixture=(name:string)=>`${folder}/${name}`;
test.beforeEach(async({page})=>{await page.goto('');await page.getByLabel('Language',{exact:true}).selectOption('en');});
async function build(page:any,count:number) {await page.getByRole('button',{name:'Build assets',exact:true}).click();await expect(page.locator('.status.complete')).toHaveCount(count);}
async function download(page:any) {const event=page.waitForEvent('download');await page.getByRole('button',{name:/Download ZIP/}).click();const d=await event;const path=await d.path();return readFileSync(path!);}
async function verifyZip(data:Buffer,browser:string) {
 const entries=unzipSync(data), manifest=JSON.parse(strFromU8(entries['manifest.json'])), html=strFromU8(entries['responsive.html']);
 expect(manifest.schemaVersion).toBe(1);expect(entries['README.txt']).toBeTruthy();expect(html).toContain('<!doctype html>');
 let total=0;const names=new Set<string>();for(const image of manifest.images) {let lastWidth=0;for(const variant of image.variants){expect(variant.width).toBeGreaterThan(lastWidth);lastWidth=variant.width;expect(variant.width).toBeLessThanOrEqual(image.source.width);const entry=entries[variant.path];expect(entry.length).toBe(variant.bytes);const meta=await sharp(entry).metadata();expect(meta.width).toBe(variant.width);expect(meta.height).toBe(variant.height);expect(`image/${meta.format==='jpg'?'jpeg':meta.format}`).toBe(variant.type);expect(html).toContain(`${variant.path} ${variant.width}w`);expect(names.has(variant.path)).toBeFalsy();expect(variant.path).toMatch(/^assets\/[a-z0-9_-]+\.(webp|png|jpg)$/);names.add(variant.path);total+=variant.bytes;}}
 expect(total).toBe(manifest.assetsBytes);expect(manifest.originalBytes).toBe(manifest.images.reduce((s:number,i:any)=>s+i.originalBytes,0));expect(Object.keys(entries)).toHaveLength(names.size+3);
 const out=`qa/generated/unpacked-${browser}`;mkdirSync(out,{recursive:true});for(const [name,value] of Object.entries(entries)){const path=`${out}/${name}`;mkdirSync(path.slice(0,path.lastIndexOf('/')),{recursive:true});writeFileSync(path,value);}writeFileSync(`qa/generated/pack-${browser}.zip`,data);
 return {entries,manifest,html};
}
test('synthetic demo → real responsive ZIP; originals untouched and escaped alt',async({page,browserName})=>{
 await page.getByRole('button',{name:'Try a demo'}).click();await expect(page.locator('.queue-row')).toHaveCount(3);await build(page,3);
 await page.getByLabel('Alt text',{exact:true}).fill('<script>alert("x")</script>&');const data=await download(page);const {manifest,html}=await verifyZip(data,browserName);
 expect(manifest.images).toHaveLength(3);expect(manifest.images[2].source).toMatchObject({width:400,height:600,orientation:6});expect(manifest.images[2].variants).toHaveLength(1);expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;');expect(html).not.toContain('<script>');
 await page.reload();await expect(page.locator('.queue-row')).toHaveCount(0);
});
test('JPEG EXIF orientations 1–8 match reference pixels and manifest',async({page,browserName})=>{
 await page.getByLabel('Choose images',{exact:true}).setInputFiles(Array.from({length:8},(_,i)=>fixture(`rotation-${i+1}.jpg`)));
 await page.getByLabel('Format',{exact:true}).selectOption('png');await build(page,8);const {entries,manifest}=await verifyZip(await download(page),`${browserName}-orientation`);
 for(let i=0;i<8;i++) {const image=manifest.images[i];expect(image.source.orientation).toBe(i+1);const variant=image.variants.at(-1);const encoded=await sharp(entries[variant.path]).raw().toBuffer({resolveWithObject:true});const reference=await sharp(fixture(`rotation-${i+1}.jpg`)).autoOrient().resize({width:variant.width}).removeAlpha().raw().toBuffer({resolveWithObject:true});
 for(const [fx,fy] of [[.2,.2],[.8,.2],[.2,.8],[.8,.8]]) {const x=Math.floor(encoded.info.width*fx),y=Math.floor(encoded.info.height*fy),at=(y*encoded.info.width+x)*encoded.info.channels,rt=(y*reference.info.width+x)*reference.info.channels;for(let c=0;c<3;c++)expect(Math.abs(encoded.data[at+c]-reference.data[rt+c])).toBeLessThan(12);}}
});
test('PNG/WebP preserve alpha; JPEG uses explicit background; small sources deduplicate',async({page,browserName})=>{
 await page.getByLabel('Choose images',{exact:true}).setInputFiles([fixture('transparent.png'),fixture('transparent.webp'),fixture('tiny.jpg')]);await build(page,3);
 let pack=await verifyZip(await download(page),`${browserName}-alpha-webp`);for(const image of pack.manifest.images.slice(0,2)){const raw=await sharp(pack.entries[image.variants[0].path]).ensureAlpha().raw().toBuffer();expect(raw[3]).toBe(0);}expect(pack.manifest.images[2].variants).toHaveLength(1);expect(pack.manifest.images[2].variants[0].width).toBe(40);
 await page.getByLabel('Format',{exact:true}).selectOption('png');await build(page,3);pack=await verifyZip(await download(page),`${browserName}-alpha-png`);expect((await sharp(pack.entries[pack.manifest.images[0].variants[0].path]).ensureAlpha().raw().toBuffer())[3]).toBe(0);
 await page.getByLabel('Format',{exact:true}).selectOption('jpeg');await page.getByLabel('JPEG background',{exact:true}).fill('#00ff00');await build(page,3);pack=await verifyZip(await download(page),`${browserName}-jpeg-bg`);const raw=await sharp(pack.entries[pack.manifest.images[0].variants[0].path]).raw().toBuffer();expect(raw[0]).toBeLessThan(15);expect(raw[1]).toBeGreaterThan(240);expect(raw[2]).toBeLessThan(15);
});
test('corrupt, forged, animated and oversized input fail; valid 12 MP succeeds',async({page})=>{
 await page.getByLabel('Choose images',{exact:true}).setInputFiles(['corrupt.png','fake.png','animated.png','animated.webp','large-invalid.png','large-valid.jpg'].map(fixture));await build(page,1);await expect(page.locator('.status.error')).toHaveCount(5);await expect(page.getByText('Animated PNG/WebP is unsupported.',{exact:false})).toHaveCount(2);await expect(page.getByText('Over the limit:',{exact:false})).toBeVisible();await expect(page.getByText('Only JPEG, PNG and WebP image contents are supported.')).toBeVisible();await expect(page.getByText('The image is corrupt or cannot be decoded.')).toBeVisible();
});
test('Unicode duplicates create safe names and never unsafe HTML or ZIP paths',async({page,browserName})=>{
 const buffer=readFileSync(fixture('transparent.png'));await page.getByLabel('Choose images',{exact:true}).setInputFiles(['../../evil.png','a.png','a.png','фото 🐈.png','ＣＯＮ.png','a.webp'].map(name=>({name,mimeType:'image/png',buffer})));await build(page,6);const {manifest}=await verifyZip(await download(page),`${browserName}-names`);expect(manifest.images).toHaveLength(6);
});
test('cancel between encodes, retry, clear and URL cleanup',async({page})=>{
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(callback,type,quality){original.call(this,blob=>setTimeout(()=>callback(blob),180),type,quality);};const oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL;const active=new Set<string>();(window as any).__activeUrls=active;URL.createObjectURL=b=>{const u=oldCreate(b);active.add(u);return u;};URL.revokeObjectURL=u=>{active.delete(u);oldRevoke(u);};});await page.reload();
 await page.getByRole('button',{name:'Try a demo'}).click();await page.getByRole('button',{name:'Build assets',exact:true}).click();await expect(page.getByRole('button',{name:'Cancel',exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('.status.cancelled')).toHaveCount(3);await page.getByRole('button',{name:'Retry: color-study.jpg',exact:true}).click();await expect(page.locator('.status.complete')).toHaveCount(1);await build(page,3);await page.getByRole('button',{name:'Clear queue',exact:true}).click();await expect(page.locator('.queue-row')).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>(window as any).__activeUrls.size)).toBe(0);
});
test('unsupported Canvas encoder fallback is an error, never a mislabeled PNG',async({page})=>{
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(callback,type,quality){original.call(this,callback,type==='image/webp'?'image/png':type,quality);};});await page.reload();await page.getByRole('button',{name:'Try a demo'}).click();await page.getByRole('button',{name:'Build assets',exact:true}).click();await expect(page.locator('.status.error')).toHaveCount(3);await expect(page.getByRole('button',{name:/Download ZIP/})).toBeDisabled();await page.getByLabel('Format',{exact:true}).selectOption('png');await build(page,3);
});
test('input byte/count limits are atomic and displayed',async({page})=>{
 const buffer=readFileSync(fixture('tiny.jpg'));await page.getByLabel('Choose images',{exact:true}).setInputFiles(Array.from({length:21},(_,i)=>({name:`tiny-${i}.jpg`,mimeType:'image/jpeg',buffer})));await expect(page.getByRole('alert')).toContainText('up to 20');await expect(page.locator('.queue-row')).toHaveCount(0);
 await page.getByLabel('Choose images',{exact:true}).setInputFiles({name:'too-big.jpg',mimeType:'image/jpeg',buffer:Buffer.alloc(15*1024**2+1)});await expect(page.getByRole('alert')).toContainText('15 MiB');
 const path=fixture('byte-limit.jpg');writeFileSync(path,Buffer.alloc(14*1024**2));await page.getByLabel('Choose images',{exact:true}).setInputFiles(Array.from({length:6},()=>path));await expect(page.getByRole('alert')).toContainText('80 MiB');await expect(page.locator('.queue-row')).toHaveCount(0);
});
test('loaded app works offline, no image/telemetry requests, keyboard and light/dark RU/EN a11y',async({page,browserName})=>{
 const requests:string[]=[];page.on('request',r=>{if(/^https?:/.test(r.url())) requests.push(r.url());});
 // Playwright WebKit's offline emulation rejects even a new Blob([1,2,3]) with NotReadableError.
 // Block every HTTP request there; Chromium/Firefox use true offline context emulation.
 if(browserName==='webkit')await page.context().route(/^https?:\/\//,r=>r.abort('internetdisconnected'));else await page.context().setOffline(true);
 await page.getByRole('button',{name:'Try a demo'}).click();await build(page,3);await verifyZip(await download(page),`${browserName}-offline`);expect(requests).toEqual([]);
 if(browserName==='webkit')await page.context().unroute(/^https?:\/\//);else await page.context().setOffline(false);
 for(const lang of ['en','ru']) {await page.locator('.top-actions select').selectOption(lang);for(let n=0;n<2;n++){const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(results.violations).toEqual([]);await page.locator('.top-actions button').click();}}
 await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement?.tagName)).not.toBe('BODY');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`qa/generated/mobile-${browserName}.png`,fullPage:true});await page.setViewportSize({width:1440,height:1100});await page.locator('.top-actions select').selectOption('en');await page.screenshot({path:`qa/generated/desktop-${browserName}.png`,fullPage:true});
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('ZIP cancellation terminates packing and a later export succeeds',async({page,browserName})=>{
 await page.addInitScript(()=>{const Native=Worker;window.Worker=class extends Native {postMessage(...args:any[]){setTimeout(()=>{try{super.postMessage(args[0],args[1]);}catch{}},350);} } as typeof Worker;});await page.reload();await page.getByRole('button',{name:'Try a demo'}).click();await build(page,3);let downloads=0;page.on('download',()=>downloads++);
 await page.getByRole('button',{name:/Download ZIP/}).click();await expect(page.getByRole('button',{name:/Cancel ·/})).toBeVisible();await page.getByRole('button',{name:/Cancel ·/}).click();await expect(page.getByRole('button',{name:/Download ZIP/})).toBeEnabled();expect(downloads).toBe(0);await verifyZip(await download(page),`${browserName}-retry-pack`);expect(downloads).toBe(1);
});
test('output byte budget stops encoding early and retry with a supported recipe works',async({page})=>{
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.toBlob;(window as any).__hugeEncodes=0;HTMLCanvasElement.prototype.toBlob=function(callback,type,quality){if(type==='image/webp'){(window as any).__hugeEncodes++;callback(new Blob([new Uint8Array(41*1024**2)],{type}));}else original.call(this,callback,type,quality);};});await page.reload();await page.getByLabel('Choose images',{exact:true}).setInputFiles(fixture('rotation-1.jpg'));await page.getByRole('button',{name:'Build assets',exact:true}).click();await expect(page.locator('.status.error')).toHaveCount(1);await expect(page.getByText('Results exceed the 80 MiB limit.',{exact:false})).toBeVisible();expect(await page.evaluate(()=>(window as any).__hugeEncodes)).toBe(2);await page.getByLabel('Format',{exact:true}).selectOption('png');await build(page,1);
});
test('extreme portrait has a bounded queue thumbnail and truthful full-size variant',async({page,browserName})=>{
 await page.getByLabel('Choose images',{exact:true}).setInputFiles(fixture('tall.png'));await build(page,1);
 const dimensions=await page.locator('.thumb img').evaluate((img:HTMLImageElement)=>({width:img.naturalWidth,height:img.naturalHeight}));expect(dimensions.width).toBeGreaterThan(0);expect(dimensions.height).toBeGreaterThan(0);expect(dimensions.width).toBeLessThanOrEqual(256);expect(dimensions.height).toBeLessThanOrEqual(256);
 const {manifest}=await verifyZip(await download(page),`${browserName}-tall`);expect(manifest.images[0].variants).toHaveLength(1);expect(manifest.images[0].variants[0]).toMatchObject({width:256,height:8192});
});
