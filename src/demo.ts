import { encode, readBlob } from './core';
export async function demoFiles(): Promise<File[]> {
  const c=document.createElement('canvas'); c.width=1600; c.height=1000; const x=c.getContext('2d')!;
  const g=x.createLinearGradient(0,0,1600,1000); g.addColorStop(0,'#4832ce');g.addColorStop(.5,'#f382c1');g.addColorStop(1,'#f3b449');x.fillStyle=g;x.fillRect(0,0,c.width,c.height);
  x.strokeStyle='#ffffff88';x.lineWidth=3;for(let i=-10;i<40;i++){x.beginPath();x.moveTo(i*80,0);x.lineTo(i*80+600,1000);x.stroke();}
  x.fillStyle='#ffffff';x.font='bold 130px sans-serif';x.fillText('COLOR STUDY',100,450);x.font='36px monospace';x.fillText('FRAMEPACK / SYNTHETIC SAMPLE 01',110,530);
  const color=new File([await encode(c,'image/jpeg',.97)],'color-study.jpg',{type:'image/jpeg'});
  c.width=900;c.height=900;x.clearRect(0,0,900,900);x.fillStyle='#6350df';x.fillRect(150,150,600,600);x.clearRect(290,290,320,320);x.fillStyle='#b3ed51';x.fillRect(370,370,160,160);
  const alpha=new File([await encode(c,'image/png',1)],'transparent-mark.png',{type:'image/png'});
  c.width=600;c.height=400;x.fillStyle='#5334ca';x.fillRect(0,0,300,200);x.fillStyle='#cbf078';x.fillRect(300,0,300,200);x.fillStyle='#ed779d';x.fillRect(0,200,300,200);x.fillStyle='#233147';x.fillRect(300,200,300,200);x.fillStyle='white';x.font='bold 36px sans-serif';x.fillText('EXIF ROTATION 6',35,100);
  const jpeg=new Uint8Array(await readBlob(await encode(c,'image/jpeg',.9)));
  const exif=new Uint8Array([255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]);
  const insertion=jpeg[2]===255&&jpeg[3]===224?4+new DataView(jpeg.buffer).getUint16(4):2;
  const rotated=new File([jpeg.slice(0,insertion),exif,jpeg.slice(insertion)],'rotated-study.jpg',{type:'image/jpeg'});c.width=0;c.height=0;
  return [color,alpha,rotated];
}
