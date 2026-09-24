import { test as setup, expect } from '@playwright/test'

setup('login de carmen', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('Correo').fill('carmen@cota.test')
  await page.getByPlaceholder('Contraseña').fill('cota-demo-2026')
  // El botón no lleva `type="submit"` explícito (el default HTML de <button> dentro de
  // <form> ya es submit), así que `button[type=submit]` no matchea. Se usa el rol + texto.
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/proyectos/)
  await page.context().storageState({ path: 'e2e/.auth/carmen.json' })
})
