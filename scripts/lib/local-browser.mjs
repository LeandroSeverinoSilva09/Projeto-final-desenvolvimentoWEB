// Disposable local-only Chrome CDP harness. Never connects to a personal browser profile.
import assert from 'node:assert/strict'
export const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
export async function localBrowser(port='9338',origin='http://127.0.0.1:5173'){
  assert(/^\d+$/.test(port));assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  const version=await fetch(`http://127.0.0.1:${port}/json/version`).then(r=>r.json())
  const socket=new WebSocket(version.webSocketDebuggerUrl)
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})})
  let nextId=0,sessionId
  const pending=new Map(),loaded=new Set(),errors=[],requests=[]
  socket.addEventListener('message',({data})=>{
    const m=JSON.parse(String(data)),p=pending.get(m.id)
    if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)}
    if(m.sessionId!==sessionId)return
    if(m.method==='Page.lifecycleEvent'&&m.params.name==='DOMContentLoaded')loaded.add(m.params.loaderId)
    if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)
    if(m.method==='Network.requestWillBeSent')requests.push({method:m.params.request.method,url:m.params.request.url})
  })
  function command(method,params={},session){
    const id=++nextId
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Timeout ${method}`))},20000)
      pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(session?{sessionId:session}:{})}))
    })
  }
  const {browserContextId}=await command('Target.createBrowserContext')
  const {targetId}=await command('Target.createTarget',{browserContextId,url:'about:blank'})
  sessionId=(await command('Target.attachToTarget',{targetId,flatten:true})).sessionId
  const page=(method,params)=>command(method,params,sessionId)
  const evaluate=async expression=>{
    const r=await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})
    if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text)
    return r.result.value
  }
  const waitFor=async (expression,timeout=10000)=>{
    const end=Date.now()+timeout
    while(Date.now()<end){if(await evaluate(`(async()=>Boolean(await (${expression})))()`))return;await pause(100)}
    throw new Error(`Condicao nao confirmada: ${expression}`)
  }
  const navigate=async route=>{
    const {loaderId}=await page('Page.navigate',{url:origin+route})
    if(loaderId){for(let i=0;i<100&&!loaded.has(loaderId);i++)await pause(100);assert(loaded.has(loaderId))}
    await waitFor(`location.pathname===${JSON.stringify(route)}&&!!document.querySelector('main')`)
  }
  const input=(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`)
  const button=text=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b||b.disabled)throw Error('Botao indisponivel: '+${JSON.stringify(text)});b.click()})()`)
  await page('Page.enable');await page('Page.setLifecycleEventsEnabled',{enabled:true});await page('Runtime.enable');await page('Network.enable')
  return {page,evaluate,waitFor,navigate,input,button,errors,requests,version:version.Browser,
    grantPermissions:permissions=>command('Browser.grantPermissions',{browserContextId,origin,permissions}),
    async dispose(){await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});socket.close()}}
}
