import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ageLabel, formatDate, parseBorn, todayIso } from '../lib/dates'
import {
  ROLES,
  ROLE_LABELS,
  type Relation,
  type Role,
  canEnd,
  household,
  relationsOf,
} from '../lib/links'
import type { Note, Person, Space } from '../lib/model'
import { addChild, childLabel, childrenOf } from '../lib/children'
import { connect, deletePerson, notesFor } from '../lib/people'
import {
  ConfirmButton,
  Page,
  SensitiveBadge,
  SensitiveToggle,
  useVault,
} from './common'

export default function PersonPage() {
  const { id = '' } = useParams()
  const vault = useVault()
  const [editing, setEditing] = useState(false)
  const person = vault.get('person', id)

  if (!person) {
    return (
      <Page>
        <Link to="/" className="muted underline">
          ‹ Back
        </Link>
        <p>This person is no longer here.</p>
      </Page>
    )
  }

  const age = ageLabel(person.born)
  const space = person.space ?? 'personal'
  const relations = relationsOf(vault.all('link'), person.id)

  return (
    <Page>
      <Link to="/" className="muted underline">
        ‹ Back
      </Link>

      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">
            {person.name}
            {age && <span className="muted ml-2 font-normal">{age}</span>}
          </h1>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className="btn"
              onClick={() => void vault.update('person', person.id, { pinned: !person.pinned })}
            >
              {person.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button type="button" className="btn" onClick={() => setEditing(!editing)}>
              {editing ? 'Close' : 'Edit'}
            </button>
          </div>
        </div>
        {person.howIKnow && <p className="muted">{person.howIKnow}</p>}
        {space !== 'personal' && (
          <span className="chip self-start">{SPACE_LABELS[space]}</span>
        )}
        {person.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {person.tags.map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
          </div>
        )}
        {person.hasMap && (
          <Link to={`/person/${person.id}/map`} className="btn btn-primary self-start">
            Love map
          </Link>
        )}
      </header>

      {editing && <EditPerson person={person} onDone={() => setEditing(false)} />}

      <Briefing person={person} relations={relations} />
      <NoteForm personId={person.id} />
      <Loops personId={person.id} />
      <Facts personId={person.id} />
      <Kids personId={person.id} />
      <Connections person={person} relations={relations} />
      <Notes personId={person.id} />
    </Page>
  )
}

const SPACE_LABELS: Record<Space, string> = {
  personal: 'Personal',
  work: 'Work',
  both: 'Personal and work',
}

function EditPerson({ person, onDone }: { person: Person; onDone: () => void }) {
  const vault = useVault()
  const navigate = useNavigate()
  const [name, setName] = useState(person.name)
  const [born, setBorn] = useState(person.born ?? '')
  const [howIKnow, setHowIKnow] = useState(person.howIKnow ?? '')
  const [tags, setTags] = useState(person.tags.join(', '))
  const [circle, setCircle] = useState(person.circle)
  const [space, setSpace] = useState<Space>(person.space ?? 'personal')
  const [hasMap, setHasMap] = useState(person.hasMap ?? false)
  const [error, setError] = useState('')

  async function save(event: React.FormEvent) {
    event.preventDefault()
    const parsedBorn = born.trim() ? parseBorn(born) : undefined
    if (born.trim() && !parsedBorn) return setError('Born should be a year (2018) or a date (2018-05-31).')
    if (!name.trim()) return setError('A name is needed.')
    await vault.update('person', person.id, {
      name: name.trim(),
      born: parsedBorn,
      howIKnow: howIKnow.trim() || undefined,
      tags: tags
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
      circle,
      space,
      hasMap,
    })
    onDone()
  }

  return (
    <form onSubmit={save} className="card flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="edit-name">
          Name
        </label>
        <input id="edit-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="edit-born">
          Born (year or full date)
        </label>
        <input
          id="edit-born"
          className="input"
          placeholder="2018 or 2018-05-31"
          inputMode="numeric"
          value={born}
          onChange={(e) => setBorn(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="edit-how">
          How I know them
        </label>
        <input
          id="edit-how"
          className="input"
          value={howIKnow}
          onChange={(e) => setHowIKnow(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="edit-tags">
          Tags (comma separated)
        </label>
        <input
          id="edit-tags"
          className="input"
          autoCapitalize="none"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="edit-space">
          Shown under
        </label>
        <select
          id="edit-space"
          className="input"
          value={space}
          onChange={(e) => setSpace(e.target.value as Space)}
        >
          {(Object.keys(SPACE_LABELS) as Space[]).map((option) => (
            <option key={option} value={option}>
              {SPACE_LABELS[option]}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={circle} onChange={(e) => setCircle(e.target.checked)} />
        In my circle
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={hasMap} onChange={(e) => setHasMap(e.target.checked)} />
        Keep a love map
      </label>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex justify-between gap-2">
        <ConfirmButton
          label="Delete person"
          confirmLabel="Tap again to delete everything about them"
          onConfirm={() => {
            void deletePerson(vault, person.id).then(() => navigate('/'))
          }}
        />
        <button className="btn btn-primary">Save</button>
      </div>
    </form>
  )
}

function Briefing({ person, relations }: { person: Person; relations: Relation[] }) {
  const vault = useVault()
  const lastNote = notesFor(vault, person.id)[0]
  const openLoops = vault
    .all('loop')
    .filter((loop) => loop.personId === person.id && loop.status === 'open')
  const home = household(relations)
  const kids = childrenOf(vault.all('child'), person.id)

  return (
    <section className="card flex flex-col gap-3" data-testid="briefing">
      <div>
        <h2 className="section-title">Last conversation</h2>
        {lastNote ? (
          <>
            <p className="muted">{formatDate(lastNote.date)}</p>
            <p className="whitespace-pre-wrap">{lastNote.text}</p>
          </>
        ) : (
          <p className="muted">Nothing noted yet.</p>
        )}
      </div>
      {openLoops.length > 0 && (
        <div>
          <h2 className="section-title">Ask about</h2>
          <ul className="list-disc pl-5">
            {openLoops.map((loop) => (
              <li key={loop.id}>
                {loop.text}
                {loop.dueDate && <span className="muted ml-2">{formatDate(loop.dueDate)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(home.length > 0 || kids.length > 0) && (
        <div>
          <h2 className="section-title">Household</h2>
          <ul>
            {home.map((relation) => (
              <RelationLine key={relation.link.id} relation={relation} />
            ))}
          </ul>
          {kids.length > 0 && (
            <p>
              <span className="muted mr-2">Kids</span>
              {kids.map((child) => childLabel(child)).join(', ')}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function RelationLine({ relation }: { relation: Relation }) {
  const vault = useVault()
  const other = vault.get('person', relation.otherId)
  if (!other) return null
  const age = ageLabel(other.born)
  return (
    <li>
      <Link to={`/person/${other.id}`} className="font-medium underline">
        {other.name}
      </Link>
      {age && <span className="ml-1">({age})</span>}
      <span className="muted ml-2">{relation.label}</span>
    </li>
  )
}

function NoteForm({ personId }: { personId: string }) {
  const vault = useVault()
  const [text, setText] = useState('')
  const [date, setDate] = useState(todayIso())
  const [sensitive, setSensitive] = useState(false)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!text.trim()) return
    await vault.create('note', { personId, date, text: text.trim(), sensitive })
    setText('')
    setSensitive(false)
  }

  return (
    <form onSubmit={save} className="card flex flex-col gap-2">
      <h2 className="section-title">New note</h2>
      <textarea
        className="input"
        rows={4}
        placeholder="What did you talk about?"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        <input
          type="date"
          className="input w-auto"
          aria-label="Conversation date"
          value={date}
          max={todayIso()}
          onChange={(e) => setDate(e.target.value || todayIso())}
        />
        <SensitiveToggle checked={sensitive} onChange={setSensitive} />
      </div>
      <button className="btn btn-primary" disabled={!text.trim()}>
        Save note
      </button>
    </form>
  )
}

function Loops({ personId }: { personId: string }) {
  const vault = useVault()
  const [text, setText] = useState('')
  const [dueDate, setDueDate] = useState('')
  const loops = vault
    .all('loop')
    .filter((loop) => loop.personId === personId)
    .sort((a, b) => a.status.localeCompare(b.status) * -1 || b.createdAt.localeCompare(a.createdAt))

  async function add(event: React.FormEvent) {
    event.preventDefault()
    if (!text.trim()) return
    await vault.create('loop', {
      personId,
      text: text.trim(),
      dueDate: dueDate || undefined,
      status: 'open',
    })
    setText('')
    setDueDate('')
  }

  return (
    <section className="card flex flex-col gap-2">
      <h2 className="section-title">Things to ask about</h2>
      {loops.map((loop) => (
        <div key={loop.id} className="flex items-start justify-between gap-2">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1.5"
              checked={loop.status === 'closed'}
              onChange={(e) =>
                void vault.update('loop', loop.id, { status: e.target.checked ? 'closed' : 'open' })
              }
            />
            <span className={loop.status === 'closed' ? 'muted line-through' : ''}>
              {loop.text}
              {loop.dueDate && <span className="muted ml-2">{formatDate(loop.dueDate)}</span>}
            </span>
          </label>
          <button
            type="button"
            className="muted underline"
            onClick={() => void vault.remove(loop.id)}
          >
            Remove
          </button>
        </div>
      ))}
      <form onSubmit={add} className="flex flex-col gap-2">
        <input
          className="input"
          placeholder="e.g. How did the interview go?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex gap-2">
          <input
            type="date"
            className="input"
            aria-label="When it happens (optional)"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <button className="btn shrink-0" disabled={!text.trim()}>
            Add
          </button>
        </div>
      </form>
    </section>
  )
}

function Facts({ personId }: { personId: string }) {
  const vault = useVault()
  const [text, setText] = useState('')
  const facts = vault
    .all('fact')
    .filter((fact) => fact.personId === personId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  async function add(event: React.FormEvent) {
    event.preventDefault()
    if (!text.trim()) return
    await vault.create('fact', { personId, text: text.trim() })
    setText('')
  }

  return (
    <section className="card flex flex-col gap-2">
      <h2 className="section-title">Good to know</h2>
      {facts.map((fact) => (
        <div key={fact.id} className="flex items-start justify-between gap-2">
          <span>{fact.text}</span>
          <button
            type="button"
            className="muted underline"
            onClick={() => void vault.remove(fact.id)}
          >
            Remove
          </button>
        </div>
      ))}
      <form onSubmit={add} className="flex gap-2">
        <input
          className="input"
          placeholder="e.g. Barracks for Carlton"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn shrink-0" disabled={!text.trim()}>
          Add
        </button>
      </form>
    </section>
  )
}

function Kids({ personId }: { personId: string }) {
  const vault = useVault()
  const [text, setText] = useState('')
  const kids = childrenOf(vault.all('child'), personId)

  async function add(event: React.FormEvent) {
    event.preventDefault()
    if (await addChild(vault, personId, text)) setText('')
  }

  return (
    <section className="card flex flex-col gap-2" data-testid="kids">
      <h2 className="section-title">Kids</h2>
      {kids.map((child) => (
        <div key={child.id} className="flex items-start justify-between gap-2">
          <span>{childLabel(child)}</span>
          <ConfirmButton
            label="Remove"
            confirmLabel="Tap again"
            className="muted underline"
            onConfirm={() => void vault.remove(child.id)}
          />
        </div>
      ))}
      <form onSubmit={add} className="flex gap-2">
        <input
          className="input"
          placeholder="Name, or name and birth year"
          aria-label="Child's name"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn shrink-0" disabled={!text.trim()}>
          Add child
        </button>
      </form>
      <p className="muted">Kids also show on the card of anyone linked as their partner.</p>
    </section>
  )
}

const NEW_PERSON = 'new'

function Connections({ person, relations }: { person: Person; relations: Relation[] }) {
  const vault = useVault()
  const [role, setRole] = useState<Role>('partner')
  const [otherId, setOtherId] = useState(NEW_PERSON)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const others = vault
    .all('person')
    .filter((other) => other.id !== person.id)
    .sort((a, b) => a.name.localeCompare(b.name))

  async function add(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    let targetId = otherId
    if (otherId === NEW_PERSON) {
      if (!newName.trim()) return
      targetId = (await vault.create('person', {
          name: newName.trim(),
          circle: false,
          // A colleague's partner belongs with the colleague, not among personal contacts.
          space: person.space,
          tags: [],
        })).id
    }
    if (!(await connect(vault, person.id, targetId, role))) {
      return setError('That connection is already recorded.')
    }
    setNewName('')
    setOtherId(NEW_PERSON)
  }

  return (
    <section className="card flex flex-col gap-2">
      <h2 className="section-title">Connections</h2>
      <ul className="flex flex-col gap-1">
        {relations.map((relation) => (
          <div key={relation.link.id} className="flex items-start justify-between gap-2">
            <RelationLine relation={relation} />
            <span className="flex shrink-0 gap-3">
              {canEnd(relation.role) && (
                <button
                  type="button"
                  className="muted underline"
                  onClick={() =>
                    void vault.update('link', relation.link.id, { ended: !relation.link.ended })
                  }
                >
                  {relation.link.ended ? 'Current' : 'Ended'}
                </button>
              )}
              <button
                type="button"
                className="muted underline"
                onClick={() => void vault.remove(relation.link.id)}
              >
                Remove
              </button>
            </span>
          </div>
        ))}
      </ul>
      <form onSubmit={add} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <select
            className="input"
            aria-label="Relationship"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {ROLES.map((option) => (
              <option key={option} value={option}>
                {option === 'child' ? 'Child (own card)' : ROLE_LABELS[option]}
              </option>
            ))}
          </select>
          <select
            className="input"
            aria-label="Person"
            value={otherId}
            onChange={(e) => setOtherId(e.target.value)}
          >
            <option value={NEW_PERSON}>New person…</option>
            {others.map((other) => (
              <option key={other.id} value={other.id}>
                {other.name}
                {other.howIKnow ? ` (${other.howIKnow})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          {otherId === NEW_PERSON && (
            <input
              className="input"
              placeholder="Their name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          )}
          <button className="btn shrink-0" disabled={otherId === NEW_PERSON && !newName.trim()}>
            Add connection
          </button>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </form>
    </section>
  )
}

function Notes({ personId }: { personId: string }) {
  const vault = useVault()
  const notes = notesFor(vault, personId)
  if (notes.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h2 className="section-title">All notes</h2>
      {notes.map((note) => (
        <NoteItem key={note.id} note={note} />
      ))}
    </section>
  )
}

function NoteItem({ note }: { note: Note }) {
  const vault = useVault()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(note.text)
  const [sensitive, setSensitive] = useState(note.sensitive)

  async function save() {
    if (!text.trim()) return
    await vault.update('note', note.id, { text: text.trim(), sensitive })
    setEditing(false)
  }

  return (
    <article className="card flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="muted">{formatDate(note.date)}</span>
        {note.sensitive && !editing && <SensitiveBadge />}
      </div>
      {editing ? (
        <>
          <textarea
            className="input"
            rows={4}
            aria-label="Note text"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <SensitiveToggle checked={sensitive} onChange={setSensitive} />
          <div className="flex justify-between gap-2">
            <ConfirmButton
              label="Delete"
              confirmLabel="Tap again to delete"
              onConfirm={() => void vault.remove(note.id)}
            />
            <button type="button" className="btn btn-primary" onClick={() => void save()}>
              Save
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="whitespace-pre-wrap">{note.text}</p>
          <button
            type="button"
            className="muted self-start underline"
            onClick={() => {
              setText(note.text)
              setSensitive(note.sensitive)
              setEditing(true)
            }}
          >
            Edit
          </button>
        </>
      )}
    </article>
  )
}
