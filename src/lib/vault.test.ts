import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { deletePerson, recentPeople } from './people'
import { BackupFormatError, Vault, WrongSecretError } from './vault'

const PASSPHRASE = 'correct horse battery'
let counter = 0
const freshName = () => `vault-test-${counter++}`
// A low iteration count keeps the suite fast; the app default is far higher.
const open = (name: string) => new Vault(name, 1000)

async function seeded(name = freshName()) {
  const vault = open(name)
  await vault.init()
  const recoveryKey = await vault.setup(PASSPHRASE)
  const dave = await vault.create('person', { name: 'Dave Tester', circle: true, tags: ['footy'] })
  await vault.create('note', {
    personId: dave.id,
    date: '2026-08-12',
    text: 'Nervous about the restructure',
    sensitive: false,
  })
  return { vault, name, recoveryKey, dave }
}

describe('Vault', () => {
  it('starts uninitialised and is unlocked after setup', async () => {
    const vault = open(freshName())
    await vault.init()
    expect(vault.status).toBe('uninitialised')
    await vault.setup(PASSPHRASE)
    expect(vault.status).toBe('unlocked')
  })

  it('refuses to set up twice', async () => {
    const { vault } = await seeded()
    await expect(vault.setup('another passphrase')).rejects.toThrow()
  })

  it('persists records across a restart and unlock', async () => {
    const { name, dave } = await seeded()
    const reopened = open(name)
    await reopened.init()
    expect(reopened.status).toBe('locked')
    expect(reopened.all('person')).toEqual([])

    await reopened.unlock(PASSPHRASE)
    expect(reopened.get('person', dave.id)?.name).toBe('Dave Tester')
    expect(reopened.all('note')).toHaveLength(1)
  })

  it('rejects a wrong passphrase and stays locked', async () => {
    const { name } = await seeded()
    const reopened = open(name)
    await reopened.init()
    await expect(reopened.unlock('not the passphrase')).rejects.toBeInstanceOf(WrongSecretError)
    expect(reopened.status).toBe('locked')
  })

  it('clears records from memory when locked and refuses writes', async () => {
    const { vault } = await seeded()
    vault.lock()
    expect(vault.all('person')).toEqual([])
    await expect(
      vault.create('person', { name: 'Nobody', circle: true, tags: [] }),
    ).rejects.toThrow('locked')
  })

  it('resets the passphrase with the recovery key, however it is typed', async () => {
    const { name, recoveryKey, dave } = await seeded()
    const reopened = open(name)
    await reopened.init()
    await reopened.recover(recoveryKey.toLowerCase().replace(/-/g, ' '), 'a new passphrase')
    expect(reopened.get('person', dave.id)?.name).toBe('Dave Tester')

    const again = open(name)
    await again.init()
    await expect(again.unlock(PASSPHRASE)).rejects.toBeInstanceOf(WrongSecretError)
    await again.unlock('a new passphrase')
    expect(again.status).toBe('unlocked')
  })

  it('rejects a wrong recovery key', async () => {
    const { name } = await seeded()
    const reopened = open(name)
    await reopened.init()
    await expect(
      reopened.recover('0000-0000-0000-0000-0000-0000-0000-0000', 'a new passphrase'),
    ).rejects.toBeInstanceOf(WrongSecretError)
  })

  it('updates a record and bumps updatedAt', async () => {
    const { vault, dave } = await seeded()
    await new Promise((resolve) => setTimeout(resolve, 2))
    const updated = await vault.update('person', dave.id, { howIKnow: 'footy club' })
    expect(updated.howIKnow).toBe('footy club')
    expect(updated.name).toBe('Dave Tester')
    expect(updated.updatedAt > dave.updatedAt).toBe(true)
  })

  it('notifies subscribers on change', async () => {
    const { vault, dave } = await seeded()
    const before = vault.getSnapshot()
    let calls = 0
    const unsubscribe = vault.subscribe(() => calls++)
    await vault.update('person', dave.id, { pinned: true })
    unsubscribe()
    await vault.update('person', dave.id, { pinned: false })
    expect(calls).toBe(1)
    expect(vault.getSnapshot()).toBeGreaterThan(before)
  })

  it('keeps nothing readable in a backup', async () => {
    const { vault } = await seeded()
    const backup = await vault.exportBackup()
    expect(backup).not.toContain('Dave')
    expect(backup).not.toContain('restructure')
    expect(backup).not.toContain('footy')
    expect(backup).not.toContain(PASSPHRASE)
  })

  it('restores a backup on a clean install', async () => {
    const { vault, dave, recoveryKey } = await seeded()
    const backup = await vault.exportBackup()

    const clean = open(freshName())
    await clean.init()
    expect(clean.status).toBe('uninitialised')
    await clean.importBackup(backup)
    expect(clean.status).toBe('locked')

    await clean.unlock(PASSPHRASE)
    expect(clean.get('person', dave.id)?.tags).toEqual(['footy'])
    expect(clean.all('note')[0].text).toBe('Nervous about the restructure')

    clean.lock()
    await clean.recover(recoveryKey, 'another passphrase')
    expect(clean.all('person')).toHaveLength(1)
  })

  it('replaces existing data when a backup is imported', async () => {
    const { vault } = await seeded()
    const backup = await vault.exportBackup()

    const other = open(freshName())
    await other.init()
    await other.setup('a different passphrase')
    await other.create('person', { name: 'Someone Else', circle: true, tags: [] })
    await other.importBackup(backup)
    await other.unlock(PASSPHRASE)
    expect(other.all('person').map((person) => person.name)).toEqual(['Dave Tester'])
  })

  it('rejects a file that is not a backup and leaves data alone', async () => {
    const { vault } = await seeded()
    await expect(vault.importBackup('not json')).rejects.toBeInstanceOf(BackupFormatError)
    await expect(vault.importBackup('{"app":"other"}')).rejects.toBeInstanceOf(BackupFormatError)
    await expect(
      vault.importBackup('{"app":"atlas","format":1,"vault":{},"records":[]}'),
    ).rejects.toBeInstanceOf(BackupFormatError)
    expect(vault.all('person')).toHaveLength(1)
  })

  it('records when the last backup was marked', async () => {
    const { vault } = await seeded()
    expect(await vault.lastExportAt()).toBeUndefined()
    await vault.markExported()
    expect(await vault.lastExportAt()).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('removes a record for good, leaving nothing after restart', async () => {
    const { vault, name, dave } = await seeded()
    const note = vault.all('note')[0]
    await vault.remove(note.id)
    expect(vault.all('note')).toEqual([])

    const reopened = open(name)
    await reopened.init()
    await reopened.unlock(PASSPHRASE)
    expect(reopened.all('note')).toEqual([])
    expect(reopened.get('person', dave.id)).toBeDefined()
  })
})

describe('deletePerson', () => {
  it('removes the person, their links and everything recorded against them', async () => {
    const { vault, dave } = await seeded()
    const mia = await vault.create('person', { name: 'Mia', circle: false, tags: [] })
    await vault.create('link', { fromId: dave.id, toId: mia.id, kind: 'parent' })
    await vault.create('fact', { personId: dave.id, text: 'Barracks for Carlton' })
    await vault.create('loop', { personId: dave.id, text: 'Interview', status: 'open' })
    await vault.create('note', {
      personId: mia.id,
      date: '2026-09-01',
      text: 'Started school',
      sensitive: false,
    })

    await deletePerson(vault, dave.id)

    expect(vault.all('person').map((person) => person.name)).toEqual(['Mia'])
    expect(vault.all('link')).toEqual([])
    expect(vault.all('fact')).toEqual([])
    expect(vault.all('loop')).toEqual([])
    expect(vault.all('note').map((note) => note.text)).toEqual(['Started school'])
  })
})

describe('recentPeople', () => {
  const wait = () => new Promise((resolve) => setTimeout(resolve, 2))

  it('orders the circle by latest activity and leaves satellites out', async () => {
    const { vault, dave } = await seeded()
    await wait()
    const priya = await vault.create('person', { name: 'Priya', circle: true, tags: [] })
    await wait()
    await vault.create('person', { name: 'Mia', circle: false, tags: [] })
    expect(recentPeople(vault, 5, 'personal').map((person) => person.id)).toEqual([
      priya.id,
      dave.id,
    ])

    await wait()
    await vault.create('note', {
      personId: dave.id,
      date: '2026-10-01',
      text: 'Caught up',
      sensitive: false,
    })
    expect(recentPeople(vault, 5, 'personal').map((person) => person.id)).toEqual([
      dave.id,
      priya.id,
    ])
    expect(recentPeople(vault, 1, 'personal')).toHaveLength(1)
  })

  it('keeps work and personal apart, with people in both on each side', async () => {
    const { vault, dave } = await seeded()
    await wait()
    const boss = await vault.create('person', {
      name: 'Boss',
      circle: true,
      space: 'work',
      tags: [],
    })
    await wait()
    const mate = await vault.create('person', {
      name: 'Work Mate',
      circle: true,
      space: 'both',
      tags: [],
    })
    expect(recentPeople(vault, 5, 'work').map((person) => person.id)).toEqual([mate.id, boss.id])
    expect(recentPeople(vault, 5, 'personal').map((person) => person.id)).toEqual([
      mate.id,
      dave.id,
    ])
  })
})
