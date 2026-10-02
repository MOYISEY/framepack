import { webkit } from 'playwright';
const b=await webkit.launch();const p=await b.newPage();await p.goto('http://127.0.0.1:4173/framepack/');
await p.context().setOffline(true);
console.log(await p.evaluate(async()=>{
 const res=[];const canvas=document.createElement('canvas');canvas.width=100;canvas.height=100;
 const step=async(name,f)=>{try{res.push({name,value:await f()});}catch(e){res.push({name,error:String(e)});}};
 await step('canvas Blob+FileReader',async()=>{const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg'));return await new Promise((r,j)=>{const fr=new FileReader();fr.onload=()=>r(fr.result.byteLength);fr.onerror=()=>j(fr.error);fr.readAsArrayBuffer(blob);});});
 await step('new Blob+FileReader',async()=>{const blob=new Blob([new Uint8Array([1,2,3])]);return await new Promise((r,j)=>{const fr=new FileReader();fr.onload=()=>r(fr.result.byteLength);fr.onerror=()=>j(fr.error);fr.readAsArrayBuffer(blob);});});
 await step('canvas dataURL',()=>canvas.toDataURL('image/jpeg').length);
 await step('canvas→bitmap',async()=>{const m=await createImageBitmap(canvas);return m.width;});
 return res;
}));
await p.context().setOffline(false);await p.context().route('**/*',r=>r.abort('internetdisconnected'));
await p.getByRole('button',{name:'Try a demo'}).click();await p.waitForTimeout(300);await p.getByRole('button',{name:'Build assets',exact:true}).click();await p.waitForTimeout(1000);console.log('network requests blocked',await p.locator('.status').allTextContents());const event=p.waitForEvent('download');await p.getByRole('button',{name:/Download ZIP/}).click();console.log('zipbytes',(await event).suggestedFilename());await b.close();
