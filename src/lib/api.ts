import { API_BASE } from './config'
import type { AppData, User } from './types'

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

async function request<T>(path: string, token: string | null, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(API_BASE + '/api' + path, {
      method: body === undefined ? 'GET' : 'POST',
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
    pickups: d.pickups || [],
  }
}

export const sync = (token: string, payload: { upserts: Record<string, unknown[]>; deletes?: Record<string, string[]>; seq: Record<string, number> }) =>
  request<{ ok: true }>('/sync', token, payload)
