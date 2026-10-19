// Captures only a synthetic founder fixture. Never visits authenticated production pages.
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {setTimeout} from 'node:timers';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=process.cwd();const output=resolve('test-results/district-screenshots');mkdirSync(output,{recursive:true});
let assetRoot=root;
const assets=createServer((request,response)=>{if(request.url==='/district.svg'){response.writeHead(200,{'Content-Type':'image/svg+xml'});response.end(readFileSync(join(assetRoot,'public/district.svg')));}else{response.writeHead(404);response.end();}});
await new Promise(done=>assets.listen(3000,'127.0.0.1',done));
const browser=await chromium.launch();
async function capture(version,source){
  assetRoot=source;
  if(version==='before')writeFileSync(join(source,'tests/presentation/app/layout.tsx'),"import RootLayout from '@/app/layout';\nexport const metadata={title:'Tycoonara baseline screenshot'};\nexport default RootLayout;\n");
  const server=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'dev',join(source,'tests/presentation'),'--webpack','-p','3002'],{cwd:source,detached:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});
  let logs='';server.stdout.on('data',b=>logs+=b.toString());server.stderr.on('data',b=>logs+=b.toString());
  try{
    let ready=false;for(let attempt=0;attempt<90;attempt++){try{const r=await fetch('http://localhost:3002');if(r.ok){ready=true;break;}}catch{}await new Promise(done=>setTimeout(done,1000));}
    if(!ready)throw new Error(`Fixture failed to start: ${logs.slice(-4000)}`);
    for(const width of version==='before'?[390,1440]:[320,360,390,430,1440])for(const theme of ['light','dark']){
      const context=await browser.newContext({viewport:{width,height:width===1440?1000:844},isMobile:width<800,hasTouch:width<800,deviceScaleFactor:1,reducedMotion:'reduce'});
      const page=await context.newPage();await page.addInitScript(value=>localStorage.setItem('tycoonara-theme',value),theme);
      await page.goto('http://localhost:3002');await page.locator('.map-world > img').waitFor();await page.waitForFunction(()=>document.querySelector('.map-world > img')?.naturalWidth>0);await page.evaluate(()=>document.fonts.ready);
      const name=`${version}-${width===1440?'desktop':'mobile'}-${width}-${theme}`;
      await page.screenshot({path:join(output,`${name}.png`)});await page.screenshot({path:join(output,`${name}-full.png`),fullPage:true});
      if(version==='after'&&width===390){
        await page.getByRole('button',{name:'Explore streets',exact:true}).click();await page.locator('#district-map').scrollIntoViewIfNeeded();await page.screenshot({path:join(output,`${name}-explore.png`)});
        await page.getByRole('button',{name:'Whole district',exact:true}).click();await page.getByRole('button',{name:'Marketplace. Preview. Level 1',exact:true}).click();await page.screenshot({path:join(output,`${name}-panel.png`)});
      }
      await context.close();
    }
  }finally{try{process.kill(-server.pid,'SIGTERM');}catch{}await new Promise(done=>{if(server.exitCode!==null)done();else server.once('exit',done);});}
}
try{
  const before=resolve(process.env.TYCOONARA_BEFORE_DIR||'before-source');if(!existsSync(before))throw new Error('Before checkout is required');
  await capture('before',before);await capture('after',root);
}finally{await browser.close();assets.close();}
console.log('Captured district before/after at 320, 360, 390, 430 and 1440 CSS pixels, in both themes. Fixture data only.');
