import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createSportsInteraction, closeSportsInteraction, publishSportsResult, publishSportsScreen, watchSportsInteractions, watchSportsResponses, type SportsInteraction } from '../firebase/sports';
import { getSportsLightColor, saveSportsGame, uploadTeamLogo, watchSportsGame, type SportsGame, type SportsTeam } from '../firebase/sportsGame';

const TEMPLATES = [
  { label: 'Next Song', question: 'Which song should play next?', options: ['Song A', 'Song B', 'Song C'] },
  { label: 'Next Point', question: 'Who will score the next point?', options: ['Home Team', 'Away Team'] },
  { label: 'Halftime', question: 'What will the score be at halftime?', options: ['Home leads', 'Tied', 'Away leads'] },
  { label: 'Winner', question: 'Who will win?', options: ['Home Team', 'Away Team'] },
  { label: 'Next Scoring Team', question: 'Which team scores next?', options: ['Home Team', 'Away Team'] },
  { label: '30 Seconds', question: 'Will the next score happen within 30 seconds?', options: ['Yes', 'No'] },
  { label: 'Final Score', question: 'What will the final result be?', options: ['Home wins', 'Draw', 'Away wins'] },
];

const emptyTeam = (name: string): SportsTeam => ({ name, primaryColor: '#FFFFFF', secondaryColor: '#111111' });

