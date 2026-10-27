import { DAY_STOPS, optionById, programById } from '@shared/demo-data';
import { AlertTriangle, ArrowUp, Info, MapPin, RotateCcw } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ProgramMark } from '../../components/bits';
import { api, localTime } from '../../lib/api';
import { money, points } from '../../lib/format';
import type { PilotReply as CopilotReply } from '../../lib/types';
import { useApp } from '../../state/app';
import { useSession } from '../../state/session';

type Msg = { id: number; role: 'user'; text: string } | { id: number; role: 'assistant'; data: CopilotReply } | { id: number; role: 'error'; text: string; retry: string };

const SUGGESTED = [
  'What’s the best use of my points?',
  'What should I use near me right now?',
  'Which points expire soon?',
  'What can I do with my points tonight?',
  'Is the $15 coffee reward worth the minimum spend?',
  'How much are all my points worth?',
];

/** The web preview can't assume you're near the sample shops, so the Pilot stands at the demo campus. */
const DEMO_SPOT = DAY_STOPS[0];

/** Renders **bold** and "- " bullet lines. Nothing else is interpreted. */
function RichText({ text }: { text: string }) {
  const blocks = text.split('\n\n');
  const inline = (s: string): ReactNode[] =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>));
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        const bullets = lines.filter((l) => l.startsWith('- '));
        const lead = lines.filter((l) => !l.startsWith('- '));
        return (
          <div key={i} className="cp-block">
            {lead.length > 0 && <p>{inline(lead.join(' '))}</p>}
            {bullets.length > 0 && <ul>{bullets.map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}</ul>}
          </div>
        );
      })}
    </>
  );
}

export function Pilot() {
  const { redeem } = useApp();
  const { preferences } = useSession();
  const located = Boolean(preferences?.privacy.location);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    document.title = 'Perkly’s Pilot · Perkly';
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: document.documentElement.dataset.motion === 'reduced' ? 'auto' : 'smooth' });
  }, [msgs, busy]);

  async function ask(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput('');
    setMsgs((m) => [...m, { id: ++idRef.current, role: 'user', text: message }]);
    setBusy(true);
    try {
      const context = { ...localTime(), lat: DEMO_SPOT.lat, lng: DEMO_SPOT.lng, source: 'simulated' as const, session: 'pilot' };
      const data = await api<CopilotReply>('/me/pilot', { method: 'POST', body: { message, context }, timeoutMs: 8000 });
      setMsgs((m) => [...m, { id: ++idRef.current, role: 'assistant', data }]);
    } catch (e) {
      setMsgs((m) => [...m, { id: ++idRef.current, role: 'error', text: (e as Error).message, retry: message }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <div className="page copilot">
      <header className="page-head copilot-head">
        <div>
          <h1 className="display page-h">Perkly’s Pilot</h1>
          <p className="page-lede">Ask how to get the most out of your points. The Pilot uses your linked balances, expiry dates, spending habits, the time and where you are.</p>
        </div>
        <div className="cp-engine">
          <p><Info aria-hidden /> No language model is connected. The Pilot matches your question to a set of points questions, and every number comes from your linked programs, the planner and the moment engine.</p>
          <p><MapPin aria-hidden /> {located ? `Location: demo campus (${DEMO_SPOT.label.replace('Walking into the ', '')})` : 'Location is off, so answers skip distance.'}</p>
        </div>
      </header>

      <div className="cp-thread" role="log" aria-live="polite" aria-label="Conversation">
        {msgs.length === 0 && (
          <div className="cp-empty">
            <p className="display cp-empty-h">What would you like to figure out?</p>
            <div className="cp-suggest">
              {SUGGESTED.map((s) => (
                <button key={s} type="button" className="cp-sugg" onClick={() => ask(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="cp-msg cp-user"><p>{m.text}</p></div>
          ) : m.role === 'error' ? (
            <div key={m.id} className="cp-msg cp-error" role="alert">
              <AlertTriangle aria-hidden />
              <div>
                <p>{m.text}</p>
                <button type="button" className="btn btn-sm" onClick={() => ask(m.retry)}><RotateCcw aria-hidden /> Try again</button>
              </div>
            </div>
          ) : (
            <div key={m.id} className="cp-msg cp-bot">
              <RichText text={m.data.reply} />
              {m.data.table && (
                <div className="cp-table-wrap" tabIndex={0} role="region" aria-label="Comparison table">
                  <table className="cp-table tabular">
                    <thead><tr>{m.data.table.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
                    <tbody>
                      {m.data.table.rows.map((r, i) => (
                        <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {m.data.cards.length > 0 && (
                <ul className="cp-cards">
                  {m.data.cards.map((id) => {
                    const o = optionById(id);
                    if (!o) return null;
                    const prog = programById(o.programId);
                    return (
                      <li key={id}>
                        <button type="button" className="cp-card" onClick={() => redeem(id)}>
                          <ProgramMark programId={o.programId} size="sm" />
                          <span>
                            <span className="cp-card-brand">{prog?.name}</span>
                            <span className="cp-card-head">{o.title}</span>
                            <span className="cp-card-meta tabular">{money(o.value)} for {points(o.cost, prog?.unit)}. Use it</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {m.data.notes.length > 0 && (
                <ul className="cp-notes" aria-label="Assumptions and limits">
                  {m.data.notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
              )}
              {m.data.followUps.length > 0 && (
                <div className="cp-follow">
                  {m.data.followUps.map((f) => (
                    <button key={f} type="button" className="chip" onClick={() => ask(f)}>{f}</button>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        {busy && (
          <div className="cp-msg cp-bot cp-typing" aria-label="The Pilot is working">
            <span /><span /><span />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="cp-input" onSubmit={submit}>
        <label htmlFor="cp-text" className="visually-hidden">Ask Perkly’s Pilot</label>
        <textarea
          id="cp-text"
          ref={inputRef}
          rows={1}
          maxLength={1000}
          placeholder="Ask about your points, a reward or a minimum spend"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void ask(input);
            }
          }}
        />
        <button type="submit" className="btn btn-primary cp-send" disabled={busy || !input.trim()} aria-label="Send">
          <ArrowUp aria-hidden />
        </button>
      </form>
    </div>
  );
}
