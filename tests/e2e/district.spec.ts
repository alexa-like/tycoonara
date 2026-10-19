import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {BUILDINGS,buildingState} from '../../lib/rules.mjs';
const nav=(page:Page)=>page.locator('.district-nav');
async function shell(page:Page,width:number,height:number) {
  const geometry=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,bodyHeight:document.body.scrollHeight,scrollY}));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(width);expect(geometry.scrollHeight).toBeLessThanOrEqual(height+1);expect(geometry.bodyHeight).toBeLessThanOrEqual(height+1);expect(geometry.scrollY).toBe(0);
  const dock=await nav(page).boundingBox();expect(dock!.width).toBeLessThan(width-15);expect(Math.abs(dock!.x+dock!.width/2-width/2)).toBeLessThan(2);expect(height-dock!.y-dock!.height).toBeGreaterThanOrEqual(12);
  expect(await nav(page).evaluate(el=>getComputedStyle(el).position)).toBe('fixed');expect(await nav(page).evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  const map=await page.locator('.map-scroll').boundingBox();expect(map!.width).toBeGreaterThan(width-30);expect(map!.height).toBeGreaterThan(40);expect(map!.y+map!.height).toBeLessThan(dock!.y);
  for(const button of await nav(page).getByRole('button').all()){const box=await button.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44);}
  const controls=await page.locator('.map-controls').boundingBox();expect(controls!.y+controls!.height).toBeLessThan(dock!.y);
}
async function alignment(page:Page) {
  const boxes=await page.evaluate(()=>{const rect=(el:Element)=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};};return {image:rect(document.querySelector('.map-world>img')!),pins:[...document.querySelectorAll('.hotspot')].map(rect)};});
  expect(boxes.pins).toHaveLength(11);
  for(const [i,b] of BUILDINGS.entries()){const r=boxes.pins[i],img=boxes.image;expect(r.width).toBeGreaterThanOrEqual(44);expect(r.height).toBeGreaterThanOrEqual(44);expect(Math.abs((r.x+r.width/2-img.x)/img.width*100-b.x)).toBeLessThan(.2);expect(Math.abs((r.y+r.height/2-img.y)/img.height*100-b.y)).toBeLessThan(.2);}
  for(let i=0;i<11;i++)for(let j=i+1;j<11;j++){const a=boxes.pins[i],b=boxes.pins[j];expect(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>1,`${BUILDINGS[i].name}/${BUILDINGS[j].name} target overlap`).toBe(false);}
}
async function accessible(page:Page){expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);}
async function building(page:Page,b:typeof BUILDINGS[number],touch:boolean,keyboard=false){
  const pin=page.getByRole('button',{name:`${b.name}. ${buildingState(b,1)}. Level ${b.level}`,exact:true});await pin.scrollIntoViewIfNeeded();
  if(keyboard){await pin.focus();await page.keyboard.press('Enter');}else if(touch)await pin.tap();else await pin.click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog.getByRole('heading',{name:b.name,exact:true})).toBeVisible();
  if(b.level>1)await expect(dialog).toContainText(`Requires level ${b.level}`);else if(b.id!=='hq')await expect(dialog).toContainText('Stage 2 coming soon');
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(pin).toBeFocused();
}
for(const [width,height] of [[320,844],[360,844],[390,844],[430,844],[844,390],[667,320],[1440,900],[1280,600],[720,450]])for(const theme of ['light','dark']){
  test(`isolated district presentation ${width}x${height} ${theme}: viewport, floating dock and all panels`,async({page},testInfo)=>{
    test.skip(testInfo.project.name!==(width>=1000||width===720?'desktop':'mobile'),'Each layout runs in its matching input project.');test.setTimeout(180000);
    await page.setViewportSize({width,height});await page.addInitScript(value=>localStorage.setItem('tycoonara-theme',value),theme);
    await page.goto('http://localhost:3002');await expect.poll(()=>page.locator('.map-world>img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByLabel('Founder statistics')).toContainText('FixtureFounder');await expect(page.getByLabel('Founder statistics')).toContainText('500.00');
    await expect(nav(page).getByRole('button')).toHaveCount(5);await expect(nav(page).getByRole('button')).toHaveText(['District','Buildings','Founder','Notices','Settings']);
    await expect(page.locator('.map-scroll')).toHaveAttribute('data-ready','true');
    await shell(page,width,height);await alignment(page);await accessible(page);
    if(testInfo.project.name==='mobile')await nav(page).getByRole('button',{name:'District',exact:true}).tap();
    await nav(page).getByRole('button',{name:'District',exact:true}).click();await nav(page).getByRole('button',{name:'District',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
    for(const b of BUILDINGS)await building(page,b,testInfo.project.name==='mobile');
    for(const b of BUILDINGS)await building(page,b,false,true);
    await page.getByRole('button',{name:'Explore streets',exact:true}).click();await expect(page.locator('.map-scroll')).toHaveAttribute('data-mode','explore');
    if(testInfo.project.name==='mobile'){
      const box=await page.locator('.map-scroll').boundingBox();const x=Math.min(width-35,box!.x+box!.width-30),y=box!.y+box!.height/2;const session=await page.context().newCDPSession(page);
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=4;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*40,y}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();await expect.poll(()=>page.locator('.map-scroll').evaluate(el=>el.scrollLeft)).toBeGreaterThan(30);
    }
    await page.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(page.locator('.map-zoom output')).toHaveText('125%');await alignment(page);
    for(const b of BUILDINGS)await building(page,b,testInfo.project.name==='mobile');
    await page.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(page.locator('.map-zoom output')).toHaveText('150%');await alignment(page);
    const position=await page.locator('.map-scroll').evaluate(el=>({x:el.scrollLeft,y:el.scrollTop}));
    if(testInfo.project.name==='mobile')await nav(page).getByRole('button',{name:'Buildings',exact:true}).tap();else await nav(page).getByRole('button',{name:'Buildings',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(nav(page).locator('[aria-label=Buildings]')).toHaveAttribute('aria-current','page');await accessible(page);
    // Native modal inertness: coordinate taps on the dock cannot open duplicate dialogs or pan the map.
    const dock=await nav(page).boundingBox();const point={x:dock!.x+dock!.width*.3,y:dock!.y+dock!.height/2};expect(await page.evaluate(({x,y})=>!document.elementFromPoint(x,y)?.closest('.district-nav'),point)).toBe(true);
    const panelBox=await dialog.boundingBox();if(point.x<panelBox!.x||point.x>panelBox!.x+panelBox!.width||point.y<panelBox!.y||point.y>panelBox!.y+panelBox!.height)await page.mouse.click(point.x,point.y);
    await expect(page.locator('dialog[open]')).toHaveCount(1);await expect(dialog.getByRole('heading',{name:'Every address, one tap away.'})).toBeVisible();
    expect(await page.locator('.panel-body').evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
    for(const b of BUILDINGS){await dialog.locator('.directory-grid').getByRole('button',{name:new RegExp(b.name)}).click();await expect(dialog.getByRole('heading',{name:b.name,exact:true})).toBeVisible();await dialog.getByRole('button',{name:'Browse all buildings',exact:true}).click();}
    await page.getByRole('button',{name:'Close panel',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(nav(page).getByRole('button',{name:'Buildings',exact:true})).toBeFocused();
    expect(await page.locator('.map-scroll').evaluate(el=>({x:el.scrollLeft,y:el.scrollTop}))).toEqual(position);
    for(const section of ['Founder','Notices','Settings']){
      const button=nav(page).getByRole('button',{name:section,exact:true});if(testInfo.project.name==='mobile'){await button.tap();await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(button).toBeFocused();}await button.focus();await page.keyboard.press('Enter');await expect(dialog).toBeVisible();await expect(nav(page).locator(`[aria-label=${section}]`)).toHaveAttribute('aria-current','page');await expect(dialog.getByRole('button',{name:'Close panel',exact:true})).toBeFocused();
      if(section==='Founder'){await expect(dialog).toContainText('500.00 EC');await expect(dialog).toContainText('Progression will arrive');}
      if(section==='Notices')await expect(dialog).toContainText('No notifications yet');
      if(section==='Settings'){await expect(dialog.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();await dialog.getByRole('button',{name:theme==='light'?'Use dark mode':'Use light mode',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme',theme==='light'?'dark':'light');await dialog.getByRole('button',{name:theme==='light'?'Use light mode':'Use dark mode',exact:true}).click();}
      await accessible(page);await dialog.getByRole('button',{name:'Back to the district',exact:true}).scrollIntoViewIfNeeded();await expect(dialog.getByRole('button',{name:'Back to the district',exact:true})).toBeInViewport();await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(button).toBeFocused();
    }
    await page.getByRole('button',{name:'Whole district',exact:true}).click();await alignment(page);await shell(page,width,height);
    const destination=page.getByRole('button',{name:'Property Exchange. Locked. Level 25',exact:true});await destination.scrollIntoViewIfNeeded();await destination.click();await page.getByRole('button',{name:'Locate on map',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(destination).toBeFocused();

    if(height>500){await page.getByRole('button',{name:'Dismiss district tip',exact:true}).click();await expect(page.locator('.district-tip')).toHaveCount(0);await shell(page,width,height);}
    if(width===390){
      await page.addStyleTag({content:'.game-layout{--dock-space:116px}.district-nav{bottom:34px}'});await shell(page,width,height);expect(height-(await nav(page).boundingBox())!.y-(await nav(page).boundingBox())!.height).toBeGreaterThanOrEqual(32);
    }
  });
}
test('isolated district presentation desktop zoom reflow 100–200% and reduced motion',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop');test.setTimeout(90000);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://localhost:3002');await expect(page.locator('.map-scroll')).toHaveAttribute('data-ready','true');
  const session=await page.context().newCDPSession(page);
  for(const scale of [1,1.25,1.5,2]){const width=Math.round(1440/scale),height=Math.round(900/scale);await session.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:scale,mobile:false});await shell(page,width,height);await alignment(page);await nav(page).getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Back to the district',exact:true}).scrollIntoViewIfNeeded();await page.keyboard.press('Escape');}
  expect(await nav(page).getByRole('button',{name:'District',exact:true}).evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');await session.detach();
});
