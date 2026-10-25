const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
mkdirSync('art/drill-mode-studies/playable-review', { recursive: true });
(async () => {
 const browser = await chromium.launch();
 try {
 const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
 const errors = []; page.on('pageerror', e => errors.push(e.message));
 await page.clock.install();
 await page.goto('http://localhost:8097');
 await page.getByRole('button', { name: 'Step onto the court' }).waitFor();
 await page.screenshot({ path: 'art/drill-mode-studies/playable-review/intro.png' });
 await page.getByRole('button', { name: 'Step onto the court' }).click();
 const state = () => page.evaluate(() => window.courtyardState());
 const until = async (fn) => { for(let i=0;i<600;i++){ const s=await state(); if(fn(s))return s; await page.clock.runFor(40); } throw Error('Timed out: '+JSON.stringify(await state())); };
 await until(s => s.phase === 'incoming');
 await page.getByRole('button', { name: 'Pause practice' }).click();
 const frozen = await state(); await page.clock.runFor(2000); assert.deepEqual(await state(), frozen);
 await page.getByRole('button', { name: 'Resume practice' }).click();
 await page.mouse.move(200, 570); await page.mouse.down(); await page.mouse.up();
 assert.equal((await state()).hits, 0, 'Cannot hit before bounce');
 for(let shot=1;shot<=10;shot++) {
   await until(s => s.feeds === shot && s.phase === 'incoming');
   await page.mouse.move(180,570); await page.mouse.down();
   await until(s => s.ball?.z >= 8.7 && s.ball?.bounces === 1);
   if(shot === 2) await page.mouse.move(350,570);
   await page.mouse.up();
   assert.equal((await state()).phase, 'outgoing');
   if(shot === 1){await page.clock.runFor(70);await page.screenshot({path:'art/drill-mode-studies/playable-review/contact.png'});}
   await until(s => s.phase === 'waiting');
 }
 await until(s=>s.phase==='finished');
 const result=await state(); assert.equal(result.hits,10);assert.equal(result.landed,9);
 await page.screenshot({path:'art/drill-mode-studies/playable-review/finished.png'});
 await page.getByRole('button',{name:'Another ten'}).click();assert.equal((await state()).feeds,0);
 await until(s=>s.phase==='incoming');
 await page.mouse.move(180,570); await page.mouse.down();
 await page.dispatchEvent('#court','pointercancel',{pointerId:1});assert.equal((await state()).held,false);
 await page.mouse.up();
 await until(s=>s.feeds===2);assert.equal((await state()).hits,0,'Missed feeds advance');
 await page.setViewportSize({width:1280,height:900});await page.clock.runFor(50);await page.screenshot({path:'art/drill-mode-studies/playable-review/desktop.png'});
 await page.setViewportSize({width:320,height:568});await page.clock.runFor(50);await page.screenshot({path:'art/drill-mode-studies/playable-review/small.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result,errors,checks:['pause freezes physics','early swing rejected','10 timed returns','direction changes landing','9 in / 1 wide','session completes','restart resets','cancel clears hold','miss advances','phone and desktop layouts']},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
