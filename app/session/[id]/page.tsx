'use client'

import { useState, useRef, useEffect, useCallback, FormEvent, KeyboardEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Mic, MicOff, Send, ImagePlus, X, Sparkles, ArrowLeft,
  Copy, Check, Zap, FileText, BookOpen, Presentation, Brain, ListTodo,
} from 'lucide-react'
import { getSession, saveSession, Session, ChatMessage, SESSION_ICONS, SESSION_LABELS, SESSION_COLORS } from '@/lib/sessions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OutputOption {
  type: string
  label: string
  icon: React.ReactNode
  prompt: string
  color: string
}

const OUTPUT_OPTIONS: OutputOption[] = [
  { type: 'summary',      label: 'Resumen',          icon: <FileText size={18} />,    color: '#3b82f6', prompt: 'summary' },
  { type: 'studyGuide',   label: 'Guía de estudio',  icon: <BookOpen size={18} />,    color: '#22c55e', prompt: 'studyGuide' },
  { type: 'presentation', label: 'Presentación',     icon: <Presentation size={18} />,color: '#f59e0b', prompt: 'presentation' },
  { type: 'flashcards',   label: 'Flashcards',       icon: <Brain size={18} />,       color: '#a855f7', prompt: 'flashcards' },
  { type: 'actionItems',  label: 'Puntos de acción', icon: <ListTodo size={18} />,    color: '#ef4444', prompt: 'actionItems' },
]

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (running) intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    else { if (intervalRef.current) clearInterval(intervalRef.current) }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])
  const reset = () => setSeconds(0)
  return { seconds, reset }
}

function fmtTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000) }}
      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all text-xs flex items-center gap-1"
      style={{ color: 'var(--fg2)' }} title="Copiar">
      {done ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-2.5 group ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
          style={{ background: 'var(--accent)', boxShadow: '0 0 10px var(--accent-glow)' }}>
          <Zap size={12} fill="white" className="text-white" />
        </div>
      )}
      <div className={`max-w-[85%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div className="px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
          style={isUser
            ? { background: 'var(--accent)', color: '#fff', borderRadius: '14px 14px 3px 14px' }
            : { background: 'var(--surface2)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: '14px 14px 14px 3px' }
          }>
          {msg.content}
        </div>
        {!isUser && <CopyBtn text={msg.content} />}
      </div>
    </div>
  )
}

function Dots() {
  return (
    <div className="flex gap-2.5">
      <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
        <Zap size={12} fill="white" className="text-white" />
      </div>
      <div className="px-3.5 py-2.5 flex items-center gap-1" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '14px 14px 14px 3px' }}>
        {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent-light)', animationDelay: `${i*0.15}s` }} />)}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [activeTab, setActiveTab] = useState<'capture' | 'chat' | 'generate'>('capture')

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [finalTranscript, setFinalTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [recordingSupported, setRecordingSupported] = useState(true)
  const recognitionRef = useRef<any>(null)
  const isRecordingRef = useRef(false)
  const { seconds: recordingSeconds } = useTimer(isRecording)

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Generate state
  const [generating, setGenerating] = useState(false)
  const [selectedOutput, setSelectedOutput] = useState<string>('studyGuide')
  const [generatedContent, setGeneratedContent] = useState<string>('')
  const [generatingType, setGeneratingType] = useState<string>('')
  const [showGenerated, setShowGenerated] = useState(false)
  const [viewingGenerated, setViewingGenerated] = useState<{ label: string; content: string } | null>(null)

  // Load session
  useEffect(() => {
    const s = getSession(id)
    if (!s) { router.push('/'); return }
    setSession(s)
    setFinalTranscript(s.transcript)
    setMessages(s.messages)
    setRecordingSupported(!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition)
  }, [id, router])

  // Auto-save transcript + messages to session
  const persistSession = useCallback((transcript: string, msgs: ChatMessage[]) => {
    const s = getSession(id)
    if (!s) return
    const updated = { ...s, transcript, messages: msgs }
    saveSession(updated)
    setSession(updated)
  }, [id])

  useEffect(() => { persistSession(finalTranscript, messages) }, [finalTranscript, messages, persistSession])

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, chatLoading])

  // ── Recording ──────────────────────────────────────────────────────────────

  const startRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setRecordingSupported(false); return }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'es-MX'

    recognition.onresult = (e: any) => {
      let interim = '', final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      if (final) setFinalTranscript(p => p + final)
      setInterimTranscript(interim)
    }
    recognition.onerror = () => { setIsRecording(false); isRecordingRef.current = false }
    recognition.onend = () => {
      if (isRecordingRef.current) {
        try { recognition.start() } catch {}
      }
    }

    recognitionRef.current = recognition
    isRecordingRef.current = true
    recognition.start()
    setIsRecording(true)
  }

  const stopRecording = () => {
    isRecordingRef.current = false
    recognitionRef.current?.stop()
    setIsRecording(false)
    setInterimTranscript('')
  }

  // ── Images ─────────────────────────────────────────────────────────────────

  const handleImageUpload = (files: FileList | null) => {
    if (!files || !session) return
    Array.from(files).slice(0, 6 - (session.images?.length || 0)).forEach(file => {
      const reader = new FileReader()
      reader.onload = e => {
        const dataUrl = e.target?.result as string
        const s = getSession(id)
        if (!s) return
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

  const resize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const sendChat = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || chatLoading) return
    const s = getSession(id)
    const newMsgs: ChatMessage[] = [...messages, { role: 'user', content: trimmed }]
    setMessages(newMsgs)
    setChatInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setChatLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMsgs,
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
        setMessages(p => {
          const c = [...p]
          c[c.length - 1] = { ...c[c.length - 1], content: c[c.length - 1].content + dec.decode(value) }
          return c
        })
      }
    } catch {
      setChatLoading(false)
      setMessages(p => [...p, { role: 'assistant', content: 'Error al conectar. Intenta de nuevo.' }])
    }
  }

  const onChatSubmit = (e: FormEvent) => { e.preventDefault(); sendChat(chatInput) }
  const onChatKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(chatInput) }
  }

  // ── Generate ───────────────────────────────────────────────────────────────

  const generate = async () => {
    const s = getSession(id)
    if (!s || (!finalTranscript && s.images.length === 0)) return
    const opt = OUTPUT_OPTIONS.find(o => o.type === selectedOutput)!
    setGenerating(true)
    setGeneratingType(opt.label)
    setGeneratedContent('')
    setShowGenerated(true)

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
      // Save to session
      const updated = {
        ...s,
        generated: [...s.generated.filter(g => g.type !== opt.type), {
          type: opt.type, label: opt.label, content: full, createdAt: new Date().toISOString()
        }],
        status: 'ended' as const,
      }
      saveSession(updated)
      setSession(updated)
    } catch {
      setGeneratedContent('Error al generar. Verifica tu conexión e intenta de nuevo.')
    } finally {
      setGenerating(false)
    }
  }

  if (!session) return (
    <div className="flex items-center justify-center h-full" style={{ background: 'var(--bg)' }}>
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  const sessionColor = SESSION_COLORS[session.type]
  const hasContent = !!finalTranscript || (session.images?.length || 0) > 0

  // ─── Capture Panel ─────────────────────────────────────────────────────────

  const CapturePanel = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Recording */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--fg2)' }}>Grabación</span>
          {isRecording && <span className="text-sm font-mono" style={{ color: '#ef4444' }}>{fmtTime(recordingSeconds)}</span>}
        </div>

        {!recordingSupported ? (
          <div className="px-4 py-3 rounded-xl text-sm text-center" style={{ background: '#ef444422', border: '1px solid #ef444444', color: '#fca5a5' }}>
            🎙 Usa Chrome o Edge para grabar audio
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button onClick={isRecording ? stopRecording : startRecording}
              className="relative w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0"
              style={isRecording
                ? { background: '#ef4444', boxShadow: '0 0 20px rgba(239,68,68,0.5)' }
                : { background: 'var(--surface2)', border: '1px solid var(--border2)' }}>
              {isRecording && <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: '#ef4444' }} />}
              {isRecording ? <MicOff size={18} className="text-white" /> : <Mic size={18} style={{ color: 'var(--fg2)' }} />}
            </button>
            <div className="flex-1 min-w-0">
              {isRecording ? (
                <div className="flex items-end gap-0.5 h-8">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <span key={i} className="wave-bar flex-1 rounded-sm" style={{ background: '#ef4444', opacity: 0.4 + Math.random() * 0.6, animationDelay: `${i * 0.05}s` }} />
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--fg2)' }}>
                  {finalTranscript ? 'Grabación pausada — continúa cuando quieras' : 'Presiona para empezar a grabar la clase'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Live transcript preview */}
        {(finalTranscript || interimTranscript) && (
          <div className="mt-3 max-h-24 overflow-y-auto rounded-xl p-3 text-sm" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', lineHeight: 1.6 }}>
            <span style={{ color: 'var(--fg)' }}>{finalTranscript}</span>
            <span style={{ color: 'var(--fg2)', fontStyle: 'italic' }}>{interimTranscript}</span>
          </div>
        )}
      </div>

      {/* Full transcript editor */}
      {finalTranscript && (
        <div className="p-4 border-b flex-1 flex flex-col min-h-0" style={{ borderColor: 'var(--border)' }}>
          <span className="text-xs font-semibold uppercase tracking-widest mb-2 block shrink-0" style={{ color: 'var(--fg2)' }}>
            Transcripción completa ({finalTranscript.split(' ').length} palabras)
          </span>
          <textarea
            value={finalTranscript}
            onChange={e => setFinalTranscript(e.target.value)}
            className="flex-1 w-full bg-transparent resize-none text-sm outline-none leading-relaxed overflow-y-auto"
            style={{ color: 'var(--fg)', minHeight: 80 }}
            placeholder="La transcripción aparecerá aquí..."
          />
        </div>
      )}

      {/* Images */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--fg2)' }}>
            Imágenes {session.images?.length > 0 && `(${session.images.length})`}
          </span>
          <label className="cursor-pointer flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all"
            style={{ color: 'var(--accent-light)', border: '1px solid rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.08)' }}>
            <ImagePlus size={12} /> Subir foto
            <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleImageUpload(e.target.files)} />
          </label>
        </div>

        {(session.images?.length || 0) === 0 ? (
          <label className="flex flex-col items-center justify-center gap-2 h-24 rounded-xl cursor-pointer transition-all"
            style={{ border: '2px dashed var(--border2)', color: 'var(--fg2)' }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleImageUpload(e.dataTransfer.files) }}>
            <ImagePlus size={20} />
            <span className="text-sm">Sube fotos del pizarrón o slides</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleImageUpload(e.target.files)} />
          </label>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {session.images.map((img, i) => (
              <div key={i} className="relative group aspect-square rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--border)' }}>
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  style={{ background: 'rgba(0,0,0,0.7)' }}>
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
            {(session.images?.length || 0) < 6 && (
              <label className="aspect-square rounded-xl flex items-center justify-center cursor-pointer transition-all"
                style={{ border: '2px dashed var(--border2)', color: 'var(--fg2)' }}>
                <ImagePlus size={18} />
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleImageUpload(e.target.files)} />
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  )

  // ─── Chat Panel ────────────────────────────────────────────────────────────

  const ChatPanel = () => (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
              <Zap size={18} style={{ color: 'var(--accent-light)' }} />
            </div>
            <p className="text-sm max-w-xs" style={{ color: 'var(--fg2)' }}>
              Hazme preguntas sobre lo que estás grabando. Te ayudo a entender mientras escuchas.
            </p>
          </div>
        ) : (
          <>
            {messages.map((m, i) => <Bubble key={i} msg={m} />)}
            {chatLoading && <Dots />}
          </>
        )}
        <div ref={chatBottomRef} />
      </div>
      <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <form onSubmit={onChatSubmit} className="flex items-end gap-2 px-3 py-2.5 rounded-xl transition-all"
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
          onFocusCapture={e => (e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)')}
          onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
          <textarea ref={textareaRef} value={chatInput}
            onChange={e => { setChatInput(e.target.value); resize() }}
            onKeyDown={onChatKey}
            placeholder="Pregunta sobre la clase..."
            rows={1} className="flex-1 bg-transparent resize-none text-sm outline-none leading-relaxed placeholder:opacity-40"
            style={{ color: 'var(--fg)', maxHeight: 120 }} />
          <button type="submit" disabled={!chatInput.trim() || chatLoading}
            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-20"
            style={{ background: 'var(--accent)', boxShadow: chatInput.trim() ? '0 0 12px var(--accent-glow)' : 'none' }}>
            <Send size={13} className="text-white" />
          </button>
        </form>
      </div>
    </div>
  )

  // ─── Generate Panel ────────────────────────────────────────────────────────

  const GeneratePanel = () => (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      {!hasContent && (
        <div className="px-4 py-3 rounded-xl text-sm text-center" style={{ background: '#f59e0b22', border: '1px solid #f59e0b44', color: '#fcd34d' }}>
          ⚠️ Graba audio o sube imágenes primero para generar contenido
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--fg2)' }}>¿Qué quieres generar?</p>
        <div className="grid grid-cols-1 gap-2">
          {OUTPUT_OPTIONS.map(opt => (
            <button key={opt.type} onClick={() => setSelectedOutput(opt.type)}
              className="flex items-center gap-3 p-3.5 rounded-xl text-left transition-all"
              style={{
                background: selectedOutput === opt.type ? opt.color + '20' : 'var(--surface2)',
                border: `1px solid ${selectedOutput === opt.type ? opt.color + '60' : 'var(--border)'}`,
              }}>
              <span style={{ color: selectedOutput === opt.type ? opt.color : 'var(--fg2)' }}>{opt.icon}</span>
              <span className="font-medium text-sm" style={{ color: selectedOutput === opt.type ? 'var(--fg)' : 'var(--fg2)' }}>{opt.label}</span>
              {selectedOutput === opt.type && <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: opt.color + '30', color: opt.color }}>Seleccionado</span>}
            </button>
          ))}
        </div>
      </div>

      <button onClick={generate} disabled={!hasContent || generating}
        className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-30"
        style={{ background: 'var(--accent)', boxShadow: hasContent ? '0 0 20px var(--accent-glow)' : 'none' }}>
        <Sparkles size={16} />
        {generating ? 'Generando...' : 'Generar con IA'}
      </button>

      {/* Previously generated */}
      {session.generated.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--fg2)' }}>Generados anteriormente</p>
          <div className="space-y-2">
            {session.generated.map((g, i) => (
              <button key={i} onClick={() => { setViewingGenerated(g); setShowGenerated(true) }}
                className="w-full flex items-center justify-between p-3 rounded-xl text-left transition-all"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                <span className="text-sm font-medium text-white">{g.label}</span>
                <span className="text-xs" style={{ color: 'var(--fg2)' }}>{new Date(g.createdAt).toLocaleDateString('es-MX')}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="shrink-0 flex items-center gap-3 px-4 h-14 border-b"
        style={{ borderColor: 'var(--border)', background: 'rgba(9,9,11,0.9)', backdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => { stopRecording(); router.push('/') }}
          className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--fg2)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg2)')}>
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-lg shrink-0">{SESSION_ICONS[session.type]}</span>
          <span className="font-semibold text-white truncate">{session.name}</span>
          <span className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: sessionColor + '22', color: sessionColor }}>
            {SESSION_LABELS[session.type]}
          </span>
        </div>
        {isRecording && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#ef4444' }} />
            <span className="text-sm font-mono" style={{ color: '#ef4444' }}>{fmtTime(recordingSeconds)}</span>
          </div>
        )}
      </header>

      {/* Desktop: 2-column | Mobile: tabs */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop left panel */}
        <div className="hidden md:flex flex-col w-[420px] shrink-0 border-r overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <CapturePanel />
        </div>
        {/* Desktop right panel */}
        <div className="hidden md:flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden"><ChatPanel /></div>
        </div>

        {/* Mobile tabs */}
        <div className="flex md:hidden flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            {activeTab === 'capture' && <div className="h-full overflow-y-auto"><CapturePanel /></div>}
            {activeTab === 'chat' && <div className="h-full"><ChatPanel /></div>}
            {activeTab === 'generate' && <GeneratePanel />}
          </div>
          <nav className="shrink-0 flex border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            {(['capture', 'chat', 'generate'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="flex-1 py-3 text-xs font-medium transition-colors capitalize"
                style={{ color: activeTab === tab ? 'var(--accent-light)' : 'var(--fg2)', borderTop: activeTab === tab ? `2px solid var(--accent)` : '2px solid transparent' }}>
                {tab === 'capture' ? '🎙 Capturar' : tab === 'chat' ? '💬 Chat' : '✨ Generar'}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Desktop Generate sidebar toggle */}
      <div className="hidden md:block shrink-0 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 px-4 py-2">
          <button onClick={() => setShowGenerated(p => !p)}
            disabled={!hasContent}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-30"
            style={{ background: 'var(--accent)', boxShadow: hasContent ? '0 0 16px var(--accent-glow)' : 'none' }}>
            <Sparkles size={14} /> Generar contenido
          </button>
          <span className="text-xs" style={{ color: 'var(--fg2)' }}>
            {hasContent ? `${finalTranscript.split(' ').filter(Boolean).length} palabras · ${session.images.length} imágenes` : 'Graba o sube imágenes primero'}
          </span>
        </div>
      </div>

      {/* Generate overlay (desktop) */}
      {showGenerated && !viewingGenerated && (
        <div className="hidden md:flex fixed inset-0 z-50 items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-2xl rounded-3xl flex flex-col max-h-[85vh]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border2)' }}>
            <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-lg font-bold text-white">Generar con IA</h3>
              <button onClick={() => { setShowGenerated(false); setGeneratedContent('') }} style={{ color: 'var(--fg2)' }}>
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {!generatedContent ? (
                <div className="space-y-4">
                  <p className="text-sm" style={{ color: 'var(--fg2)' }}>Selecciona qué quieres generar a partir de la sesión:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {OUTPUT_OPTIONS.map(opt => (
                      <button key={opt.type} onClick={() => setSelectedOutput(opt.type)}
                        className="flex items-center gap-3 p-4 rounded-2xl text-left transition-all"
                        style={{
                          background: selectedOutput === opt.type ? opt.color + '18' : 'var(--surface2)',
                          border: `1px solid ${selectedOutput === opt.type ? opt.color + '60' : 'var(--border)'}`,
                        }}>
                        <span style={{ color: selectedOutput === opt.type ? opt.color : 'var(--fg2)' }}>{opt.icon}</span>
                        <span className="font-medium text-sm" style={{ color: 'var(--fg)' }}>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={generate} disabled={generating}
                    className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all"
                    style={{ background: 'var(--accent)', boxShadow: '0 0 20px var(--accent-glow)' }}>
                    <Sparkles size={16} />
                    {generating ? 'Generando...' : `Generar ${OUTPUT_OPTIONS.find(o => o.type === selectedOutput)?.label}`}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{generatingType}</span>
                    {!generating && (
                      <button onClick={() => navigator.clipboard.writeText(generatedContent)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                        style={{ color: 'var(--accent-light)', border: '1px solid rgba(124,58,237,0.3)' }}>
                        <Copy size={12} /> Copiar
                      </button>
                    )}
                  </div>
                  <div className="rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-wrap overflow-y-auto max-h-96"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--fg)', fontFamily: 'system-ui' }}>
                    {generatedContent}
                    {generating && <span className="animate-pulse text-purple-400">▋</span>}
                  </div>
                  {!generating && (
                    <button onClick={() => { setGeneratedContent(''); setShowGenerated(true) }}
                      className="text-sm" style={{ color: 'var(--fg2)' }}>
                      ← Generar otro tipo
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View previously generated */}
      {viewingGenerated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-2xl rounded-3xl flex flex-col max-h-[85vh]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border2)' }}>
            <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
              <span className="font-bold text-white">{viewingGenerated.label}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => navigator.clipboard.writeText(viewingGenerated.content)}
                  className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                  style={{ color: 'var(--accent-light)', border: '1px solid rgba(124,58,237,0.3)' }}>
                  <Copy size={12} /> Copiar
                </button>
                <button onClick={() => setViewingGenerated(null)} style={{ color: 'var(--fg2)' }}>
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <pre className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--fg)', fontFamily: 'system-ui' }}>
                {viewingGenerated.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
