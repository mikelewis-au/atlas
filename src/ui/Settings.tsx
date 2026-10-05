import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { formatDate, todayIso } from '../lib/dates'
import { BackupFormatError } from '../lib/vault'
import { ConfirmButton, Page, useVault } from './common'

/** Returns false when the person dismissed the share sheet without saving. */
async function saveFile(json: string): Promise<boolean> {
  const name = `atlas-backup-${todayIso()}.json`
  const file = new File([json], name, { type: 'application/json' })
  // An installed iOS app cannot download; the share sheet's "Save to Files" is the way out.
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return true
    } catch {
      return false
    }
  }
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
  return true
}

export default function Settings() {
  const vault = useVault()
  const [lastExport, setLastExport] = useState<string>()
  const [pending, setPending] = useState<File>()
  const [message, setMessage] = useState('')
  const version = vault.getSnapshot()

  useEffect(() => {
    void vault.lastExportAt().then(setLastExport)
  }, [vault, version])

  async function backUp() {
    setMessage('')
    if (await saveFile(await vault.exportBackup())) await vault.markExported()
  }

  async function restore() {
    if (!pending) return
    try {
      await vault.importBackup(await pending.text())
    } catch (e) {
      if (!(e instanceof BackupFormatError)) throw e
      setMessage('That file is not an Atlas backup.')
      setPending(undefined)
    }
  }

  return (
    <Page>
      <Link to="/" className="muted underline">
        ‹ Back
      </Link>
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="card flex flex-col gap-3">
        <h2 className="section-title">Backup</h2>
        <p className="muted">
          Your notes live only on this device. A backup file is encrypted and needs your passphrase
          or recovery key to open.
        </p>
        <p>Last backup: {lastExport ? formatDate(lastExport) : 'never'}</p>
        <button type="button" className="btn btn-primary" onClick={() => void backUp()}>
          Back up now
        </button>
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="section-title">Restore</h2>
        <p className="muted">
          Restoring replaces everything on this device with the contents of the backup file.
        </p>
        <input
          type="file"
          accept="application/json,.json"
          aria-label="Backup file"
          onChange={(e) => setPending(e.target.files?.[0])}
        />
        {pending && (
          <ConfirmButton
            label="Restore from this file"
            confirmLabel="Tap again to replace everything"
            onConfirm={() => void restore()}
          />
        )}
        {message && <p className="text-sm text-red-600 dark:text-red-400">{message}</p>}
      </section>

      <button type="button" className="btn" onClick={() => vault.lock()}>
        Lock now
      </button>
    </Page>
  )
}
