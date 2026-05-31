'use client'

import {
  useState, useRef, useEffect, useCallback,
  FormEvent, KeyboardEvent,
} from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Mic, MicOff, Send, ImagePlus, X, Sparkles, ArrowLeft,
  Copy, Check, Square, FileText, BookOpen, PresentationIcon,
  Brain, ListTodo,
} from 'lucide-react'
import {
  getSession, saveSession, Session, ChatMessage,
  SESSION_LABELS, SESSION_COLORS,
} from '@/lib/sessions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OutputOption {
  type: string
  label: string
  icon: React.ReactNode
  desc: string
}

const OUTPUT_OPTIONS: OutputOption[] = [
  { type: 'summary',      label: 'Resumen',           icon: <FileText size={16} strokeWidth={1.8} />,           desc: 'Puntos clave en párrafos' },
  { type: 'studyGuide',   label: 'Guía de estudio',   icon: <BookOpen size={16} strokeWidth={1.8} />,           desc: 'Conceptos, definiciones y preguntas' },
  { type: 'presentation', label: 'Presentación',      icon: <PresentationIcon size={16} strokeWidth={1.8} />,   desc: 'Slide por slide para PowerPoint' },
  { type: 'flashcards',   label: 'Flashcards',        icon: <Brain size={16} strokeWidth={1.8} />,              desc: 'Preguntas y respuestas para repasar' },
  { type: 'actionItems',  label: 'Puntos de acción',  icon: <ListTodo size={16} strokeWidth={1.8} />,           desc: 'Tareas y seguimientos' },
]

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmtTime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function useTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (running) ref.current = setInterval(() => setSeconds(s => s + 1), 1000)
    else if (ref.current) clearInterval(ref.current)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [running])
  return seconds
}

