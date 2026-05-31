'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, ImageIcon, Sparkles, ChevronRight } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { getSessions, Session, SESSION_LABELS, SESSION_COLORS } from '@/lib/sessions'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Home() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => { setSessions(getSessions()) }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      <main style={{
        flex: 1, overflowY: 'auto',
        background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
      }}>
        {sessions.length === 0 ? (

          /* Empty state */
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 40, minHeight: 'calc(100vh - 0px)',
          }}>
            <div style={{ maxWidth: 460, textAlign: 'center' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, margin: '0 auto 24px',
                background: 'var(--aqua-bg)', border: '1.5px solid var(--aqua-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={22} strokeWidth={1.5} style={{ color: 'var(--aqua)' }} />
              </div>
              <h1 style={{
                fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em',
                color: 'var(--fg)', marginBottom: 12,
              }}>
                Tu asistente de estudio
              </h1>
              <p style={{ fontSize: 14, color: 'var(--fg2)', lineHeight: 1.7, marginBottom: 10 }}>
                Graba clases en tiempo real, sube fotos del pizarrón y genera presentaciones,
                guías de estudio o resúmenes con IA.
              </p>
              <p style={{ fontSize: 13, color: 'var(--fg3)' }}>
                Crea una sesión desde la barra lateral para comenzar.
              </p>
            </div>
          </div>

        ) : (

          /* Sessions grid */
          <div style={{ padding: '36px 40px', maxWidth: 1000, width: '100%' }}>
            <h1 style={{
              fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em',
              color: 'var(--fg)', marginBottom: 6,
            }}>
              Sesiones
            </h1>
            <p style={{ fontSize: 13, color: 'var(--fg3)', marginBottom: 28 }}>
              {sessions.length} sesión{sessions.length !== 1 ? 'es' : ''}
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(272px, 1fr))',
              gap: 12,
            }}>
              {sessions.map(s => (
                <SessionCard key={s.id} session={s} onClick={() => router.push(`/session/${s.id}`)} />
              ))}
            </div>
          </div>

        )}
      </main>
    </div>
  )
}

function SessionCard({ session: s, onClick }: { session: Session; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  const wordCount = s.transcript.split(' ').filter(Boolean).length

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${hov ? 'var(--border2)' : 'var(--border)'}`,
        borderRadius: 14, padding: '18px 20px',
        cursor: 'pointer',
        boxShadow: hov ? '0 4px 20px rgba(0,0,0,0.07)' : '0 1px 4px rgba(0,0,0,0.03)',
        transition: 'all 0.15s',
        position: 'relative',
      }}>

      {/* Top */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
          background: SESSION_COLORS[s.type] + '1A',
          color: SESSION_COLORS[s.type],
          letterSpacing: '0.02em',
        }}>
          {SESSION_LABELS[s.type].toUpperCase()}
        </span>
        <span style={{ fontSize: 11, color: 'var(--fg3)' }}>{fmtDate(s.createdAt)}</span>
      </div>

      {/* Name */}
      <p style={{
        fontSize: 15, fontWeight: 600, color: 'var(--fg)',
        marginBottom: 14, lineHeight: 1.35,
      }}>
        {s.name}
      </p>

      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {wordCount > 0 && (
          <Stat icon={<Mic size={11} strokeWidth={2} />} label={`${wordCount} palabras`} />
        )}
        {s.images.length > 0 && (
          <Stat icon={<ImageIcon size={11} strokeWidth={2} />} label={`${s.images.length} imagen${s.images.length !== 1 ? 'es' : ''}`} />
        )}
        {s.generated.length > 0 && (
          <Stat icon={<Sparkles size={11} strokeWidth={2} />} label={`${s.generated.length} generado${s.generated.length !== 1 ? 's' : ''}`} color="var(--aqua)" />
        )}
      </div>

      <div style={{
        position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)',
        color: 'var(--fg3)', opacity: hov ? 1 : 0, transition: 'opacity 0.15s',
      }}>
        <ChevronRight size={16} />
      </div>
    </div>
  )
}

function Stat({ icon, label, color }: { icon: React.ReactNode; label: string; color?: string }) {
  return (
    <span style={{
      display: 'flex', alignItems: 'center', gap: 4,
      fontSize: 12, color: color || 'var(--fg3)',
    }}>
      {icon}{label}
    </span>
  )
}
