'use client'

import { useState, useRef, useEffect, useCallback, FormEvent, KeyboardEvent } from 'react'
import { useParams } from 'next/navigation'
import { Mic, Square, Send, ImagePlus, X, Sparkles, Copy, Check, FileText, BookOpen, Monitor, Brain, ListTodo } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { getSession, saveSession, Session, ChatMessage, SESSION_LABELS, SESSION_COLORS } from '@/lib/sessions'

// ── Output types ──────────────────────────────────────────────────────────────

const OUTPUTS = [
  { type: 'summary',      label: 'Resumen',          desc: 'Puntos clave en párrafos',          icon: FileText },
  { type: 'studyGuide',   label: 'Guía de estudio',  desc: 'Conceptos, definiciones, preguntas', icon: BookOpen },
  { type: 'presentation', label: 'Presentación',     desc: 'Slide por slide para PowerPoint',    icon: Monitor },
  { type: 'flashcards',   label: 'Flashcards',       desc: 'Preguntas y respuestas de repaso',   icon: Brain },
  { type: 'actionItems',  label: 'Puntos de acción', desc: 'Tareas y seguimientos',              icon: ListTodo },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  return h > 0
    ? `${h}:${pad(m)}:${pad(ss)}`
    : `${pad(m)}:${pad(ss)}`
}
const pad = (n: number) => String(n).padStart(2, '0')

function useTimer(on: boolean) {
  const [n, setN] = useState(0)
  const t = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (on) t.current = setInterval(() => setN(x => x + 1), 1000)
    else t.current && clearInterval(t.current)
    return () => { t.current && clearInterval(t.current) }
  }, [on])
  return n
}

// ── Components ────────────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: ChatMessage }) {
  const [copied, setCopied] = useState(false)
  const isUser = msg.role === 'user'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 4 }}>
      <div style={{
        maxWidth: '80%', padding: '10px 14px', fontSize: 13, lineHeight: 1.6,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        ...(isUser
          ? { background: 'var(--aqua)', color: '#fff', borderRadius: '14px 14px 4px 14px' }
          : { background: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: '14px 14px 14px 4px' }
        ),
      }}>
        {msg.content}
      </div>
      {!isUser && msg.content && (
        <button
          onClick={() => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, color: 'var(--fg3)', padding: '2px 4px',
            borderRadius: 4, transition: 'color 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--aqua)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg3)')}>
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      )}
    </div>
  )
}

