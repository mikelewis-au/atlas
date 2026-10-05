import { useState } from 'react'
import { BackupFormatError, MIN_PASSPHRASE_LENGTH, type Vault, WrongSecretError } from '../lib/vault'
import { Page } from './common'

type Mode = 'passphrase' | 'recover'

export default function Lock({ vault, onSetUp }: { vault: Vault; onSetUp: (key: string) => void }) {
  const isNew = vault.status === 'uninitialised'
  const [mode, setMode] = useState<Mode>('passphrase')
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const choosing = isNew || mode === 'recover'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (choosing) {
      if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
        return setError(`Use at least ${MIN_PASSPHRASE_LENGTH} characters.`)
      }
      if (passphrase !== confirm) return setError('The two passphrases do not match.')
    }
    setBusy(true)
    try {
      if (isNew) {
        onSetUp(await vault.setup(passphrase))
        void navigator.storage?.persist?.()
      } else if (mode === 'recover') await vault.recover(recoveryKey, passphrase)
      else await vault.unlock(passphrase)
    } catch (e) {
      if (!(e instanceof WrongSecretError)) throw e
      setError(mode === 'recover' ? 'That recovery key is not right.' : 'Wrong passphrase.')
    } finally {
      setBusy(false)
    }
  }

  async function restore(file: File | undefined) {
    if (!file) return
    setError('')
    try {
      await vault.importBackup(await file.text())
    } catch (e) {
      if (!(e instanceof BackupFormatError)) throw e
      setError('That file is not an Atlas backup.')
    }
  }

  return (
    <Page>
      <form onSubmit={submit} className="card mt-10 flex flex-col gap-3">
        {isNew && (
          <p className="muted">
            Choose a passphrase. It encrypts everything on this device. If you forget it and lose
            your recovery key, your notes cannot be recovered.
          </p>
        )}
        {mode === 'recover' && (
          <div>
            <label className="label" htmlFor="recovery">
              Recovery key
            </label>
            <input
              id="recovery"
              className="input font-mono"
              autoCapitalize="characters"
              autoComplete="off"
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
            />
          </div>
        )}
        <div>
          <label className="label" htmlFor="passphrase">
            {mode === 'recover' ? 'New passphrase' : 'Passphrase'}
          </label>
          <input
            id="passphrase"
            type="password"
            className="input"
            autoComplete={choosing ? 'new-password' : 'current-password'}
            autoFocus
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
        </div>
        {choosing && (
          <div>
            <label className="label" htmlFor="confirm">
              Confirm passphrase
            </label>
            <input
              id="confirm"
              type="password"
              className="input"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>
          {isNew ? 'Create' : mode === 'recover' ? 'Reset passphrase' : 'Unlock'}
        </button>
      </form>

      {!isNew && (
        <button
          type="button"
          className="muted underline"
          onClick={() => {
            setMode(mode === 'recover' ? 'passphrase' : 'recover')
            setError('')
          }}
        >
          {mode === 'recover' ? 'Use my passphrase' : 'Forgot passphrase? Use recovery key'}
        </button>
      )}
      {isNew && (
        <label className="muted underline">
          Restore from a backup file
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void restore(e.target.files?.[0])}
          />
        </label>
      )}
    </Page>
  )
}

export function RecoveryKeyScreen({
  recoveryKey,
  onDone,
}: {
  recoveryKey: string
  onDone: () => void
}) {
  return (
    <Page>
      <h1 className="mt-10 text-2xl font-semibold">Your recovery key</h1>
      <div className="card flex flex-col gap-3">
        <p className="muted">
          Write this down or print it, and keep it somewhere safe away from your phone. It is the
          only way back in if you forget your passphrase, and it will not be shown again.
        </p>
        <p className="rounded-lg bg-slate-100 p-3 text-center font-mono text-lg break-all select-all dark:bg-slate-900">
          {recoveryKey}
        </p>
        <button type="button" className="btn" onClick={() => window.print()}>
          Print
        </button>
        <button type="button" className="btn btn-primary" onClick={onDone}>
          I've saved it
        </button>
      </div>
    </Page>
  )
}
