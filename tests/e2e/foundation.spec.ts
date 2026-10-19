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
test('signup, email verification, profile, map, persistence, reset and signout', async ({page,request},testInfo) => {
  const mailbox = `founder-${testInfo.project.name}-${Date.now()}`;
  const email = `${mailbox}@example.test`;
  const password = 'District-founders-2026!';
  await page.goto('/login');
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Start your story',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  await page.goto('/game');
  await expect(page).toHaveURL(/\/login/);
  await page.goto(await emailLink(request,mailbox));
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel('Your founder name').fill(`Founder_${testInfo.project.name}`);
  await page.getByRole('radio',{name:'orchid'}).check();
  await accessible(page);
  await page.getByRole('button',{name:'Make it official'}).click();
  await expect(page).toHaveURL(/\/game/);
  await expect(page.getByLabel('Founder statistics')).toContainText('500.00');
  await expect(page.getByLabel('Founder statistics')).toContainText(`Founder_${testInfo.project.name}`);
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
  await page.getByRole('button',{name:'Reset password',exact:true}).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button',{name:'Send reset link',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('password reset link');
  await page.goto(await emailLink(request,mailbox,'recovery'));
  await expect(page).toHaveURL(/\/auth\/update-password/);
  await page.getByLabel('New password').fill(`${password}new`);
  await page.getByRole('button',{name:'Save password and sign out'}).click();
  await expect(page).toHaveURL(/\/login\?notice=password/);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password',{exact:true}).fill(`${password}new`);
  await page.getByRole('button',{name:'Enter Tycoonara',exact:true}).click();
  await expect(page).toHaveURL(/\/game/);
  await expect(page.getByLabel('Founder statistics')).toContainText('500.00');
});
