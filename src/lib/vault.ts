import Dexie, { type Table } from 'dexie'
import {
  type Bytes,
  type Sealed,
  deriveKey,
  fromB64,
  importDataKey,
  newRecoveryKey,
  normaliseRecoveryKey,
  open,
  openJson,
  randomBytes,
  seal,
  sealJson,
  toB64,
} from './crypto'
import type { AnyRecord, Fields, RecordMap, RecordType } from './model'

interface Row {
  id: string
  type: RecordType
  updatedAt: string
  deleted: 0 | 1
  iv: Bytes
  ct: Bytes
}

interface VaultMeta {
  version: 1
  iterations: number
  passSalt: Bytes
  passWrap: Sealed
  recSalt: Bytes
  recWrap: Sealed
}

interface MetaRow {
  key: string
  value: unknown
}

class PeopleDb extends Dexie {
  records!: Table<Row, string>
  meta!: Table<MetaRow, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({ records: 'id, type', meta: 'key' })
  }
}

export class WrongSecretError extends Error {}
export class BackupFormatError extends Error {}

export type VaultStatus = 'uninitialised' | 'locked' | 'unlocked'

export const MIN_PASSPHRASE_LENGTH = 8

// Readable inside a backup file, so it carries the app's public name.
const BACKUP_APP_ID = 'atlas'

/**
 * Every record is encrypted with a random data key. That key is stored twice,
 * wrapped once by the passphrase and once by the recovery key, so either can
 * unlock and the passphrase can change without re-encrypting the records.
 */
export class Vault {
  status: VaultStatus = 'locked'
  private db: PeopleDb
  private key: CryptoKey | null = null
  private records = new Map<string, AnyRecord>()
  private listeners = new Set<() => void>()
  private version = 0

  constructor(
    dbName = 'people',
    private iterations = 600_000,
  ) {
    this.db = new PeopleDb(dbName)
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): number => this.version

  private changed(): void {
    this.version++
    for (const listener of this.listeners) listener()
  }

  async init(): Promise<void> {
    this.status = (await this.readMeta()) ? 'locked' : 'uninitialised'
    this.changed()
  }

  private async readMeta(): Promise<VaultMeta | undefined> {
    return (await this.db.meta.get('vault'))?.value as VaultMeta | undefined
  }

  /** Returns the recovery key. It is shown once and never stored in readable form. */
  async setup(passphrase: string): Promise<string> {
    if (await this.readMeta()) throw new Error('Vault already set up')
    const raw = randomBytes(32)
    const recoveryKey = newRecoveryKey()
    const passSalt = randomBytes(16)
    const recSalt = randomBytes(16)
    const meta: VaultMeta = {
      version: 1,
      iterations: this.iterations,
      passSalt,
      passWrap: await seal(await deriveKey(passphrase, passSalt, this.iterations), raw),
      recSalt,
      recWrap: await seal(
        await deriveKey(normaliseRecoveryKey(recoveryKey), recSalt, this.iterations),
        raw,
      ),
    }
    await this.db.meta.put({ key: 'vault', value: meta })
    await this.load(raw)
    return recoveryKey
  }

  async unlock(passphrase: string): Promise<void> {
    const meta = await this.requireMeta()
    const raw = await unwrap(passphrase, meta.passSalt, meta.iterations, meta.passWrap)
    await this.load(raw)
  }

  async recover(recoveryKey: string, newPassphrase: string): Promise<void> {
    const meta = await this.requireMeta()
    const raw = await unwrap(
      normaliseRecoveryKey(recoveryKey),
      meta.recSalt,
      meta.iterations,
      meta.recWrap,
    )
    const passSalt = randomBytes(16)
    const passWrap = await seal(await deriveKey(newPassphrase, passSalt, meta.iterations), raw)
    await this.db.meta.put({ key: 'vault', value: { ...meta, passSalt, passWrap } })
    await this.load(raw)
  }

  private async requireMeta(): Promise<VaultMeta> {
    const meta = await this.readMeta()
    if (!meta) throw new Error('Vault is not set up')
    return meta
  }

  private async load(raw: Bytes): Promise<void> {
    const key = await importDataKey(raw)
    const rows = await this.db.records.toArray()
    const records = new Map<string, AnyRecord>()
    for (const row of rows) {
      if (row.deleted) continue
      records.set(row.id, await openJson<AnyRecord>(key, row))
    }
    this.key = key
    this.records = records
    this.status = 'unlocked'
    this.changed()
  }

  lock(): void {
    this.key = null
    this.records = new Map()
    this.status = 'locked'
    this.changed()
  }

  all<K extends RecordType>(type: K): RecordMap[K][] {
    const found: RecordMap[K][] = []
    for (const record of this.records.values()) {
      if (record.type === type) found.push(record as RecordMap[K])
    }
    return found
  }

  get<K extends RecordType>(type: K, id: string): RecordMap[K] | undefined {
    const record = this.records.get(id)
    return record?.type === type ? (record as RecordMap[K]) : undefined
  }

