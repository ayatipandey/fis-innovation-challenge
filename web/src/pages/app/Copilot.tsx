import { AlertTriangle, ArrowUp, Info, RotateCcw } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { api, localTime } from '../../lib/api';
import { expiryPhrase } from '../../lib/format';
import { useData } from '../../state/data';

interface CopilotReply {
  reply: string;
  cards: string[];
  table: { columns: string[]; rows: string[][] } | null;
  notes: string[];
  followUps: string[];
  engine: string;
}

type Msg = { id: number; role: 'user'; text: string } | { id: number; role: 'assistant'; data: CopilotReply } | { id: number; role: 'error'; text: string; retry: string };

const SUGGESTED = [
  'Find food rewards relevant to me.',
  'Which of my rewards expires soon?',
  'Should I use miles for a seat upgrade or save them for a ticket?',
  'Which of these offers gives me better value?',
  'Find rewards from my favorite brands.',
  'Is this offer worth the minimum spend?',
];

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

export function Copilot() {
  const d = useData();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    document.title = 'AI Copilot · Perkly';
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
      const data = await api<CopilotReply>('/me/copilot', { method: 'POST', body: { message, ...localTime() }, timeoutMs: 8000 });
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
          <h1 className="display page-h">AI Copilot</h1>
          <p className="page-lede">Ask about your rewards. Answers use your demo rewards, balances and the preferences you’ve allowed.</p>
        </div>
        <p className="cp-engine"><Info aria-hidden /> Rule-based assistant. No language model is connected, so it answers a set of reward questions rather than anything at all.</p>
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
                    const o = d.offer(id);
                    if (!o) return null;
                    const b = d.brand(o.brandId);
                    return (
                      <li key={id}>
                        <button type="button" className="cp-card" onClick={() => d.openReward(id)}>
                          <span className="monogram sm" aria-hidden>{b?.monogram}</span>
                          <span>
                            <span className="cp-card-brand">{b?.name}</span>
                            <span className="cp-card-head">{o.benefit.summary}</span>
                            <span className="cp-card-meta">{expiryPhrase(o.expiresAt)}. View reward</span>
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
          <div className="cp-msg cp-bot cp-typing" aria-label="Copilot is working">
            <span /><span /><span />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="cp-input" onSubmit={submit}>
        <label htmlFor="cp-text" className="visually-hidden">Ask the Copilot</label>
        <textarea
          id="cp-text"
          ref={inputRef}
          rows={1}
          maxLength={1000}
          placeholder="Ask about a reward, a balance, or a comparison"
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
