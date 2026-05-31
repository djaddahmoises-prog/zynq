'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Plus, Trash2, ChevronRight, Clock } from 'lucide-react'
import {
  getSessions, createSession, deleteSession,
  Session, SessionType,
  SESSION_ICONS, SESSION_LABELS, SESSION_COLORS,
} from '@/lib/sessions'

const TYPES: { type: SessionType; icon: string; label: string; desc: string }[] = [
  { type: 'class',    icon: '🎓', label: 'Clase',    desc: 'Apuntes de clase o conferencia' },
  { type: 'meeting',  icon: '📅', label: 'Reunión',  desc: 'Minutas y acuerdos' },
  { type: 'business', icon: '💼', label: 'Negocio',  desc: 'Análisis y estrategia' },
  { type: 'workshop', icon: '🔧', label: 'Taller',   desc: 'Workshop o capacitación' },
]

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDuration(s: number) {
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function Home() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<SessionType>('class')

  useEffect(() => { setSessions(getSessions()) }, [])

  const start = () => {
    if (!name.trim()) return
    const s = createSession(name.trim(), type)
    router.push(`/session/${s.id}`)
  }

  const remove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteSession(id)
    setSessions(getSessions())
  }

  return (
    <div className="min-h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-5 h-14 border-b"
        style={{ borderColor: 'var(--border)', background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--accent)', boxShadow: '0 0 18px var(--accent-glow)' }}>
            <Zap size={15} className="text-white" fill="white" />
          </div>
          <span className="font-bold tracking-tight text-white">Zynq</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(124,58,237,0.15)', color: 'var(--accent-light)', border: '1px solid rgba(124,58,237,0.3)' }}>
            Study AI
          </span>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: 'var(--accent)', boxShadow: '0 0 14px var(--accent-glow)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}>
          <Plus size={15} /> Nueva sesión
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 px-5 py-8 max-w-3xl mx-auto w-full">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
              style={{ background: 'linear-gradient(135deg, var(--accent), #a21caf)', boxShadow: '0 0 40px var(--accent-glow)' }}>
              🧠
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-white">Tu asistente de estudio</h1>
              <p style={{ color: 'var(--fg2)' }} className="max-w-sm">
                Graba clases, sube imágenes del pizarrón y genera presentaciones, resúmenes o guías de estudio con IA.
              </p>
            </div>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-white transition-all"
              style={{ background: 'var(--accent)', boxShadow: '0 0 20px var(--accent-glow)' }}>
              <Plus size={18} /> Crear primera sesión
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-white mb-4">Sesiones recientes</h2>
            <div className="space-y-3">
              {sessions.map(s => (
                <div key={s.id} onClick={() => router.push(`/session/${s.id}`)}
                  className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all group"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)' }}>
                  {/* Icon */}
                  <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: SESSION_COLORS[s.type] + '22', border: `1px solid ${SESSION_COLORS[s.type]}44` }}>
                    {SESSION_ICONS[s.type]}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-white truncate">{s.name}</span>
                      <span className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: SESSION_COLORS[s.type] + '22', color: SESSION_COLORS[s.type] }}>
                        {SESSION_LABELS[s.type]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--fg2)' }}>
                      <span>{fmt(s.createdAt)}</span>
                      {s.duration > 0 && <span className="flex items-center gap-1"><Clock size={11} />{fmtDuration(s.duration)}</span>}
                      {s.transcript && <span>{s.transcript.split(' ').length} palabras</span>}
                      {s.images.length > 0 && <span>📷 {s.images.length}</span>}
                      {s.generated.length > 0 && <span>✨ {s.generated.length} generado{s.generated.length > 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={e => remove(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all"
                      style={{ color: 'var(--fg2)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg2)')}>
                      <Trash2 size={15} />
                    </button>
                    <ChevronRight size={16} style={{ color: 'var(--fg2)' }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* New Session Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="w-full max-w-md rounded-3xl p-6 space-y-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border2)' }}>
            <div>
              <h3 className="text-xl font-bold text-white">Nueva sesión</h3>
              <p style={{ color: 'var(--fg2)' }} className="text-sm mt-1">Dale un nombre y tipo a tu sesión</p>
            </div>

            {/* Name */}
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && start()}
              placeholder="Ej: Cálculo diferencial, Reunión de ventas..."
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--fg)' }}
            />

            {/* Type selector */}
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(t => (
                <button key={t.type} onClick={() => setType(t.type)}
                  className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                  style={{
                    background: type === t.type ? SESSION_COLORS[t.type] + '22' : 'var(--surface2)',
                    border: `1px solid ${type === t.type ? SESSION_COLORS[t.type] : 'var(--border)'}`,
                  }}>
                  <span className="text-2xl">{t.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-white">{t.label}</div>
                    <div className="text-xs" style={{ color: 'var(--fg2)' }}>{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'var(--surface2)', color: 'var(--fg2)', border: '1px solid var(--border)' }}>
                Cancelar
              </button>
              <button onClick={start} disabled={!name.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-30"
                style={{ background: 'var(--accent)', boxShadow: '0 0 16px var(--accent-glow)' }}>
                Comenzar →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
