import { test, expect } from '@playwright/test'

// Preview mode (no VITE_SUPABASE_* set): sample data, login/saving disabled.

test('home page loads and search goes to the lost list', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Let AI find it')
  await page.locator('#hero-search').fill('Samsung')
  await page.locator('#hero-search').press('Enter')
  await expect(page).toHaveURL(/\/lost\?q=Samsung/)
  await expect(page.getByText('Black Samsung phone').first()).toBeVisible()
})

test('language switch flips the page to Arabic RTL and is remembered', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'التبديل إلى العربية' }).first().click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('الذكاء الاصطناعي')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await page.getByRole('button', { name: 'Switch to English' }).first().click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
})

test('item page shows details and the OpenStreetMap preview', async ({ page }) => {
  await page.goto('/items/l1')
  await expect(page.getByRole('heading', { name: 'Black Samsung phone' })).toBeVisible()
  await expect(page.locator('iframe[src^="https://www.openstreetmap.org/export/embed.html"]')).toBeVisible()
})

test('report form validates before saving', async ({ page }) => {
  await page.goto('/report/lost')
  await page.getByRole('button', { name: /submit report/i }).click()
  await expect(page.getByText('Enter an item name (at least 3 characters).')).toBeVisible()
  await expect(page.locator('#name')).toBeFocused()
})

test('privacy and terms pages are reachable from the footer', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Privacy' }).click()
  await expect(page.getByRole('heading', { name: 'Privacy notice' })).toBeVisible()
  await page.getByRole('link', { name: 'Terms' }).click()
  await expect(page.getByRole('heading', { name: 'Terms of use' })).toBeVisible()
})

test('unknown URLs show the not-found page', async ({ page }) => {
  await page.goto('/no-such-page')
  await expect(page.getByText('Page not found')).toBeVisible()
})

test('mobile menu opens', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only')
  await page.goto('/')
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeVisible()
})

test('report form: clicking the map drops a pin and fills the coordinates', async ({ page }) => {
  await page.goto('/report/lost')
  const map = page.getByTestId('pin-map')
  await map.scrollIntoViewIfNeeded()
  const box = await map.boundingBox()
  await page.mouse.click(box.x + box.width / 2 + 40, box.y + box.height / 2 + 20)
  await expect(page.getByTestId('pin-marker')).toBeVisible()
  expect(Number(await page.locator('#lat').inputValue())).toBeGreaterThan(-90)
  expect(await page.locator('#lng').inputValue()).toMatch(/^-?\d+\.\d{5}$/)
  await page.getByRole('button', { name: 'Remove location' }).click()
  await expect(page.getByTestId('pin-marker')).toHaveCount(0)
})
