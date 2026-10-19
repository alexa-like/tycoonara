// Production-rendered before/after screenshots of a synthetic founder only.
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {setTimeout} from 'node:timers';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=process.cwd(),output=resolve('test-results/district-screenshots');mkdirSync(output,{recursive:true});
let assetRoot=root;
const assets=createServer((request,response)=>{if(request.url==='/district.svg'){response.writeHead(200,{'Content-Type':'image/svg+xml'});response.end(readFileSync(join(assetRoot,'public/district.svg')));}else{response.writeHead(404);response.end();}});
await new Promise(done=>assets.listen(3000,'127.0.0.1',done));
const browser=await chromium.launch();
async function capture(version,source){
  assetRoot=source;
  writeFileSync(join(source,'tests/presentation/next.config.ts'),"export default {devIndicators:false,async rewrites(){return [{source:'/district.svg',destination:'http://localhost:3000/district.svg'}];}};\n");
  const next=join(root,'node_modules/next/dist/bin/next');
  await new Promise((done,reject)=>{const build=spawn(process.execPath,[next,'build',join(source,'tests/presentation'),'--webpack'],{cwd:source,stdio:['ignore','pipe','pipe'],env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});let output='';build.stdout.on('data',d=>output+=d.toString());build.stderr.on('data',d=>output+=d.toString());build.once('error',reject);build.once('exit',code=>code===0?done():reject(new Error(output.slice(-6000))));});
  const server=spawn(process.execPath,[next,'start',join(source,'tests/presentation'),'-p','3002'],{cwd:source,detached:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});let logs='';server.stdout.on('data',d=>logs+=d.toString());server.stderr.on('data',d=>logs+=d.toString());
  try{
    let ready=false;for(let attempt=0;attempt<60;attempt++){try{if((await fetch('http://localhost:3002')).ok){ready=true;break;}}catch{}await new Promise(done=>setTimeout(done,1000));}if(!ready)throw new Error(logs.slice(-4000));
    const sizes=version==='before'?[[390,844],[1440,900]]:[[320,844],[360,844],[390,844],[430,844],[844,390],[1440,900],[1280,600]];
    for(const [width,height] of sizes)for(const theme of ['light','dark']){
      const context=await browser.newContext({viewport:{width,height},isMobile:width<1000,hasTouch:width<1000,deviceScaleFactor:1,reducedMotion:'reduce'});const page=await context.newPage();await page.addInitScript(value=>localStorage.setItem('tycoonara-theme',value),theme);
      await page.goto('http://localhost:3002');await page.waitForFunction(()=>document.querySelector('.map-world>img')?.naturalWidth>0);await page.evaluate(()=>document.fonts.ready);
      if(version==='after')await page.waitForFunction(()=>document.querySelector('.map-scroll')?.getAttribute('data-ready')==='true');
      const name=`${version}-${width<1000?'mobile':'desktop'}-${width}x${height}-${theme}`;
      await page.screenshot({path:join(output,`${name}.png`)});
      if(version==='before'){await page.screenshot({path:join(output,`${name}-full.png`),fullPage:true});await context.close();continue;}
      if(width===390||width===1440||height<500){
        await page.getByRole('button',{name:'Explore streets',exact:true}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.screenshot({path:join(output,`${name}-explore.png`)});await page.getByRole('button',{name:'Whole district',exact:true}).click();
        await page.getByRole('button',{name:'Marketplace. Preview. Level 1',exact:true}).click();await page.screenshot({path:join(output,`${name}-building.png`)});await page.getByRole('button',{name:'Close panel',exact:true}).click();
        for(const section of ['Buildings','Founder','Notices','Settings']){await page.getByRole('navigation',{name:'District navigation'}).getByRole('button',{name:section,exact:true}).click();await page.screenshot({path:join(output,`${name}-${section.toLowerCase()}.png`)});await page.getByRole('button',{name:'Close panel',exact:true}).click();}
      }
      await context.close();
    }
  }finally{try{process.kill(-server.pid,'SIGTERM');}catch{}await new Promise(done=>{if(server.exitCode!==null)done();else server.once('exit',done);});}
}
try{await capture('before',resolve('before-source'));await capture('after',root);}finally{await browser.close();assets.close();}
console.log('Captured viewport-owned district and floating dock: phones, landscape, desktop and short laptop in both themes.');
