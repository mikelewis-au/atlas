import { useEffect, useState, useSyncExternalStore } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import { Vault } from './lib/vault'
import { Page, VaultContext, describe } from './ui/common'
import Home from './ui/Home'
import Lock, { RecoveryKeyScreen } from './ui/Lock'
import MapPage from './ui/MapPage'
import PersonPage from './ui/PersonPage'
import Settings from './ui/Settings'

const vault = new Vault()
const AUTO_LOCK_MS = 5 * 60 * 1000

export default function App() {
  const [ready, setReady] = useState(false)
  const [failure, setFailure] = useState('')
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null)
  useSyncExternalStore(vault.subscribe, vault.getSnapshot)

  useEffect(() => {
    vault.init().then(
      () => setReady(true),
      (e: unknown) => setFailure(describe(e)),
    )
  }, [])

  useEffect(() => {
    let hiddenAt = 0
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > AUTO_LOCK_MS && vault.status === 'unlocked') {
        vault.lock()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  if (failure) {
    return (
      <Page>
        <p className="mt-10 text-red-600 dark:text-red-400">{failure}</p>
        <p className="muted">
          Atlas keeps its notes in this browser's storage, which could not be opened. Private
          browsing windows often block it.
        </p>
      </Page>
    )
  }
  if (!ready) return null
  if (recoveryKey) {
    return <RecoveryKeyScreen recoveryKey={recoveryKey} onDone={() => setRecoveryKey(null)} />
  }
  if (vault.status !== 'unlocked') return <Lock vault={vault} onSetUp={setRecoveryKey} />

  return (
    <VaultContext.Provider value={vault}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/person/:id" element={<PersonPage />} />
          <Route path="/person/:id/map" element={<MapPage />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </HashRouter>
    </VaultContext.Provider>
  )
}
