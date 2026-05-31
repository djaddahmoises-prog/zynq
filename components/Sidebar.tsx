'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Plus, Trash2, LayoutGrid } from 'lucide-react'
import {
  getSessions, createSession, deleteSession,
  Session, SessionType, SESSION_LABELS, SESSION_COLORS,
} from '@/lib/sessions'

const TYPES: { type: SessionType; label: string; desc: string }[] = [
  { type: 'class',    label: 'Clase',    desc: 'Apuntes y conferencias' },
  { type: 'meeting',  label: 'Reunión',  desc: 'Minutas y acuerdos' },
  { type: 'business', label: 'Negocio',  desc: 'Análisis y estrategia' },
  { type: 'workshop', label: 'Taller',   desc: 'Workshop y capacitación' },
]

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [sessions, setSessions] = useState<Session[]>([])
  const [hovered, setHovered] = useState<string | null>(null)
  const [modal, setModal] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<SessionType>('class')

  const activeId = pathname.startsWith('/session/') ? pathname.split('/')[2] : null

  useEffect(() => { setSessions(getSessions()) }, [pathname])

  const create = () => {
    if (!name.trim()) return
    const s = createSession(name.trim(), type)
    setSessions(getSessions())
    setModal(false)
    setName('')
    setType('class')
    router.push(`/session/${s.id}`)
  }

  const remove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteSession(id)
    setSessions(getSessions())
    if (activeId === id) router.push('/')
  }

  return (
    <>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 'var(--sidebar-w)', minWidth: 'var(--sidebar-w)',
        height: '100%', display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', borderRight: '1px solid var(--border)',
        overflow: 'hidden',
      }}>

        {/* Logo */}
        <div style={{
          height: 56, padding: '0 18px',
          display: 'flex', alignItems: 'center',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <button onClick={() => router.push('/')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--fg)' }}>
              Zynq
            </span>
          </button>
        </div>

        {/* Nav */}
        <div style={{ padding: '8px 8px 4px', flexShrink: 0 }}>
          <NavItem
            label="Sesiones"
            icon={<LayoutGrid size={15} strokeWidth={1.8} />}
            active={pathname === '/'}
            onClick={() => router.push('/')}
          />
        </div>

        {/* New session */}
        <div style={{ padding: '4px 8px 8px', flexShrink: 0 }}>
          <button
            onClick={() => setModal(true)}
            style={{
              width: '100%', height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--aqua)', color: '#fff',
              fontSize: 13, fontWeight: 600,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--aqua-dark)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--aqua)')}>
            <Plus size={14} strokeWidth={2.5} />
            Nueva sesión
          </button>
        </div>

        <div style={{ margin: '0 8px', height: 1, background: 'var(--border)', flexShrink: 0 }} />

        {/* Sessions list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px 12px' }}>
          {sessions.length > 0 && (
            <p style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--fg3)',
              padding: '8px 10px 6px',
            }}>
              Recientes
            </p>
          )}
          {sessions.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--fg3)', padding: '10px', fontStyle: 'italic', textAlign: 'center', marginTop: 8 }}>
              Sin sesiones todavía
            </p>
          )}
          {sessions.map(s => {
            const active = s.id === activeId
            return (
              <div
                key={s.id}
                onClick={() => router.push(`/session/${s.id}`)}
                onMouseEnter={() => setHovered(s.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                  background: active ? 'var(--aqua-bg)' : hovered === s.id ? 'var(--bg2)' : 'transparent',
                  transition: 'background 0.12s',
                  borderLeft: `2px solid ${active ? 'var(--aqua)' : 'transparent'}`,
                }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: SESSION_COLORS[s.type],
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
                  onClick={e => remove(s.id, e)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 3, borderRadius: 4, flexShrink: 0,
                    color: 'var(--fg3)',
                    opacity: hovered === s.id ? 1 : 0,
                    transition: 'opacity 0.12s',
                    display: 'flex', alignItems: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg3)')}>
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>
      </aside>

      {/* ── Modal ── */}
      {modal && (
        <div
          onClick={e => e.target === e.currentTarget && setModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(17,17,17,0.3)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}>
          <div style={{
            width: '100%', maxWidth: 420,
            background: 'var(--surface)', borderRadius: 20,
            border: '1px solid var(--border)',
            padding: '24px', display: 'flex', flexDirection: 'column', gap: 18,
            boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
          }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.02em' }}>
                Nueva sesión
              </h3>
              <p style={{ fontSize: 13, color: 'var(--fg2)', marginTop: 4 }}>
                Nombre y tipo para tu sesión
              </p>
            </div>

            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && create()}
              placeholder="Ej: Cálculo diferencial, Reunión de ventas..."
              style={{
                width: '100%', padding: '11px 14px',
                borderRadius: 10, fontSize: 14, outline: 'none',
                border: '1.5px solid var(--border)',
                background: 'var(--bg)', color: 'var(--fg)',
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
                    padding: '12px 14px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                    background: type === t.type ? 'var(--aqua-bg)' : 'var(--surface2)',
                    border: `1.5px solid ${type === t.type ? 'var(--aqua)' : 'var(--border)'}`,
                    transition: 'all 0.12s',
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: type === t.type ? 'var(--aqua-dark)' : 'var(--fg)', marginBottom: 2 }}>
                    {t.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg3)' }}>{t.desc}</div>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setModal(false); setName('') }}
                style={{
                  flex: 1, padding: '11px', borderRadius: 10,
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  background: 'var(--surface2)', color: 'var(--fg2)',
                  border: '1px solid var(--border)',
                }}>
                Cancelar
              </button>
              <button
                onClick={create}
                disabled={!name.trim()}
                style={{
                  flex: 1, padding: '11px', borderRadius: 10,
                  fontSize: 13, fontWeight: 600, cursor: name.trim() ? 'pointer' : 'not-allowed',
                  background: name.trim() ? 'var(--aqua)' : 'var(--bg2)',
                  color: name.trim() ? '#fff' : 'var(--fg3)',
                  border: 'none', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (name.trim()) e.currentTarget.style.background = 'var(--aqua-dark)' }}
                onMouseLeave={e => (e.currentTarget.style.background = name.trim() ? 'var(--aqua)' : 'var(--bg2)')}>
                Comenzar →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function NavItem({ label, icon, active, onClick }: {
  label: string; icon: React.ReactNode; active: boolean; onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', height: 34, display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
        background: active || hov ? 'var(--bg2)' : 'transparent',
        color: active ? 'var(--fg)' : 'var(--fg2)',
        fontSize: 13, fontWeight: active ? 600 : 400,
        transition: 'all 0.12s',
      }}>
      {icon}
      {label}
    </button>
  )
}
