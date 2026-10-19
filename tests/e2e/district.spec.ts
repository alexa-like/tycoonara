import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {BUILDINGS,buildingState} from '../../lib/rules.mjs';
async function checkAlignment(page:Page,contained:boolean) {
  // Read everything in one animation frame, including while native touch momentum is active.
  const geometry=await page.evaluate(()=>{
    const rect=(element:Element)=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
    return {image:rect(document.querySelector('.map-world > img')!),map:rect(document.querySelector('.map-scroll')!),boxes:[...document.querySelectorAll('.hotspot')].map(rect)};
  });
  const {image,map,boxes}=geometry;
  expect(boxes).toHaveLength(11);
  for(const [index,b] of BUILDINGS.entries()) {
    const box=boxes[index];
    expect(box.width,b.name).toBeGreaterThanOrEqual(44);expect(box.height,b.name).toBeGreaterThanOrEqual(44);
    expect(Math.abs((box.x+box.width/2-image.x)/image.width*100-b.x),b.name+' horizontal alignment').toBeLessThan(.2);
    expect(Math.abs((box.y+box.height/2-image.y)/image.height*100-b.y),b.name+' vertical alignment').toBeLessThan(.2);
    if(contained){expect(box.x).toBeGreaterThanOrEqual(map.x-1);expect(box.x+box.width).toBeLessThanOrEqual(map.x+map.width+1);expect(box.y).toBeGreaterThanOrEqual(map.y-1);expect(box.y+box.height).toBeLessThanOrEqual(map.y+map.height+1);}
  }
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i],b=boxes[j];const overlapX=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x);const overlapY=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);
    expect(overlapX>1&&overlapY>1,`${BUILDINGS[i].name} and ${BUILDINGS[j].name} touch targets must not overlap`).toBe(false);
  }
}
async function panel(page:Page,name:string,touch:boolean,keyboard=false) {
  const b=BUILDINGS.find(b=>b.name===name)!;
  const target=page.getByRole('button',{name:`${b.name}. ${buildingState(b,1)}. Level ${b.level}`,exact:true});
  await target.scrollIntoViewIfNeeded();
  if(keyboard){await target.focus();await page.keyboard.press('Enter');}else if(touch)await target.tap();else await target.click();
  await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog').getByRole('heading',{name:b.name,exact:true})).toBeVisible();
  if(b.level>1)await expect(page.getByRole('dialog')).toContainText(`Requires level ${b.level}`);
  else if(b.id!=='hq')await expect(page.getByRole('dialog')).toContainText('Stage 2 coming soon');
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await expect(target).toBeFocused();
}
for(const width of [320,360,390,430,1440])for(const theme of ['light','dark']) {
  test(`isolated district presentation ${width}px ${theme}: all 11 buildings, touch, keyboard and zoom`,async({page},testInfo)=>{
    test.skip(testInfo.project.name!==(width===1440?'desktop':'mobile'),'Viewport matrix uses mobile touch and desktop keyboard projects.');
    test.setTimeout(180000);
    await page.setViewportSize({width,height:width===1440?1000:844});
    await page.addInitScript(value=>localStorage.setItem('tycoonara-theme',value),theme);
    await page.goto('http://localhost:3002');await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    await expect.poll(()=>page.locator('.map-world > img').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByLabel('Founder statistics')).toContainText('FixtureFounder');await expect(page.getByLabel('Founder statistics')).toContainText('500.00');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const nav=page.getByRole('navigation',{name:'District navigation'});
    if(width<801){expect(await nav.evaluate(el=>getComputedStyle(el).position)).toBe('fixed');const box=await nav.boundingBox();expect(Math.abs(box!.y+box!.height-844)).toBeLessThan(2);expect(await page.locator('.game-layout').evaluate(el=>parseFloat(getComputedStyle(el).paddingBottom))).toBeGreaterThanOrEqual(76);}
    else expect(await nav.evaluate(el=>getComputedStyle(el).position)).not.toBe('fixed');
    for(const button of await nav.getByRole('button').all()){const box=await button.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44);}
    await checkAlignment(page,true);
    for(const b of BUILDINGS)await panel(page,b.name,width<801);
    for(const b of BUILDINGS)await panel(page,b.name,false,true);
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
    await page.getByRole('button',{name:'Explore streets',exact:true}).click();
    await expect(page.locator('.map-scroll')).toHaveAttribute('data-mode','explore');
    await page.locator('.map-scroll').scrollIntoViewIfNeeded();
    if(width<801){
      const viewport=await page.locator('.map-scroll').boundingBox();const y=Math.max(80,Math.min(600,viewport!.y+viewport!.height/2));
      const session=await page.context().newCDPSession(page);const x=width-45;
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      for(let i=1;i<=5;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*35,y}]});
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();
      await expect.poll(()=>page.locator('.map-scroll').evaluate(el=>el.scrollLeft)).toBeGreaterThan(50);
    }
    await page.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(page.locator('.map-zoom output')).toHaveText('125%');await checkAlignment(page,false);
    for(const b of BUILDINGS)await panel(page,b.name,width<801);
    await page.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(page.getByRole('button',{name:'Zoom in',exact:true})).toBeDisabled();await checkAlignment(page,false);
    await page.getByRole('button',{name:'Whole district',exact:true}).click();await checkAlignment(page,true);
    await nav.getByRole('button',{name:'Buildings',exact:true}).click();await expect(page.getByRole('heading',{name:'Every address, one tap away.'})).toBeInViewport();
    for(const b of BUILDINGS){const button=page.locator('.directory-grid').getByRole('button',{name:new RegExp(b.name)});await button.click();await expect(page.getByRole('dialog')).toContainText(b.name);await page.getByRole('button',{name:'Close building panel'}).click();}
    await nav.getByRole('button',{name:'Notices',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('No notifications yet');await page.keyboard.press('Escape');
    // A short landscape screen must keep panels scrollable and their actions reachable.
    if(width===390){await page.setViewportSize({width:844,height:390});await nav.getByRole('button',{name:'Founder',exact:true}).click();await page.getByRole('button',{name:'Back to the district',exact:true}).scrollIntoViewIfNeeded();await page.getByRole('button',{name:'Back to the district',exact:true}).click();}
  });
}
