import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { addChild, childLabel, childrenOf, parseChild } from '../lib/children'
import { ageLabel, parseBorn, todayIso, whenLabel } from '../lib/dates'
import {
  ROLES,
  ROLE_LABELS,
  type Relation,
  type Role,
  canEnd,
  household,
  relationsOf,
} from '../lib/links'
import { mapHighlights, sectionInfo } from '../lib/map'
import type { Note, OpenLoop, Person, Space } from '../lib/model'
import { connect, deletePerson, notesFor, openLoops, questionsIn } from '../lib/people'
import {
  BackLink,
  ConfirmButton,
  Editable,
  ErrorText,
  Page,
  Reveal,
  SensitiveBadge,
  SensitiveToggle,
  useInstant,
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
        <BackLink to="/" />
        <p>This person is no longer here.</p>
      </Page>
    )
  }

  const age = ageLabel(person.born)
  const space = person.space ?? 'personal'
  const relations = relationsOf(vault.all('link'), person.id)

  return (
    <Page>
      <BackLink to="/" />

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
        {(space !== 'personal' || person.tags.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {space !== 'personal' && <span className="chip">{SPACE_LABELS[space]}</span>}
            {person.tags.map((tag) => (
              <Link key={tag} to={`/?q=${encodeURIComponent(tag)}`} className="chip">
                {tag}
              </Link>
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

function firstName(person: Person): string {
  return person.name.split(/\s+/)[0]
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
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" className="size-4" checked={circle} onChange={(e) => setCircle(e.target.checked)} />
        In my circle
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" className="size-4" checked={hasMap} onChange={(e) => setHasMap(e.target.checked)} />
        Keep a love map
      </label>
      {error && <ErrorText>{error}</ErrorText>}
      <div className="flex justify-between gap-2">
        <ConfirmButton
          label="Delete person"
          confirmLabel="Tap again to delete everything about them"
          onConfirm={() => {
            // Leave the page first: each removal re-renders it, and it would briefly show
            // "no longer here" before the navigation.
            void navigate('/')
            void deletePerson(vault, person.id)
          }}
        />
        <button className="btn btn-primary">Save</button>
      </div>
    </form>
  )
}

/** Everything worth knowing before the next conversation, each part editable in place. */
function Briefing({ person, relations }: { person: Person; relations: Relation[] }) {
  const vault = useVault()
  const lastNote = notesFor(vault, person.id)[0]
  return (
    <section className="card flex flex-col gap-4" data-testid="briefing">
      <div>
        <h2 className="section-title">Last conversation</h2>
        {lastNote ? (
          <>
            <p className="muted">{whenLabel(lastNote.date)}</p>
            <Clamped text={lastNote.text} />
          </>
        ) : (
          <p className="muted">Nothing noted yet.</p>
        )}
      </div>
      {person.hasMap && <OnTheirMind person={person} />}
      <Loops personId={person.id} />
      <Facts personId={person.id} />
      <Household personId={person.id} relations={relations} />
    </section>
  )
}

const CLAMP_LINES = 4
const CLAMP_CHARS = 220

/** A long note shows its first few lines until tapped, so the rest of the brief stays in view. */
function Clamped({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const long = text.length > CLAMP_CHARS || text.split('\n').length > CLAMP_LINES
  if (!long) return <p className="whitespace-pre-wrap">{text}</p>
  return (
    <button
      type="button"
      className="text-left"
      aria-expanded={expanded}
      onClick={() => setExpanded(!expanded)}
    >
      <span className={`whitespace-pre-wrap ${expanded ? 'block' : 'line-clamp-4'}`}>{text}</span>
      <span className="textbtn">{expanded ? 'Less' : 'More'}</span>
    </button>
  )
}

/** The pressing parts of the love map, so the brief is the one place to look. */
function OnTheirMind({ person }: { person: Person }) {
  const vault = useVault()
  const highlights = mapHighlights(
    vault.all('mapEntry').filter((entry) => entry.personId === person.id),
  )
  if (highlights.length === 0) return null
  return (
    <div className="flex flex-col gap-1" data-testid="on-their-mind">
      <h2 className="section-title mb-0">On {firstName(person)}'s mind</h2>
      <ul className="flex flex-col gap-1">
        {highlights.map((entry) => (
          <li key={entry.id}>
            {entry.text}
            <span className="muted ml-2">{sectionInfo(entry.section).title}</span>
          </li>
        ))}
      </ul>
      <Link to={`/person/${person.id}/map`} className="textbtn self-start">
        Open the love map
      </Link>
    </div>
  )
}

function Loops({ personId }: { personId: string }) {
  const vault = useVault()
  const [text, setText] = useState('')
  const [dueDate, setDueDate] = useState('')
  // A loop just ticked stays in view for one answer before it moves to Done.
  const [answeringId, setAnsweringId] = useState<string>()
  const { error, run } = useInstant()
  const loops = vault.all('loop').filter((loop) => loop.personId === personId)
  const open = openLoops(loops, personId)
  const answering = loops.find((loop) => loop.id === answeringId)
  const done = loops
    .filter((loop) => loop.status === 'closed' && loop.id !== answeringId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  function add(event: React.FormEvent) {
    event.preventDefault()
    const entry = { text: text.trim(), dueDate: dueDate || undefined }
    if (!entry.text) return
    setText('')
    setDueDate('')
    run(
      () => vault.create('loop', { personId, ...entry, status: 'open' }),
      () => {
        setText(entry.text)
        setDueDate(entry.dueDate ?? '')
      },
    )
  }

  return (
    <div className="flex flex-col gap-2" data-testid="loops">
      <h2 className="section-title mb-0">Ask about</h2>
      {open.map((loop) => (
        <LoopRow key={loop.id} loop={loop} onClose={() => setAnsweringId(loop.id)} />
      ))}
      {answering && <AnswerForm loop={answering} onDone={() => setAnsweringId(undefined)} />}
      {done.length > 0 && (
        <details>
          <summary className="muted cursor-pointer">Done ({done.length})</summary>
          <div className="mt-1 flex flex-col gap-2">
            {done.map((loop) => (
              <LoopRow key={loop.id} loop={loop} />
            ))}
          </div>
        </details>
      )}
      {error && <ErrorText>{error}</ErrorText>}
      <Reveal label="Add something to ask">
        {(close) => (
          <form onSubmit={add} className="flex flex-col gap-2">
            <input
              className="input"
              placeholder="e.g. How did the interview go?"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex items-center gap-2">
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
              <button type="button" className="textbtn shrink-0" onClick={close}>
                Done
              </button>
            </div>
          </form>
        )}
      </Reveal>
    </div>
  )
}

function LoopRow({ loop, onClose }: { loop: OpenLoop; onClose?: () => void }) {
  const vault = useVault()
  const closed = loop.status === 'closed'
  return (
    <div className="flex items-start gap-2">
      <label className="-my-1.5 flex min-h-11 shrink-0 items-center">
        <input
          type="checkbox"
          className="size-4"
          aria-label={closed ? `Reopen: ${loop.text}` : `Done: ${loop.text}`}
          checked={closed}
          onChange={(e) => {
            const status = e.target.checked ? 'closed' : 'open'
            void vault.update('loop', loop.id, { status })
            if (status === 'closed') onClose?.()
          }}
        />
      </label>
      <div className="grow">
        <Editable
          text={loop.text}
          className={closed ? 'muted line-through' : ''}
          onSave={(text) => vault.update('loop', loop.id, { text })}
          onDelete={() => void vault.remove(loop.id)}
        >
          {loop.text}
          {loop.dueDate && <span className="muted ml-2 no-underline">{whenLabel(loop.dueDate)}</span>}
        </Editable>
      </div>
    </div>
  )
}

/** One optional line after ticking a loop, kept as something good to know. */
function AnswerForm({ loop, onDone }: { loop: OpenLoop; onDone: () => void }) {
  const vault = useVault()
  const [answer, setAnswer] = useState('')
  const { error, run } = useInstant()

  function keep(event: React.FormEvent) {
    event.preventDefault()
    const text = answer.trim()
    onDone()
    if (text) run(() => vault.create('fact', { personId: loop.personId, text }))
  }

  return (
    <form
      onSubmit={keep}
      className="flex flex-col gap-2 rounded-lg bg-slate-100 p-3 dark:bg-slate-900"
      data-testid="answer"
    >
      <p className="muted line-through">{loop.text}</p>
      <input
        className="input"
        placeholder="What they said (optional)"
        aria-label="What they said"
        autoFocus
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="textbtn"
          onClick={() => {
            void vault.update('loop', loop.id, { status: 'open' })
            onDone()
          }}
        >
          Reopen
        </button>
        <span className="flex items-center gap-3">
          <button type="button" className="textbtn" onClick={onDone}>
            Skip
          </button>
          <button className="btn btn-primary py-1" disabled={!answer.trim()}>
            Keep
          </button>
        </span>
      </div>
    </form>
  )
}

function Facts({ personId }: { personId: string }) {
  const vault = useVault()
  const [text, setText] = useState('')
  const { error, run } = useInstant()
  const facts = vault
    .all('fact')
    .filter((fact) => fact.personId === personId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  function add(event: React.FormEvent) {
    event.preventDefault()
    const entry = text.trim()
    if (!entry) return
    setText('')
    run(() => vault.create('fact', { personId, text: entry }), () => setText(entry))
  }

  return (
    <div className="flex flex-col gap-2" data-testid="facts">
      <h2 className="section-title mb-0">Good to know</h2>
      {facts.map((fact) => (
        <Editable
          key={fact.id}
          text={fact.text}
          onSave={(text) => vault.update('fact', fact.id, { text })}
          onDelete={() => void vault.remove(fact.id)}
        />
      ))}
      {error && <ErrorText>{error}</ErrorText>}
      <Reveal label="Add something good to know">
        {(close) => (
          <form onSubmit={add} className="flex gap-2">
            <input
              className="input"
              placeholder="e.g. Barracks for Carlton"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="btn shrink-0" disabled={!text.trim()}>
              Add
            </button>
            <button type="button" className="textbtn shrink-0" onClick={close}>
              Done
            </button>
          </form>
        )}
      </Reveal>
    </div>
  )
}

function Household({ personId, relations }: { personId: string; relations: Relation[] }) {
  const vault = useVault()
  const [text, setText] = useState('')
  const { error, run } = useInstant()
  const home = household(relations)
  const kids = childrenOf(vault.all('child'), personId)

  function add(event: React.FormEvent) {
    event.preventDefault()
    const entry = text.trim()
    if (!entry) return
    setText('')
    run(() => addChild(vault, personId, entry), () => setText(entry))
  }

  return (
    <div className="flex flex-col gap-2" data-testid="household">
      <h2 className="section-title mb-0">Household</h2>
      {home.length > 0 && (
        <ul>
          {home.map((relation) => (
            <li key={relation.link.id}>
              <RelationLine relation={relation} />
            </li>
          ))}
        </ul>
      )}
      {kids.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="muted">Kids</span>
          {kids.map((child) => (
            <Editable
              key={child.id}
              text={child.born ? `${child.name} ${child.born}` : child.name}
              deleteLabel="Remove"
              onSave={(value) => {
                const parsed = parseChild(value)
                if (parsed) return vault.update('child', child.id, { name: parsed.name, born: parsed.born })
              }}
              onDelete={() => void vault.remove(child.id)}
            >
              {childLabel(child)}
            </Editable>
          ))}
        </div>
      )}
      {error && <ErrorText>{error}</ErrorText>}
      <Reveal label="Add a child">
        {(close) => (
          <form onSubmit={add} className="flex flex-col gap-1">
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Name, or name and birth year"
                aria-label="Child's name"
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button className="btn shrink-0" disabled={!text.trim()}>
                Add child
              </button>
              <button type="button" className="textbtn shrink-0" onClick={close}>
                Done
              </button>
            </div>
            <p className="muted">Kids also show on the card of anyone linked as a partner.</p>
          </form>
        )}
      </Reveal>
    </div>
  )
}

function RelationLine({ relation }: { relation: Relation }) {
  const vault = useVault()
  const other = vault.get('person', relation.otherId)
  if (!other) return null
  const age = ageLabel(other.born)
  return (
    <span>
      <Link to={`/person/${other.id}`} className="font-medium underline">
        {other.name}
      </Link>
      {age && <span className="ml-1">({age})</span>}
      <span className="muted ml-2">{relation.label}</span>
    </span>
  )
}

function NoteForm({ personId }: { personId: string }) {
  const vault = useVault()
  const [text, setText] = useState('')
  const [date, setDate] = useState(todayIso())
  const [sensitive, setSensitive] = useState(false)
  const [focused, setFocused] = useState(false)
  const [skipped, setSkipped] = useState<string[]>([])
  const { error, run } = useInstant()
  const form = useRef<HTMLFormElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const inView = useInView(form)
  const active = focused || text.trim().length > 0

  const existing = new Set(
    openLoops(vault.all('loop'), personId).map((loop) => loop.text.toLowerCase()),
  )
  const questions = questionsIn(text).filter((question) => !existing.has(question.toLowerCase()))
  const toAsk = questions.filter((question) => !skipped.includes(question))

  function save(event: React.FormEvent) {
    event.preventDefault()
    const entry = { text: text.trim(), date, sensitive, toAsk }
    if (!entry.text) return
    setText('')
    setSensitive(false)
    setDate(todayIso())
    setSkipped([])
    textarea.current?.blur()
    run(
      async () => {
        const note = await vault.create('note', {
          personId,
          date: entry.date,
          text: entry.text,
          sensitive: entry.sensitive,
        })
        for (const question of entry.toAsk) {
          await vault.create('loop', { personId, text: question, status: 'open', sourceNoteId: note.id })
        }
      },
      () => {
        setText(entry.text)
        setSensitive(entry.sensitive)
        setDate(entry.date)
      },
    )
  }

  return (
    <>
      <form ref={form} onSubmit={save} className="card flex flex-col gap-2" data-testid="note-form">
        <textarea
          ref={textarea}
          className="input"
          rows={active ? 5 : 2}
          placeholder="What did you talk about?"
          aria-label="New note"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {active && (
          <>
            {questions.length > 0 && (
              <fieldset className="flex flex-col gap-1" data-testid="note-questions">
                <legend className="muted mb-1">Add to Ask about</legend>
                {questions.map((question) => (
                  <label key={question} className="-my-1.5 flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={!skipped.includes(question)}
                      onChange={(e) =>
                        setSkipped(
                          e.target.checked
                            ? skipped.filter((item) => item !== question)
                            : [...skipped, question],
                        )
                      }
                    />
                    {question}
                  </label>
                ))}
              </fieldset>
            )}
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
              {toAsk.length > 0
                ? `Save note and ${toAsk.length === 1 ? '1 thing' : `${toAsk.length} things`} to ask`
                : 'Save note'}
            </button>
          </>
        )}
        {error && <ErrorText>{error}</ErrorText>}
      </form>
      {!inView && !active && (
        <button
          type="button"
          className="btn btn-primary fixed right-4 bottom-4 z-10 rounded-full px-4 py-3 shadow-lg"
          onClick={() => {
            form.current?.scrollIntoView({ block: 'center' })
            textarea.current?.focus({ preventScroll: true })
          }}
        >
          Write a note
        </button>
      )}
    </>
  )
}

/** Whether the element is at least partly on screen. */
function useInView(ref: React.RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return inView
}

const NEW_PERSON = 'new'

function Connections({ person, relations }: { person: Person; relations: Relation[] }) {
  const vault = useVault()
  const [role, setRole] = useState<Role>('partner')
  const [otherId, setOtherId] = useState(NEW_PERSON)
  const [newName, setNewName] = useState('')
  const [selectedId, setSelectedId] = useState<string>()
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
      targetId = (
        await vault.create('person', {
          name: newName.trim(),
          circle: false,
          // A colleague's partner belongs with the colleague, not among personal contacts.
          space: person.space,
          tags: [],
        })
      ).id
    }
    if (!(await connect(vault, person.id, targetId, role))) {
      return setError('That connection is already recorded.')
    }
    setNewName('')
    setOtherId(NEW_PERSON)
  }

  return (
    <section className="card flex flex-col gap-2" data-testid="connections">
      <h2 className="section-title">Connections</h2>
      {relations.length === 0 && <p className="muted">No one linked yet.</p>}
      <ul className="flex flex-col gap-1">
        {relations.map((relation) => (
          <ConnectionRow
            key={relation.link.id}
            relation={relation}
            selected={selectedId === relation.link.id}
            onSelect={() => setSelectedId(selectedId === relation.link.id ? undefined : relation.link.id)}
          />
        ))}
      </ul>
      <Reveal label="Add a connection">
        {(close) => (
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
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              )}
              <button className="btn shrink-0" disabled={otherId === NEW_PERSON && !newName.trim()}>
                Add connection
              </button>
              <button type="button" className="textbtn shrink-0" onClick={close}>
                Done
              </button>
            </div>
            {error && <ErrorText>{error}</ErrorText>}
          </form>
        )}
      </Reveal>
    </section>
  )
}

/** Tap a connection for its controls, like every other line in the app. */
function ConnectionRow({
  relation,
  selected,
  onSelect,
}: {
  relation: Relation
  selected: boolean
  onSelect: () => void
}) {
  const vault = useVault()
  const other = vault.get('person', relation.otherId)
  if (!other) return null
  const age = ageLabel(other.born)
  return (
    <li className="flex flex-col gap-1">
      <button
        type="button"
        className="-my-1.5 flex min-h-11 items-center text-left"
        aria-expanded={selected}
        onClick={onSelect}
      >
        <span className="font-medium">{other.name}</span>
        {age && <span className="ml-1">({age})</span>}
        <span className="muted ml-2">{relation.label}</span>
      </button>
      {selected && (
        <span className="flex gap-4">
          <Link to={`/person/${other.id}`} className="textbtn">
            Open
          </Link>
          {canEnd(relation.role) && (
            <button
              type="button"
              className="textbtn"
              onClick={() => void vault.update('link', relation.link.id, { ended: !relation.link.ended })}
            >
              {relation.link.ended ? 'Current again' : 'Ended'}
            </button>
          )}
          <ConfirmButton
            label="Remove"
            confirmLabel="Tap again"
            className="textbtn textbtn-danger"
            onConfirm={() => void vault.remove(relation.link.id)}
          />
        </span>
      )}
    </li>
  )
}

function Notes({ personId }: { personId: string }) {
  const vault = useVault()
  const notes = notesFor(vault, personId)
  if (notes.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h2 className="section-title">All notes ({notes.length})</h2>
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
        <span className="muted">{whenLabel(note.date)}</span>
        {note.sensitive && !editing && <SensitiveBadge />}
      </div>
      {editing ? (
        <>
          <textarea
            className="input"
            rows={5}
            aria-label="Note text"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <SensitiveToggle checked={sensitive} onChange={setSensitive} />
          <div className="flex items-center justify-between gap-2">
            <ConfirmButton
              label="Delete"
              confirmLabel="Tap again to delete"
              className="textbtn textbtn-danger"
              onConfirm={() => void vault.remove(note.id)}
            />
            <span className="flex gap-3">
              <button type="button" className="textbtn" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary py-1" onClick={() => void save()}>
                Save
              </button>
            </span>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="text-left whitespace-pre-wrap"
          onClick={() => {
            setText(note.text)
            setSensitive(note.sensitive)
            setEditing(true)
          }}
        >
          {note.text}
        </button>
      )}
    </article>
  )
}
