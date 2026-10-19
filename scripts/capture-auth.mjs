// Synthetic visual fixture. Real Supabase interactions run separately in auth-e2e.
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {setTimeout} from 'node:timers';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=process.cwd(),output=resolve('test-results/auth-screenshots');mkdirSync(output,{recursive:true});
const browser=await chromium.launch();
async function capture(version,source){
  if(version==='before'){
    const directory=join(source,'tests/presentation/app/auth-review');mkdirSync(directory,{recursive:true});
    writeFileSync(join(directory,'page.tsx'),`import Login from '@/app/login/page';import {PasswordForm} from '@/components/forms';export default async function Review({searchParams}:{searchParams:Promise<{screen?:string;notice?:string}>}){const params=await searchParams;return params.screen==='update'?<main id="main" className="onboarding card"><h1>A new password.</h1><p>Choose at least 12 characters to keep your founder account safe.</p><PasswordForm/></main>:<Login searchParams={Promise.resolve(params)}/>;}`);
    writeFileSync(join(source,'tests/presentation/app/layout.tsx'),"import RootLayout from '@/app/layout';export default RootLayout;\n");
  }
  writeFileSync(join(source,'tests/presentation/next.config.ts'),'export default {devIndicators:false};\n');
  // Use the production renderer: development issue widgets are not part of the game UI.
  const next=join(root,'node_modules/next/dist/bin/next');
  await new Promise((done,reject)=>{const build=spawn(process.execPath,[next,'build',join(source,'tests/presentation'),'--webpack'],{cwd:source,stdio:['ignore','pipe','pipe'],env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});let output='';build.stdout.on('data',data=>output+=data.toString());build.stderr.on('data',data=>output+=data.toString());build.once('error',reject);build.once('exit',code=>code===0?done():reject(new Error(output.slice(-6000))));});
  const server=spawn(process.execPath,[next,'start',join(source,'tests/presentation'),'-p','3002'],{cwd:source,detached:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});
  let logs='';server.stdout.on('data',data=>logs+=data.toString());server.stderr.on('data',data=>logs+=data.toString());
  try{
    let ready=false;for(let attempt=0;attempt<90;attempt++){try{if((await fetch('http://localhost:3002/auth-review')).ok){ready=true;break;}}catch{}await new Promise(done=>setTimeout(done,1000));}if(!ready)throw new Error(logs.slice(-4000));
    for(const width of version==='before'?[390,1440]:[320,360,390,430,1440])for(const theme of ['light','dark']){
      const context=await browser.newContext({viewport:{width,height:width===1440?1000:844},isMobile:width<800,hasTouch:width<800,deviceScaleFactor:1,reducedMotion:'reduce'});
      const page=await context.newPage();await page.addInitScript(value=>localStorage.setItem('tycoonara-theme',value),theme);
      for(const mode of ['signin','signup','reset','resend','update',...(version==='after'?['expired']:[])]){
        await page.goto(`http://localhost:3002/auth-review${mode==='update'?'?screen=update':mode==='expired'?'?notice=expired':''}`);
        if(mode==='signup')await page.getByRole('button',{name:'Create account',exact:true}).click();
        if(mode==='reset')await page.getByRole('button',{name:version==='before'?'Reset password':'Forgot password?',exact:true}).click();
        if(mode==='resend')await page.getByRole('button',{name:'Resend verification',exact:true}).click();
        await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
        await page.screenshot({path:join(output,`${version}-${width===1440?'desktop':'mobile'}-${width}-${theme}-${mode}.png`),fullPage:true});
      }
      await context.close();
    }
  }finally{try{process.kill(-server.pid,'SIGTERM');}catch{}await new Promise(done=>{if(server.exitCode!==null)done();else server.once('exit',done);});}
}
try{await capture('before',resolve(process.env.TYCOONARA_AUTH_BEFORE_DIR||'auth-before-source'));await capture('after',root);}finally{await browser.close();}
console.log('Captured before/after authentication: all five screens, both themes, requested phone widths and desktop, plus expired links.');
