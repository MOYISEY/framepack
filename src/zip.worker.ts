import { zipSync } from 'fflate';
self.onmessage=({data}:{data:Record<string,Uint8Array>})=>{
  try{const bytes=zipSync(data,{level:0});self.postMessage({bytes},{transfer:[bytes.buffer]});}
  catch{self.postMessage({error:'zip'});}
};
