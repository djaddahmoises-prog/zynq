'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Mic, ImageIcon, Sparkles, ChevronRight } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { getSessions, deleteSession, Session, SESSION_LABELS, SESSION_COLORS } from '@/lib/sessions'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export default function Home() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => { setSessions(getSessions()) }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar />

      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {sessions.length === 0 ? (
          /* ── Empty state ── */
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 32px',
          }}>
            <div style={{ maxWidth: 480, textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: '0 auto 24px',
                background: 'var(--aqua-bg)', border: '1px solid var(--aqua-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={24} style={{ color: 'var(--aqua)' }} strokeWidth={1.5} />
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--fg)', marginBottom: 10, letterSpacing: '-0.02em' }}>
                Tu asistente de estudio
              </h1>
              <p style={{ fontSize: 14, color: 'var(--fg2)', lineHeight: 1.6, marginBottom: 28 }}>
                Graba clases, sube fotos del pizarrón y genera presentaciones,
                guías de estudio o resúmenes con IA.
              </p>
              <p style={{ fontSize: 13, color: 'var(--fg3)' }}>
                Crea una nueva sesión desde la barra lateral para comenzar.
              </p>
            </div>
          </div>
        ) : (
          /* ── Sessions grid ── */
          <div style={{ padding: '32px 40px', maxWidth: 960, width: '100%', margin: '0 auto' }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', marginBottom: 6, letterSpacing: '-0.02em' }}>
              Sesiones
            </h2>
            <p style={{ fontSize: 13, color: 'var(--fg2)', marginBottom: 28 }}>
              {sessions.length} sesión{sessions.length !== 1 ? 'es' : ''}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => router.push(`/session/${s.id}`)}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: '18px 20px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--border2)'
                    e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}>

                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      padding: '3px 8px', borderRadius: 6,
                      background: SESSION_COLORS[s.type] + '18',
                      color: SESSION_COLORS[s.type],
                    }}>
                      {SESSION_LABELS[s.type]}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--fg3)' }}>{fmtDate(s.createdAt)}</span>
                  </div>

                  {/* Name */}
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)', marginBottom: 12, lineHeight: 1.3 }}>
                    {s.name}
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {s.transcript && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--fg3)' }}>
                        <Mic size={12} strokeWidth={1.8} />
                        {s.transcript.split(' ').filter(Boolean).length} palabras
                      </span>
                    )}
                    {s.images.length > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--fg3)' }}>
                        <ImageIcon size={12} strokeWidth={1.8} />
                        {s.images.length} imagen{s.images.length !== 1 ? 'es' : ''}
                      </span>
                    )}
                    {s.generated.length > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--aqua)' }}>
                        <Sparkles size={12} strokeWidth={1.8} />
                        {s.generated.length} generado{s.generated.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Arrow */}
                  <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg3)' }}>
                    <ChevronRight size={16} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
