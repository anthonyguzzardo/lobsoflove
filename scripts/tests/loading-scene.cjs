// Run with PLAYWRIGHT_MODULE pointing to an installed Playwright package.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const source=fs.readFileSync('src/generated/loading-scene-html.ts','utf8');
const html=JSON.parse(source.slice(source.indexOf(' = ')+3).trim().replace(/;$/,''));
(async()=>{
 const browser=await chromium.launch();
 try{
 for(const config of [{reduced:false,preview:false,active:true},{reduced:true,preview:false,active:true},{reduced:false,preview:true,active:true},{reduced:false,preview:true,fullReplay:true,active:true}]){
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<script>window.messages=[];addEventListener("message",e=>{try{messages.push(JSON.parse(e.data))}catch{}})</script><iframe style="width:350px;height:350px" sandbox="allow-scripts"></iframe>');
 await page.locator('iframe').evaluate((el,src)=>el.srcdoc=src,html.replace('__CONFIG__',JSON.stringify(config)));
 await page.waitForFunction(()=>messages.some(m=>m.type==='ready'));
 const artwork=page.frames()[1];
 const first=await artwork.evaluate(()=>scene.getState());
 if(!config.fullReplay&&!config.reduced){assert.equal(first.time,30,'Startup artwork must already be assembled');assert.equal(first.titleComplete,false,'Name must write in');}
 if(config.fullReplay)assert.ok(first.time<2,'Replay must start from the beginning');
 if(!config.reduced){
 await page.waitForTimeout(250);
 await page.locator('iframe').evaluate(el=>el.contentWindow.postMessage(JSON.stringify({source:'lol-loading-control',active:false}),'*'));
 const frame=page.frames()[1];const before=await frame.evaluate(()=>elapsed);await page.waitForTimeout(200);assert.equal(await frame.evaluate(()=>elapsed),before,'Paused time must not advance');
 await page.locator('iframe').evaluate(el=>el.contentWindow.postMessage(JSON.stringify({source:'lol-loading-control',active:true}),'*'));
 }
 await page.waitForFunction(()=>messages.some(m=>m.type==='complete'),{},{timeout:26000});
 await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>messages.filter(m=>m.type==='complete').length),1);
 if(config.preview){const frame=page.frames()[1];const before=await frame.evaluate(()=>elapsed);await page.waitForTimeout(250);assert.equal(await frame.evaluate(()=>elapsed),before,'Finished artwork must hold');}
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>messages.some(m=>m.type==='error')),false);await page.close();
 }
 console.log('Embedded intro: ready, one-shot completion, pause/resume, reduced motion, calm startup, slow replay, finished preview hold passed.');
 }finally{await browser.close();}
})();
