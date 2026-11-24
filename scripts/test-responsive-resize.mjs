// Live resize QA: same document and draft while changing size, height and DPR.
import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { localBrowser, pause } from './lib/local-browser.mjs'
const arg=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1]}
const browser=await localBrowser(arg('--port')||'9338',arg('--origin')||'http://127.0.0.1:5173')
const {page,evaluate,waitFor,navigate,input,button}=browser
const axe=arg('--axe-path')?await readFile(arg('--axe-path'),'utf8'):null
const sizes=[[1440,900,1],[1180,600,1],[1101,650,1],[1100,650,1],[1024,768,2],[768,1024,2],[600,800,1],[430,932,3],[390,844,1],[390,844,2],[390,844,3],[375,667,2],[320,568,2],[844,390,3],[896,414,3],[1024,500,2],[375,420,3],[1280,720,1],[1366,600,1],[1920,1080,1],[2560,1440,2]]
const rows=[],audits=[],dialogRows=[]
const resize=async([width,height,dpr])=>{
  await page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:width<=1100,screenOrientation:{type:width>height?'landscapePrimary':'portraitPrimary',angle:width>height?90:0}})
  await pause(60)
}
const audit=async(label)=>{
  if(!axe)return
  if(!await evaluate('!!window.axe'))await evaluate(axe+';true')
  const result=await evaluate(`axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}}).then(r=>({version:r.testEngine.version,violations:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})),incomplete:r.incomplete.map(v=>v.id)}))`)
  audits.push({label,...result})
}
const inspect=async(route,large,size,timeOrigin)=>{
  const row=await evaluate(`(()=>{
    window.scrollTo(0,0);
    const visible=e=>{if(!e?.getClientRects().length)return false;for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);if(s.visibility==='hidden'||s.clipPath!=='none'||p.getAttribute('aria-hidden')==='true')return false;if(p.tagName==='DETAILS'&&!p.open&&!p.querySelector(':scope > summary')?.contains(e))return false;}return true};
    const selectors='h1,h2,h3,p,button,a,input,select,textarea,summary';
    const elements=[...document.querySelectorAll(selectors)].filter(visible).filter(e=>!e.closest('.medicine-art,.welcome-illustration'));
    const cuts=elements.filter(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1}).map(e=>({tag:e.tagName,class:String(e.className),text:e.textContent.slice(0,45)}));
    const squeezed=elements.filter(e=>e.clientWidth>0&&e.scrollWidth>e.clientWidth+2&&!['INPUT','TEXTAREA','SELECT'].includes(e.tagName)&&getComputedStyle(e).overflowX==='hidden').map(e=>({tag:e.tagName,class:String(e.className)}));
    const sidebar=document.querySelector('.sidebar'),nav=document.querySelector('.mobile-nav');
    const sidebarVisible=visible(sidebar),navVisible=visible(nav);
    let sidebarLastReachable=null,sidebarOverflow=null;
    if(sidebarVisible){const last=sidebar.querySelector('.sidebar-bottom button');last.scrollIntoView({block:'nearest'});const r=last.getBoundingClientRect();sidebarLastReachable=r.top>=0&&r.bottom<=innerHeight;sidebarOverflow=getComputedStyle(sidebar).overflowY;sidebar.scrollTop=0;}
    const workspace=document.querySelector('.workspace')?.getBoundingClientRect();
    const cards=document.querySelector('.medication-grid');
    return {width:innerWidth,height:innerHeight,dpr:devicePixelRatio,timeOrigin:performance.timeOrigin,documentWidth:document.documentElement.scrollWidth,cuts,squeezed,sidebarVisible,navVisible,sidebarLastReachable,sidebarOverflow,workspace:workspace?{left:workspace.left,width:workspace.width}:null,columns:cards?getComputedStyle(cards).gridTemplateColumns:null,draft:document.querySelector('#med-name')?.value||null};
  })()`)
  assert.equal(row.width,size[0]);assert.equal(row.height,size[1]);assert.equal(row.dpr,size[2]);assert.equal(row.timeOrigin,timeOrigin,'Redimensionar nao deve recarregar o documento.')
  rows.push({route,large,...row})
}
try{
  await page('Emulation.setFocusEmulationEnabled',{enabled:true})
  await navigate('/login');await waitFor('!!document.querySelector(".demo-button")')
  const loginTime=await evaluate('performance.timeOrigin')
  for(const size of [sizes[0],sizes[4],sizes[5],sizes[11],sizes[12],sizes[13]]){await resize(size);await inspect('/login',false,size,loginTime)}
  await audit('login-landscape')
  await evaluate('document.querySelector(".demo-button").click()');await waitFor('!!document.querySelector(".routine-heading")')
  const draft='Remedio ficticio para conferir a adaptacao automatica entre dispositivos'
  await mkdir('docs/screenshots',{recursive:true})
  for(const route of ['/','/medicamentos','/adicionar','/configuracoes']){
    for(const large of [false,true]){
      await resize(sizes[0]);await navigate(route)
      await evaluate(`document.documentElement.classList.toggle('large-text',${large});localStorage.setItem('medcontrol_large_text',${JSON.stringify(String(large))})`)
      if(route==='/adicionar')await input('#med-name',draft)
      const timeOrigin=await evaluate('performance.timeOrigin')
      for(const size of sizes){
        await resize(size);await inspect(route,large,size,timeOrigin)
        if(route==='/adicionar')assert.equal(rows.at(-1).draft,draft,'O rascunho precisa sobreviver a troca de tamanho e orientacao.')
        if([375,768,1180,1440].includes(size[0]))await audit(route+' '+size[0]+' '+(large?'large':'normal'))
        if(route==='/'&&!large&&[375,1024,1440].includes(size[0])&&size[1]!==500){
          await evaluate('document.fonts.ready');const shot=await page('Page.captureScreenshot',{format:'png'});
          await writeFile(`docs/screenshots/responsive-routine-${size[0]}x${size[1]}.png`,Buffer.from(shot.data,'base64'))
        }
      }
    }
  }
  await resize(sizes[0]);await navigate('/medicamentos');await button('Repor estoque');await waitFor('!!document.querySelector("dialog[open]")');
  for(const size of [[320,568,2],[844,390,3],[1024,500,2],[1440,900,1]]){
    await resize(size)
    const dialog=await evaluate(`(()=>{const d=document.querySelector('dialog[open]'),r=d.getBoundingClientRect();const b=[...d.querySelectorAll('button')].find(e=>e.textContent==='Adicionar ao estoque');b.scrollIntoView({block:'nearest'});const t=b.getBoundingClientRect();return{width:innerWidth,height:innerHeight,dialog:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},finalActionReachable:t.top>=0&&t.bottom<=innerHeight}})()`)
    dialogRows.push(dialog);await audit('restock '+size[0])
  }
  await button('Cancelar')
  const violations=audits.filter(r=>r.violations.length)
  const issues=rows.filter(r=>r.documentWidth>r.width+1||r.cuts.length||r.squeezed.length||(r.route!=='/login'&&(Number(r.sidebarVisible)+Number(r.navVisible)!==1||r.sidebarLastReachable===false||(r.width<=1024&&Math.abs(r.workspace.width-r.width)>1))))
  const clippedDialogs=dialogRows.filter(r=>r.dialog.left<0||r.dialog.right>r.width+1||r.dialog.top<0||r.dialog.bottom>r.height+1||!r.finalActionReachable)
  const report={checkedAt:new Date().toISOString(),environment:'Disposable local Chrome demo, native live resizing without page reloads',rows,issues,dialogRows,clippedDialogs,accessibility:audits,unexpectedExceptions:browser.errors,limitations:['DPR and viewport emulation is not a physical iOS or Android test','Short viewports approximate available height; no real virtual keyboard tested','Effective CSS widths exercise reflow; browser toolbar zoom was not automated','Automated accessibility does not certify WCAG; no screen reader session','Current screenshots are references; pixel comparison across different layouts is inconclusive']}
  await writeFile('docs/responsive-resize-qa.json',JSON.stringify(report,null,2)+'\n')
  assert.deepEqual(issues,[],JSON.stringify(issues));assert.deepEqual(clippedDialogs,[]);assert.deepEqual(violations,[]);assert.deepEqual(browser.errors,[])
  console.log(JSON.stringify({result:'passed',liveResizeStates:rows.length,dialogSizes:dialogRows.length,axeStates:audits.length,layoutIssues:0,exceptions:0}))
}finally{await browser.dispose()}