export default function SportsInteractions() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [game, setGame] = useState<SportsGame | null>(null);
  const [sport, setSport] = useState('Basketball');
  const [home, setHome] = useState<SportsTeam>(emptyTeam('Home Team'));
  const [away, setAway] = useState<SportsTeam>(emptyTeam('Away Team'));
  const [lightTeam, setLightTeam] = useState<SportsGame['lightTeam']>('home');
  const [customLightColor, setCustomLightColor] = useState('#FFFFFF');
  const [savingGame, setSavingGame] = useState(false);
  const [gameMessage, setGameMessage] = useState('');
  const [logoBusy, setLogoBusy] = useState<'home' | 'away' | null>(null);
  const [items, setItems] = useState<SportsInteraction[]>([]);
  const [selected, setSelected] = useState<SportsInteraction | null>(null);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState('Home Team\nAway Team');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [responses, setResponses] = useState<Record<string, { optionId?: string; answer?: string; submittedAt: number }>>({});

  useEffect(() => {
    if (!eventId) return;
    return watchSportsGame(eventId, value => {
      if (!value) return;
      setGame(value); setSport(value.sport || 'Basketball'); setHome(value.homeTeam); setAway(value.awayTeam); setLightTeam(value.lightTeam || 'home'); setCustomLightColor(value.customLightColor || '#FFFFFF');
    });
  }, [eventId]);

  useEffect(() => { if (!eventId) return; return watchSportsInteractions(eventId, setItems); }, [eventId]);
  useEffect(() => { if (!eventId || !selected) { setResponses({}); return; } return watchSportsResponses(eventId, selected.id, setResponses); }, [eventId, selected?.id]);
  useEffect(() => {
    if (!eventId || !selected) return;
    const counts: Record<string, number> = {};
    Object.values(responses).forEach(response => { if (response.optionId) counts[response.optionId] = (counts[response.optionId] ?? 0) + 1; });
    void publishSportsResult(eventId, selected.id, { total: Object.keys(responses).length, counts, updatedAt: Date.now() }).catch(error => console.error('Could not publish sports result:', error));
  }, [eventId, selected, responses]);

  const counts = useMemo(() => { const value: Record<string, number> = {}; Object.values(responses).forEach(response => { if (response.optionId) value[response.optionId] = (value[response.optionId] ?? 0) + 1; }); return value; }, [responses]);

  async function saveGame() {
    if (!eventId || !home.name.trim() || !away.name.trim()) return setGameMessage('Enter both team names.');
    setSavingGame(true); setGameMessage('');
    try {
      await saveSportsGame(eventId, { sport, homeTeam: { ...home, name: home.name.trim() }, awayTeam: { ...away, name: away.name.trim() }, lightTeam, customLightColor });
      setGameMessage('Team setup saved.');
    } catch (error) { console.error(error); setGameMessage('Could not save team setup.'); } finally { setSavingGame(false); }
  }

  async function handleLogo(side: 'home' | 'away', event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file || !eventId) return;
    setLogoBusy(side); setGameMessage('Uploading logo...');
    try {
      const logoUrl = await uploadTeamLogo(eventId, side, file);
      if (side === 'home') setHome(value => ({ ...value, logoUrl })); else setAway(value => ({ ...value, logoUrl }));
      setGameMessage('Logo uploaded. Save team setup to keep it.');
    } catch (error) { console.error(error); setGameMessage(error instanceof Error ? error.message : 'Could not upload logo.'); } finally { setLogoBusy(null); event.target.value = ''; }
  }

  async function create(type: 'poll' | 'question') {
    if (!eventId || !question.trim()) return setMessage('Enter a question first.');
    const labels = options.split('\n').map(value => value.trim()).filter(Boolean);
    if (type === 'poll' && labels.length < 2) return setMessage('Add at least two options.');
    setBusy(true); setMessage('');
    try {
      const optionMap: Record<string, string> = {};
      labels.forEach((label, index) => { optionMap[`option_${index + 1}`] = label; });
      const id = await createSportsInteraction(eventId, { type, question: question.trim(), status: 'open', options: optionMap, createdAt: Date.now(), displayOnScreen: false, screenMode: type === 'poll' ? 'percentages' : 'question' });
      await publishSportsScreen(eventId, id, type === 'poll' ? 'results' : 'question');
      setQuestion(''); setMessage('Interaction opened and sent to the audience.');
    } catch (error) { console.error(error); setMessage('Could not create the interaction.'); } finally { setBusy(false); }
  }

  function useTemplate(template: typeof TEMPLATES[number]) {
    const mapped = template.options.map(value => value.replace('Home Team', home.name || 'Home Team').replace('Away Team', away.name || 'Away Team'));
    setQuestion(template.question.replaceAll('Home Team', home.name || 'Home Team').replaceAll('Away Team', away.name || 'Away Team'));
    setOptions(mapped.join('\n')); setSelected(null); setMessage('');
  }

  function openBigScreen() { if (eventId) window.open(`/sports-screen/${eventId}`, 'lightsync-sports-screen', 'noopener,noreferrer'); }
  async function closeSelected() { if (!eventId || !selected) return; setBusy(true); try { await closeSportsInteraction(eventId, selected.id); await publishSportsScreen(eventId, null, 'idle'); setMessage('Interaction closed.'); } catch (error) { console.error(error); setMessage('Could not close the interaction.'); } finally { setBusy(false); } }

  if (!eventId) return null;
  const total = Object.keys(responses).length;
  const lightColor = game ? getSportsLightColor(game) : '#FFFFFF';
  const teamCard = (side: 'home' | 'away', team: SportsTeam, setTeam: React.Dispatch<React.SetStateAction<SportsTeam>>) => <div className="ls-card" style={{ borderTop: `4px solid ${team.primaryColor}` }}><div className="ls-eyebrow">{side === 'home' ? 'HOME TEAM' : 'AWAY TEAM'}</div><div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 12 }}><div style={{ width: 76, height: 76, borderRadius: 18, border: '1px solid var(--line)', background: 'var(--panel)', display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 }}>{team.logoUrl ? <img src={team.logoUrl} alt="Team logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontWeight: 900, fontSize: 26 }}>{team.name.slice(0, 2).toUpperCase()}</span>}</div><div style={{ flex: 1 }}><input value={team.name} onChange={e => setTeam(value => ({ ...value, name: e.target.value }))} placeholder="Team name" style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)', fontWeight: 800 }} /><label className="ls-upload" style={{ marginTop: 8, display: 'inline-flex' }}><span>{logoBusy === side ? 'UPLOADING...' : team.logoUrl ? 'CHANGE LOGO' : 'ADD LOGO'}</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={logoBusy !== null} onChange={e => void handleLogo(side, e)} /></label></div></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}><label className="ls-muted">PRIMARY<input type="color" value={team.primaryColor} onChange={e => setTeam(value => ({ ...value, primaryColor: e.target.value.toUpperCase() }))} style={{ display: 'block', width: '100%', height: 42, marginTop: 5 }} /></label><label className="ls-muted">SECONDARY<input type="color" value={team.secondaryColor} onChange={e => setTeam(value => ({ ...value, secondaryColor: e.target.value.toUpperCase() }))} style={{ display: 'block', width: '100%', height: 42, marginTop: 5 }} /></label></div></div>;

  return <main className="ls-shell" style={{ minHeight: '100vh', padding: 24 }}>
    <header className="ls-header"><div><div className="ls-brand">LIGHTSYNC</div><p className="ls-eyebrow">SPORTS</p></div><div style={{ display: 'flex', gap: 10 }}><button className="ls-button ls-primary" onClick={openBigScreen}>OPEN BIG SCREEN ↗</button><button className="ls-button ls-secondary" onClick={() => navigate(`/admin/event/${eventId}`)}>BACK TO EVENT</button></div></header>
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gap: 18 }}>
      <section className="ls-card"><div className="ls-eyebrow">GAME SETUP</div><h2>Team branding</h2><p className="ls-muted">Keep this lightweight: team identity only. No player roster or live score data is stored.</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18 }}>{teamCard('home', home, setHome)}{teamCard('away', away, setAway)}</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 18 }}><label className="ls-muted">SPORT<select value={sport} onChange={e => setSport(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 6, padding: 12, borderRadius: 10, background: 'var(--panel)', color: 'var(--ink)', border: '1px solid var(--line)' }}><option>Basketball</option><option>Football</option><option>Volleyball</option><option>Handball</option><option>Other</option></select></label><label className="ls-muted">LIGHT COLOR<select value={lightTeam} onChange={e => setLightTeam(e.target.value as SportsGame['lightTeam'])} style={{ display: 'block', width: '100%', marginTop: 6, padding: 12, borderRadius: 10, background: 'var(--panel)', color: 'var(--ink)', border: '1px solid var(--line)' }}><option value="home">Home team</option><option value="away">Away team</option><option value="custom">Custom</option></select></label><label className="ls-muted">PREVIEW<input type="color" value={lightColor} disabled={lightTeam !== 'custom'} onChange={e => setCustomLightColor(e.target.value.toUpperCase())} style={{ display: 'block', width: '100%', height: 42, marginTop: 5 }} /></label></div><div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}><div style={{ width: 34, height: 34, borderRadius: 9, background: lightColor, border: '2px solid rgba(255,255,255,.25)' }} /><span className="ls-muted">Audience screen light color: <strong style={{ color: 'var(--ink)' }}>{lightColor}</strong></span><button className="ls-button ls-primary" style={{ marginLeft: 'auto' }} disabled={savingGame} onClick={() => void saveGame()}>{savingGame ? 'SAVING...' : 'SAVE TEAM SETUP'}</button></div>{gameMessage && <p className="ls-muted" style={{ marginTop: 12 }}>{gameMessage}</p>}</section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 1.4fr)', gap: 18 }}><section className="ls-card"><p className="ls-eyebrow">INTERACTIONS</p><h2>Start a live interaction</h2><div style={{ display: 'grid', gap: 8, marginTop: 18 }}>{TEMPLATES.map(template => <button key={template.label} className="ls-button ls-secondary" onClick={() => useTemplate(template)} style={{ textAlign: 'left' }}>{template.label}</button>)}</div><div style={{ marginTop: 22 }}><label className="ls-eyebrow">QUESTION</label><input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask the audience..." style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)', marginTop: 8 }} /><label className="ls-eyebrow" style={{ display: 'block', marginTop: 16 }}>OPTIONS — ONE PER LINE</label><textarea value={options} onChange={e => setOptions(e.target.value)} rows={5} style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)', marginTop: 8, resize: 'vertical' }} /><div style={{ display: 'flex', gap: 10, marginTop: 14 }}><button className="ls-button ls-primary" disabled={busy} onClick={() => void create('poll')}>OPEN POLL</button><button className="ls-button ls-secondary" disabled={busy} onClick={() => void create('question')}>OPEN QUESTION</button></div>{message && <p className="ls-muted" style={{ marginTop: 12 }}>{message}</p>}</div></section><section className="ls-card"><div className="ls-section-title"><div><p className="ls-eyebrow">LIVE CONTROL</p><h2>{selected ? selected.question : 'Select an interaction'}</h2></div></div><div style={{ display: 'grid', gap: 10, marginTop: 18 }}>{items.map(item => <button key={item.id} onClick={() => setSelected(item)} style={{ textAlign: 'left', padding: 14, borderRadius: 12, border: `1px solid ${selected?.id === item.id ? '#d9dde2' : 'var(--line)'}`, background: 'var(--panel)', color: 'var(--ink)', cursor: 'pointer' }}><strong>{item.question}</strong><div className="ls-muted" style={{ marginTop: 5 }}>{item.status.toUpperCase()} · {item.type.toUpperCase()}</div></button>)}</div>{selected && <><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}><strong>{total} RESPONSES</strong><button className="ls-button ls-stop" disabled={busy || selected.status === 'closed'} onClick={() => void closeSelected()}>CLOSE</button></div><div style={{ marginTop: 20 }}>{Object.entries(selected.options ?? {}).map(([id, label]) => { const count = counts[id] ?? 0; const pct = total ? Math.round(count / total * 100) : 0; return <div key={id} style={{ marginBottom: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{label}</span><strong>{pct}% · {count}</strong></div><div style={{ height: 8, background: 'var(--line)', borderRadius: 99, overflow: 'hidden', marginTop: 6 }}><div style={{ width: `${pct}%`, height: '100%', background: '#d9dde2' }} /></div></div> })}</div><button className="ls-button ls-primary" style={{ width: '100%', marginTop: 8 }} onClick={() => { void publishSportsScreen(eventId, selected.id, selected.type === 'poll' ? 'results' : 'question'); openBigScreen(); }}>SHOW ON BIG SCREEN ↗</button></>}</section></div>
    </div>
  </main>;
}
