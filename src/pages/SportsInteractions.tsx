import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createSportsInteraction, closeSportsInteraction, publishSportsResult, publishSportsScreen, watchSportsInteractions, watchSportsResponses, type SportsInteraction } from '../firebase/sports';
import { watchSportsGame, type SportsGame } from '../firebase/sportsGame';

const TEMPLATES = [
  { label: 'Next Song', question: 'Which song should play next?', options: ['Song A', 'Song B', 'Song C'] },
  { label: 'Who Scores First?', question: 'Who will score the next point?', options: ['Home Team', 'Away Team'] },
  { label: 'First Half Score', question: 'What will the score be at halftime?', options: ['Home leads', 'Tied', 'Away leads'] },
  { label: 'Who Wins?', question: 'Who will win?', options: ['Home Team', 'Away Team'] },
  { label: 'Next Scoring Team', question: 'Which team scores next?', options: ['Home Team', 'Away Team'] },
  { label: 'Within 30 Seconds?', question: 'Will the next score happen within 30 seconds?', options: ['Yes', 'No'] },
  { label: 'Final Score', question: 'What will the final result be?', options: ['Home wins', 'Draw', 'Away wins'] },
];

type Props = { embedded?: boolean };

export default function SportsInteractions({ embedded = false }: Props) {
  const navigate = useNavigate(); const { eventId } = useParams();
  const [game, setGame] = useState<SportsGame | null>(null); const [items, setItems] = useState<SportsInteraction[]>([]); const [selected, setSelected] = useState<SportsInteraction | null>(null);
  const [question, setQuestion] = useState(''); const [options, setOptions] = useState('Home Team\nAway Team'); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [responses, setResponses] = useState<Record<string, { optionId?: string; answer?: string; submittedAt: number }>>({});

  useEffect(() => { if (!eventId) return; return watchSportsGame(eventId, setGame); }, [eventId]);
  useEffect(() => { if (!eventId) return; return watchSportsInteractions(eventId, setItems); }, [eventId]);
  useEffect(() => { if (!eventId || !selected) { setResponses({}); return; } return watchSportsResponses(eventId, selected.id, setResponses); }, [eventId, selected?.id]);
  useEffect(() => { if (!eventId || !selected) return; const counts: Record<string, number> = {}; Object.values(responses).forEach(response => { if (response.optionId) counts[response.optionId] = (counts[response.optionId] ?? 0) + 1; }); void publishSportsResult(eventId, selected.id, { total: Object.keys(responses).length, counts, updatedAt: Date.now() }).catch(error => console.error(error)); }, [eventId, selected, responses]);

  const counts = useMemo(() => { const value: Record<string, number> = {}; Object.values(responses).forEach(response => { if (response.optionId) value[response.optionId] = (value[response.optionId] ?? 0) + 1; }); return value; }, [responses]);
  const total = Object.keys(responses).length;

  function useTemplate(template: typeof TEMPLATES[number]) { const home = game?.homeTeam.name || 'Home Team'; const away = game?.awayTeam.name || 'Away Team'; setQuestion(template.question.replaceAll('Home Team', home).replaceAll('Away Team', away)); setOptions(template.options.map(value => value.replace('Home Team', home).replace('Away Team', away)).join('\n')); setSelected(null); setMessage(''); }
  async function create(type: 'poll' | 'question') {
    if (!eventId || !question.trim()) return setMessage('Enter a question first.'); const labels = options.split('\n').map(value => value.trim()).filter(Boolean); if (type === 'poll' && labels.length < 2) return setMessage('Add at least two options.');
    setBusy(true); setMessage(''); try { const optionMap: Record<string, string> = {}; labels.forEach((label, index) => { optionMap[`option_${index + 1}`] = label; }); const id = await createSportsInteraction(eventId, { type, question: question.trim(), status: 'open', options: optionMap, createdAt: Date.now(), displayOnScreen: false, screenMode: type === 'poll' ? 'percentages' : 'question' }); await publishSportsScreen(eventId, id, type === 'poll' ? 'results' : 'question'); setQuestion(''); setMessage('Interaction opened and sent to the audience.'); } catch (error) { console.error(error); setMessage('Could not create the interaction.'); } finally { setBusy(false); }
  }
  async function closeSelected() { if (!eventId || !selected) return; setBusy(true); try { await closeSportsInteraction(eventId, selected.id); await publishSportsScreen(eventId, null, 'idle'); setSelected(null); setMessage('Interaction closed.'); } catch (error) { console.error(error); setMessage('Could not close the interaction.'); } finally { setBusy(false); } }
  function openBigScreen() { if (eventId) window.open(`/sports-screen/${eventId}`, 'lightsync-sports-screen', 'noopener,noreferrer'); }

  if (!eventId) return null;
  const content = <div style={{ display: 'grid', gap: 16 }}>
    {!embedded && game && <section className="ls-card"><p className="ls-eyebrow">SPORTS EVENT &middot; {game.sport.toUpperCase()}</p><h2 style={{ margin: '5px 0' }}>{game.homeTeam.name} <span className="ls-muted">vs</span> {game.awayTeam.name}</h2></section>}
    <section className="ls-card">
      <div className="ls-section-title"><div><p className="ls-eyebrow">AUDIENCE INTERACTIONS</p><h2>Engage the crowd</h2></div>{embedded && <button className="ls-button ls-secondary" onClick={openBigScreen}>OPEN BIG SCREEN &nearr;</button>}</div>

      <div className="ls-interact-grid">
        <div>
          <p className="ls-muted">Quick questions</p>
          <div className="ls-template-list">{TEMPLATES.map(template => <button key={template.label} className="ls-template-chip" onClick={() => useTemplate(template)}><span className="ls-swatch-dot" />{template.label}</button>)}</div>
          <div className="ls-custom-question">
            <label className="ls-field-label">CUSTOM QUESTION</label>
            <input className="ls-question-input" value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask the audience..." />
            <label className="ls-field-label" style={{ marginTop: 12 }}>OPTIONS &mdash; ONE PER LINE</label>
            <textarea className="ls-textarea" value={options} onChange={e => setOptions(e.target.value)} rows={4} />
            <div className="ls-interact-actions"><button className="ls-button ls-primary" disabled={busy} onClick={() => void create('poll')}>OPEN POLL</button><button className="ls-button ls-secondary" disabled={busy} onClick={() => void create('question')}>OPEN QUESTION</button></div>
          </div>
        </div>

        <div>
          <p className="ls-muted">Live interactions</p>
          <div className="ls-interaction-list">
            {items.length === 0 && <div className="ls-empty">No interactions yet.</div>}
            {items.map(item => <button key={item.id} className={`ls-interaction-item ${selected?.id === item.id ? 'is-selected' : ''}`} onClick={() => setSelected(item)}><strong>{item.question}</strong><div className="ls-muted ls-interaction-meta">{item.status.toUpperCase()} &middot; {item.type.toUpperCase()}</div></button>)}
          </div>
          {selected && <div className="ls-interaction-detail">
            <div className="ls-interaction-detail-head"><strong>{total} RESPONSES</strong><button className="ls-button ls-stop" disabled={busy || selected.status === 'closed'} onClick={() => void closeSelected()}>CLOSE</button></div>
            {selected.type === 'poll' && <div style={{ marginTop: 14 }}>{Object.entries(selected.options ?? {}).map(([id, label]) => { const count = counts[id] ?? 0; const pct = total ? Math.round(count / total * 100) : 0; return <div key={id} className="ls-option-row"><div className="ls-option-row-top"><span>{label}</span><strong>{pct}% &middot; {count}</strong></div><div className="ls-option-track"><div className="ls-option-fill" style={{ width: `${pct}%` }} /></div></div>; })}</div>}
          </div>}
          {message && <p className="ls-muted" style={{ marginTop: 10 }}>{message}</p>}
        </div>
      </div>
    </section>
  </div>;

  if (embedded) return content;
  return <main className="ls-shell" style={{ minHeight: '100vh', padding: 24 }}><header className="ls-header"><div><div className="ls-brand">LIGHTSYNC</div><p className="ls-eyebrow">SPORTS INTERACTIONS</p></div><div style={{ display: 'flex', gap: 10 }}><button className="ls-button ls-primary" onClick={openBigScreen}>OPEN BIG SCREEN &nearr;</button><button className="ls-button ls-secondary" onClick={() => navigate(`/admin/event/${eventId}`)}>BACK TO EVENT</button></div></header><div style={{ maxWidth: 1200, margin: '0 auto' }}>{content}</div></main>;
}