// ─── Small components ──────────���──────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000) }}
      className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all"
      style={{ color: 'var(--fg3)' }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--aqua)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg3)')}>
      {done ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-2 group ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center mt-0.5"
          style={{ background: 'var(--aqua-bg)', border: '1px solid var(--aqua-muted)' }}>
          <Sparkles size={12} style={{ color: 'var(--aqua)' }} strokeWidth={1.8} />
        </div>
      )}
      <div className={`max-w-[82%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className="px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
          style={isUser
            ? { background: 'var(--aqua)', color: '#fff', borderRadius: '12px 12px 3px 12px' }
            : { background: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: '12px 12px 12px 3px' }
          }>
          {msg.content}
        </div>
        {!isUser && <CopyBtn text={msg.content} />}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex gap-2">
      <div className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
        style={{ background: 'var(--aqua-bg)', border: '1px solid var(--aqua-muted)' }}>
        <Sparkles size={12} style={{ color: 'var(--aqua)' }} strokeWidth={1.8} />
      </div>
      <div className="px-3.5 py-2.5 flex items-center gap-1"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px 12px 12px 3px' }}>
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full"
            style={{
              background: 'var(--aqua)',
              opacity: 0.5,
              animation: 'dot-bounce 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }} />
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [activeTab, setActiveTab] = useState<'capture' | 'chat' | 'generate'>('capture')

  // Recording
  const [isRecording, setIsRecording] = useState(false)
  const [finalTranscript, setFinalTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [noSpeechAPI, setNoSpeechAPI] = useState(false)
  const recognitionRef = useRef<any>(null)
  const isRecordingRef = useRef(false)
  const recordingSeconds = useTimer(isRecording)

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

  // Load session from localStorage
  useEffect(() => {
    const s = getSession(id)
    if (!s) { router.push('/'); return }
    setSession(s)
    setFinalTranscript(s.transcript)
    setMessages(s.messages)
    const hasSR = !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition
    setNoSpeechAPI(!hasSR)
  }, [id, router])

  // Persist to localStorage on changes
  const persist = useCallback((transcript: string, msgs: ChatMessage[]) => {
    const s = getSession(id)
    if (!s) return
    saveSession({ ...s, transcript, messages: msgs })
    setSession({ ...s, transcript, messages: msgs })
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

  // ── Images ──────────────────────────────────���──────────────────────────────

  const addImages = (files: FileList | null) => {
    if (!files) return
    Array.from(files).slice(0, 6).forEach(file => {
      const reader = new FileReader()
      reader.onload = e => {
        const dataUrl = e.target?.result as string
        const s = getSession(id)
        if (!s || s.images.length >= 6) return
        const updated = { ...s, images: [...s.images, dataUrl] }
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

  const resizeTextarea = () => {
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
          context: {
            sessionName: s?.name,
            sessionType: s?.type,
            transcript: finalTranscript,
            hasImages: (s?.images?.length || 0) > 0,
          },
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
          c[c.length - 1] = { ...c[c.length - 1], content: c[c.length - 1].content + chunk }
          return c
        })
      }
    } catch {
      setChatLoading(false)
      setMessages(p => [...p, { role: 'assistant', content: 'Error de conexión. Intenta de nuevo.' }])
    }
  }

  // ── Generate ───��───────────────────────────────────────────────────────────

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
        body: JSON.stringify({
          sessionName: s.name,
          sessionType: s.type,
          transcript: finalTranscript,
          images: s.images,
          outputType: opt.type,
        }),
      })
      if (!res.ok || !res.body) throw new Error()

      let full = ''
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = dec.decode(value)
        full += chunk
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
      setGeneratedContent('Error al generar el contenido. Verifica tu API key e intenta de nuevo.')
    } finally {
      setGenerating(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: 'var(--bg)' }}>
        <div className="w-5 h-5 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--aqua)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const sessionColor = SESSION_COLORS[session.type]
  const hasContent = !!finalTranscript.trim() || session.images.length > 0
  const wordCount = finalTranscript.split(' ').filter(Boolean).length

  // ── Capture panel ──────────────────────────────────────────────────────────

  const CapturePanel = (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* Recording section */}
      <section className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--fg3)' }}>
          Grabación de audio
        </p>

        {noSpeechAPI ? (
          <div className="px-4 py-3 rounded-lg text-sm text-center"
            style={{ background: 'var(--red-bg)', border: `1px solid ${sessionColor}33`, color: 'var(--red)' }}>
            Usa Chrome o Edge para grabar audio
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all"
              style={isRecording
                ? { background: 'var(--red-bg)', border: '1px solid var(--red)', color: 'var(--red)' }
                : { background: 'var(--aqua-bg)', border: '1px solid var(--aqua-muted)', color: 'var(--aqua)' }}>
              {isRecording ? <Square size={16} fill="currentColor" /> : <Mic size={16} />}
            </button>
            <div className="flex-1">
              {isRecording ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--red)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--red)' }}>Grabando</span>
                    <span className="text-sm font-mono ml-auto" style={{ color: 'var(--fg2)' }}>
                      {fmtTime(recordingSeconds)}
                    </span>
                  </div>
                  {interimTranscript && (
                    <p className="text-xs italic truncate" style={{ color: 'var(--fg3)' }}>
                      {interimTranscript}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--fg2)' }}>
                  {finalTranscript ? 'Grabación pausada' : 'Presiona para empezar a grabar'}
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Transcript */}
      <section className="p-5 border-b flex-1" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--fg3)' }}>
            Transcripción
          </p>
          {wordCount > 0 && (
            <span className="text-xs" style={{ color: 'var(--fg3)' }}>{wordCount} palabras</span>
          )}
        </div>
        <textarea
          value={finalTranscript}
          onChange={e => setFinalTranscript(e.target.value)}
          placeholder="La transcripción aparecerá aquí mientras grabas. También puedes escribir o pegar texto directamente."
          className="w-full resize-none text-sm outline-none leading-relaxed bg-transparent placeholder:italic"
          style={{ color: 'var(--fg)', minHeight: 120 }}
        />
      </section>

      {/* Images */}
      <section className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--fg3)' }}>
            Imágenes{session.images.length > 0 ? ` (${session.images.length}/6)` : ''}
          </p>
          {session.images.length < 6 && (
            <label
              className="text-xs font-medium px-2.5 py-1 rounded-md cursor-pointer transition-all"
              style={{ color: 'var(--aqua)', background: 'var(--aqua-bg)', border: '1px solid var(--aqua-muted)' }}>
              + Subir foto
              <input type="file" accept="image/*" multiple className="hidden"
                onChange={e => addImages(e.target.files)} />
            </label>
          )}
        </div>

        {session.images.length === 0 ? (
          <label
            className="flex flex-col items-center justify-center h-24 rounded-xl cursor-pointer transition-all"
            style={{ border: '2px dashed var(--border2)', color: 'var(--fg3)' }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); addImages(e.dataTransfer.files) }}>
            <ImagePlus size={18} strokeWidth={1.5} className="mb-1.5" />
            <span className="text-sm">Arrastra o sube fotos del pizarrón</span>
            <input type="file" accept="image/*" multiple className="hidden"
              onChange={e => addImages(e.target.files)} />
          </label>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {session.images.map((img, i) => (
              <div key={i} className="relative group aspect-square rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--border)' }}>
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  style={{ background: 'rgba(0,0,0,0.6)' }}>
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
            {session.images.length < 6 && (
              <label
                className="aspect-square rounded-lg flex items-center justify-center cursor-pointer transition-all"
                style={{ border: '2px dashed var(--border2)', color: 'var(--fg3)' }}>
                <ImagePlus size={16} strokeWidth={1.5} />
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={e => addImages(e.target.files)} />
              </label>
            )}
          </div>
        )}
      </section>
    </div>
  )

  // ── Chat panel ────────────────────────────────────���────────────────────────

  const ChatPanel = (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--aqua-bg)', border: '1px solid var(--aqua-muted)' }}>
              <Sparkles size={18} style={{ color: 'var(--aqua)' }} strokeWidth={1.5} />
            </div>
            <p className="text-sm max-w-xs leading-relaxed" style={{ color: 'var(--fg2)' }}>
              Hazme preguntas sobre lo que estás grabando. Te ayudo a entender el contenido en tiempo real.
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

      {/* Chat input */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <form
          onSubmit={(e: FormEvent) => { e.preventDefault(); sendChat(chatInput) }}
          className="flex items-end gap-2 px-3.5 py-2.5 rounded-xl transition-all"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          onFocusCapture={e => (e.currentTarget.style.borderColor = 'var(--aqua)')}
          onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
          <textarea
            ref={textareaRef}
            value={chatInput}
            onChange={e => { setChatInput(e.target.value); resizeTextarea() }}
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(chatInput) }
            }}
            placeholder="Pregunta sobre la sesión..."
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm outline-none leading-relaxed placeholder:opacity-50"
            style={{ color: 'var(--fg)', maxHeight: 120 }}
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || chatLoading}
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white transition-all disabled:opacity-30"
            style={{ background: 'var(--aqua)' }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--aqua-dark)' }}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--aqua)')}>
            <Send size={13} />
          </button>
        </form>
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <header
        className="shrink-0 flex items-center gap-3 px-4 h-14"
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
        <button
          onClick={() => { stopRecording(); router.push('/') }}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--fg3)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg3)')}>
          <ArrowLeft size={18} />
        </button>

        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-1 h-5 rounded-full shrink-0" style={{ background: sessionColor }} />
          <span className="font-semibold truncate text-sm" style={{ color: 'var(--fg)' }}>{session.name}</span>
          <span
            className="shrink-0 text-xs font-medium px-2 py-0.5 rounded"
            style={{ background: sessionColor + '15', color: sessionColor }}>
            {SESSION_LABELS[session.type]}
          </span>
        </div>

        {isRecording && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--red)' }} />
            <span className="text-xs font-mono" style={{ color: 'var(--red)' }}>{fmtTime(recordingSeconds)}</span>
          </div>
        )}

        <button
          onClick={() => setShowGenerate(true)}
          disabled={!hasContent}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-30"
          style={{ background: 'var(--aqua)' }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--aqua-dark)' }}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--aqua)')}>
          <Sparkles size={13} strokeWidth={2} />
          Generar
        </button>
      </header>

      {/* Desktop: 2 columns */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left — Capture */}
        <div className="hidden md:block w-[400px] shrink-0 border-r overflow-y-auto"
          style={{ borderColor: 'var(--border)' }}>
          {CapturePanel}
        </div>

        {/* Right — Chat */}
        <div className="hidden md:flex flex-col flex-1 overflow-hidden">
          {ChatPanel}
        </div>

        {/* Mobile tabs content */}
        <div className="flex md:hidden flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            {activeTab === 'capture' && <div className="h-full overflow-y-auto">{CapturePanel}</div>}
            {activeTab === 'chat'    && <div className="h-full">{ChatPanel}</div>}
            {activeTab === 'generate' && (
              <div className="h-full overflow-y-auto p-5 space-y-3">
                {!hasContent && (
                  <div className="px-4 py-3 rounded-lg text-sm text-center"
                    style={{ background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E' }}>
                    Graba audio o sube imágenes primero
                  </div>
                )}
                {OUTPUT_OPTIONS.map(opt => (
                  <button key={opt.type} onClick={() => setSelectedOutput(opt.type)}
                    className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all"
                    style={{
                      background: selectedOutput === opt.type ? 'var(--aqua-bg)' : 'var(--surface)',
                      border: `1px solid ${selectedOutput === opt.type ? 'var(--aqua-muted)' : 'var(--border)'}`,
                    }}>
                    <span style={{ color: selectedOutput === opt.type ? 'var(--aqua)' : 'var(--fg3)' }}>{opt.icon}</span>
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{opt.label}</div>
                      <div className="text-xs" style={{ color: 'var(--fg3)' }}>{opt.desc}</div>
                    </div>
                  </button>
                ))}
                <button onClick={generate} disabled={!hasContent || generating}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-30"
                  style={{ background: 'var(--aqua)' }}>
                  {generating ? 'Generando...' : `Generar ${OUTPUT_OPTIONS.find(o => o.type === selectedOutput)?.label}`}
                </button>
                {generatedContent && (
                  <div className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg)' }}>
                    {generatedContent}
                    {generating && <span className="cursor-blink ml-0.5" style={{ color: 'var(--aqua)' }}>|</span>}
                  </div>
                )}
                {session.generated.length > 0 && (
                  <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--fg3)' }}>Anteriores</p>
                    {session.generated.map((g, i) => (
                      <button key={i} onClick={() => setViewContent(g)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{g.label}</span>
                        <ChevronRightSmall />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile tab bar */}
          <nav className="shrink-0 grid grid-cols-3 border-t text-xs"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            {(['capture', 'chat', 'generate'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="py-3 font-medium transition-colors"
                style={{
                  color: activeTab === tab ? 'var(--aqua)' : 'var(--fg3)',
                  borderTop: `2px solid ${activeTab === tab ? 'var(--aqua)' : 'transparent'}`,
                }}>
                {tab === 'capture' ? 'Capturar' : tab === 'chat' ? 'Chat' : 'Generar'}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Generate modal (desktop) ────────────────────────────────────────── */}
      {showGenerate && (
        <div className="hidden md:flex fixed inset-0 z-50 items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-2xl rounded-2xl flex flex-col max-h-[88vh] overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
              style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="font-bold" style={{ color: 'var(--fg)' }}>Generar con IA</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--fg3)' }}>
                  {wordCount > 0 && `${wordCount} palabras`}{session.images.length > 0 && ` · ${session.images.length} imagen${session.images.length > 1 ? 'es' : ''}`}
                </p>
              </div>
              <button onClick={() => { setShowGenerate(false); setGeneratedContent('') }}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--fg3)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg3)')}>
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {!generatedContent ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-2.5">
                    {OUTPUT_OPTIONS.map(opt => (
                      <button key={opt.type} onClick={() => setSelectedOutput(opt.type)}
                        className="flex items-start gap-3 p-4 rounded-xl text-left transition-all"
                        style={{
                          background: selectedOutput === opt.type ? 'var(--aqua-bg)' : 'var(--surface2)',
                          border: `1px solid ${selectedOutput === opt.type ? 'var(--aqua-muted)' : 'var(--border)'}`,
                        }}>
                        <span className="mt-0.5" style={{ color: selectedOutput === opt.type ? 'var(--aqua)' : 'var(--fg3)' }}>
                          {opt.icon}
                        </span>
                        <div>
                          <div className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>{opt.label}</div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--fg3)' }}>{opt.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <button onClick={generate} disabled={generating}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all"
                    style={{ background: 'var(--aqua)' }}
                    onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--aqua-dark)' }}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--aqua)')}>
                    <Sparkles size={15} strokeWidth={2} />
                    {generating ? 'Generando...' : `Generar ${OUTPUT_OPTIONS.find(o => o.type === selectedOutput)?.label}`}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>{generatedLabel}</span>
                    {!generating && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigator.clipboard.writeText(generatedContent)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                          style={{ color: 'var(--aqua)', border: '1px solid var(--aqua-muted)', background: 'var(--aqua-bg)' }}>
                          <Copy size={12} /> Copiar
                        </button>
                        <button
                          onClick={() => { setGeneratedContent('') }}
                          className="text-xs px-3 py-1.5 rounded-lg transition-all"
                          style={{ color: 'var(--fg2)', border: '1px solid var(--border)', background: 'var(--surface2)' }}>
                          Nuevo
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl p-5 text-sm leading-relaxed whitespace-pre-wrap overflow-y-auto"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--fg)', maxHeight: '50vh' }}>
                    {generatedContent}
                    {generating && <span className="cursor-blink ml-0.5" style={{ color: 'var(--aqua)' }}>|</span>}
                  </div>
                </div>
              )}

              {/* Previously generated */}
              {session.generated.length > 0 && !generatedContent && (
                <div className="mt-6 pt-5 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--fg3)' }}>
                    Generados anteriormente
                  </p>
                  {session.generated.map((g, i) => (
                    <button key={i} onClick={() => { setViewContent(g); setShowGenerate(false) }}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all"
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                      <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{g.label}</span>
                      <ChevronRightSmall />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View previously generated content */}
      {viewContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-2xl rounded-2xl flex flex-col max-h-[88vh] overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
              style={{ borderColor: 'var(--border)' }}>
              <span className="font-bold" style={{ color: 'var(--fg)' }}>{viewContent.label}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(viewContent.content)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ color: 'var(--aqua)', border: '1px solid var(--aqua-muted)', background: 'var(--aqua-bg)' }}>
                  <Copy size={12} /> Copiar
                </button>
                <button onClick={() => setViewContent(null)}
                  className="p-1.5 rounded-lg" style={{ color: 'var(--fg3)' }}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <pre className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: 'var(--fg)', fontFamily: 'var(--font-inter, system-ui)' }}>
                {viewContent.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ChevronRightSmall() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ color: 'var(--fg3)', flexShrink: 0 }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
