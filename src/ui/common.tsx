import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { ageLabel } from '../lib/dates'
import type { Person } from '../lib/model'
import type { Vault } from '../lib/vault'

export const VaultContext = createContext<Vault | null>(null)

/** Re-renders the caller whenever anything in the vault changes. */
export function useVault(): Vault {
  const vault = useContext(VaultContext)
  if (!vault) throw new Error('useVault used outside VaultContext')
  useSyncExternalStore(vault.subscribe, vault.getSnapshot)
  return vault
}

export function Page({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-4 pb-16">{children}</main>
}

export function PersonRow({ person, badge }: { person: Person; badge?: string }) {
  const age = ageLabel(person.born)
  return (
    <Link to={`/person/${person.id}`} className="card flex items-baseline justify-between gap-3">
      <span className="font-medium">
        {person.name}
        {age && <span className="muted ml-2">{age}</span>}
        {badge && <span className="chip ml-2 font-normal">{badge}</span>}
      </span>
      <span className="muted truncate">{person.howIKnow}</span>
    </Link>
  )
}

/** Asks for a second tap instead of a browser dialog, which is unreliable in an installed app. */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className = 'btn btn-danger',
}: {
  label: string
  confirmLabel: string
  onConfirm: () => void
  className?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(timer)
  }, [armed])
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (armed) onConfirm()
        setArmed(!armed)
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}

export function SensitiveToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="muted flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      Sensitive
    </label>
  )
}

export function SensitiveBadge() {
  return <span className="chip">Sensitive</span>
}
