import { Directory, File, Paths } from 'expo-file-system'
import type { AppData } from '../types'
import type { QueuedPhoto, QueueItem, SyncProblem } from './queue'

// Per-user files in the document directory (kept by iOS, unlike caches). /state is several MB, too big for
// SecureStore. The queue survives sign-out on purpose: work recorded offline must reach the server.

const dir = () => {
  const d = new Directory(Paths.document, 'offline')
  d.create({ intermediates: true, idempotent: true })
  return d
}
const photoDir = () => {
  const d = new Directory(Paths.document, 'offline', 'photos')
  d.create({ intermediates: true, idempotent: true })
  return d
}
const safe = (userId: string) => userId.replace(/[^\w-]/g, '_')

async function readJson<T>(name: string): Promise<T | null> {
  try {
    const f = new File(dir(), name)
    return f.exists ? (JSON.parse(await f.text()) as T) : null
  } catch {
    return null
  }
}

async function writeJson(name: string, value: unknown) {
  try {
    const f = new File(dir(), name)
    if (!f.exists) f.create()
    await f.write(JSON.stringify(value))
  } catch {
    // A failed write only loses the offline copy; the server stays the source of truth.
  }
}

export const loadSnapshot = (userId: string) => readJson<{ data: AppData; loadedAt: number }>(`snapshot_${safe(userId)}.json`)
export const saveSnapshot = (userId: string, data: AppData, loadedAt: number) => writeJson(`snapshot_${safe(userId)}.json`, { data, loadedAt })

export const loadQueue = async (userId: string) => (await readJson<QueueItem[]>(`queue_${safe(userId)}.json`)) || []
export const saveQueue = (userId: string, items: QueueItem[]) => writeJson(`queue_${safe(userId)}.json`, items)

export const loadProblems = async (userId: string) => (await readJson<SyncProblem[]>(`problems_${safe(userId)}.json`)) || []
export const saveProblems = (userId: string, items: SyncProblem[]) => writeJson(`problems_${safe(userId)}.json`, items)

// Queued photos are kept as files so a large queue does not have to be rewritten with every change.
export function savePhoto(dataUrl: string, name: string): QueuedPhoto {
  const f = new File(photoDir(), `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.txt`)
  f.create()
  f.writeSync(dataUrl)
  return { file: f.name, name }
}

export const readPhoto = (p: QueuedPhoto) => new File(photoDir(), p.file).text()

export function deletePhoto(p: QueuedPhoto) {
  try {
    const f = new File(photoDir(), p.file)
    if (f.exists) f.delete()
  } catch {
    // already gone
  }
}
