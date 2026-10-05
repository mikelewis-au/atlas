import { useEffect, useState, useSyncExternalStore } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import { Vault } from './lib/vault'
import { VaultContext } from './ui/common'
import Home from './ui/Home'
import Lock, { RecoveryKeyScreen } from './ui/Lock'
import MapPage from './ui/MapPage'
import PersonPage from './ui/PersonPage'
import Settings from './ui/Settings'

const vault = new Vault()
const AUTO_LOCK_MS = 5 * 60 * 1000

export default function App() {
  const [ready, setReady] = useState(false)
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null)
  useSyncExternalStore(vault.subscribe, vault.getSnapshot)

  useEffect(() => {
    void vault.init().then(() => setReady(true))
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
