'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { CommentDiscussionIcon, XIcon } from '@primer/octicons-react';
import { isChromelessPath } from '@/lib/marketing-routes';
import styles from './ChatFab.module.css';

type ChatCitation = {
  id: string;
  path: string;
  title: string;
};

type ChatResponse = {
  ok: boolean;
  answer?: string;
  citations?: ChatCitation[];
  refused?: boolean;
  disclaimer?: string;
  error?: string;
};

const SUGGESTIONS = [
  'How does emission_share work?',
  'How do I mine on SN74?',
  'Is Hub Score the same as TAO?',
];

const DEFAULT_DISCLAIMER =
  'Answers are retrieved from the Hub knowledge pack only. Per-repo Gittensor configs vary — verify live docs and the master registry.';

function failureResult(message: string, partial?: Partial<ChatResponse>): ChatResponse {
  return {
    ok: false,
    refused: true,
    answer: message,
    citations: partial?.citations ?? [],
    disclaimer: partial?.disclaimer ?? DEFAULT_DISCLAIMER,
  };
}

export default function ChatFab() {
  const pathname = usePathname();
  const chromeless = isChromelessPath(pathname);
  const titleId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ChatResponse | null>(null);

  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open]);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/public/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ question: trimmed }),
      });
      let json: ChatResponse;
      try {
        json = (await res.json()) as ChatResponse;
      } catch {
        setResult(failureResult(`Chat request failed (${res.status}).`));
        return;
      }
      if (!res.ok || json.ok === false) {
        setResult(
          failureResult(json.answer || json.error || `Chat request failed (${res.status}).`, json)
        );
        return;
      }
      setResult(json);
    } catch {
      setResult(failureResult('Could not reach the chat API. Try again in a moment.'));
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void ask(question);
  }

  const panel =
    open && mounted
      ? createPortal(
          <div
            className={`${styles.panel} ${chromeless ? styles.panelChromeless : styles.panelApp}`}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            data-chat-modal=""
          >
            <header className={styles.header}>
              <div>
                <h2 id={titleId} className={styles.title}>
                  Ask Hub
                </h2>
                <p className={styles.subtitle}>Retrieval-only answers from the Hub knowledge pack</p>
              </div>
              <button type="button" className={styles.close} aria-label="Close" onClick={closeModal}>
                <XIcon size={16} />
              </button>
            </header>

            <form className={styles.form} onSubmit={onSubmit}>
              <label className={styles.label} htmlFor="hub-chat-question">
                Question
              </label>
              <textarea
                id="hub-chat-question"
                ref={inputRef}
                className={styles.input}
                rows={3}
                maxLength={500}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. How does emission_share work?"
                disabled={loading}
              />
              <div className={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={styles.chip}
                    disabled={loading}
                    onClick={() => {
                      setQuestion(s);
                      void ask(s);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button type="submit" className={styles.submit} disabled={loading || !question.trim()}>
                {loading ? 'Searching…' : 'Ask'}
              </button>
            </form>

            <div className={styles.body}>
              {result ? (
                <>
                  <p className={result.refused || result.ok === false ? styles.refuse : styles.answer}>
                    {result.answer || result.error || 'No answer returned.'}
                  </p>
                  {result.citations && result.citations.length > 0 ? (
                    <ul className={styles.citations}>
                      {result.citations.map((c) => (
                        <li key={c.path}>
                          <a
                            href={`https://github.com/e35mongo/gittensor-hub/blob/main/${c.path}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {c.title}
                          </a>
                          <span className={styles.citePath}>{c.path}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {result.disclaimer ? <p className={styles.disclaimer}>{result.disclaimer}</p> : null}
                </>
              ) : (
                <p className={styles.hint}>
                  Ask about SN74 emissions, mining, Hub contributions, or Hub Score vs TAO. Answers cite the
                  knowledge pack — nothing invented.
                </p>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        className={`${styles.fab} ${chromeless ? styles.fabChromeless : styles.fabApp}`}
        aria-label={open ? 'Close Gittensor chat' : 'Open Gittensor chat'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggleOpen}
      >
        <CommentDiscussionIcon size={22} />
      </button>
      {panel}
    </>
  );
}
