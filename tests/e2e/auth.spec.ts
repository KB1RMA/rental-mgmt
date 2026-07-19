import { test, expect } from '@playwright/test'

test('unauthenticated visitors are redirected to login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('sign-up is disabled', async ({ page }) => {
  const response = await page.request.post('/api/auth/sign-up/email', {
    headers: { Origin: 'http://localhost:3000' },
    data: {
      email: `blocked-${Date.now()}@example.com`,
      password: 'correct horse battery staple',
      name: 'Should Not Work',
    },
  })
  expect(response.status()).toBe(400)
  const body = await response.json()
  expect(body.code).toBe('EMAIL_PASSWORD_SIGN_UP_DISABLED')
})

test('sign in then dashboard access', async ({ page }) => {
  await page.goto('/login')
  await page.waitForFunction(() => !window.$_TSR || window.$_TSR.hydrated)
  await page.getByLabel('Email').fill('e2e-test@example.com')
  await page.getByLabel('Password').fill('correct horse battery staple')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})
