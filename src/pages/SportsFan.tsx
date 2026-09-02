import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ensureAnonymousAuth } from '../firebase/auth';
import { watchSportsInteractions, submitSportsResponse, type SportsInteraction } from '../firebase/sports';

export default function SportsFan() {
  const { eventId } = useParams();
  const [interaction, setInteraction] = useState<SportsInteraction | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [selected, setSelected] = useState('');
  const [answer, setAnswer] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { void ensureAnonymousAuth().then(user => setUid(user.uid)).catch(() => setError('Could not connect. Please refresh.')); }, []);
  useEffect(() => { if (!eventId) return; return watchSportsInteractions(eventId, items => setInteraction(items.find(item => item.status === 'open') ?? null)); }, [eventId]);

  async function submit() {
    if (!eventId || !uid || !interaction) return;
    if (interaction.type === 'poll' && !selected) return setError('Choose an answer.');
    if (interaction.type === 'question' && !answer.trim()) return setError('Enter an answer.');
    setError('');
    try { await submitSportsResponse(eventId, interaction.id, uid, interaction.type === 'poll' ? { optionId: selected } : { answer: answer.trim().slice(0, 200) }); setSent(true); }
    catch (err) { console.error(err); setError('Could not submit your answer.'); }
  }

  if (!interaction) return <main className="light-page"><div className="light-content"><div className="light-logo">LIGHTSYNC</div><div className="waiting-message">NO ACTIVE QUESTION</div><p className="waiting-description">Wait for the organizer to open the next interaction.</p></div></main>;
  if (sent) return <main className="light-page"><div className="light-content"><div className="light-logo">LIGHTSYNC</div><div className="connected-icon">✓</div><div className="waiting-message">ANSWER RECEIVED</div><p className="waiting-description">Thanks for participating.</p></div></main>;

  return <main className="light-page"><div className="light-content" style={{ maxWidth: 620, width: '92vw' }}><div className="light-logo">LIGHTSYNC</div><div className="light-event-name" style={{ whiteSpace: 'normal' }}>{interaction.question}</div><div style={{ display: 'grid', gap: 12, marginTop: 28, width: '100%' }}>{interaction.type === 'poll' ? Object.entries(interaction.options ?? {}).map(([id, label]) => <button key={id} className="light-join-button" style={{ fontSize: 18, margin: 0 }} onClick={() => setSelected(id)}>{label}{selected === id ? ' ✓' : ''}</button>) : <textarea value={answer} onChange={e => setAnswer(e.target.value)} maxLength={200} placeholder="Type your answer..." rows={4} style={{ width: '100%', borderRadius: 16, padding: 16, fontSize: 18 }} />}</div><button className="light-join-button" style={{ marginTop: 18 }} onClick={() => void submit()}>SUBMIT</button>{error && <p className="light-error">{error}</p>}</div></main>;
}
