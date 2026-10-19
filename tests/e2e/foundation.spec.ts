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
    const match = html.match(/https?:\/\/[^\s"<>]*\/auth\/(?:v1\/verify|confirm)[^\s"<>]*/);
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
  // Respect the explicit 1-second local Supabase auth.email.max_frequency window.
  await page.waitForTimeout(1100);
  await page.getByRole('button',{name:'Send verification link',exact:true}).click();
  await expect(page.locator('.auth-form')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('.auth-feedback')).not.toBeEmpty();
  await page.screenshot({path:testInfo.outputPath(`auth-verification-result-${theme}.png`),fullPage:true});
  await expect(page.getByRole('status')).toContainText('new link');
  await page.screenshot({path:testInfo.outputPath(`auth-verification-sent-${theme}.png`),fullPage:true});
  await accessible(page);
  await page.getByRole('button',{name:'Use another email address',exact:true}).click();
  await expect(page.getByLabel('Email address')).toHaveValue(email);
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.goto('/game');
  await expect(page).toHaveURL(/\/login/);
  await page.goto(await emailLink(request,mailbox));
  await expect.poll(()=>new URL(page.url()).pathname).toBe('/onboarding');
  await page.getByLabel('Your founder name').fill(`F_${testInfo.project.name}_${theme}`);
  await page.getByRole('radio',{name:'orchid'}).check();
  await accessible(page);
  await page.getByRole('button',{name:'Make it official'}).click();
  await expect(page).toHaveURL(/\/game/);
  await expect(page.getByLabel('Founder statistics')).toContainText('500.00');
  await expect(page.getByLabel('Founder statistics')).toContainText(`F_${testInfo.project.name}_${theme}`);
  await expect(page.getByLabel('Founder statistics')).toContainText('50');
  await accessible(page);
  await page.getByRole('button',{name:'Marketplace. Preview. Level 1',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Future district preview');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Factory. Locked. Level 3',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Requires level 3');
  await accessible(page);
  await page.getByRole('button',{name:'Back to the district',exact:true}).click();
  await page.reload();
  await expect(page.getByLabel('Founder statistics')).toContainText('500.00');
  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/game/);
  // Real NPC job flow against the isolated Supabase database, never a mocked reward.
  await page.getByRole('button',{name:'Job Center. Available. Level 1',exact:true}).click();
  const jobs=page.getByRole('region',{name:'NPC jobs'});
  await expect(jobs.getByRole('button',{name:'Start Welcome delivery',exact:true})).toBeEnabled();
  await expect(jobs.getByRole('button',{name:'Unlocks at level 2',exact:true})).toBeDisabled();
  await accessible(page);
  await page.screenshot({path:testInfo.outputPath(`jobs-board-${theme}.png`),fullPage:true});
  await jobs.getByRole('button',{name:'Start Welcome delivery',exact:true}).click();
  await expect(jobs.getByRole('button',{name:'Claim reward',exact:true})).toBeDisabled();
  await expect(jobs).toContainText('No need to keep this panel open.');
  await page.keyboard.press('Escape');await page.reload();
  await page.getByRole('button',{name:'Job Center. Available. Level 1',exact:true}).click();
  await expect(jobs.locator('.job-active')).toBeVisible();
  await expect(jobs.getByRole('button',{name:'Claim reward',exact:true})).toBeEnabled({timeout:20000});
  await accessible(page);
  await page.screenshot({path:testInfo.outputPath(`jobs-ready-${theme}.png`),fullPage:true});
  await jobs.getByRole('button',{name:'Claim reward',exact:true}).click();
  await expect(jobs.getByRole('status')).toContainText('Saved! +1.25 EC and +25 XP');
  await expect(page.getByLabel('Founder statistics')).toContainText('501.25');
  await expect(jobs.locator('.job-receipts')).toContainText('+1.25 EC');
  await expect(jobs.getByRole('button',{name:'Start Welcome delivery',exact:true})).toBeDisabled();
  await accessible(page);
  await page.screenshot({path:testInfo.outputPath(`jobs-receipt-${theme}.png`),fullPage:true});
  await page.keyboard.press('Escape');
  await page.getByRole('navigation',{name:'District navigation'}).getByRole('button',{name:'Settings',exact:true}).click();
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
  await page.getByLabel('New password',{exact:true}).fill(`${password}new`);
  await page.getByRole('button',{name:'Show new password',exact:true}).click();
  await expect(page.getByLabel('New password',{exact:true})).toHaveAttribute('type','text');
  await page.getByRole('button',{name:'Hide new password',exact:true}).click();
  await page.getByRole('button',{name:'Save password and sign out'}).click();
  await expect(page).toHaveURL(/\/login\?notice=password/);
  await page.screenshot({path:testInfo.outputPath(`auth-password-saved-${theme}.png`),fullPage:true});
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password',{exact:true}).fill(`${password}new`);
  await page.getByRole('button',{name:'Enter Tycoonara',exact:true}).click();
  await expect(page).toHaveURL(/\/game/);
  await expect(page.getByLabel('Founder statistics')).toContainText('501.25');
});
