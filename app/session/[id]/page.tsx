'use client'

import {
  useState, useRef, useEffect, useCallback,
  FormEvent, KeyboardEvent,
} from 'react'
import { useParams } from 'next/navigation'
import {
  Mic, MicOff, Send, ImagePlus, X, Sparkles,
  Copy, Check, Square, FileText, BookOpen,
  Brain, ListTodo, Monitor,
} from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import {
  getSession, saveSession, Session, ChatMessage,
  SESSION_LABELS, SESSION_COLORS,
} from '@/lib/sessions'

// ─── Output options ────────────────────────────────────────────────────────────

const OUTPUT_OPTIONS = [
  { type: 'summary',      label: 'Resumen',          icon: <FileText size={15} strokeWidth={1.8} />,  desc: 'Puntos clave en párrafos' },
  { type: 'studyGuide',   label: 'Guía de estudio',  icon: <BookOpen size={15} strokeWidth={1.8} />,  desc: 'Conceptos, definiciones y preguntas' },
  { type: 'presentation', label: 'Presentación',     icon: <Monitor size={15} strokeWidth={1.8} />,   desc: 'Slide por slide para PowerPoint' },
  { type: 'flashcards',   label: 'Flashcards',       icon: <Brain size={15} strokeWidth={1.8} />,     desc: 'Preguntas y respuestas' },
  { type: 'actionItems',  label: 'Puntos de acción', icon: <ListTodo size={15} strokeWidth={1.8} />,  desc: 'Tareas y seguimientos' },
]

// ─── Utilities ──────────────────────────────────────────────────────────────────

function fmtTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

function useTimer(running: boolean) {
  const [secs, setSecs] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (running) ref.current = setInterval(() => setSecs(s => s + 1), 1000)
    else if (ref.current) clearInterval(ref.current)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [running])
  return secs
}

