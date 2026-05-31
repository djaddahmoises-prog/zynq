'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronRight, Clock, Mic, ImageIcon, Sparkles } from 'lucide-react'
import {
  getSessions, createSession, deleteSession,
  Session, SessionType,
  SESSION_LABELS, SESSION_COLORS,
} from '@/lib/sessions'

const TYPES: { type: SessionType; label: string; desc: string }[] = [
  { type: 'class',    label: 'Clase',    desc: 'Apuntes de clase o conferencia' },
  { type: 'meeting',  label: 'Reunión',  desc: 'Minutas y acuerdos' },
  { type: 'business', label: 'Negocio',  desc: 'Análisis y estrategia' },
  { type: 'workshop', label: 'Taller',   desc: 'Workshop o capacitación' },
]

function fmtDate(iso: string) {
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
    <div className="min-h-full" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-2xl mx-auto px-5 h-14 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--fg)' }}>Zynq</span>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ background: 'var(--aqua)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--aqua-dark)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--aqua)')}>
            <Plus size={15} strokeWidth={2.5} />
            Nueva sesión
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-5 py-10">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--aqua-bg)', border: '1px solid var(--aqua-muted)' }}>
              <Sparkles size={24} style={{ color: 'var(--aqua)' }} strokeWidth={1.5} />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>Tu asistente de estudio</h1>
              <p className="text-sm max-w-xs leading-relaxed" style={{ color: 'var(--fg2)' }}>
                Graba clases, sube fotos del pizarrón y genera presentaciones, guías y resúmenes con IA.
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ background: 'var(--aqua)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--aqua-dark)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--aqua)')}>
              <Plus size={15} strokeWidth={2.5} />
              Crear primera sesión
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--fg3)' }}>
              Sesiones recientes
            </h2>
            {sessions.map(s => (
              <div
                key={s.id}
                onClick={() => router.push(`/session/${s.id}`)}
                className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all group"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>

                {/* Type bar */}
                <div className="w-1 h-10 rounded-full shrink-0" style={{ background: SESSION_COLORS[s.type] }} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold truncate" style={{ color: 'var(--fg)', fontSize: 14 }}>{s.name}</span>
                    <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded"
                      style={{ background: SESSION_COLORS[s.type] + '18', color: SESSION_COLORS[s.type] }}>
                      {SESSION_LABELS[s.type]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--fg3)' }}>
                    <span>{fmtDate(s.createdAt)}</span>
                    {s.duration > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {fmtDuration(s.duration)}
                      </span>
                    )}
                    {s.transcript && (
                      <span className="flex items-center gap-1">
                        <Mic size={11} /> {s.transcript.split(' ').filter(Boolean).length} palabras
                      </span>
                    )}
                    {s.images.length > 0 && (
                      <span className="flex items-center gap-1">
                        <ImageIcon size={11} /> {s.images.length}
                      </span>
                    )}
                    {s.generated.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Sparkles size={11} /> {s.generated.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={e => remove(s.id, e)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    style={{ color: 'var(--fg3)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg3)')}>
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight size={16} style={{ color: 'var(--fg3)' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Session Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)' }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--fg)' }}>Nueva sesión</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--fg2)' }}>Dale un nombre y tipo a tu sesión</p>
            </div>

            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && start()}
              placeholder="Ej: Cálculo diferencial, Reunión de ventas..."
              className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--fg)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--aqua)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />

            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(t => (
                <button
                  key={t.type}
                  onClick={() => setType(t.type)}
                  className="p-3.5 rounded-xl text-left transition-all"
                  style={{
                    background: type === t.type ? 'var(--aqua-bg)' : 'var(--surface2)',
                    border: `1px solid ${type === t.type ? 'var(--aqua-muted)' : 'var(--border)'}`,
                  }}>
                  <div className="text-sm font-semibold mb-0.5" style={{ color: type === t.type ? 'var(--aqua-dark)' : 'var(--fg)' }}>
                    {t.label}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--fg3)' }}>{t.desc}</div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{ background: 'var(--surface2)', color: 'var(--fg2)', border: '1px solid var(--border)' }}>
                Cancelar
              </button>
              <button
                onClick={start}
                disabled={!name.trim()}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40"
                style={{ background: 'var(--aqua)' }}
                onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = 'var(--aqua-dark)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--aqua)')}>
                Comenzar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