  async create<K extends RecordType>(type: K, fields: Fields<K>): Promise<RecordMap[K]> {
    const now = new Date().toISOString()
    const record = {
      ...fields,
      type,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    } as unknown as RecordMap[K]
    await this.write(record)
    return record
  }

  async update<K extends RecordType>(
    type: K,
    id: string,
    patch: Partial<Fields<K>>,
  ): Promise<RecordMap[K]> {
    const existing = this.get(type, id)
    if (!existing) throw new Error(`No ${type} with id ${id}`)
    const record = { ...existing, ...patch, updatedAt: new Date().toISOString() }
    await this.write(record)
    return record
  }

  private async write(record: AnyRecord): Promise<void> {
    const sealed = await sealJson(this.requireKey(), record)
    await this.db.records.put({
      id: record.id,
      type: record.type,
      updatedAt: record.updatedAt,
      deleted: 0,
      ...sealed,
    })
    this.records.set(record.id, record)
    this.changed()
  }

  /** Leaves a tombstone with no content so a later sync can propagate the delete. */
  async remove(id: string): Promise<void> {
    const record = this.records.get(id)
    if (!record) return
    const updatedAt = new Date().toISOString()
    const sealed = await sealJson(this.requireKey(), { id, type: record.type, updatedAt })
    await this.db.records.put({ id, type: record.type, updatedAt, deleted: 1, ...sealed })
    this.records.delete(id)
    this.changed()
  }

  private requireKey(): CryptoKey {
    if (!this.key) throw new Error('Vault is locked')
    return this.key
  }

  /** The backup holds the same encrypted rows as the device; it needs the passphrase to read. */
  async exportBackup(): Promise<string> {
    const meta = await this.requireMeta()
    const rows = await this.db.records.toArray()
    return JSON.stringify({
      app: BACKUP_APP_ID,
      format: 1,
      exportedAt: new Date().toISOString(),
      vault: {
        version: meta.version,
        iterations: meta.iterations,
        passSalt: toB64(meta.passSalt),
        passWrap: sealedToB64(meta.passWrap),
        recSalt: toB64(meta.recSalt),
        recWrap: sealedToB64(meta.recWrap),
      },
      records: rows.map((row) => ({
        id: row.id,
        type: row.type,
        updatedAt: row.updatedAt,
        deleted: row.deleted,
        ...sealedToB64(row),
      })),
    })
  }

  async markExported(): Promise<void> {
    await this.db.meta.put({ key: 'lastExportAt', value: new Date().toISOString() })
    this.changed()
  }

  async lastExportAt(): Promise<string | undefined> {
    return (await this.db.meta.get('lastExportAt'))?.value as string | undefined
  }

  /** Replaces everything on this device, then locks: the backup's own passphrase unlocks it. */
  async importBackup(json: string): Promise<void> {
    let meta: VaultMeta
    let rows: Row[]
    try {
      const data = JSON.parse(json)
      if (data.app !== BACKUP_APP_ID || data.format !== 1) throw new Error('Unrecognised backup')
      meta = {
        version: 1,
        iterations: requireNumber(data.vault.iterations),
        passSalt: fromB64(data.vault.passSalt),
        passWrap: sealedFromB64(data.vault.passWrap),
        recSalt: fromB64(data.vault.recSalt),
        recWrap: sealedFromB64(data.vault.recWrap),
      }
      rows = (data.records as Record<string, unknown>[]).map((row) => ({
        id: requireString(row.id),
        type: requireString(row.type) as RecordType,
        updatedAt: requireString(row.updatedAt),
        deleted: row.deleted ? 1 : 0,
        ...sealedFromB64(row as { iv: string; ct: string }),
      }))
    } catch {
      throw new BackupFormatError('This file is not an Atlas backup')
    }
    await this.db.transaction('rw', this.db.records, this.db.meta, async () => {
      await this.db.records.clear()
      await this.db.meta.clear()
      await this.db.meta.put({ key: 'vault', value: meta })
      await this.db.records.bulkPut(rows)
    })
    this.lock()
  }
}

async function unwrap(
  secret: string,
  salt: Bytes,
  iterations: number,
  wrapped: Sealed,
): Promise<Bytes> {
  try {
    return await open(await deriveKey(secret, salt, iterations), wrapped)
  } catch {
    throw new WrongSecretError()
  }
}

function sealedToB64(sealed: Sealed): { iv: string; ct: string } {
  return { iv: toB64(sealed.iv), ct: toB64(sealed.ct) }
}

function sealedFromB64(sealed: { iv: string; ct: string }): Sealed {
  return { iv: fromB64(requireString(sealed.iv)), ct: fromB64(requireString(sealed.ct)) }
}

function requireString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected a string')
  return value
}

function requireNumber(value: unknown): number {
  if (typeof value !== 'number') throw new Error('Expected a number')
  return value
}