function Dots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px 14px 14px 4px', width: 'fit-content' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%', background: 'var(--aqua-muted)', display: 'block',
          animation: 'bounce-dot 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<Session | null>(null)

  // Recording
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [noSR, setNoSR] = useState(false)
  const recRef = useRef<any>(null)
  const recActive = useRef(false)
  const recSecs = useTimer(recording)

  // Chat
  const [msgs, setMsgs] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Generate
  const [showGen, setShowGen] = useState(false)
  const [selOutput, setSelOutput] = useState('studyGuide')
  const [generating, setGenerating] = useState(false)
  const [genContent, setGenContent] = useState('')
  const [genLabel, setGenLabel] = useState('')
  const [viewGen, setViewGen] = useState<{ label: string; content: string } | null>(null)

  // Mobile tab
  const [tab, setTab] = useState<'capture' | 'chat'>('capture')

  // Load
  useEffect(() => {
    const s = getSession(id)
    if (!s) return
    setSession(s)
    setTranscript(s.transcript)
    setMsgs(s.messages)
    setNoSR(!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition))
  }, [id])

  // Persist
  const persist = useCallback((t: string, m: ChatMessage[]) => {
    const s = getSession(id)
    if (!s) return
    const u = { ...s, transcript: t, messages: m }
    saveSession(u)
    setSession(u)
  }, [id])
  useEffect(() => { persist(transcript, msgs) }, [transcript, msgs, persist])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, chatLoading])

  // ── Recording ──
  const startRec = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setNoSR(true); return }
    const r = new SR()
    r.continuous = true; r.interimResults = true; r.lang = 'es-MX'
    r.onresult = (e: any) => {
      let fin = '', intr = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript + ' '
        else intr += e.results[i][0].transcript
      }
      if (fin) setTranscript(p => p + fin)
      setInterim(intr)
    }
    r.onerror = () => { setRecording(false); recActive.current = false }
    r.onend = () => { if (recActive.current) { try { r.start() } catch {} } }
    recRef.current = r; recActive.current = true
    r.start(); setRecording(true)
  }
  const stopRec = () => { recActive.current = false; recRef.current?.stop(); setRecording(false); setInterim('') }

  // ── Images ──
  const addImgs = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(file => {
      const r = new FileReader()
      r.onload = e => {
        const url = e.target?.result as string
        const s = getSession(id)
        if (!s || s.images.length >= 6) return
        const u = { ...s, images: [...s.images, url] }
        saveSession(u); setSession(u)
      }
      r.readAsDataURL(file)
    })
  }
  const removeImg = (i: number) => {
    const s = getSession(id); if (!s) return
    const u = { ...s, images: s.images.filter((_, j) => j !== i) }
    saveSession(u); setSession(u)
  }

  // ── Chat ──
  const resizeTa = () => {
    const el = taRef.current; if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }
  const sendChat = async (text: string) => {
    const t = text.trim(); if (!t || chatLoading) return
    const s = getSession(id)
    const next: ChatMessage[] = [...msgs, { role: 'user', content: t }]
    setMsgs(next); setChatInput('')
    if (taRef.current) taRef.current.style.height = 'auto'
    setChatLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, context: { sessionName: s?.name, sessionType: s?.type, transcript, hasImages: (s?.images?.length || 0) > 0 } }),
      })
      if (!res.ok || !res.body) throw new Error()
      setMsgs(p => [...p, { role: 'assistant', content: '' }]); setChatLoading(false)
      const reader = res.body.getReader(); const dec = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        const chunk = dec.decode(value)
        setMsgs(p => { const c = [...p]; c[c.length-1] = { ...c[c.length-1], content: c[c.length-1].content + chunk }; return c })
      }
    } catch {
      setChatLoading(false)
      setMsgs(p => [...p, { role: 'assistant', content: 'Error de conexión. Intenta de nuevo.' }])
    }
  }

  // ── Generate ──
  const generate = async () => {
    const s = getSession(id); if (!s) return
    const opt = OUTPUTS.find(o => o.type === selOutput)!
    setGenerating(true); setGenContent(''); setGenLabel(opt.label)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionName: s.name, sessionType: s.type, transcript, images: s.images, outputType: opt.type }),
      })
      if (!res.ok || !res.body) throw new Error()
      let full = ''; const reader = res.body.getReader(); const dec = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        full += dec.decode(value); setGenContent(full)
      }
      const u = { ...s, generated: [...s.generated.filter(g => g.type !== opt.type), { type: opt.type, label: opt.label, content: full, createdAt: new Date().toISOString() }], status: 'ended' as const }
      saveSession(u); setSession(u)
    } catch { setGenContent('Error al generar. Verifica tu API key e intenta de nuevo.') }
    finally { setGenerating(false) }
  }

  // ── Loading ──
  if (!session) return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2.5px solid var(--aqua)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
      </div>
    </div>
  )

  const hasContent = !!transcript.trim() || session.images.length > 0
  const color = SESSION_COLORS[session.type]

  // ── Capture panel ──────────────────────────────────────────────────────────

  const CapturePanel = (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

      {/* Recording section */}
      <Section label="Grabación">
        {noSR ? (
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--red-bg)', border: '1px solid #FECACA', fontSize: 13, color: 'var(--red)' }}>
            Usa Chrome o Edge para habilitar la grabación de audio
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={recording ? stopRec : startRec}
              style={{
                width: 40, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: recording ? 'var(--red-bg)' : 'var(--aqua-bg)',
                color: recording ? 'var(--red)' : 'var(--aqua)',
                outline: recording ? '2px solid var(--red)' : '2px solid var(--aqua-muted)',
                transition: 'all 0.15s',
              }}>
              {recording
                ? <Square size={15} fill="currentColor" strokeWidth={0} />
                : <Mic size={15} strokeWidth={1.8} />
              }
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              {recording ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', flexShrink: 0, animation: 'pulse-dot 1.4s ease-in-out infinite', display: 'block' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>Grabando</span>
                  <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--fg2)', marginLeft: 'auto' }}>{fmtTime(recSecs)}</span>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--fg2)' }}>
                  {transcript ? 'Pausado — presiona para continuar' : 'Presiona el micrófono para grabar'}
                </p>
              )}
              {interim && <p style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 3, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{interim}</p>}
            </div>
          </div>
        )}
      </Section>

      {/* Transcript */}
      <Section label="Transcripción" right={transcript ? <span style={{ fontSize: 11, color: 'var(--fg3)' }}>{transcript.split(' ').filter(Boolean).length} palabras</span> : undefined} flex>
        <textarea
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          placeholder="La transcripción aparecerá aquí mientras grabas.&#10;También puedes escribir o pegar texto directamente."
          style={{
            flex: 1, width: '100%', minHeight: 100,
            resize: 'none', border: 'none', outline: 'none',
            background: 'transparent', fontSize: 13, lineHeight: 1.65,
            color: 'var(--fg)', fontFamily: 'inherit',
          }}
        />
      </Section>

      {/* Images */}
      <Section
        label={`Imágenes${session.images.length > 0 ? ` (${session.images.length}/6)` : ''}`}
        right={session.images.length < 6 ? (
          <label style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--aqua)', padding: '3px 8px', borderRadius: 6, background: 'var(--aqua-bg)', border: '1px solid var(--aqua-muted)' }}>
            Subir
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => addImgs(e.target.files)} />
          </label>
        ) : undefined}>
        {session.images.length === 0 ? (
          <label
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); addImgs(e.dataTransfer.files) }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 6, height: 80, borderRadius: 10, cursor: 'pointer',
              border: '2px dashed var(--border2)', color: 'var(--fg3)',
            }}>
            <ImagePlus size={18} strokeWidth={1.5} />
            <span style={{ fontSize: 12 }}>Arrastra o sube fotos del pizarrón</span>
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => addImgs(e.target.files)} />
          </label>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {session.images.map((img, i) => (
              <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => removeImg(i)} style={{
                  position: 'absolute', top: 3, right: 3, width: 18, height: 18,
                  borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: 'rgba(0,0,0,0.6)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <X size={10} />
                </button>
              </div>
            ))}
            {session.images.length < 6 && (
              <label style={{ aspectRatio: '1', borderRadius: 8, cursor: 'pointer', border: '2px dashed var(--border2)', color: 'var(--fg3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ImagePlus size={16} strokeWidth={1.5} />
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => addImgs(e.target.files)} />
              </label>
            )}
          </div>
        )}
      </Section>
    </div>
  )

  // ── Chat panel ─────────────────────────────────────────────────────────────

  const ChatPanel = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--aqua-bg)', border: '1px solid var(--aqua-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={16} style={{ color: 'var(--aqua)' }} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 13, color: 'var(--fg2)', lineHeight: 1.6, maxWidth: 240 }}>
              Hazme preguntas sobre lo que estás grabando. Te explico en tiempo real.
            </p>
          </div>
        ) : (
          <>
            {msgs.map((m, i) => <Bubble key={i} msg={m} />)}
            {chatLoading && <Dots />}
          </>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: '10px 12px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <form
          onSubmit={(e: FormEvent) => { e.preventDefault(); sendChat(chatInput) }}
          style={{
            display: 'flex', alignItems: 'flex-end', gap: 8,
            padding: '10px 12px', borderRadius: 12,
            border: '1.5px solid var(--border)', background: 'var(--surface)',
            transition: 'border-color 0.15s',
          }}
          onFocusCapture={e => (e.currentTarget.style.borderColor = 'var(--aqua)')}
          onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
          <textarea
            ref={taRef}
            value={chatInput}
            onChange={e => { setChatInput(e.target.value); resizeTa() }}
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(chatInput) }
            }}
            placeholder="Escribe tu pregunta..."
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', resize: 'none',
              fontSize: 13, outline: 'none', lineHeight: 1.5, color: 'var(--fg)',
              maxHeight: 120, fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || chatLoading}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none', flexShrink: 0,
              background: chatInput.trim() ? 'var(--aqua)' : 'var(--bg2)',
              color: chatInput.trim() ? '#fff' : 'var(--fg3)',
              cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (chatInput.trim()) e.currentTarget.style.background = 'var(--aqua-dark)' }}
            onMouseLeave={e => (e.currentTarget.style.background = chatInput.trim() ? 'var(--aqua)' : 'var(--bg2)')}>
            <Send size={13} />
          </button>
        </form>
        <p style={{ fontSize: 11, color: 'var(--fg3)', textAlign: 'center', marginTop: 6 }}>
          Enter para enviar · Shift+Enter nueva línea
        </p>
      </div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Header */}
        <div style={{
          height: 56, padding: '0 20px', flexShrink: 0, background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ width: 3, height: 20, borderRadius: 2, background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.name}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: color + '1A', color, letterSpacing: '0.04em', flexShrink: 0 }}>
            {SESSION_LABELS[session.type].toUpperCase()}
          </span>
          {recording && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', display: 'block', animation: 'pulse-dot 1.4s ease-in-out infinite' }} />
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--red)', fontWeight: 600 }}>{fmtTime(recSecs)}</span>
            </div>
          )}
          <button
            onClick={() => { setShowGen(true); setGenContent('') }}
            disabled={!hasContent}
            style={{
              height: 32, padding: '0 14px', borderRadius: 8, border: 'none',
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              background: hasContent ? 'var(--aqua)' : 'var(--bg2)',
              color: hasContent ? '#fff' : 'var(--fg3)',
              fontSize: 13, fontWeight: 600, cursor: hasContent ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (hasContent) e.currentTarget.style.background = 'var(--aqua-dark)' }}
            onMouseLeave={e => (e.currentTarget.style.background = hasContent ? 'var(--aqua)' : 'var(--bg2)')}>
            <Sparkles size={13} strokeWidth={2} />
            Generar
          </button>
        </div>

        {/* Desktop: 2-col */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }} className="hidden-mobile">
          <div style={{ width: 360, flexShrink: 0, borderRight: '1px solid var(--border)', overflow: 'hidden', background: 'var(--surface)' }}>
            {CapturePanel}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>{ChatPanel}</div>
        </div>

        {/* Mobile: tabs */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} className="show-mobile">
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {tab === 'capture'
              ? <div style={{ height: '100%', overflowY: 'auto', background: 'var(--surface)' }}>{CapturePanel}</div>
              : <div style={{ height: '100%' }}>{ChatPanel}</div>
            }
          </div>
          <div style={{ display: 'flex', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
            {(['capture', 'chat'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '12px 0', border: 'none', cursor: 'pointer',
                background: 'transparent', fontSize: 13, fontWeight: tab === t ? 600 : 400,
                color: tab === t ? 'var(--aqua)' : 'var(--fg3)',
                borderTop: `2px solid ${tab === t ? 'var(--aqua)' : 'transparent'}`,
                transition: 'all 0.12s',
              }}>
                {t === 'capture' ? 'Capturar' : 'Chat'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Generate Modal ─────────────────────────────────────────────────── */}
      {showGen && (
        <Modal onClose={() => { setShowGen(false); setGenContent('') }} title="Generar con IA"
          subtitle={`${transcript.split(' ').filter(Boolean).length} palabras${session.images.length > 0 ? ` · ${session.images.length} imágenes` : ''}`}>
          {!genContent ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {OUTPUTS.map(o => {
                  const Icon = o.icon
                  const active = selOutput === o.type
                  return (
                    <button key={o.type} onClick={() => setSelOutput(o.type)} style={{
                      padding: '14px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      background: active ? 'var(--aqua-bg)' : 'var(--surface2)',
                      border: `1.5px solid ${active ? 'var(--aqua)' : 'var(--border)'}`,
                      transition: 'all 0.12s',
                    }}>
                      <Icon size={15} strokeWidth={1.8} style={{ color: active ? 'var(--aqua)' : 'var(--fg3)', marginTop: 1, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', marginBottom: 2 }}>{o.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--fg3)' }}>{o.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <button
                onClick={generate} disabled={generating || !hasContent}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                  fontSize: 14, fontWeight: 600,
                  background: hasContent && !generating ? 'var(--aqua)' : 'var(--bg2)',
                  color: hasContent && !generating ? '#fff' : 'var(--fg3)',
                  cursor: hasContent && !generating ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (hasContent && !generating) e.currentTarget.style.background = 'var(--aqua-dark)' }}
                onMouseLeave={e => (e.currentTarget.style.background = hasContent && !generating ? 'var(--aqua)' : 'var(--bg2)')}>
                <Sparkles size={15} strokeWidth={2} />
                {generating ? 'Generando...' : `Generar ${OUTPUTS.find(o => o.type === selOutput)?.label}`}
              </button>

              {session.generated.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg3)', marginBottom: 8 }}>
                    Generados anteriormente
                  </p>
                  {session.generated.map((g, i) => (
                    <PrevItem key={i} label={g.label} date={g.createdAt} onClick={() => { setViewGen(g); setShowGen(false) }} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <GenResult label={genLabel} content={genContent} generating={generating} onNew={() => setGenContent('')} />
          )}
        </Modal>
      )}

      {viewGen && (
        <Modal onClose={() => setViewGen(null)} title={viewGen.label}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <CopyBtn text={viewGen.content} />
          </div>
          <pre style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--fg)', fontFamily: 'inherit', maxHeight: '55vh', overflowY: 'auto' }}>
            {viewGen.content}
          </pre>
        </Modal>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ label, right, flex, children }: {
  label: string; right?: React.ReactNode; flex?: boolean; children: React.ReactNode
}) {
  return (
    <div style={{
      padding: '16px 18px', borderBottom: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 10,
      ...(flex ? { flex: 1 } : {}),
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg3)' }}>
          {label}
        </span>
        {right}
      </div>
      {children}
    </div>
  )
}

function Modal({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(17,17,17,0.3)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
      <div style={{
        width: '100%', maxWidth: 560, background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 20,
        boxShadow: '0 24px 60px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden',
      }}>
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.02em' }}>{title}</h3>
            {subtitle && <p style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 2 }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg3)', padding: 4, borderRadius: 6 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '20px 22px' }}>{children}</div>
      </div>
    </div>
  )
}

function PrevItem({ label, date, onClick }: { label: string; date: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '9px 12px', borderRadius: 8, border: `1px solid ${hov ? 'var(--border2)' : 'var(--border)'}`,
        background: hov ? 'var(--surface2)' : 'var(--surface)',
        cursor: 'pointer', marginBottom: 6, transition: 'all 0.12s',
      }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--fg3)' }}>{new Date(date).toLocaleDateString('es-MX')}</span>
    </button>
  )
}

function GenResult({ label, content, generating, onNew }: { label: string; content: string; generating: boolean; onNew: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>{label}</span>
        {!generating && (
          <div style={{ display: 'flex', gap: 8 }}>
            <CopyBtn text={content} />
            <button onClick={onNew} style={{ padding: '5px 10px', borderRadius: 7, fontSize: 12, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--fg2)', cursor: 'pointer' }}>
              Nuevo
            </button>
          </div>
        )}
      </div>
      <div style={{
        padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)',
        background: 'var(--surface2)', fontSize: 13, lineHeight: 1.7,
        whiteSpace: 'pre-wrap', color: 'var(--fg)', fontFamily: 'inherit',
        maxHeight: '52vh', overflowY: 'auto',
      }}>
        {content}
        {generating && <span style={{ color: 'var(--aqua)', animation: 'cursor-blink 1s step-end infinite' }}>|</span>}
      </div>
    </div>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
        borderRadius: 7, fontSize: 12, cursor: 'pointer',
        background: 'var(--aqua-bg)', border: '1px solid var(--aqua-muted)', color: 'var(--aqua)',
      }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}
