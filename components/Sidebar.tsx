'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Plus, Trash2, Home } from 'lucide-react'
import {
  getSessions, createSession, deleteSession,
  Session, SessionType, SESSION_LABELS, SESSION_COLORS,
} from '@/lib/sessions'

const TYPES: { type: SessionType; label: string; desc: string }[] = [
  { type: 'class',    label: 'Clase',    desc: 'Apuntes de clase' },
  { type: 'meeting',  label: 'Reunión',  desc: 'Minutas y acuerdos' },
  { type: 'business', label: 'Negocio',  desc: 'Análisis y estrategia' },
  { type: 'workshop', label: 'Taller',   desc: 'Workshop o capacitación' },
]

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [sessions, setSessions] = useState<Session[]>([])
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<SessionType>('class')

  const currentId = pathname.startsWith('/session/') ? pathname.split('/')[2] : null

  useEffect(() => { setSessions(getSessions()) }, [pathname])

  const handleCreate = () => {
    if (!name.trim()) return
    const s = createSession(name.trim(), type)
    setSessions(getSessions())
    setShowModal(false)
    setName('')
    setType('class')
    router.push(`/session/${s.id}`)
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteSession(id)
    setSessions(getSessions())
    if (currentId === id) router.push('/')
  }

  return (
    <>
      <aside style={{
        width: 256,
        minWidth: 256,
        height: '100%',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          height: 56,
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <button
            onClick={() => router.push('/')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
              Zynq
            </span>
          </button>
        </div>

        {/* Navigation */}
        <div style={{ padding: '10px 10px 6px', flexShrink: 0 }}>
          <button
            onClick={() => router.push('/')}
            style={{
              width: '100%',
              height: 34,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 10px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              background: pathname === '/' ? 'var(--bg2)' : 'transparent',
              color: pathname === '/' ? 'var(--fg)' : 'var(--fg2)',
            }}
            onMouseEnter={e => { if (pathname !== '/') e.currentTarget.style.background = 'var(--bg2)' }}
            onMouseLeave={e => { if (pathname !== '/') e.currentTarget.style.background = 'transparent' }}>
            <Home size={15} strokeWidth={1.8} />
            Sesiones
          </button>
        </div>

        {/* New session */}
        <div style={{ padding: '4px 10px 10px', flexShrink: 0 }}>
          <button
            onClick={() => setShowModal(true)}
            style={{
              width: '100%',
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              background: 'var(--aqua)',
              color: '#fff',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--aqua-dark)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--aqua)')}>
            <Plus size={14} strokeWidth={2.5} />
            Nueva sesión
          </button>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '0 10px', flexShrink: 0 }} />

        {/* Sessions list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {sessions.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--fg3)', padding: '8px 10px', fontStyle: 'italic' }}>
              Sin sesiones todavía
            </p>
          ) : (
            <>
              <p style={{
                fontSize: 11, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.07em',
                color: 'var(--fg3)', padding: '6px 10px 6px',
              }}>
                Recientes
              </p>
              {sessions.map(s => {
                const active = s.id === currentId
                return (
                  <div
                    key={s.id}
                    onClick={() => router.push(`/session/${s.id}`)}
                    onMouseEnter={() => setHoveredId(s.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 10px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      background: active ? 'var(--aqua-bg)' : hoveredId === s.id ? 'var(--bg2)' : 'transparent',
                      borderLeft: `2px solid ${active ? 'var(--aqua)' : 'transparent'}`,
                      paddingLeft: 8,
                      transition: 'background 0.1s',
                    }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: SESSION_COLORS[s.type], flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 500,
                        color: active ? 'var(--aqua-dark)' : 'var(--fg)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 1 }}>
                        {SESSION_LABELS[s.type]}
                      </div>
                    </div>
                    <button
                      onClick={e => handleDelete(s.id, e)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 3, borderRadius: 4, flexShrink: 0,
                        color: 'var(--fg3)',
                        opacity: hoveredId === s.id ? 1 : 0,
                        transition: 'opacity 0.1s',
                        display: 'flex', alignItems: 'center',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg3)')}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </aside>

      {/* New Session Modal */}
      {showModal && (
        <div
          onClick={e => e.target === e.currentTarget && setShowModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(6px)',
          }}>
          <div style={{
            width: '100%', maxWidth: 420,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 24,
            display: 'flex', flexDirection: 'column', gap: 18,
          }}>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg)', marginBottom: 4 }}>Nueva sesión</h3>
              <p style={{ fontSize: 13, color: 'var(--fg2)' }}>Dale un nombre y tipo a tu sesión</p>
            </div>

            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Ej: Cálculo diferencial, Reunión de ventas..."
              style={{
                width: '100%', padding: '10px 14px',
                borderRadius: 10, fontSize: 14, outline: 'none',
                border: '1px solid var(--border)',
                background: 'var(--bg2)', color: 'var(--fg)',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--aqua)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TYPES.map(t => (
                <button
                  key={t.type}
                  onClick={() => setType(t.type)}
                  style={{
                    padding: '12px 14px', borderRadius: 12,
                    textAlign: 'left', cursor: 'pointer',
                    background: type === t.type ? 'var(--aqua-bg)' : 'var(--surface2)',
                    border: `1px solid ${type === t.type ? 'var(--aqua-muted)' : 'var(--border)'}`,
                    transition: 'all 0.12s',
                  }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, marginBottom: 2,
                    color: type === t.type ? 'var(--aqua-dark)' : 'var(--fg)',
                  }}>
                    {t.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg3)' }}>{t.desc}</div>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setShowModal(false); setName('') }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10,
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  background: 'var(--surface2)', color: 'var(--fg2)',
                  border: '1px solid var(--border)',
                }}>
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10,
                  fontSize: 13, fontWeight: 600, cursor: name.trim() ? 'pointer' : 'not-allowed',
                  background: 'var(--aqua)', color: '#fff',
                  border: 'none', opacity: name.trim() ? 1 : 0.4,
                }}
                onMouseEnter={e => { if (name.trim()) e.currentTarget.style.background = 'var(--aqua-dark)' }}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--aqua)')}>
                Comenzar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
