import { expect, test } from '@playwright/test'

const PASSPHRASE = 'correct horse battery'

test('set up, record a person and a love map, and find it all after a restart', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Passphrase', { exact: true }).fill(PASSPHRASE)
  await page.getByLabel('Confirm passphrase').fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByRole('heading', { name: 'Your recovery key' })).toBeVisible()
  await page.getByRole('button', { name: "I've saved it" }).click()

  await page.getByPlaceholder('Name', { exact: true }).fill('Dave Tester')
  await page.getByPlaceholder('How you know them').fill('footy')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dave Tester' })).toBeVisible()

  await page.getByPlaceholder('What did you talk about?').fill('Starting a new job in March')
  await page.getByRole('button', { name: 'Save note' }).click()
  await expect(page.getByTestId('briefing')).toContainText('Starting a new job in March')

  await page.getByLabel('Relationship').selectOption('child')
  await page.getByPlaceholder('Their name').fill('Mia')
  await page.getByRole('button', { name: 'Add connection' }).click()
  await expect(page.getByTestId('briefing')).toContainText('Mia')

  await page.locator('header').getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Keep a love map').check()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('link', { name: 'Love map' }).click()
  await page.getByLabel('Add to Current worries').fill('The restructure at work')
  await page.getByTestId('map-worries').getByRole('button', { name: 'Add' }).click()
  await expect(page.getByTestId('map-worries')).toContainText('The restructure at work')

  await page.getByRole('button', { name: 'Quiz me' }).click()
  await expect(page.getByText('What is Dave Tester worried about right now?')).toBeVisible()
  await page.getByRole('button', { name: 'Reveal' }).click()
  await expect(page.getByText('The restructure at work')).toBeVisible()

  await page.goto('/')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Unlock' })).toBeVisible()
  await page.getByLabel('Passphrase').fill('the wrong passphrase')
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByText('Wrong passphrase.')).toBeVisible()
  await page.getByLabel('Passphrase').fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Unlock' }).click()

  await page.getByPlaceholder('Search names, tags, anything you noted').fill('march job')
  await expect(page.getByRole('link', { name: /Dave Tester/ })).toBeVisible()
  await page.getByPlaceholder('Search names, tags, anything you noted').fill('mia')
  await expect(page.getByRole('link', { name: /Dave Tester/ })).toBeVisible()
})

test('work people stay off the personal side but search still finds them', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Passphrase', { exact: true }).fill(PASSPHRASE)
  await page.getByLabel('Confirm passphrase').fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByRole('button', { name: "I've saved it" }).click()

  await page.getByRole('button', { name: 'Work', exact: true }).click()
  await page.getByPlaceholder('Name', { exact: true }).fill('Priya Colleague')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByPlaceholder('Their name').fill('Arjun')
  await page.getByRole('button', { name: 'Add connection' }).click()
  await page.getByRole('link', { name: '‹ Back' }).click()

  await expect(page.getByRole('link', { name: /Priya Colleague/ })).toBeVisible()
  await page.getByRole('button', { name: 'Personal', exact: true }).click()
  await expect(page.getByRole('link', { name: /Priya Colleague/ })).toHaveCount(0)
  await expect(page.getByText('Family and connections')).toHaveCount(0)

  await page.getByPlaceholder('Search names, tags, anything you noted').fill('priya')
  await expect(page.getByRole('link', { name: /Priya Colleague.*Work/ })).toBeVisible()

  await page.getByRole('link', { name: /Priya Colleague/ }).click()
  await page.locator('header').getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Shown under').selectOption('both')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('link', { name: '‹ Back' }).click()
  await expect(page.getByRole('link', { name: /Priya Colleague/ })).toBeVisible()

  await page.reload()
  await page.getByLabel('Passphrase').fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('button', { name: 'Personal', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
