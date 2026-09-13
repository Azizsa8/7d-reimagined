/* Offline QA only. Supply externally installed Playwright and Chromium paths.
   PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chrome node tools/verify-recovery.cjs
   Serve the repository separately on port 8094. No npm/build dependency is added to the site. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const out=path.resolve('qa/recovery');fs.mkdirSync(out,{recursive:true});
const base=process.env.QA_URL||'http://localhost:8094';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const report=[];
 try{
  for(const width of [1440,390])for(const lang of ['en','ar']){
   const context=await browser.newContext({viewport:{width,height:width===1440?900:844}}),page=await context.newPage(),errors=[],failed=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push({status:r.status(),url:r.url()})});
   await page.addInitScript(()=>{sessionStorage.setItem('7d_gate','1');window.longTasks=[];new PerformanceObserver(list=>{for(const e of list.getEntries())window.longTasks.push(e.duration)}).observe({type:'longtask',buffered:true});});
   const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');let received=0;cdp.on('Network.loadingFinished',e=>received+=e.encodedDataLength);
   await page.goto(base+'/?lang='+lang,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.flight&&window.startTour);await page.waitForTimeout(1600);
   const initial=await page.evaluate(()=>{const r=performance.getEntriesByType('resource');return {bytes:performance.getEntriesByType('navigation')[0].encodedBodySize+r.reduce((n,e)=>n+e.encodedBodySize,0),projectImageRequests:r.filter(e=>e.name.includes('/assets/projects/')).length,globeLoaded:!!window.globe};});
   initial.networkBytes=received;await page.evaluate(()=>window.longTasks=[]);
   const captures=[['hero','#hero',0],['globe','#globeWrap',.65],...Array.from({length:4},(_,i)=>['project-'+i,'#flight',i/3]),...Array.from({length:7},(_,i)=>['discipline-'+i,`.card[data-n="0${i+1}"]`,0]),['history','#history',0],['news-0','#railWrap',0],['news-1','#railWrap',.5],['news-2','#railWrap',1],['quote','#quote',0],['contact','#cta',0],['footer','footer',0]];
   for(const [name,selector,progress] of captures){
    await page.evaluate(({selector,progress})=>{const el=document.querySelector(selector);scrollTo(0,el.getBoundingClientRect().top+scrollY+(selector==='#flight'||selector==='#globeWrap'||selector==='#railWrap'?Math.max(0,el.offsetHeight-innerHeight)*progress:-90));},{selector,progress});
    if(name==='globe')await page.waitForFunction(()=>window.globe?.ready);
    await page.waitForTimeout(700);
    if(name.startsWith('project'))await page.locator('.project-image.on').evaluate(img=>img.decode());
    await page.screenshot({path:path.join(out,`${width}-${lang}-${name}.jpg`),type:'jpeg',quality:78});
   }
   // Numbered project navigation is keyboard operable and hidden cards cannot receive focus.
   await page.evaluate(()=>document.querySelector('#flight').scrollIntoView());
   const button=page.locator('[data-project-go="2"]');await button.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>window.flight.active===2);
   const controls=await page.evaluate(()=>({active:window.flight.active,hiddenCardsInert:[...document.querySelectorAll('.scene-card:not(.on)')].every(c=>c.inert)}));
   await page.evaluate(()=>window.startTour());await page.waitForTimeout(200);await page.locator('#tourToggle').click();
   const paused=await page.evaluate(()=>document.body.classList.contains('tour-paused'));await page.locator('#tourToggle').click();
   const resumed=await page.evaluate(()=>!document.body.classList.contains('tour-paused'));await page.locator('#tourEnd').click();
   const scrollTasks=await page.evaluate(()=>window.longTasks);
   await page.emulateMedia({reducedMotion:'reduce'});await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.flight);
   await page.evaluate(()=>document.querySelector('#globeWrap').scrollIntoView());await page.waitForFunction(()=>window.globe?.ready);await page.waitForTimeout(300);
   const before=await page.evaluate(()=>window.globe.renderer.info.render.frame);await page.waitForTimeout(400);const after=await page.evaluate(()=>window.globe.renderer.info.render.frame);
   await page.evaluate(()=>document.querySelector('#flight').scrollIntoView());await page.waitForTimeout(300);
   const still=await page.locator('.project-image.on').evaluate(el=>getComputedStyle(el).transform);
   const entry={width,lang,errors,failed,initial,controls,paused,resumed,scrollTasks,reduced:{before,after,staticImage:still==='none'},overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)};
   report.push(entry);console.log(JSON.stringify(entry));await context.close();
  }
 }finally{await browser.close();fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2)+'\n');}
 if(report.some(r=>r.errors.length||r.failed.length||r.overflow||!r.controls.hiddenCardsInert||!r.paused||!r.resumed||r.reduced.before!==r.reduced.after||!r.reduced.staticImage||r.initial.projectImageRequests))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
