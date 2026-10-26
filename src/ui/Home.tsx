import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { openLoops, recentPeople } from '../lib/people'
import { searchMatches } from '../lib/search'
import type { Person } from '../lib/model'
import { SIDES, SIDE_LABELS, type Side, inSide, loadSide, saveSide } from '../lib/space'
import { ErrorText, Page, PersonRow, Reveal, useVault } from './common'

export default function Home() {
  const vault = useVault()
  const [params, setParams] = useSearchParams()
  const [side, setSide] = useState<Side>(loadSide)
  const query = params.get('q') ?? ''

  const everyone = vault.all('person').sort((a, b) => a.name.localeCompare(b.name))
  // Search covers both sides: its job is finding someone half remembered.
  const matches = searchMatches(query, {
    people: everyone,
    links: vault.all('link'),
    children: vault.all('child'),
    facts: vault.all('fact'),
    notes: vault.all('note'),
    mapEntries: vault.all('mapEntry'),
  })
  const otherSide: Side = side === 'work' ? 'personal' : 'work'
  const people = everyone.filter((person) => inSide(person, side))
  const pinned = people.filter((person) => person.pinned)
  const circle = people.filter((person) => person.circle)
  const satellites = people.filter((person) => !person.circle)
  const recent = recentPeople(vault, 5, side).filter((person) => !person.pinned)
  const loops = vault.all('loop')
  const nextToAsk = (person: Person) => openLoops(loops, person.id)[0]?.text
  const typedName = query.trim()
  const alreadyNamed = matches.some(
    (match) => match.person.name.toLowerCase() === typedName.toLowerCase(),
  )

  function chooseSide(next: Side) {
    setSide(next)
    saveSide(next)
  }

  function setQuery(next: string) {
    setParams(next ? { q: next } : {}, { replace: true })
  }

  return (
    <Page>
      <header className="flex justify-end">
        <Link to="/settings" className="muted underline">
          Settings
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200 p-1 dark:bg-slate-800">
        {SIDES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={side === option}
            className={`rounded-lg py-2 text-sm font-medium ${
              side === option ? 'bg-white shadow-sm dark:bg-slate-600' : 'muted'
            }`}
            onClick={() => chooseSide(option)}
          >
            {SIDE_LABELS[option]}
          </button>
        ))}
      </div>

      <input
        type="search"
        className="input"
        placeholder="Search, or type a name to add"
        aria-label="Search"
        enterKeyHint="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {typedName ? (
        <section className="flex flex-col gap-2">
          {matches.map((match) => (
            <PersonRow
              key={match.person.id}
              person={match.person}
              snippet={match.snippet}
              badge={inSide(match.person, side) ? undefined : SIDE_LABELS[otherSide]}
            />
          ))}
          {matches.length === 0 ? (
            <>
              <p className="muted">No one matches.</p>
              <AddPerson side={side} name={typedName} />
            </>
          ) : (
            !alreadyNamed && (
              <Reveal label={`Add “${typedName}” as someone new`}>
                {() => <AddPerson side={side} name={typedName} />}
              </Reveal>
            )
          )}
        </section>
      ) : (
        <>
          {people.length === 0 && (
            <p className="muted">
              No one here yet. Type a name above to add someone to {SIDE_LABELS[side].toLowerCase()}.
            </p>
          )}

          {pinned.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="section-title">Pinned</h2>
              {pinned.map((person) => (
                <PersonRow key={person.id} person={person} hint={nextToAsk(person)} />
              ))}
            </section>
          )}

          {recent.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="section-title">Recent</h2>
              {recent.map((person) => (
                <PersonRow key={person.id} person={person} hint={nextToAsk(person)} />
              ))}
            </section>
          )}

          {people.length > 0 && (
            <Reveal label="Add someone">
              {(close) => <AddPerson side={side} onDone={close} />}
            </Reveal>
          )}

          {circle.length > recent.length + pinned.length && (
            <details>
              <summary className="section-title cursor-pointer">
                Everyone in {SIDE_LABELS[side].toLowerCase()} ({circle.length})
              </summary>
              <div className="flex flex-col gap-2">
                {circle.map((person) => (
                  <PersonRow key={person.id} person={person} />
                ))}
              </div>
            </details>
          )}

          {satellites.length > 0 && (
            <details>
              <summary className="section-title cursor-pointer">
                Family and connections ({satellites.length})
              </summary>
              <div className="flex flex-col gap-2">
                {satellites.map((person) => (
                  <PersonRow key={person.id} person={person} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </Page>
  )
}

/** Five-second quick add: a name, optionally one line of context, straight to their page. */
function AddPerson({ side, name: fixedName, onDone }: { side: Side; name?: string; onDone?: () => void }) {
  const vault = useVault()
  const navigate = useNavigate()
  const [, setParams] = useSearchParams()
  const [name, setName] = useState(fixedName ?? '')
  const [context, setContext] = useState('')
  const [error, setError] = useState('')
  const finalName = (fixedName ?? name).trim()

  async function add(event: React.FormEvent) {
    event.preventDefault()
    if (!finalName) return setError('A name is needed.')
    const person = await vault.create('person', {
      name: finalName,
      howIKnow: context.trim() || undefined,
      circle: true,
      space: side,
      tags: [],
    })
    // Coming back should land on the list, not on a search for the name just added.
    setParams({}, { replace: true })
    void navigate(`/person/${person.id}`)
  }

  return (
    <form onSubmit={add} className="card flex flex-col gap-2">
      <h2 className="section-title">
        {fixedName ? `Add “${fixedName}” to ${SIDE_LABELS[side].toLowerCase()}` : `Add someone to ${SIDE_LABELS[side].toLowerCase()}`}
      </h2>
      {!fixedName && (
        <input
          className="input"
          placeholder="Name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      )}
      <input
        className="input"
        placeholder="How you know them"
        value={context}
        onChange={(e) => setContext(e.target.value)}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <div className="flex justify-between gap-2">
        {onDone ? (
          <button type="button" className="textbtn" onClick={onDone}>
            Cancel
          </button>
        ) : (
          <span />
        )}
        <button className="btn btn-primary" disabled={!finalName}>
          Add
        </button>
      </div>
    </form>
  )
}
