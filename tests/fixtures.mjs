import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
const dir='qa/generated';mkdirSync(dir,{recursive:true});
const width=1200,height=800, pixels=Buffer.alloc(width*height*3);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*3;pixels[i]=x<600?(y<400?240:10):(y<400?10:240);pixels[i+1]=x<600?(y<400?10:10):(y<400?240:220);pixels[i+2]=x<600?(y<400?10:240):10;}
for(let o=1;o<=8;o++) await sharp(pixels,{raw:{width,height,channels:3}}).jpeg({quality:96}).withMetadata({orientation:o}).toFile(`${dir}/rotation-${o}.jpg`);
const rgba=Buffer.alloc(800*600*4);for(let y=150;y<450;y++)for(let x=200;x<600;x++){const i=(y*800+x)*4;rgba[i]=112;rgba[i+1]=52;rgba[i+2]=230;rgba[i+3]=200;}
await sharp(rgba,{raw:{width:800,height:600,channels:4}}).png().toFile(`${dir}/transparent.png`);
await sharp(rgba,{raw:{width:800,height:600,channels:4}}).webp({lossless:true}).toFile(`${dir}/transparent.webp`);
await sharp({create:{width:40,height:20,channels:3,background:'#ff0000'}}).jpeg({quality:10}).toFile(`${dir}/tiny.jpg`);
await sharp({create:{width:4000,height:3000,channels:3,background:'#889966'}}).jpeg({quality:80}).toFile(`${dir}/large-valid.jpg`);
await sharp({create:{width:5000,height:3000,channels:3,background:'#889966'}}).png().toFile(`${dir}/large-invalid.png`);
await sharp({create:{width:256,height:8192,channels:4,background:'#7755cc'}}).png().toFile(`${dir}/tall.png`);
writeFileSync(`${dir}/corrupt.png`,Buffer.from([137,80,78,71,13,10,26,10,1,2,3]));
writeFileSync(`${dir}/fake.png`,'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');
// 2-frame animated WebP encoded by sharp; APNG signature crafted for preflight rejection.
const animation=await sharp(Buffer.concat([rgba,rgba]),{raw:{width:800,height:1200,channels:4,pageHeight:600}}).webp({loop:0,delay:[100,100]}).toBuffer();writeFileSync(`${dir}/animated.webp`,animation);
const apng=Buffer.alloc(57);apng.set([137,80,78,71,13,10,26,10]);apng.writeUInt32BE(13,8);apng.write('IHDR',12);apng.writeUInt32BE(10,16);apng.writeUInt32BE(10,20);apng.write('acTL',37);apng.write('IEND',49);writeFileSync(`${dir}/animated.png`,apng);
console.log('Generated synthetic fixtures, orientations 1–8, transparency, size limits, corrupt and active-content impostor.');
