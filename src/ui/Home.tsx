import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { recentPeople } from '../lib/people'
import { searchPeople } from '../lib/search'
import { SIDES, SIDE_LABELS, type Side, inSide, loadSide, saveSide } from '../lib/space'
import { Page, PersonRow, useVault } from './common'

export default function Home() {
  const vault = useVault()
  const navigate = useNavigate()
  const [side, setSide] = useState<Side>(loadSide)
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [context, setContext] = useState('')

  const everyone = vault.all('person').sort((a, b) => a.name.localeCompare(b.name))
  // Search covers both sides: its job is finding someone half remembered.
  const results = searchPeople(query, {
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

  function chooseSide(next: Side) {
    setSide(next)
    saveSide(next)
  }

  async function quickAdd(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    const person = await vault.create('person', {
      name: name.trim(),
      howIKnow: context.trim() || undefined,
      circle: true,
      space: side,
      tags: [],
    })
    void navigate(`/person/${person.id}`)
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
        placeholder="Search names, tags, anything you noted"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {query.trim() ? (
        <section className="flex flex-col gap-2">
          {results.length === 0 && <p className="muted">No one matches.</p>}
          {results.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              badge={inSide(person, side) ? undefined : SIDE_LABELS[otherSide]}
            />
          ))}
        </section>
      ) : (
        <>
          <form onSubmit={quickAdd} className="card flex flex-col gap-2">
            <h2 className="section-title">Add someone to {SIDE_LABELS[side].toLowerCase()}</h2>
            <input
              className="input"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="input"
              placeholder="How you know them"
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
            <button className="btn btn-primary" disabled={!name.trim()}>
              Add
            </button>
          </form>

          {pinned.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="section-title">Pinned</h2>
              {pinned.map((person) => (
                <PersonRow key={person.id} person={person} />
              ))}
            </section>
          )}

          {circle.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="section-title">Recent</h2>
              {recentPeople(vault, 5, side).map((person) => (
                <PersonRow key={person.id} person={person} />
              ))}
            </section>
          )}

          {circle.length > 5 && (
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
