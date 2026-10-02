import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Aperture, ArrowDownToLine, Plus, X, Play, Square, Sun, Moon, ShieldCheck, FolderOpen, Image as ImageIcon, Check, RotateCcw, ChevronDown, Copy, Package, Layers, HardDrive, SlidersHorizontal } from 'lucide-react';
import { LIMITS, processImage, responsiveHtml, saving, safeStem, type Output, type Settings, type Variant } from './core';
import { makePack } from './export';
import { demoFiles } from './demo';
import { en, ru } from './i18n';
import './styles.css';
type Row = { id: string; file: File; stem: string; alt: string; status: 'pending'|'processing'|'complete'|'cancelled'|'error'; progress: number; error?: string; output?: Output; previewUrl?: string };
const bytes = (n: number) => n >= 1024**2 ? `${(n/1024**2).toFixed(2)} MiB` : n >= 1024 ? `${(n/1024).toFixed(1)} KiB` : `${n} B`;
const preference = (key:string, fallback:string) => { try{return localStorage.getItem(key) || fallback;}catch{return fallback;} };
const initialTheme = () => preference('framepack-theme',matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
function App() {
  const [lang,setLang]=useState(()=>preference('framepack-lang',navigator.language.startsWith('ru')?'ru':'en'));
  const [theme,setTheme]=useState(initialTheme); const t=lang==='ru'?ru:en;
  const [rows,setRows]=useState<Row[]>([]); const rowsRef=useRef<Row[]>([]);
  const [settings,setSettings]=useState<Settings>({widths:[640,1280,1920],format:'webp',quality:80,background:'#ffffff'});
  const [demoLoading,setDemoLoading]=useState(false); const [busy,setBusy]=useState(false), busyRef=useRef(false), controller=useRef<AbortController|null>(null);
  const [packing,setPacking]=useState(false), [packProgress,setPackProgress]=useState(0), [packSize,setPackSize]=useState<number|null>(null);
  const [notice,setNotice]=useState(''), [selected,setSelected]=useState(''), [variantIndex,setVariantIndex]=useState(0), [drag,setDrag]=useState(false), [copied,setCopied]=useState(false);
  const input=useRef<HTMLInputElement>(null), urls=useRef(new Set<string>());
  const createUrl=(blob:Blob)=>{const url=URL.createObjectURL(blob);urls.current.add(url);return url;};
  const revoke=(url?:string)=>{if(url){URL.revokeObjectURL(url);urls.current.delete(url);}};
  const update=(fn:(r:Row[])=>Row[])=>{const next=fn(rowsRef.current);rowsRef.current=next;setRows(next);setPackSize(null);setCopied(false);};
  useEffect(()=> { document.documentElement.dataset.theme=theme;document.documentElement.lang=lang;try {localStorage.setItem('framepack-theme',theme);localStorage.setItem('framepack-lang',lang);}catch{} },[theme,lang]);
  useEffect(()=>()=>{controller.current?.abort();for(const u of urls.current)URL.revokeObjectURL(u);},[]);
  const errorText=(code:string)=>t.errors[code as keyof typeof t.errors]||t.errors.unknown;
  function add(files:File[]) {
    if(busyRef.current) return; setNotice('');
    if(files.length+rowsRef.current.length>LIMITS.count) {setNotice(errorText('count'));return;}
    if(files.some(f=>f.size>LIMITS.fileBytes)){setNotice(errorText('file'));return;}
    if(files.reduce((s,f)=>s+f.size,0)+rowsRef.current.reduce((s,r)=>s+r.file.size,0)>LIMITS.totalBytes){setNotice(errorText('total'));return;}
    const used=new Set(rowsRef.current.map(r=>r.stem));update(r=>[...r,...files.map(file=>({id:crypto.randomUUID(),file,stem:safeStem(file.name,used),alt:'',status:'pending' as const,progress:0}))]);
  }
  function changeRecipe(next: Settings) {
    if(busyRef.current) return;setSettings(next);setSelected('');setVariantIndex(0);
    update(r=>r.map(row=>{revoke(row.previewUrl);return {...row,status:'pending',progress:0,output:undefined,previewUrl:undefined,error:undefined};}));
  }
  async function build(only?:string) {
    if(busyRef.current) return;const jobs=rowsRef.current.filter(r=>only?r.id===only:r.status!=='complete');if(!jobs.length)return;
    busyRef.current=true;setBusy(true);setNotice('');const abort=new AbortController();controller.current=abort;
    try {
      for(let n=0;n<jobs.length;n++) {
        if(abort.signal.aborted) {const ids=new Set(jobs.slice(n).map(r=>r.id));update(r=>r.map(v=>ids.has(v.id)?{...v,status:'cancelled',progress:0}:v));break;}
        const row=jobs[n];update(r=>r.map(v=>v.id===row.id?{...v,status:'processing',progress:0,error:undefined}:v));
        try {
          const remainingBudget=LIMITS.outputBytes-rowsRef.current.reduce((s,r)=>s+(r.id===row.id?0:r.output?.variants.reduce((a,v)=>a+v.bytes,0)||0),0);
          const output=await processImage(row.file,row.stem,settings,abort.signal,p=>update(r=>r.map(v=>v.id===row.id?{...v,progress:p}:v)),remainingBudget);
          const currentBytes=rowsRef.current.reduce((s,r)=>s+(r.id===row.id?0:r.output?.variants.reduce((a,v)=>a+v.bytes,0)||0),0);
          if(currentBytes+output.variants.reduce((s,v)=>s+v.bytes,0)>LIMITS.outputBytes)throw new Error('output');
          const previewUrl=createUrl(output.preview);revoke(row.previewUrl);update(r=>r.map(v=>v.id===row.id?{...v,status:'complete',progress:100,output,previewUrl}:v));setSelected(s=>s||row.id);
        } catch(e) {const cancelled=e instanceof DOMException && e.name==='AbortError';update(r=>r.map(v=>v.id===row.id?{...v,status:cancelled?'cancelled':'error',progress:0,error:cancelled?undefined:e instanceof Error?e.message:'unknown'}:v));}
      }
    } finally {busyRef.current=false;setBusy(false);controller.current=null;}
  }
  async function loadDemo() {
    if(busyRef.current)return;busyRef.current=true;setBusy(true);setDemoLoading(true);try{const files=await demoFiles();busyRef.current=false;add(files);}catch{setNotice(t.demoError);}finally{busyRef.current=false;setBusy(false);setDemoLoading(false);}
  }
  function remove(id?:string) {if(busyRef.current)return;update(r=>r.filter(v=>{if(!id||v.id===id){revoke(v.previewUrl);return false;}return true;}));if(!id||selected===id)setSelected('');}
  function compare(id:string) {setSelected(id);setVariantIndex(0);requestAnimationFrame(()=>{const heading=document.getElementById('compare-title');heading?.focus({preventScroll:true});heading?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});}
  const done=rows.filter(r=>r.output&&r.status==='complete');
  const sourceBytes=rows.reduce((s,r)=>s+r.file.size,0), assetBytes=done.reduce((s,r)=>s+r.output!.variants.reduce((a,v)=>a+v.bytes,0),0), totalVariants=done.reduce((s,r)=>s+r.output!.variants.length,0);
  const doneSourceBytes=done.reduce((s,r)=>s+r.file.size,0);
  const current=done.find(r=>r.id===selected)||done[0];const variant=current?.output?.variants[Math.min(variantIndex,(current.output?.variants.length||1)-1)];
  const [resultUrl,setResultUrl]=useState(''), [originalUrl,setOriginalUrl]=useState('');
  useEffect(()=>{if(!current){setOriginalUrl('');return;}const url=createUrl(current.file);setOriginalUrl(url);return ()=>revoke(url);},[current?.file]);
  useEffect(()=>{if(!variant){setResultUrl('');return;}const url=createUrl(variant.blob);setResultUrl(url);return ()=>revoke(url);},[variant]);
  const html=current?responsiveHtml(current.output!.variants,current.alt):'';
  async function download() {
    if(busyRef.current||!done.length)return;busyRef.current=true;setPacking(true);setPackProgress(0);setNotice('');const abort=new AbortController();controller.current=abort;
    try {const blob=await makePack(done.map(r=>({name:r.file.name,alt:r.alt,bytes:r.file.size,output:r.output!})),abort.signal,setPackProgress);setPackSize(blob.size);const url=createUrl(blob), a=document.createElement('a');a.href=url;a.download='framepack.zip';a.click();setTimeout(()=>revoke(url),10000);}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setNotice(t.exportError);}finally{busyRef.current=false;setPacking(false);controller.current=null;}
  }
  const disabled=busy||packing;
  const percent=(v:Variant,source:number)=> {const s=saving(source,v.bytes);return Math.abs(s)<.05?t.noChange:`${Math.abs(s).toFixed(1)}% ${s>=0?t.saving:t.growth}`;};
  return <div className="app-shell">
    <a className="skip-link" href="#queue">{t.queue}</a>
    <header className="topbar"><a href={import.meta.env.BASE_URL} className="brand" aria-label="Framepack"><span className="brand-icon"><Aperture size={21}/></span>framepack<span className="version">/ 01</span></a><div className="top-actions"><span className="local"><ShieldCheck size={15}/>{t.local}</span><select aria-label={t.language} value={lang} onChange={e=>setLang(e.target.value)}><option value="en">EN</option><option value="ru">RU</option></select><button className="icon-button" aria-label={`${t.theme}: ${theme==='dark'?t.light:t.dark}`} onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button></div></header>
    <main>
      <div className="workspace-heading"><div><p className="eyebrow">{t.workspace}</p><h1>{t.title}</h1><p className="intro">{t.intro}</p></div><span className="edition"><span className="tiny-line"/>JPEG / PNG / WEBP</span></div>
      <section className="stats" aria-label={t.pack}><div><HardDrive size={18}/><span>{t.source}</span><strong>{bytes(sourceBytes)}</strong></div><div><Package size={18}/><span>{t.assets}</span><strong>{bytes(assetBytes)}</strong></div><div><Layers size={18}/><span>{t.variants}</span><strong>{String(totalVariants).padStart(2,'0')}</strong></div><div><Check size={18}/><span>{t.ready}</span><strong>{done.length}<small> / {rows.length}</small></strong></div></section>
      {notice&&<div className="notice" role="alert"><span>{notice}</span><button className="icon-button" aria-label={t.remove} onClick={()=>setNotice('')}><X size={18}/></button></div>}
      <div className="workspace-grid">
        <aside className="recipe panel"><div className="panel-heading"><h2><span className="step">01</span>{t.settings}</h2><SlidersHorizontal size={17}/></div><fieldset disabled={disabled}><legend className="sr-only">{t.settings}</legend>
          <div className="field"><label>{t.widths}</label><div className="width-options" role="group" aria-label={t.widths}>{[320,640,960,1280,1920].map(w=><button key={w} type="button" aria-pressed={settings.widths.includes(w)} onClick={()=>changeRecipe({...settings,widths:settings.widths.includes(w)?settings.widths.length===1?settings.widths:settings.widths.filter(v=>v!==w):[...settings.widths,w].sort((a,b)=>a-b)})}>{w}<span>px</span></button>)}</div><p className="hint">{t.widthHint}</p></div>
          <div className="field"><label htmlFor="format">{t.format}</label><div className="select-wrap"><select id="format" value={settings.format} onChange={e=>changeRecipe({...settings,format:e.target.value as Settings['format']})}><option value="webp">WebP</option><option value="jpeg">JPEG</option><option value="png">PNG</option></select><ChevronDown size={16}/></div></div>
          <div className="field"><label htmlFor="quality">{t.quality}<output>{settings.format==='png'?'—':settings.quality+'%'}</output></label><input id="quality" type="range" min="10" max="100" step="5" disabled={disabled||settings.format==='png'} value={settings.quality} onChange={e=>changeRecipe({...settings,quality:Number(e.target.value)})}/><p className="hint">{settings.format==='png'?t.pngHint:'JPEG / WebP · 10–100%'}</p></div>
          {settings.format==='jpeg'&&<div className="field"><label htmlFor="background">{t.background}</label><div className="color-field"><input id="background" type="color" value={settings.background} onChange={e=>changeRecipe({...settings,background:e.target.value})}/><code>{settings.background}</code></div><p className="hint">{t.backgroundHint}</p></div>}
        </fieldset><p className="recipe-note">{t.recipeHint}</p><button className="primary build" disabled={demoLoading||packing||(!busy&&!rows.some(r=>r.status!=='complete'))} onClick={()=>busy?controller.current?.abort():void build()}>{busy?<Square size={16}/>:<Play size={16}/>} {demoLoading?(lang==="ru"?"Создание демо…":"Creating demo…"):busy?t.cancel:t.build}</button><p className="hint encoder-hint">{t.encoderWarning}</p></aside>
        <section id="queue" className={`queue panel ${drag?'dragging':''}`} onDragOver={e=>{e.preventDefault();if(!disabled)setDrag(true);}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDrag(false);}} onDrop={e=>{e.preventDefault();setDrag(false);add([...e.dataTransfer.files]);}}>
          <div className="panel-heading"><h2><span className="step">02</span>{t.queue}<span className="counter">{rows.length}</span></h2><div className="queue-actions"><button className="text-button" disabled={disabled} onClick={()=>void loadDemo()}>{t.demo}</button><button className="secondary small" disabled={disabled} onClick={()=>input.current?.click()}><Plus size={16}/>{t.add}</button></div></div>
          <input className="sr-only" aria-label={t.choose} ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e=>{add([...e.target.files||[]]);e.target.value='';}} disabled={disabled}/>
          {!rows.length?<div className="empty"><span className="empty-icon"><FolderOpen size={32}/></span><h3>{t.empty}</h3><p>{t.emptyHint}</p><button className="secondary" disabled={disabled} onClick={()=>input.current?.click()}><Plus size={17}/>{t.choose}</button><span className="drop-lines" aria-hidden="true"/></div>:<div className="queue-list">{rows.map((r,i)=><article key={r.id} className={`queue-row ${current?.id===r.id?'selected':''}`}>
            <button className="thumb checker" disabled={!r.output||packing} aria-label={`${t.preview}: ${r.file.name}`} aria-controls={r.output?"compare-title":undefined} onClick={()=>compare(r.id)}>{r.previewUrl?<img src={r.previewUrl} alt=""/>:<ImageIcon size={23}/>}</button><div className="file-info"><span className="file-index">{String(i+1).padStart(2,'0')}</span><strong title={r.file.name}>{r.file.name}</strong><p>{bytes(r.file.size)}{r.output&&` · ${r.output.source.width} × ${r.output.source.height} px`}</p>{r.error&&<p className="error-text" role="alert">{errorText(r.error)}</p>}{r.status==='processing'&&<progress max="100" value={r.progress} aria-label={`${t.rebuilding}: ${r.file.name}`}/>}</div><div className="row-end"><span className={`status ${r.status}`}>{r.status==='complete'&&<Check size={12}/>} {t[r.status]}{r.status==='processing'?` ${Math.round(r.progress)}%`:''}</span><div className="row-buttons">{r.output&&<button className="text-button" disabled={packing} aria-controls={r.output?"compare-title":undefined} onClick={()=>compare(r.id)}>{t.preview}</button>}{(r.status==='error'||r.status==='cancelled')&&<button className="icon-button" disabled={disabled} aria-label={`${t.retry}: ${r.file.name}`} onClick={()=>void build(r.id)}><RotateCcw size={16}/></button>}<button className="icon-button" disabled={disabled} aria-label={`${t.remove}: ${r.file.name}`} onClick={()=>remove(r.id)}><X size={16}/></button></div></div>
          </article>)}</div>}
          <div className="queue-foot"><p>{t.limits}</p>{!!rows.length&&<button className="text-button" disabled={disabled} onClick={()=>remove()}>{t.clear}</button>}</div><p className="limit-note">{t.limitsHint}</p>
        </section>
      </div>
      {current&&variant&&<section className="inspector panel" aria-labelledby="compare-title"><div className="panel-heading"><h2 id="compare-title" tabIndex={-1}><span className="step">03</span>{t.preview}<span className="inspect-name">{current.file.name}</span></h2><label className="variant-picker">{t.pick}<select aria-label={t.pick} value={Math.min(variantIndex,current.output!.variants.length-1)} onChange={e=>setVariantIndex(Number(e.target.value))}>{current.output!.variants.map((v,i)=><option key={v.name} value={i}>{v.width} px</option>)}</select></label></div><div className="compare-grid"><div><div className="compare-label"><span>{t.original}</span><strong>{bytes(current.file.size)}</strong></div><div className="preview-frame checker"><img src={originalUrl} alt=""/></div><p className="preview-meta">{current.output!.source.width} × {current.output!.source.height} px · {current.output!.source.format.toUpperCase()}</p></div><div><div className="compare-label"><span>{t.result}</span><strong>{bytes(variant.bytes)}<span className={saving(current.file.size,variant.bytes)>=0?'saving':'growth'}>{percent(variant,current.file.size)}</span></strong></div><div className="preview-frame checker"><img src={resultUrl} alt=""/></div><p className="preview-meta">{variant.width} × {variant.height} px · {variant.type.split('/')[1].toUpperCase()} · {variant.name}</p></div></div><p className="hint compare-hint">{t.viewportHint}</p><div className="variant-table" tabIndex={0} role="region" aria-label={t.variants}><table><thead><tr><th>{t.variants}</th><th>px</th><th>{t.assets}</th><th>{t.original}</th></tr></thead><tbody>{current.output!.variants.map(v=><tr key={v.name}><td>{v.name}</td><td>{v.width} × {v.height}</td><td>{bytes(v.bytes)}</td><td className={saving(current.file.size,v.bytes)>=0?'saving':'growth'}>{percent(v,current.file.size)}</td></tr>)}</tbody></table></div><div className="alt-field"><label htmlFor="alt">{t.alt}</label><input id="alt" disabled={disabled} type="text" maxLength={2000} value={current.alt} placeholder={t.altPlaceholder} onChange={e=>update(r=>r.map(v=>v.id===current.id?{...v,alt:e.target.value}:v))}/><p className="hint">{t.altHint}</p></div><details className="html-details"><summary>{t.html}</summary><div className="html-top"><p className="hint">{t.htmlHint}</p><button className="text-button" onClick={async()=>{try{await navigator.clipboard.writeText(html);setCopied(true);}catch{setNotice(t.copyError);}}}><Copy size={15}/>{copied?t.copied:t.copy}</button></div><pre tabIndex={0}><code>{html}</code></pre></details></section>}
      <section className="handoff panel"><div className="handoff-icon"><Package size={24}/></div><div className="handoff-copy"><h2>{t.pack}</h2><p>{t.packHint}</p>{done.length>0&&<p className="bundle-delta">{t.bundleDelta}: <strong>{percent({bytes:assetBytes} as Variant,doneSourceBytes)}</strong> · {bytes(assetBytes)}{packSize!==null&&` · ${t.packBytes}: ${bytes(packSize)}`}</p>}</div><button className="primary export" disabled={busy||(!packing&&!done.length)} onClick={()=>packing?controller.current?.abort():void download()}>{packing?<Square size={17}/>:<ArrowDownToLine size={18}/>} {packing?`${t.cancel} · ${Math.round(packProgress)}%`:t.export}{!packing&&done.length>0&&<span>{totalVariants}</span>}</button></section>
      <details className="explanation"><summary>{t.details}<ChevronDown size={15}/></summary><div><p>{t.privacy}</p><p>{t.constraints}</p><p>{t.totals}</p><p>{t.support}</p></div></details>
      <div className="sr-only" role="status" aria-live="polite">{busy?`${t.rebuilding} ${done.length}/${rows.length}`:packing?t.exporting:`${t.ready}: ${done.length}/${rows.length}; ${t.error}: ${rows.filter(r=>r.status==="error").length}; ${t.cancelled}: ${rows.filter(r=>r.status==="cancelled").length}`}</div>
    </main><footer><span>{t.footer}</span><a href="https://github.com/MOYISEY/framepack" target="_blank" rel="noreferrer">GitHub</a><span>FRAMEPACK / 1.0</span></footer>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);





