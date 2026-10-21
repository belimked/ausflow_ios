import { API_BASE } from './config'
import type { AppData, Photo, User } from './types'

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

async function request<T>(path: string, token: string | null, body?: unknown, method?: 'DELETE' | 'PATCH'): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(API_BASE + '/api' + path, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Cannot reach the server. Check your internet connection.', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status)
  return data as T
}

export const login = (username: string, password: string) =>
  request<{ token: string; user: User }>('/login', null, { username, password })

export async function fetchState(token: string): Promise<AppData> {
  const res = await request<{ seq: Record<string, number>; data: Record<string, any[]> }>('/state', token)
  const d = res.data
  return {
    seq: res.seq || {},
    companies: d.companies || [],
    locations: d.locations || [],
    devices: d.devices || [],
    drivers: d.drivers || [],
    vehicles: d.vehicles || [],
    facilities: d.facilities || [],
    pickups: d.pickups || [],
    transfers: d.transfers || [],
    unloads: d.unloads || [],
    reportedIssues: d.reportedIssues || [],
  }
}

export interface SyncPayload { upserts: Record<string, unknown[]>; deletes?: Record<string, string[]>; seq: Record<string, number> }

export const sync = (token: string, payload: SyncPayload) => request<{ ok: true }>('/sync', token, payload)

// Photos are stored outside /state; the server only accepts the entity types and kinds in its PHOTO_KINDS list.
export const listPhotos = (token: string, type: string, id: string) =>
  request<Photo[]>(`/photos?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`, token)

export const uploadPhoto = (token: string, photo: { type: string; id: string; kind: string; name?: string; dataUrl: string }) =>
  request<Photo>('/photos', token, photo)

export const deletePhoto = (token: string, id: string) => request<{ ok: true }>(`/photos/${encodeURIComponent(id)}`, token, undefined, 'DELETE')

// Old WasteID "My Details": the current password is always required.
export const updateMe = (token: string, body: { currentPassword: string; displayName?: string; email?: string | null; newPassword?: string }) =>
  request<User & { email?: string | null }>('/me', token, body, 'PATCH')

// Emails a one-time reset link (opened in the browser) when the account has an email address; same answer otherwise.
export const forgotPassword = (login: string) => request<{ ok: true }>('/password/forgot', null, { login })
