import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { childLabel, childrenOf } from '../lib/children'
import { formatDate, todayIso } from '../lib/dates'
import { relationsOf } from '../lib/links'
import { MAP_SECTIONS, type SectionInfo, sectionInfo } from '../lib/map'
import type { MapEntry, MapSection, Person, Question } from '../lib/model'
import {
  BackLink,
  Editable,
  Page,
  Reveal,
  SensitiveBadge,
  SensitiveToggle,
  useVault,
} from './common'

export default function MapPage() {
  const { id = '' } = useParams()
  const vault = useVault()
  const person = vault.get('person', id)
  const [quizzing, setQuizzing] = useState(false)

  if (!person?.hasMap) {
    return (
      <Page>
        <BackLink to="/" />
        <p>There is no love map here.</p>
      </Page>
    )
  }

  const entries = vault.all('mapEntry').filter((entry) => entry.personId === person.id)
  const current = entries.filter((entry) => entry.status === 'current')
  const past = entries
    .filter((entry) => entry.status === 'resolved')
    .sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? ''))

  return (
    <Page>
      <BackLink to={`/person/${person.id}`} label={person.name} />
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Love map</h1>
        <button
          type="button"
          className="btn"
          disabled={current.length === 0}
          onClick={() => setQuizzing(!quizzing)}
        >
          {quizzing ? 'Close quiz' : 'Quiz me'}
        </button>
      </header>

      {quizzing ? (
        <Quiz person={person} current={current} />
      ) : (
        <>
          <Cast person={person} />
          {MAP_SECTIONS.map((section) => (
            <Section
              key={section.id}
              section={section}
              personId={person.id}
              entries={current.filter((entry) => entry.section === section.id)}
            />
          ))}
          <Questions personId={person.id} />
          {past.length > 0 && (
            <details className="card">
              <summary className="section-title cursor-pointer">Timeline ({past.length})</summary>
              <ul className="mt-2 flex flex-col gap-3">
                {past.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-2">
                    <span>
                      <span className="muted block">
                        {sectionInfo(entry.section).title} · {formatDate(entry.date)}
                        {entry.resolvedAt && ` to ${formatDate(entry.resolvedAt)}`}
                      </span>
                      {entry.text}
                    </span>
                    <button
                      type="button"
                      className="muted shrink-0 underline"
                      onClick={() =>
                        void vault.update('mapEntry', entry.id, {
                          status: 'current',
                          resolvedAt: undefined,
                        })
                      }
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </Page>
  )
}

function Cast({ person }: { person: Person }) {
  const vault = useVault()
  const relations = relationsOf(vault.all('link'), person.id)
  const kids = childrenOf(vault.all('child'), person.id)
  return (
    <section className="card flex flex-col gap-2">
      <h2 className="section-title">Cast of characters</h2>
      {relations.length === 0 && kids.length === 0 && (
        <p className="muted">
          No one linked yet.{' '}
          <Link to={`/person/${person.id}`} className="underline">
            Add family, friends and colleagues under Connections.
          </Link>
        </p>
      )}
      {kids.length > 0 && (
        <p>
          <span className="muted mr-2">Kids</span>
          {kids.map((child) => childLabel(child)).join(', ')}
        </p>
      )}
      {relations.length > 0 && (
        <ul>
          {relations.map((relation) => {
            const other = vault.get('person', relation.otherId)
            if (!other) return null
            return (
              <li key={relation.link.id}>
                <Link to={`/person/${other.id}`} className="font-medium underline">
                  {other.name}
                </Link>
                <span className="muted ml-2">{relation.label}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Section({
  section,
  personId,
  entries,
}: {
  section: SectionInfo
  personId: string
  entries: MapEntry[]
}) {
  const vault = useVault()
  const [text, setText] = useState('')
  const [sensitive, setSensitive] = useState(false)

  async function add(event: React.FormEvent) {
    event.preventDefault()
    if (!text.trim()) return
    await vault.create('mapEntry', {
      personId,
      section: section.id,
      text: text.trim(),
      date: todayIso(),
      status: 'current',
      sensitive,
    })
    setText('')
    setSensitive(false)
  }

  return (
    <section className="card flex flex-col gap-2" data-testid={`map-${section.id}`}>
      <h2 className="section-title">{section.title}</h2>
      {entries.length === 0 && <p className="muted">{section.placeholder}.</p>}
      {[...entries]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((entry) => (
          <div key={entry.id} className="flex items-start justify-between gap-3">
            <div className="grow">
              <Editable
                text={entry.text}
                onSave={(value) => vault.update('mapEntry', entry.id, { text: value })}
                onDelete={() => void vault.remove(entry.id)}
              >
                <span className="block whitespace-pre-wrap">{entry.text}</span>
                <span className="muted">
                  {formatDate(entry.date)}
                  {entry.sensitive && (
                    <span className="ml-2">
                      <SensitiveBadge />
                    </span>
                  )}
                </span>
              </Editable>
            </div>
            <button
              type="button"
              className="muted mt-0.5 shrink-0 underline"
              aria-label={`Done: ${entry.text}`}
              onClick={() =>
                void vault.update('mapEntry', entry.id, {
                  status: 'resolved',
                  resolvedAt: todayIso(),
                })
              }
            >
              Done
            </button>
          </div>
        ))}
      <Reveal label="Add">
        {(close) => (
          <form onSubmit={add} className="flex flex-col gap-2">
            <input
              className="input"
              placeholder={section.placeholder}
              aria-label={`Add to ${section.title}`}
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex items-center justify-between gap-2">
              <SensitiveToggle checked={sensitive} onChange={setSensitive} />
              <span className="flex items-center gap-3">
                <button type="button" className="muted underline" onClick={close}>
                  Done
                </button>
                <button className="btn" disabled={!text.trim()}>
                  Add
                </button>
              </span>
            </div>
          </form>
        )}
      </Reveal>
    </section>
  )
}

function Questions({ personId }: { personId: string }) {
  const vault = useVault()
  const [text, setText] = useState('')
  const [section, setSection] = useState<MapSection>('hopes')
  const questions = vault
    .all('question')
    .filter((question) => question.personId === personId && question.status === 'toAsk')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  async function add(event: React.FormEvent) {
    event.preventDefault()
    if (!text.trim()) return
    await vault.create('question', { personId, text: text.trim(), section, status: 'toAsk' })
    setText('')
  }

  return (
    <section className="card flex flex-col gap-3">
      <h2 className="section-title">Questions to ask</h2>
      {questions.length === 0 && (
        <p className="muted">Things you want to ask next time. Logging the answer files it in the map.</p>
      )}
      {questions.map((question) => (
        <QuestionItem key={question.id} question={question} />
      ))}
      <Reveal label="Add a question">
        {(close) => (
          <form onSubmit={add} className="flex flex-col gap-2">
            <input
              className="input"
              placeholder="Something you want to ask"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex gap-2">
              <select
                className="input"
                aria-label="Section the answer belongs in"
                value={section}
                onChange={(e) => setSection(e.target.value as MapSection)}
              >
                {MAP_SECTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title}
                  </option>
                ))}
              </select>
              <button className="btn shrink-0" disabled={!text.trim()}>
                Add
              </button>
              <button type="button" className="muted shrink-0 underline" onClick={close}>
                Done
              </button>
            </div>
          </form>
        )}
      </Reveal>
    </section>
  )
}

function QuestionItem({ question }: { question: Question }) {
  const vault = useVault()
  const [answer, setAnswer] = useState('')
  const [answering, setAnswering] = useState(false)
  const section = question.section ?? 'innerWorld'

  async function logAnswer(event: React.FormEvent) {
    event.preventDefault()
    if (!answer.trim()) return
    await vault.create('mapEntry', {
      personId: question.personId,
      section,
      text: answer.trim(),
      date: todayIso(),
      status: 'current',
      sensitive: false,
    })
    await vault.update('question', question.id, { status: 'asked' })
  }

  return (
    <div className="flex flex-col gap-2">
      <Editable
        text={question.text}
        deleteLabel="Remove"
        onSave={(text) => vault.update('question', question.id, { text })}
        onDelete={() => void vault.remove(question.id)}
      >
        {question.text}
        <span className="muted ml-2">{sectionInfo(section).title}</span>
      </Editable>
      {answering ? (
        <form onSubmit={logAnswer} className="flex gap-2">
          <input
            className="input"
            placeholder="What you learned"
            aria-label="Answer"
            autoFocus
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <button className="btn shrink-0" disabled={!answer.trim()}>
            Save
          </button>
        </form>
      ) : (
        <button type="button" className="muted self-start underline" onClick={() => setAnswering(true)}>
          Log the answer
        </button>
      )}
    </div>
  )
}

function Quiz({ person, current }: { person: Person; current: MapEntry[] }) {
  const filled = MAP_SECTIONS.filter((section) =>
    current.some((entry) => entry.section === section.id),
  )
  const [index, setIndex] = useState(() => Math.floor(Math.random() * filled.length))
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const section = filled[index % filled.length]
  const firstName = person.name.split(/\s+/)[0]

  return (
    <section className="card flex flex-col gap-3">
      <h2 className="text-lg font-medium">{section.quiz(firstName)}</h2>
      <textarea
        className="input"
        rows={3}
        placeholder="Answer from memory. This is not saved."
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />
      {revealed ? (
        <>
          <div>
            <h3 className="section-title">What you have recorded</h3>
            <ul className="list-disc pl-5">
              {current
                .filter((entry) => entry.section === section.id)
                .map((entry) => (
                  <li key={entry.id}>{entry.text}</li>
                ))}
            </ul>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setIndex(index + 1)
              setAnswer('')
              setRevealed(false)
            }}
          >
            Next question
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => setRevealed(true)}>
          Reveal
        </button>
      )}
    </section>
  )
}
