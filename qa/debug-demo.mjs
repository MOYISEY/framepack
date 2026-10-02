import { chromium, firefox, webkit } from 'playwright';
import fs from 'node:fs';
for(const [name,type] of Object.entries({chromium,firefox,webkit})){
 const browser=await type.launch();const page=await browser.newPage();await page.goto('http://127.0.0.1:4173/framepack/');
 const result=await page.evaluate(async()=>{const {demoFiles}=await import('/framepack/src/demo.ts');const {inspect}=await import('/framepack/src/core.ts');const files=await demoFiles();return Promise.all(files.map(async file=>{const bytes=new Uint8Array(await file.arrayBuffer());let header,decoded;try{header=inspect(bytes);}catch(e){header=String(e);}try{const b=await createImageBitmap(file,{imageOrientation:'from-image'});decoded={width:b.width,height:b.height};b.close();}catch(e){decoded=String(e);}return{name:file.name,header,decoded,bytes:file.name.includes('rotated')?Array.from(bytes):undefined};}));});
 console.log(name,JSON.stringify(result.map(({bytes,...other})=>other)));const rotated=result.find(r=>r.bytes);fs.writeFileSync(`qa/generated/debug-demo-${name}.jpg`,Buffer.from(rotated.bytes));
 await page.context().setOffline(true);const offline=await page.evaluate(async()=>{try{const m=await import('/framepack/src/demo.ts');return (await m.demoFiles()).map(f=>({name:f.name,size:f.size}));}catch(e){return String(e);}});console.log(name,'offline',JSON.stringify(offline));await browser.close();
}
