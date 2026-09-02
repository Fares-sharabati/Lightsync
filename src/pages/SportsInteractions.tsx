import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ensureOrganizerAuth } from '../firebase/auth';
import { createSportsInteraction, closeSportsInteraction, publishSportsResult, publishSportsScreen, watchSportsInteractions, watchSportsResponses, type SportsInteraction } from '../firebase/sports';

const TEMPLATES = [
  { label: 'Next Song', question: 'Which song should play next?', options: ['Song A', 'Song B', 'Song C'] },
  { label: 'First Point', question: 'Who will score the next point?', options: ['Home Team', 'Away Team'] },
  { label: 'Halftime Score', question: 'What will the score be at halftime?', options: ['Home leads', 'Tied', 'Away leads'] },
  { label: 'Winner', question: 'Who will win?', options: ['Home Team', 'Away Team'] },
  { label: 'Next Scoring Team', question: 'Which team scores next?', options: ['Home Team', 'Away Team'] },
  { label: '30 Seconds', question: 'Will the next score happen within 30 seconds?', options: ['Yes', 'No'] },
  { label: 'Player of the Game', question: 'Who will be Player of the Game?', options: ['Player 1', 'Player 2', 'Player 3'] },
  { label: 'Final Score', question: 'What will the final result be?', options: ['Home wins', 'Draw', 'Away wins'] },
];

