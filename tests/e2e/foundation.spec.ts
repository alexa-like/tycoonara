import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function accessible(page: Page) {
  const results = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}
async function emailLink(request: APIRequestContext, mailbox: string, purpose = 'signup') {
  let link = '';
  await expect.poll(async () => {
    const response = await request.get('http://127.0.0.1:54324/api/v1/messages');
    if (!response.ok()) return false;
    const inbox = await response.json();
    const message = inbox.messages?.find((m: { To: { Address: string }[]; Subject: string }) =>
      m.To.some(to => to.Address === `${mailbox}@example.test`) &&
      (purpose === 'recovery' ? /reset|recover/i.test(m.Subject) : /confirm|verify/i.test(m.Subject)));
    if (!message) return false;
    const detail = await (await request.get(`http://127.0.0.1:54324/api/v1/message/${message.ID}`)).json();
    const html = detail.HTML || detail.Text;
    const match = html.match(/https?:\/\/[^\s"<>]*\/auth\/v1\/verify[^\s"<>]*/);
    link = match ? match[0].replaceAll('&amp;','&') : '';
    return Boolean(link);
  },{timeout:30000}).toBe(true);
  return link;
}
test('public landing, protected routes, safe invalid email links and accessibility', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Small beginnings. Big possibilities.'})).toBeVisible();
  await accessible(page);
  await page.getByRole('button',{name:'Use dark mode'}).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await accessible(page);
  for (const route of ['/game','/onboarding','/auth/update-password']) {
    await page.goto(route); await expect(page).toHaveURL(/\/login/);
  }
  await page.goto('/auth/callback?next=https://evil.example');
  await expect(page).toHaveURL(/\/login\?notice=expired/);
  await expect(page.getByRole('status')).toContainText('expired');
  await accessible(page);
});
async function submitWithPendingCheck(page:Page,name:string) {
  let release=()=>{};
  const gate=new Promise<void>(done=>{release=done;});
  const handler=async(route:import('@playwright/test').Route)=>{if(route.request().method()==='POST')await gate;await route.continue();};
  await page.route('**/login',handler);
  const submission=page.getByRole('button',{name,exact:true}).click();
  try{await expect(page.getByRole('button',{name:'Please wait…',exact:true})).toBeDisabled();await expect(page.getByRole('form')).toHaveAttribute('aria-busy','true');await expect(page.getByLabel('Email address')).toBeDisabled();}
  finally{release();await submission;await page.unroute('**/login',handler);}
}
for(const theme of ['light','dark']) test(`signup, email verification, profile, map, persistence, reset and signout: ${theme}`, async ({page,request},testInfo) => {
  const mailbox = `founder-${testInfo.project.name}-${Date.now()}`;
  const email = `${mailbox}@example.test`;
  const password = 'District-founders-2026!';
  await page.addInitScript(value=>localStorage.setItem('tycoonara-theme',value),theme);
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password',{exact:true}).fill('Incorrect-password-2026!');
  await submitWithPendingCheck(page,'Enter Tycoonara');
  await expect(page.locator('.auth-feedback').getByRole('alert')).toContainText('Could not sign in');
  await expect(page.locator('.auth-feedback')).toBeFocused();
  await page.screenshot({path:testInfo.outputPath(`auth-error-${theme}.png`),fullPage:true});
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.locator('.auth-feedback').getByRole('alert')).toHaveCount(0);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await submitWithPendingCheck(page,'Start your story');
  await expect(page.getByRole('status')).toContainText('Check your email');
  await accessible(page);
  await page.screenshot({path:testInfo.outputPath(`auth-signup-sent-${theme}.png`),fullPage:true});
  await page.getByRole('button',{name:'Resend verification',exact:true}).click();
  await page.getByRole('button',{name:'Send verification link',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('new link');
  await page.screenshot({path:testInfo.outputPath(`auth-verification-sent-${theme}.png`),fullPage:true});
  await accessible(page);
  await page.getByRole('button',{name:'Use another email address',exact:true}).click();
  await expect(page.getByLabel('Email address')).toHaveValue(email);
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.goto('/game');
  await expect(page).toHaveURL(/\/login/);
  await page.goto(await emailLink(request,mailbox));
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel('Your founder name').fill(`F_${testInfo.project.name}_${theme}`);
  await page.getByRole('radio',{name:'orchid'}).check();
  await accessible(page);
  await page.getByRole('button',{name:'Make it official'}).click();
  await expect(page).toHaveURL(/\/game/);
  await expect(page.getByLabel('Founder statistics')).toContainText('500.00');
  await expect(page.getByLabel('Founder statistics')).toContainText(`F_${testInfo.project.name}_${theme}`);
  await expect(page.getByLabel('Founder statistics')).toContainText('50');
  await accessible(page);
  await page.getByRole('button',{name:'Job Center. Preview. Level 1',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Stage 2 coming soon');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Factory. Locked. Level 3',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Requires level 3');
  await accessible(page);
  await page.getByRole('button',{name:'Back to the district',exact:true}).click();
  await page.reload();
  await expect(page.getByLabel('Founder statistics')).toContainText('500.00');
  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/game/);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page).toHaveURL('/');
  await page.goto('/game'); await expect(page).toHaveURL(/\/login/);
  // Exercise the password recovery flow against local Supabase + local email capture.
  await page.getByRole('button',{name:'Forgot password?',exact:true}).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button',{name:'Send reset link',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('password reset link');
  await accessible(page);
  await page.screenshot({path:testInfo.outputPath(`auth-reset-sent-${theme}.png`),fullPage:true});
  await page.goto(await emailLink(request,mailbox,'recovery'));
  await expect(page).toHaveURL(/\/auth\/update-password/);
  await accessible(page);
  await page.screenshot({path:testInfo.outputPath(`auth-update-${theme}.png`),fullPage:true});
  await page.getByLabel('New password').fill(`${password}new`);
  await page.getByRole('button',{name:'Show new password',exact:true}).click();
  await expect(page.getByLabel('New password')).toHaveAttribute('type','text');
  await page.getByRole('button',{name:'Hide new password',exact:true}).click();
  await page.getByRole('button',{name:'Save password and sign out'}).click();
  await expect(page).toHaveURL(/\/login\?notice=password/);
  await page.screenshot({path:testInfo.outputPath(`auth-password-saved-${theme}.png`),fullPage:true});
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password',{exact:true}).fill(`${password}new`);
  await page.getByRole('button',{name:'Enter Tycoonara',exact:true}).click();
  await expect(page).toHaveURL(/\/game/);
  await expect(page.getByLabel('Founder statistics')).toContainText('500.00');
});