// ─── Chat bubble ─────────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: ChatMessage }) {
  const [copied, setCopied] = useState(false)
  const isUser = msg.role === 'user'
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: isUser ? 'flex-end' : 'flex-start' }}
      className="group">
      {!isUser && (
        <div style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0, marginTop: 2,
          background: 'var(--aqua-bg)', border: '1px solid var(--aqua-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={12} style={{ color: 'var(--aqua)' }} strokeWidth={1.8} />
        </div>
      )}
      <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        <div style={{
          padding: '9px 13px', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap',
          ...(isUser
            ? { background: 'var(--aqua)', color: '#fff', borderRadius: '12px 12px 3px 12px' }
            : { background: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: '12px 12px 12px 3px' }
          ),
        }}>
          {msg.content}
        </div>
        {!isUser && (
          <button
            onClick={() => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            className="group-hover-show"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
              borderRadius: 4, color: 'var(--fg3)', display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 11, opacity: 0, transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--aqua)' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.color = 'var(--fg3)' }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        )}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{
        width: 26, height: 26, borderRadius: 8, flexShrink: 0,
        background: 'var(--aqua-bg)', border: '1px solid var(--aqua-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Sparkles size={12} style={{ color: 'var(--aqua)' }} strokeWidth={1.8} />
      </div>
      <div style={{
        padding: '9px 13px', borderRadius: '12px 12px 12px 3px',
        background: 'var(--surface)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {[0,1,2].map(i => (
          <span key={i} style={{
            width: 5, height: 5, borderRadius: '50%',
            background: 'var(--aqua-muted)',
            animation: 'dot-bounce 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
            display: 'block',
          }} />
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()

  const [session, setSession] = useState<Session | null>(null)

  // Recording
  const [isRecording, setIsRecording] = useState(false)
  const [finalTranscript, setFinalTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [noSpeechAPI, setNoSpeechAPI] = useState(false)
  const recognitionRef = useRef<any>(null)
  const isRecordingRef = useRef(false)
  const recordingSecs = useTimer(isRecording)

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Generate
  const [showGenerate, setShowGenerate] = useState(false)
  const [selectedOutput, setSelectedOutput] = useState('studyGuide')
  const [generating, setGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState('')
  const [generatedLabel, setGeneratedLabel] = useState('')
  const [viewContent, setViewContent] = useState<{ label: string; content: string } | null>(null)

  // Mobile tab
  const [activeTab, setActiveTab] = useState<'capture' | 'chat'>('capture')

  useEffect(() => {
    const s = getSession(id)
    if (!s) return
    setSession(s)
    setFinalTranscript(s.transcript)
    setMessages(s.messages)
    setNoSpeechAPI(!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition))
  }, [id])

  const persist = useCallback((transcript: string, msgs: ChatMessage[]) => {
    const s = getSession(id)
    if (!s) return
    const updated = { ...s, transcript, messages: msgs }
    saveSession(updated)
    setSession(updated)
  }, [id])

  useEffect(() => { persist(finalTranscript, messages) }, [finalTranscript, messages, persist])
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, chatLoading])

  // ── Recording ──────────────────────────────────────────────────────────────

  const startRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setNoSpeechAPI(true); return }
    const r = new SR()
    r.continuous = true
    r.interimResults = true
    r.lang = 'es-MX'
    r.onresult = (e: any) => {
      let interim = '', final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      if (final) setFinalTranscript(p => p + final)
      setInterimTranscript(interim)
    }
    r.onerror = () => { setIsRecording(false); isRecordingRef.current = false }
    r.onend = () => { if (isRecordingRef.current) { try { r.start() } catch {} } }
    recognitionRef.current = r
    isRecordingRef.current = true
    r.start()
    setIsRecording(true)
  }

  const stopRecording = () => {
    isRecordingRef.current = false
    recognitionRef.current?.stop()
    setIsRecording(false)
    setInterimTranscript('')
  }

  // ── Images ─────────────────────────────────────────────────────────────────

  const addImages = (files: FileList | null) => {
    if (!files) return
    const s = getSession(id)
    if (!s) return
    Array.from(files).slice(0, 6 - s.images.length).forEach(file => {
      const reader = new FileReader()
      reader.onload = e => {
        const dataUrl = e.target?.result as string
        const latest = getSession(id)
        if (!latest || latest.images.length >= 6) return
        const updated = { ...latest, images: [...latest.images, dataUrl] }
        saveSession(updated)
        setSession(updated)
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (idx: number) => {
    const s = getSession(id)
    if (!s) return
    const updated = { ...s, images: s.images.filter((_, i) => i !== idx) }
    saveSession(updated)
    setSession(updated)
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  const resizeTa = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const sendChat = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || chatLoading) return
    const s = getSession(id)
    const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed }]
    setMessages(next)
    setChatInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setChatLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          context: { sessionName: s?.name, sessionType: s?.type, transcript: finalTranscript, hasImages: (s?.images?.length || 0) > 0 },
        }),
      })
      if (!res.ok || !res.body) throw new Error()
      setMessages(p => [...p, { role: 'assistant', content: '' }])
      setChatLoading(false)
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = dec.decode(value)
        setMessages(p => {
          const c = [...p]
          c[c.length-1] = { ...c[c.length-1], content: c[c.length-1].content + chunk }
          return c
        })
      }
    } catch {
      setChatLoading(false)
      setMessages(p => [...p, { role: 'assistant', content: 'Error de conexión. Intenta de nuevo.' }])
    }
  }

  // ── Generate ───────────────────────────────────────────────────────────────

  const generate = async () => {
    const s = getSession(id)
    if (!s) return
    const opt = OUTPUT_OPTIONS.find(o => o.type === selectedOutput)!
    setGenerating(true)
    setGeneratedContent('')
    setGeneratedLabel(opt.label)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionName: s.name, sessionType: s.type, transcript: finalTranscript, images: s.images, outputType: opt.type }),
      })
      if (!res.ok || !res.body) throw new Error()
      let full = ''
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += dec.decode(value)
        setGeneratedContent(full)
      }
      const updated = {
        ...s,
        generated: [
          ...s.generated.filter(g => g.type !== opt.type),
          { type: opt.type, label: opt.label, content: full, createdAt: new Date().toISOString() },
        ],
        status: 'ended' as const,
      }
      saveSession(updated)
      setSession(updated)
    } catch {
      setGeneratedContent('Error al generar. Verifica tu API key e intenta de nuevo.')
    } finally {
      setGenerating(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (!session) {
    return (
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--aqua)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
        </div>
      </div>
    )
  }

  const sessionColor = SESSION_COLORS[session.type]
  const hasContent = !!finalTranscript.trim() || session.images.length > 0
  const wordCount = finalTranscript.split(' ').filter(Boolean).length

  // ── Panels ─────────────────────────────────────────────────────────────────

  const CapturePanel = (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Recording */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg3)', marginBottom: 14 }}>
          Grabación
        </p>
        {noSpeechAPI ? (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FEE2E2', border: '1px solid #FECACA', fontSize: 13, color: '#991B1B' }}>
            Usa Chrome o Edge para grabar audio
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                ...(isRecording
                  ? { background: '#FEE2E2', color: '#DC2626' }
                  : { background: 'var(--aqua-bg)', color: 'var(--aqua)', border: '1px solid var(--aqua-muted)' }
                ),
              }}>
              {isRecording ? <Square size={16} fill="currentColor" /> : <Mic size={16} strokeWidth={1.8} />}
            </button>
            <div style={{ flex: 1 }}>
              {isRecording ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#DC2626', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#DC2626' }}>Grabando</span>
                    <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--fg2)', marginLeft: 'auto' }}>
                      {fmtTime(recordingSecs)}
                    </span>
                  </div>
                  {interimTranscript && (
                    <p style={{ fontSize: 12, color: 'var(--fg3)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {interimTranscript}
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--fg2)' }}>
                  {finalTranscript ? 'Pausado — presiona para continuar' : 'Presiona para empezar a grabar'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Transcript */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg3)' }}>
            Transcripción
          </p>
          {wordCount > 0 && (
            <span style={{ fontSize: 11, color: 'var(--fg3)' }}>{wordCount} palabras</span>
          )}
        </div>
        <textarea
          value={finalTranscript}
          onChange={e => setFinalTranscript(e.target.value)}
          placeholder="La transcripción aparecerá aquí mientras grabas. También puedes escribir o pegar texto."
          style={{
            width: '100%', minHeight: 100, resize: 'none',
            fontSize: 13, lineHeight: 1.6, outline: 'none',
            background: 'transparent', border: 'none',
            color: 'var(--fg)', fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Images */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg3)' }}>
            Imágenes{session.images.length > 0 ? ` (${session.images.length}/6)` : ''}
          </p>
          {session.images.length < 6 && (
            <label style={{
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              color: 'var(--aqua)', padding: '3px 8px', borderRadius: 6,
              background: 'var(--aqua-bg)', border: '1px solid var(--aqua-muted)',
            }}>
              Subir foto
              <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => addImages(e.target.files)} />
            </label>
          )}
        </div>
        {session.images.length === 0 ? (
          <label
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); addImages(e.dataTransfer.files) }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: 80, borderRadius: 12, cursor: 'pointer',
              border: '2px dashed var(--border2)', color: 'var(--fg3)', gap: 6,
            }}>
            <ImagePlus size={18} strokeWidth={1.5} />
            <span style={{ fontSize: 12 }}>Arrastra o sube fotos</span>
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => addImages(e.target.files)} />
          </label>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {session.images.map((img, i) => (
              <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}
                className="group">
                <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  onClick={() => removeImage(i)}
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 18, height: 18, borderRadius: 4,
                    background: 'rgba(0,0,0,0.65)', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                  }}>
                  <X size={10} />
                </button>
              </div>
            ))}
            {session.images.length < 6 && (
              <label style={{
                aspectRatio: '1', borderRadius: 8, cursor: 'pointer',
                border: '2px dashed var(--border2)', color: 'var(--fg3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ImagePlus size={16} strokeWidth={1.5} />
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => addImages(e.target.files)} />
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  )

  const ChatPanel = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 16px', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--aqua-bg)', border: '1px solid var(--aqua-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={16} style={{ color: 'var(--aqua)' }} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 13, color: 'var(--fg2)', lineHeight: 1.5, maxWidth: 240 }}>
              Hazme preguntas sobre lo que estás grabando. Te ayudo en tiempo real.
            </p>
          </div>
        ) : (
          <>
            {messages.map((m, i) => <Bubble key={i} msg={m} />)}
            {chatLoading && <TypingDots />}
          </>
        )}
        <div ref={chatBottomRef} />
      </div>
      <div style={{ padding: '10px 12px 12px', borderTop: '1px solid var(--border)' }}>
        <form
          onSubmit={(e: FormEvent) => { e.preventDefault(); sendChat(chatInput) }}
          style={{
            display: 'flex', alignItems: 'flex-end', gap: 8,
            padding: '10px 12px',
            borderRadius: 12, border: '1px solid var(--border)',
            background: 'var(--surface)', transition: 'border-color 0.15s',
          }}
          onFocusCapture={e => (e.currentTarget.style.borderColor = 'var(--aqua)')}
          onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
          <textarea
            ref={textareaRef}
            value={chatInput}
            onChange={e => { setChatInput(e.target.value); resizeTa() }}
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(chatInput) }
            }}
            placeholder="Pregunta sobre la sesión..."
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', resize: 'none',
              fontSize: 13, outline: 'none', lineHeight: 1.5,
              color: 'var(--fg)', maxHeight: 120, fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || chatLoading}
            style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: chatInput.trim() ? 'var(--aqua)' : 'var(--bg2)',
              border: 'none', cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: chatInput.trim() ? '#fff' : 'var(--fg3)',
              transition: 'all 0.15s',
            }}>
            <Send size={13} />
          </button>
        </form>
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar />

      {/* Session main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Header */}
        <div style={{
          height: 56, padding: '0 20px', flexShrink: 0,
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ width: 3, height: 20, borderRadius: 99, background: sessionColor, flexShrink: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.name}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
            background: sessionColor + '18', color: sessionColor, flexShrink: 0,
          }}>
            {SESSION_LABELS[session.type]}
          </span>
          {isRecording && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#DC2626', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#DC2626' }}>{fmtTime(recordingSecs)}</span>
            </div>
          )}
          <button
            onClick={() => setShowGenerate(true)}
            disabled={!hasContent}
            style={{
              height: 32, padding: '0 14px', borderRadius: 8,
              background: hasContent ? 'var(--aqua)' : 'var(--bg2)',
              border: 'none', cursor: hasContent ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 600,
              color: hasContent ? '#fff' : 'var(--fg3)',
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (hasContent) e.currentTarget.style.background = 'var(--aqua-dark)' }}
            onMouseLeave={e => (e.currentTarget.style.background = hasContent ? 'var(--aqua)' : 'var(--bg2)')}>
            <Sparkles size={13} strokeWidth={2} />
            Generar
          </button>
        </div>

        {/* Desktop: 2 columns */}
        <div className="hidden md:flex" style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ width: 360, flexShrink: 0, borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
            {CapturePanel}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>{ChatPanel}</div>
        </div>

        {/* Mobile: tabs */}
        <div className="flex md:hidden" style={{ flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeTab === 'capture' ? <div style={{ height: '100%', overflowY: 'auto' }}>{CapturePanel}</div> : <div style={{ height: '100%' }}>{ChatPanel}</div>}
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            borderTop: '1px solid var(--border)', background: 'var(--surface)',
            flexShrink: 0,
          }}>
            {(['capture', 'chat'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  padding: '12px 0', fontSize: 13, fontWeight: 500,
                  border: 'none', cursor: 'pointer', background: 'transparent',
                  color: activeTab === tab ? 'var(--aqua)' : 'var(--fg3)',
                  borderTop: `2px solid ${activeTab === tab ? 'var(--aqua)' : 'transparent'}`,
                }}>
                {tab === 'capture' ? 'Capturar' : 'Chat'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Generate Modal ──────────────────────────────────────────────────── */}
      {showGenerate && (
        <div
          onClick={e => e.target === e.currentTarget && setShowGenerate(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(6px)',
          }}>
          <div style={{
            width: '100%', maxWidth: 560,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 20, display: 'flex', flexDirection: 'column',
            maxHeight: '88vh', overflow: 'hidden',
          }}>
            {/* Modal header */}
            <div style={{
              padding: '18px 22px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)', marginBottom: 2 }}>Generar con IA</h3>
                <p style={{ fontSize: 12, color: 'var(--fg3)' }}>
                  {wordCount > 0 && `${wordCount} palabras`}{session.images.length > 0 && ` · ${session.images.length} imagen${session.images.length !== 1 ? 'es' : ''}`}
                </p>
              </div>
              <button
                onClick={() => { setShowGenerate(false); setGeneratedContent('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg3)', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {!generatedContent ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {OUTPUT_OPTIONS.map(opt => (
                      <button
                        key={opt.type}
                        onClick={() => setSelectedOutput(opt.type)}
                        style={{
                          padding: '14px 14px', borderRadius: 12, textAlign: 'left',
                          cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10,
                          background: selectedOutput === opt.type ? 'var(--aqua-bg)' : 'var(--surface2)',
                          border: `1px solid ${selectedOutput === opt.type ? 'var(--aqua-muted)' : 'var(--border)'}`,
                          transition: 'all 0.12s',
                        }}>
                        <span style={{ color: selectedOutput === opt.type ? 'var(--aqua)' : 'var(--fg3)', marginTop: 1 }}>
                          {opt.icon}
                        </span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', marginBottom: 2 }}>{opt.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--fg3)' }}>{opt.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={generate}
                    disabled={generating || !hasContent}
                    style={{
                      width: '100%', padding: '12px 0', borderRadius: 10,
                      fontSize: 14, fontWeight: 600, color: '#fff',
                      background: 'var(--aqua)', border: 'none',
                      cursor: generating ? 'wait' : 'pointer',
                      opacity: !hasContent ? 0.4 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                    onMouseEnter={e => { if (!generating && hasContent) e.currentTarget.style.background = 'var(--aqua-dark)' }}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--aqua)')}>
                    <Sparkles size={15} strokeWidth={2} />
                    {generating ? 'Generando...' : `Generar ${OUTPUT_OPTIONS.find(o => o.type === selectedOutput)?.label}`}
                  </button>

                  {session.generated.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg3)', marginBottom: 10 }}>
                        Generados anteriormente
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {session.generated.map((g, i) => (
                          <button
                            key={i}
                            onClick={() => { setViewContent(g); setShowGenerate(false) }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '10px 14px', borderRadius: 10,
                              background: 'var(--surface2)', border: '1px solid var(--border)',
                              cursor: 'pointer', transition: 'border-color 0.12s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{g.label}</span>
                            <span style={{ fontSize: 11, color: 'var(--fg3)' }}>{new Date(g.createdAt).toLocaleDateString('es-MX')}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>{generatedLabel}</span>
                    {!generating && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => navigator.clipboard.writeText(generatedContent)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '5px 10px', borderRadius: 8, fontSize: 12,
                            background: 'var(--aqua-bg)', border: '1px solid var(--aqua-muted)',
                            color: 'var(--aqua)', cursor: 'pointer',
                          }}>
                          <Copy size={12} /> Copiar
                        </button>
                        <button
                          onClick={() => setGeneratedContent('')}
                          style={{
                            padding: '5px 10px', borderRadius: 8, fontSize: 12,
                            background: 'var(--surface2)', border: '1px solid var(--border)',
                            color: 'var(--fg2)', cursor: 'pointer',
                          }}>
                          Nuevo
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{
                    padding: '16px', borderRadius: 12,
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap',
                    color: 'var(--fg)', maxHeight: '50vh', overflowY: 'auto',
                    fontFamily: 'inherit',
                  }}>
                    {generatedContent}
                    {generating && <span style={{ color: 'var(--aqua)', animation: 'blink 1s step-end infinite' }}>|</span>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View previously generated content */}
      {viewContent && (
        <div
          onClick={e => e.target === e.currentTarget && setViewContent(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(6px)',
          }}>
          <div style={{
            width: '100%', maxWidth: 600,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 20, display: 'flex', flexDirection: 'column',
            maxHeight: '88vh', overflow: 'hidden',
          }}>
            <div style={{
              padding: '18px 22px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>{viewContent.label}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => navigator.clipboard.writeText(viewContent.content)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 8, fontSize: 12,
                    background: 'var(--aqua-bg)', border: '1px solid var(--aqua-muted)',
                    color: 'var(--aqua)', cursor: 'pointer',
                  }}>
                  <Copy size={12} /> Copiar
                </button>
                <button
                  onClick={() => setViewContent(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg3)' }}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div style={{ overflowY: 'auto', padding: '20px 22px' }}>
              <pre style={{
                fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap',
                color: 'var(--fg)', fontFamily: 'inherit',
              }}>
                {viewContent.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
