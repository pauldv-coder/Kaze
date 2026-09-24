import { test, expect } from '@playwright/test'

test('la app abre /proyectos con sesión', async ({ page }) => {
  await page.goto('/proyectos')
  await expect(page.getByRole('heading', { name: 'Proyectos' })).toBeVisible()
})
