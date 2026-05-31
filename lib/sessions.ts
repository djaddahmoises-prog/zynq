export type SessionType = 'class' | 'meeting' | 'business' | 'workshop'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface GeneratedContent {
  type: string
  label: string
  content: string
  createdAt: string
}

export interface Session {
  id: string
  name: string
  type: SessionType
  createdAt: string
  duration: number
  transcript: string
  images: string[]
  messages: ChatMessage[]
  generated: GeneratedContent[]
  status: 'active' | 'ended'
}

const KEY = 'zynq_sessions'

export function getSessions(): Session[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') }
  catch { return [] }
}

export function getSession(id: string): Session | null {
  return getSessions().find(s => s.id === id) ?? null
}

export function saveSession(session: Session) {
  const all = getSessions()
  const idx = all.findIndex(s => s.id === session.id)
  if (idx >= 0) all[idx] = session
  else all.unshift(session)
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function createSession(name: string, type: SessionType): Session {
  const session: Session = {
    id: crypto.randomUUID(),
    name, type,
    createdAt: new Date().toISOString(),
    duration: 0,
    transcript: '',
    images: [],
    messages: [],
    generated: [],
    status: 'active',
  }
  saveSession(session)
  return session
}

export function deleteSession(id: string) {
  localStorage.setItem(KEY, JSON.stringify(getSessions().filter(s => s.id !== id)))
}

export function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return { mediaType: match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: match[2] }
}

export const SESSION_LABELS: Record<SessionType, string> = {
  class: 'Clase',
  meeting: 'Reunión',
  business: 'Negocio',
  workshop: 'Taller',
}

export const SESSION_ICONS: Record<SessionType, string> = {
  class: '🎓',
  meeting: '📅',
  business: '💼',
  workshop: '🔧',
}

export const SESSION_COLORS: Record<SessionType, string> = {
  class: '#3b82f6',
  meeting: '#22c55e',
  business: '#f59e0b',
  workshop: '#a855f7',
}
