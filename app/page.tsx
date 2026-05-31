'use client'

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from 'react'
import { Send, Zap, RotateCcw, Copy, Check, Sparkles } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  { icon: '✍️', text: 'Write a professional email for me' },
  { icon: '💡', text: 'Brainstorm ideas for my project' },
  { icon: '🧑‍💻', text: 'Review and improve my code' },
  { icon: '📊', text: 'Explain a complex topic simply' },
  { icon: '🌍', text: 'Translate text to another language' },
  { icon: '🎯', text: 'Help me make a decision' },
]

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000) }}
      className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-lg"
      style={{ color: 'rgba(255,255,255,0.3)' }}
      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
      title="Copy"
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 group ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5" style={{ background: 'var(--accent)', boxShadow: '0 0 12px var(--accent-glow)' }}>
          <Zap size={14} className="text-white" fill="white" />
        </div>
      )}
      <div className={`max-w-[78%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className="px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
          style={isUser
            ? { background: 'var(--accent)', color: '#fff', borderRadius: '16px 16px 4px 16px' }
            : { background: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: '16px 16px 16px 4px' }
          }
        >
          {msg.content}
        </div>
        {!isUser && <CopyBtn text={msg.content} />}
      </div>
    </div>
  )
}

function Dots() {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)' }}>
        <Zap size={14} className="text-white" fill="white" />
      </div>
      <div className="px-4 py-3 flex items-center gap-1.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px 16px 16px 4px' }}>
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent-light)', animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const resize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    const next: Message[] = [...messages, { role: 'user', content: trimmed }]
    setMessages(next)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      if (!res.ok || !res.body) throw new Error()
      setMessages(p => [...p, { role: 'assistant', content: '' }])
      setLoading(false)

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
      setLoading(false)
      setMessages(p => [...p, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    }
  }

  const onSubmit = (e: FormEvent) => { e.preventDefault(); send(input) }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>

      {/* Top bar */}
      <header className="shrink-0 flex items-center justify-between px-5 h-14 border-b" style={{ borderColor: 'var(--border)', background: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)', boxShadow: '0 0 18px var(--accent-glow)' }}>
            <Zap size={15} className="text-white" fill="white" />
          </div>
          <span className="text-base font-bold tracking-tight" style={{ color: 'var(--fg)' }}>Zynq</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(124,58,237,0.15)', color: 'var(--accent-light)', border: '1px solid rgba(124,58,237,0.3)' }}>AI</span>
        </div>
        {!isEmpty && (
          <button
            onClick={() => { setMessages([]); setInput('') }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            <RotateCcw size={12} />
            New chat
          </button>
        )}
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center min-h-full gap-10 max-w-2xl mx-auto py-12">
            <div className="text-center space-y-4">
              <div className="relative inline-flex">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #a21caf 100%)', boxShadow: '0 0 48px var(--accent-glow)' }}>
                  <Sparkles size={36} className="text-white" />
                </div>
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 animate-pulse" style={{ background: '#22c55e', borderColor: 'var(--bg)' }} />
              </div>
              <h1 className="text-4xl font-bold tracking-tight">
                Hi, I&apos;m <span style={{ color: 'var(--accent-light)' }}>Zynq</span>
              </h1>
              <p style={{ color: 'var(--muted)' }}>Your intelligent daily assistant. Ask me anything.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
              {SUGGESTIONS.map(s => (
                <button
                  key={s.text}
                  onClick={() => send(s.text)}
                  className="flex items-center gap-3 text-left px-4 py-3 rounded-xl text-sm transition-all"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'
                    e.currentTarget.style.color = 'var(--fg)'
                    e.currentTarget.style.background = 'rgba(124,58,237,0.06)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.color = 'var(--muted)'
                    e.currentTarget.style.background = 'var(--surface)'
                  }}
                >
                  <span className="text-lg">{s.icon}</span>
                  <span>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-5">
            {messages.map((m, i) => <Bubble key={i} msg={m} />)}
            {loading && <Dots />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 px-4 pb-6 pt-2">
        <div className="max-w-2xl mx-auto">
          <form
            onSubmit={onSubmit}
            className="flex items-end gap-2 px-4 py-3 rounded-2xl transition-all"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            onFocusCapture={e => (e.currentTarget.style.borderColor = 'rgba(124,58,237,0.6)')}
            onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => { setInput(e.target.value); resize() }}
              onKeyDown={onKey}
              placeholder="Ask anything..."
              rows={1}
              className="flex-1 bg-transparent resize-none text-sm outline-none leading-relaxed placeholder:opacity-40"
              style={{ color: 'var(--fg)', maxHeight: 160 }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent)', boxShadow: input.trim() ? '0 0 16px var(--accent-glow)' : 'none' }}
            >
              <Send size={14} className="text-white" />
            </button>
          </form>
          <p className="text-center text-xs mt-2 opacity-30" style={{ color: 'var(--muted)' }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
