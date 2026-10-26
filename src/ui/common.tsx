import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router'
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

export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-4 pb-24">{children}</main>
}

/** Back lands where the page was left; a new page starts at the top. Mount inside the router. */
export function ScrollMemory() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const positions = useRef(new Map<string, number>())
  useEffect(() => {
    const remember = () => positions.current.set(location.key, window.scrollY)
    window.addEventListener('scroll', remember, { passive: true })
    return () => window.removeEventListener('scroll', remember)
  }, [location.key])
  useLayoutEffect(() => {
    if (navigationType === 'POP') window.scrollTo(0, positions.current.get(location.key) ?? 0)
    else if (navigationType === 'PUSH') window.scrollTo(0, 0)
  }, [location.key, navigationType])
  return null
}

/**
 * Clears a form before the encrypted write finishes, so the next entry can start at once.
 * A failed write calls `restore` and shows the error.
 */
export function useInstant(): {
  error: string
  run: (write: () => Promise<unknown>, restore?: () => void) => void
} {
  const [error, setError] = useState('')
  return {
    error,
    run(write, restore) {
      setError('')
      write().catch((e: unknown) => {
        restore?.()
        setError(describe(e))
      })
    },
  }
}

/** Goes back through history when the app got here from another of its own pages. */
export function BackLink({ to, label = 'Back' }: { to: string; label?: string }) {
  const navigate = useNavigate()
  return (
    <Link
      to={to}
      className="textbtn self-start"
      onClick={(event) => {
        if (window.history.state?.idx > 0) {
          event.preventDefault()
          void navigate(-1)
        }
      }}
    >
      ‹ {label}
    </Link>
  )
}

export function PersonRow({
  person,
  badge,
  snippet,
  hint,
}: {
  person: Person
  badge?: string
  snippet?: string
  /** The next thing to ask them, shown so the list reads as a brief. */
  hint?: string
}) {
  const age = ageLabel(person.born)
  return (
    <Link to={`/person/${person.id}`} className="card flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-medium">
          {person.name}
          {age && <span className="muted ml-2">{age}</span>}
          {badge && <span className="chip ml-2 font-normal">{badge}</span>}
        </span>
        <span className="muted truncate">{person.howIKnow}</span>
      </span>
      {snippet && <span className="muted line-clamp-2">{snippet}</span>}
      {hint && (
        <span className="muted line-clamp-1">
          <span className="mr-1.5 text-xs font-semibold tracking-wide uppercase">Ask</span>
          {hint}
        </span>
      )}
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

/** A "+ Add" link that stands in for a form until it is wanted. */
export function Reveal({
  label,
  children,
}: {
  label: string
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button type="button" className="textbtn self-start" onClick={() => setOpen(true)}>
        + {label}
      </button>
    )
  }
  return <>{children(() => setOpen(false))}</>
}

/** A line of text that turns into an editor when tapped. */
export function Editable({
  text,
  onSave,
  onDelete,
  className = '',
  deleteLabel = 'Delete',
  children,
}: {
  text: string
  onSave: (text: string) => unknown
  onDelete: () => void
  className?: string
  deleteLabel?: string
  /** What to show when not editing; defaults to the text itself. */
  children?: ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text)

  if (!editing) {
    return (
      <button
        type="button"
        className={`text-left ${className}`}
        onClick={() => {
          setDraft(text)
          setEditing(true)
        }}
      >
        {children ?? text}
      </button>
    )
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!draft.trim()) return
        void Promise.resolve(onSave(draft.trim())).then(() => setEditing(false))
      }}
    >
      <input
        className="input"
        aria-label={`Edit: ${text}`}
        enterKeyHint="done"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        <ConfirmButton
          label={deleteLabel}
          confirmLabel="Tap again"
          className="textbtn textbtn-danger"
          onConfirm={onDelete}
        />
        <span className="flex gap-3">
          <button type="button" className="textbtn" onClick={() => setEditing(false)}>
            Cancel
          </button>
          <button className="btn btn-primary py-1" disabled={!draft.trim()}>
            Save
          </button>
        </span>
      </div>
    </form>
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
    <label className="muted -my-1.5 flex min-h-11 items-center gap-2">
      <input type="checkbox" className="size-4" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      Sensitive
    </label>
  )
}

/** For errors the app did not anticipate: shown rather than swallowed, so a failure is never silent. */
export function describe(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error)
  return `Something went wrong: ${detail}`
}

export function SensitiveBadge() {
  return <span className="chip">Sensitive</span>
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <p className="text-sm text-red-600 dark:text-red-400">{children}</p>
}
