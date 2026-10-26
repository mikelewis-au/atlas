import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { formatDate, todayIso } from '../lib/dates'
import { BackupFormatError, MIN_PASSPHRASE_LENGTH, WrongSecretError } from '../lib/vault'
import { ConfirmButton, Page, describe, useVault } from './common'

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
      setMessage(e instanceof BackupFormatError ? 'That file is not an Atlas backup.' : describe(e))
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

      {vault.unreadable > 0 && (
        <p className="card text-sm text-red-600 dark:text-red-400">
          {vault.unreadable} stored {vault.unreadable === 1 ? 'record' : 'records'} could not be
          read and {vault.unreadable === 1 ? 'is' : 'are'} not shown. Restoring an earlier backup
          may bring {vault.unreadable === 1 ? 'it' : 'them'} back.
        </p>
      )}

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

      <ChangePassphrase />

      <button type="button" className="btn" onClick={() => vault.lock()}>
        Lock now
      </button>
    </Page>
  )
}

function ChangePassphrase() {
  const vault = useVault()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string }>()

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setStatus(undefined)
    if (next.length < MIN_PASSPHRASE_LENGTH) {
      return setStatus({ ok: false, text: `Use at least ${MIN_PASSPHRASE_LENGTH} characters.` })
    }
    if (next !== confirm) return setStatus({ ok: false, text: 'The two passphrases do not match.' })
    setBusy(true)
    try {
      await vault.changePassphrase(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setStatus({ ok: true, text: 'Passphrase changed. Your recovery key still works.' })
    } catch (e) {
      setStatus({
        ok: false,
        text: e instanceof WrongSecretError ? 'The current passphrase is wrong.' : describe(e),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3">
      <h2 className="section-title">Change passphrase</h2>
      <div>
        <label className="label" htmlFor="current-passphrase">
          Current passphrase
        </label>
        <input
          id="current-passphrase"
          type="password"
          className="input"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="new-passphrase">
          New passphrase
        </label>
        <input
          id="new-passphrase"
          type="password"
          className="input"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="confirm-passphrase">
          Confirm new passphrase
        </label>
        <input
          id="confirm-passphrase"
          type="password"
          className="input"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {status && (
        <p
          className={`text-sm ${status.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
        >
          {status.text}
        </p>
      )}
      <button className="btn" disabled={busy || !current || !next || !confirm}>
        {busy ? 'Working…' : 'Change passphrase'}
      </button>
    </form>
  )
}
