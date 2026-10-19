import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function layout(page:Page,width:number) {
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const card=await page.locator('.auth-card').boundingBox();
  expect(card!.width).toBeGreaterThanOrEqual(Math.min(width-32,400));
  if(width<980){const intro=await page.locator('.auth-intro').boundingBox();expect(card!.y).toBeGreaterThanOrEqual(intro!.y+intro!.height-1);}
  for(const input of await page.locator('.auth-form input:not([type=hidden])').all()){
    const box=await input.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.width).toBeGreaterThanOrEqual(card!.width-64);expect(await input.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  }
  for(const button of await page.locator('.auth-card button').all()) {const box=await button.boundingBox();if(box){expect(box.height).toBeGreaterThanOrEqual(44);expect(box.width).toBeGreaterThanOrEqual(44);}}
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
}
for(const width of [320,360,390,430,768,1024,1440])for(const theme of ['light','dark']){
  test(`mobile-first authentication ${width}px ${theme}: form modes, validation and keyboard`,async({page},testInfo)=>{
    test.skip(testInfo.project.name!==(width<980?'mobile':'desktop'),'Each viewport runs once using the matching input project.');
    await page.setViewportSize({width,height:844});
    await page.addInitScript(value=>localStorage.setItem('tycoonara-theme',value),theme);
    await page.goto('/login');await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    await expect(page.getByRole('group',{name:'Account access'}).getByRole('button')).toHaveCount(2);
    await layout(page,width);
    const email=page.getByLabel('Email address');const password=page.getByLabel('Password',{exact:true});
    await email.fill('not-an-email');await password.fill('A-private-password!');
    await page.getByRole('button',{name:'Enter Tycoonara',exact:true}).click();
    expect(await email.evaluate((el:HTMLInputElement)=>el.validity.typeMismatch)).toBe(true);await expect(email).toBeFocused();
    await email.fill('founder@example.test');await password.focus();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Show password',exact:true})).toBeFocused();await page.keyboard.press('Enter');await expect(password).toHaveAttribute('type','text');await page.getByRole('button',{name:'Hide password',exact:true}).click();
    await page.getByRole('button',{name:'Forgot password?',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Let’s get you back in.'})).toBeFocused();await expect(email).toHaveValue('founder@example.test');await expect(password).toHaveCount(0);await layout(page,width);
    await page.getByRole('button',{name:'← Back to sign in',exact:true}).click();
    await page.getByRole('button',{name:'Create account',exact:true}).click();
    await expect(password).toHaveAttribute('autocomplete','new-password');await expect(password).toHaveAttribute('minlength','12');await password.fill('short');await page.getByRole('button',{name:'Start your story',exact:true}).click();expect(await password.evaluate((el:HTMLInputElement)=>el.validity.tooShort)).toBe(true);await layout(page,width);
    await page.getByRole('button',{name:'Resend verification',exact:true}).click();await expect(page.getByRole('heading',{name:'Your first step: verify.'})).toBeFocused();await expect(page.getByRole('button',{name:'Send verification link',exact:true})).toBeVisible();await layout(page,width);
    await page.goto('/login?notice=expired');await expect(page.getByRole('status')).toContainText('expired');await expect(page.getByRole('button',{name:'Send verification link',exact:true})).toBeVisible();await layout(page,width);
    await page.goto('/login?notice=password');await expect(page.getByRole('status')).toContainText('Password updated');await layout(page,width);
    // Short visual viewport approximates the space remaining above an on-screen keyboard.
    if(width===390){await page.setViewportSize({width,height:420});await page.getByLabel('Password',{exact:true}).focus();await page.getByRole('button',{name:'Enter Tycoonara',exact:true}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Enter Tycoonara',exact:true})).toBeInViewport();}
    await page.setViewportSize({width,height:844});
    // Isolated visual app only: production /auth/update-password remains session-protected.
    await page.goto('http://localhost:3002/auth-review?screen=update');await layout(page,width);
    const newPassword=page.getByLabel('New password',{exact:true});await newPassword.fill('short');await page.getByRole('button',{name:'Save password and sign out',exact:true}).click();expect(await newPassword.evaluate((el:HTMLInputElement)=>el.validity.tooShort)).toBe(true);
    await page.getByRole('button',{name:'Show new password',exact:true}).click();await expect(newPassword).toHaveAttribute('type','text');await page.getByRole('button',{name:'Hide new password',exact:true}).click();await expect(newPassword).toHaveAttribute('type','password');
  });
}