export default function SportsInteractions() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [items, setItems] = useState<SportsInteraction[]>([]);
  const [selected, setSelected] = useState<SportsInteraction | null>(null);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState('Home Team\nAway Team');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [responses, setResponses] = useState<Record<string, { optionId?: string; answer?: string; submittedAt: number }>>({});

  useEffect(() => {
    if (!eventId) return;
    return watchSportsInteractions(eventId, setItems);
  }, [eventId]);

  useEffect(() => {
    if (!eventId || !selected) { setResponses({}); return; }
    return watchSportsResponses(eventId, selected.id, setResponses);
  }, [eventId, selected?.id]);

  useEffect(() => {
    if (!eventId || !selected) return;
    const counts: Record<string, number> = {};
    Object.values(responses).forEach(response => { if (response.optionId) counts[response.optionId] = (counts[response.optionId] ?? 0) + 1; });
    void publishSportsResult(eventId, selected.id, { total: Object.keys(responses).length, counts, updatedAt: Date.now() }).catch(error => console.error('Could not publish sports result:', error));
  }, [eventId, selected, responses]);

  const counts = useMemo(() => {
    const value: Record<string, number> = {};
    Object.values(responses).forEach(response => { if (response.optionId) value[response.optionId] = (value[response.optionId] ?? 0) + 1; });
    return value;
  }, [responses]);

  async function create(type: 'poll' | 'question') {
    if (!eventId || !question.trim()) return setMessage('Enter a question first.');
    const labels = options.split('\n').map(value => value.trim()).filter(Boolean);
    if (type === 'poll' && labels.length < 2) return setMessage('Add at least two options.');
    setBusy(true); setMessage('');
    try {
      await ensureOrganizerAuth();
      const optionMap: Record<string, string> = {};
      labels.forEach((label, index) => { optionMap[`option_${index + 1}`] = label; });
      const id = await createSportsInteraction(eventId, { type, question: question.trim(), status: 'open', options: optionMap, createdAt: Date.now(), displayOnScreen: false, screenMode: type === 'poll' ? 'percentages' : 'question' });
      await publishSportsScreen(eventId, id, type === 'poll' ? 'results' : 'question');
      setQuestion(''); setMessage('Interaction opened and sent to the audience.');
    } catch (error) { console.error(error); setMessage('Could not create the interaction.'); } finally { setBusy(false); }
  }

  function useTemplate(template: typeof TEMPLATES[number]) {
    setQuestion(template.question); setOptions(template.options.join('\n')); setSelected(null); setMessage('');
  }

  async function closeSelected() {
    if (!eventId || !selected) return;
    setBusy(true);
    try { await closeSportsInteraction(eventId, selected.id); await publishSportsScreen(eventId, null, 'idle'); setMessage('Interaction closed.'); }
    catch (error) { console.error(error); setMessage('Could not close the interaction.'); }
    finally { setBusy(false); }
  }

  if (!eventId) return null;
  const total = Object.keys(responses).length;

  return <main className="ls-shell" style={{ minHeight: '100vh', padding: 24 }}>
    <header className="ls-header"><div><div className="ls-brand">LIGHTSYNC</div><p className="ls-eyebrow">SPORTS INTERACTIONS</p></div><button className="ls-button ls-secondary" onClick={() => navigate(`/admin/event/${eventId}`)}>BACK TO EVENT</button></header>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 1.4fr)', gap: 18, maxWidth: 1200, margin: '0 auto' }}>
      <section className="ls-card"><p className="ls-eyebrow">QUICK TEMPLATES</p><h2>Start a live interaction</h2><div style={{ display: 'grid', gap: 8, marginTop: 18 }}>{TEMPLATES.map(template => <button key={template.label} className="ls-button ls-secondary" onClick={() => useTemplate(template)} style={{ textAlign: 'left' }}>{template.label}</button>)}</div><div style={{ marginTop: 22 }}><label className="ls-eyebrow">QUESTION</label><input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask the audience..." style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)', marginTop: 8 }} /><label className="ls-eyebrow" style={{ display: 'block', marginTop: 16 }}>OPTIONS — ONE PER LINE</label><textarea value={options} onChange={e => setOptions(e.target.value)} rows={5} style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)', marginTop: 8, resize: 'vertical' }} /><div style={{ display: 'flex', gap: 10, marginTop: 14 }}><button className="ls-button ls-primary" disabled={busy} onClick={() => void create('poll')}>OPEN POLL</button><button className="ls-button ls-secondary" disabled={busy} onClick={() => void create('question')}>OPEN QUESTION</button></div>{message && <p className="ls-muted" style={{ marginTop: 12 }}>{message}</p>}</div></section>
      <section className="ls-card"><div className="ls-section-title"><div><p className="ls-eyebrow">LIVE CONTROL</p><h2>{selected ? selected.question : 'Select an interaction'}</h2></div></div><div style={{ display: 'grid', gap: 10, marginTop: 18 }}>{items.map(item => <button key={item.id} onClick={() => setSelected(item)} style={{ textAlign: 'left', padding: 14, borderRadius: 12, border: `1px solid ${selected?.id === item.id ? '#d9dde2' : 'var(--line)'}`, background: 'var(--panel)', color: 'var(--ink)', cursor: 'pointer' }}><strong>{item.question}</strong><div className="ls-muted" style={{ marginTop: 5 }}>{item.status.toUpperCase()} · {item.type.toUpperCase()}</div></button>)}</div>{selected && <><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}><strong>{total} RESPONSES</strong><button className="ls-button ls-stop" disabled={busy || selected.status === 'closed'} onClick={() => void closeSelected()}>CLOSE</button></div><div style={{ marginTop: 20 }}>{Object.entries(selected.options ?? {}).map(([id, label]) => { const count = counts[id] ?? 0; const pct = total ? Math.round(count / total * 100) : 0; return <div key={id} style={{ marginBottom: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{label}</span><strong>{pct}% · {count}</strong></div><div style={{ height: 8, background: 'var(--line)', borderRadius: 99, overflow: 'hidden', marginTop: 6 }}><div style={{ width: `${pct}%`, height: '100%', background: '#d9dde2' }} /></div></div> })}</div><button className="ls-button ls-primary" style={{ width: '100%', marginTop: 8 }} onClick={() => void publishSportsScreen(eventId, selected.id, selected.type === 'poll' ? 'results' : 'question')}>SHOW RESULTS ON BIG SCREEN</button></>}</section>
    </div>
  </main>;
}
