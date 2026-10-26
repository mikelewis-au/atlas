import { expect, test, type Page } from '@playwright/test'

const PASSPHRASE = 'correct horse battery'

async function setUp(page: Page) {
  await page.goto('/')
  await page.getByLabel('Passphrase', { exact: true }).fill(PASSPHRASE)
  await page.getByLabel('Confirm passphrase').fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByRole('heading', { name: 'Your recovery key' })).toBeVisible()
  await page.getByRole('button', { name: "I've saved it" }).click()
}

test('set up, record a person and a love map, and find it all after a restart', async ({ page }) => {
  await setUp(page)

  // Typing a name no one has offers to add them.
  await page.getByLabel('Search').fill('Dave Tester')
  await expect(page.getByText('No one matches.')).toBeVisible()
  await page.getByPlaceholder('How you know them').fill('footy')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dave Tester' })).toBeVisible()

  await page.getByPlaceholder('What did you talk about?').fill('Starting a new job in March')
  await page.getByRole('button', { name: 'Save note' }).click()
  await expect(page.getByTestId('briefing')).toContainText('Starting a new job in March')

  await page.getByRole('button', { name: '+ Add something to ask' }).click()
  await page.getByPlaceholder('e.g. How did the interview go?').fill('How is the new boss?')
  await page.getByTestId('loops').getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByTestId('loops')).toContainText('How is the new boss?')
  await page.getByTestId('loops').getByRole('button', { name: 'How is the new boss?' }).click()
  await page.getByLabel('Edit: How is the new boss?').fill('How is the new boss going?')
  await page.getByTestId('loops').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByTestId('loops')).toContainText('How is the new boss going?')
  await page.getByLabel('Done: How is the new boss going?').click()
  await expect(page.getByTestId('loops')).toContainText('Done (1)')

  await page.getByRole('button', { name: '+ Add a child' }).click()
  await page.getByLabel("Child's name").fill('Mia 2019')
  await page.getByRole('button', { name: 'Add child' }).click()
  await page.getByRole('button', { name: '+ Add a connection' }).click()
  await page.getByPlaceholder('Their name').fill('Sarah Tester')
  await page.getByRole('button', { name: 'Add connection' }).click()
  await expect(page.getByTestId('household')).toContainText('Sarah Tester')
  await expect(page.getByTestId('household')).toContainText(/Mia \(~\d+\)/)

  await page.getByTestId('household').getByRole('link', { name: 'Sarah Tester' }).click()
  await expect(page.getByRole('heading', { name: 'Sarah Tester' })).toBeVisible()
  await expect(page.getByTestId('household')).toContainText('Dave Tester')
  await expect(page.getByTestId('household')).toContainText('Mia')
  await page.getByTestId('household').getByRole('link', { name: 'Dave Tester' }).click()

  await page.locator('header').getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Keep a love map').check()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('link', { name: 'Love map' }).click()
  await page.getByTestId('map-worries').getByRole('button', { name: '+ Add' }).click()
  await page.getByLabel('Add to Current worries').fill('The restructure at work')
  await page.getByTestId('map-worries').getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByTestId('map-worries')).toContainText('The restructure at work')

  await page.getByRole('button', { name: 'Quiz me' }).click()
  await expect(page.getByText('What is Dave worried about right now?')).toBeVisible()
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

  await page.getByLabel('Search').fill('march job')
  await expect(page.getByRole('link', { name: /Dave Tester.*new job in March/ })).toBeVisible()
  await page.getByLabel('Search').fill('mia')
  await expect(page.getByRole('link', { name: /Dave Tester/ })).toBeVisible()
})

test('work people stay off the personal side but search still finds them', async ({ page }) => {
  await setUp(page)

  await page.getByRole('button', { name: 'Work', exact: true }).click()
  await page.getByLabel('Search').fill('Priya Colleague')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('button', { name: '+ Add a connection' }).click()
  await page.getByPlaceholder('Their name').fill('Arjun')
  await page.getByRole('button', { name: 'Add connection' }).click()
  await expect(page.getByTestId('connections')).toContainText('Arjun')
  await page.getByRole('link', { name: '‹ Back' }).click()

  await expect(page.getByRole('link', { name: /Priya Colleague/ })).toBeVisible()
  await page.getByRole('button', { name: 'Personal', exact: true }).click()
  await expect(page.getByRole('link', { name: /Priya Colleague/ })).toHaveCount(0)
  await expect(page.getByText('Family and connections')).toHaveCount(0)

  await page.getByLabel('Search').fill('priya')
  await expect(page.getByRole('link', { name: /^Priya Colleague.*Work/ })).toBeVisible()
  // Arjun is found through the name of the person he is linked to.
  await expect(page.getByRole('link', { name: /^Arjun.*Priya Colleague/ })).toBeVisible()

  await page.getByRole('link', { name: /^Priya Colleague/ }).click()
  await page.locator('header').getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Shown under').selectOption('both')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  // Back returns to the search as it was left.
  await page.getByRole('link', { name: '‹ Back' }).click()
  await expect(page.getByLabel('Search')).toHaveValue('priya')
  await page.getByLabel('Search').fill('')
  await page.getByRole('button', { name: '+ Add someone' }).click()
  await page.getByPlaceholder('Name', { exact: true }).fill('Sam Local')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sam Local' })).toBeVisible()
  await page.getByRole('link', { name: '‹ Back' }).click()
  await expect(page.getByRole('link', { name: /Priya Colleague/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Sam Local/ })).toBeVisible()

  await page.reload()
  await page.getByLabel('Passphrase').fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('button', { name: 'Personal', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('the passphrase can be changed from settings', async ({ page }) => {
  await setUp(page)

  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByLabel('Current passphrase').fill('not it')
  await page.getByLabel('New passphrase', { exact: true }).fill('a brand new passphrase')
  await page.getByLabel('Confirm new passphrase').fill('a brand new passphrase')
  await page.getByRole('button', { name: 'Change passphrase' }).click()
  await expect(page.getByText('The current passphrase is wrong.')).toBeVisible()

  await page.getByLabel('Current passphrase').fill(PASSPHRASE)
  await page.getByLabel('New passphrase', { exact: true }).fill('a brand new passphrase')
  await page.getByLabel('Confirm new passphrase').fill('a brand new passphrase')
  await page.getByRole('button', { name: 'Change passphrase' }).click()
  await expect(page.getByText('Passphrase changed.')).toBeVisible()

  await page.reload()
  await page.getByLabel('Passphrase').fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByText('Wrong passphrase.')).toBeVisible()
  await page.getByLabel('Passphrase').fill('a brand new passphrase')
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
})
