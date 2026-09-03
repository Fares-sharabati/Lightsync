import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { createShow, deleteShow, watchOrganizerShows, type Show } from '../firebase/shows';
import { signInOrganizer } from '../firebase/auth';
import { saveSportsGame, type SportsTeam } from '../firebase/sportsGame';
import '../styles/lightsync.css';

const blankTeam = (name: string): SportsTeam => ({ name, primaryColor: '#FFFFFF', secondaryColor: '#111111' });
const baseTheme: CSSProperties = { '--ls-bg': '#050607', '--ls-card': '#0d0f11', '--ls-border': '#292c30', '--ls-text': '#f5f5f5', '--ls-muted': '#9a9da2' } as CSSProperties;

export default function Admin() {
  const navigate = useNavigate(); const auth = getAuth();
  const [shows, setShows] = useState<Show[]>([]); const [date, setDate] = useState(''); const [venue, setVenue] = useState('');
  const [sport, setSport] = useState('Basketball'); const [home, setHome] = useState<SportsTeam>(blankTeam('')); const [away, setAway] = useState<SportsTeam>(blankTeam(''));
  const [lightTeam, setLightTeam] = useState<'home' | 'away' | 'custom'>('home'); const [customLightColor, setCustomLightColor] = useState('#FFFFFF');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [creating, setCreating] = useState(false); const [deletingId, setDeletingId] = useState<string | null>(null); const [message, setMessage] = useState('');
  const [authenticated, setAuthenticated] = useState(!!auth.currentUser && !auth.currentUser.isAnonymous);

  useEffect(() => auth.onAuthStateChanged(user => setAuthenticated(!!user && !user.isAnonymous)), [auth]);
  useEffect(() => { if (!authenticated || !auth.currentUser) return; return watchOrganizerShows(auth.currentUser.uid, setShows); }, [authenticated, auth]);

  const theme = useMemo(() => ({ ...baseTheme, '--ls-accent': home.primaryColor || '#FFFFFF', '--ls-accent-strong': home.primaryColor || '#FFFFFF' }) as CSSProperties, [home.primaryColor]);

  async function login() { try { setMessage(''); await signInOrganizer(email.trim(), password); } catch (error) { console.error(error); setMessage('Login failed. Check your organizer email and password.'); } }

  async function handleCreate() {
    if (!auth.currentUser) return; if (!date || !venue.trim()) return setMessage('Please enter the date and venue.'); if (!home.name.trim() || !away.name.trim()) return setMessage('Please enter both team names.');
    setCreating(true); setMessage('');
    try {
      const id = await createShow(auth.currentUser.uid, { name: `${home.name.trim()} vs ${away.name.trim()}`, date, venue });
      await saveSportsGame(id, { sport, homeTeam: { ...home, name: home.name.trim() }, awayTeam: { ...away, name: away.name.trim() }, lightTeam, customLightColor });
      setDate(''); setVenue(''); setHome(blankTeam('')); setAway(blankTeam('')); setSport('Basketball'); setLightTeam('home'); setCustomLightColor('#FFFFFF');
      navigate(`/admin/event/${id}`);
    } catch (error) { console.error(error); setMessage(error instanceof Error ? error.message : 'Could not create the sports event.'); } finally { setCreating(false); }
  }

  async function handleDelete(show: Show) {
    if (!auth.currentUser || deletingId) return; if (!window.confirm(`Delete “${show.name}”?\n\nThis permanently removes the event and audience data.`)) return;
    setDeletingId(show.id); setMessage(''); try { await deleteShow(show.id); setMessage(`“${show.name}” was deleted.`); } catch (error) { console.error(error); setMessage(error instanceof Error ? error.message : 'Could not delete the event.'); } finally { setDeletingId(null); }
  }

  if (!authenticated) return <main className="ls-shell" style={baseTheme}><section className="ls-auth-card"><div className="ls-brand">LIGHTSYNC</div><p className="ls-eyebrow">ORGANIZER ACCESS</p><h1>Control the crowd.</h1><p className="ls-muted">Sports event control for LightSync.</p><input className="ls-input" type="email" placeholder="Organizer email" value={email} onChange={e => setEmail(e.target.value)} /><input className="ls-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && void login()} /><button className="ls-button ls-primary" onClick={() => void login()}>ENTER DASHBOARD</button>{message && <p className="ls-error">{message}</p>}</section></main>;

  const teamFields = (side: 'home' | 'away', team: SportsTeam, setTeam: Dispatch<SetStateAction<SportsTeam>>) => <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 16 }}><p className="ls-eyebrow">{side === 'home' ? 'HOME TEAM' : 'AWAY TEAM'}</p><input className="ls-input" style={{ marginTop: 8 }} placeholder={side === 'home' ? 'Home Team' : 'Away Team'} value={team.name} onChange={e => setTeam(value => ({ ...value, name: e.target.value }))} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}><label className="ls-muted">PRIMARY<input type="color" value={team.primaryColor} onChange={e => setTeam(value => ({ ...value, primaryColor: e.target.value.toUpperCase() }))} style={{ display: 'block', width: '100%', height: 40, marginTop: 4 }} /></label><label className="ls-muted">SECONDARY<input type="color" value={team.secondaryColor} onChange={e => setTeam(value => ({ ...value, secondaryColor: e.target.value.toUpperCase() }))} style={{ display: 'block', width: '100%', height: 40, marginTop: 4 }} /></label></div></div>;

  return <main className="ls-shell" style={theme}>
    <header className="ls-header"><div><div className="ls-brand">LIGHTSYNC</div><p className="ls-eyebrow">SPORTS CONTROL</p></div><button className="ls-button ls-secondary" onClick={() => navigate('/')}>HOME</button></header>
    <section className="ls-hero-grid"><div><p className="ls-eyebrow">SPORTS EVENT CONTROL</p><h1>Synchronize the audience.</h1><p className="ls-muted">Create a match, choose its colors, then control the music and audience interactions from one event page.</p></div><div className="ls-orbit"><div className="ls-arena" style={{ borderColor: home.primaryColor }}><span style={{ color: home.primaryColor }}>LIGHTSYNC</span></div></div></section>
    <section className="ls-card"><div className="ls-section-title"><div><p className="ls-eyebrow">NEW SPORTS EVENT</p><h2>Create a match</h2></div></div><div className="ls-form-grid"><input className="ls-input" type="date" value={date} onChange={e => setDate(e.target.value)} /><input className="ls-input" placeholder="Venue" value={venue} onChange={e => setVenue(e.target.value)} /><select className="ls-input" value={sport} onChange={e => setSport(e.target.value)}><option>Basketball</option><option>Football</option><option>Volleyball</option><option>Handball</option><option>Other</option></select></div><p className="ls-muted" style={{ marginTop: 14 }}>The event name is automatically created as Home Team vs Away Team.</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>{teamFields('home', home, setHome)}{teamFields('away', away, setAway)}</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14 }}><label className="ls-muted">PHONE LIGHT TEAM<select className="ls-input" value={lightTeam} onChange={e => setLightTeam(e.target.value as 'home' | 'away' | 'custom')}><option value="home">Home team primary</option><option value="away">Away team primary</option><option value="custom">Custom</option></select></label><label className="ls-muted">CUSTOM LIGHT COLOR<input type="color" value={customLightColor} disabled={lightTeam !== 'custom'} onChange={e => setCustomLightColor(e.target.value.toUpperCase())} style={{ display: 'block', width: '100%', height: 42, marginTop: 4 }} /></label><div style={{ borderRadius: 12, border: '1px solid var(--line)', background: home.primaryColor, minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900 }}>HOME COLOR</div></div><button className="ls-button ls-primary" style={{ marginTop: 18 }} disabled={creating} onClick={() => void handleCreate()}>{creating ? 'CREATING...' : '+ CREATE SPORTS EVENT'}</button>{message && <p className="ls-error">{message}</p>}</section>
    <section className="ls-card"><div className="ls-section-title"><div><p className="ls-eyebrow">YOUR SPORTS EVENTS</p><h2>Matches</h2></div><span className="ls-count">{shows.length}</span></div>{shows.length === 0 ? <div className="ls-empty">No sports events yet.</div> : <div className="ls-show-list">{shows.map(show => <div className="ls-show-row" key={show.id} style={{ padding: 0, gap: 8 }}><button className="ls-show-main" style={{ flex: 1, border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', textAlign: 'left', padding: '17px' }} onClick={() => navigate(`/admin/event/${show.id}`)}><div><strong>{show.name}</strong><span>{show.venue} · {show.date}</span></div><div><span className={`ls-status ls-${show.status}`}>{show.status}</span><b>→</b></div></button><button className="ls-delete-show" style={{ marginRight: 10, border: '1px solid #45494e', background: '#111315', color: '#c9cdd2', borderRadius: 8, padding: '8px 10px', fontSize: 10, fontWeight: 800, letterSpacing: '.08em', cursor: 'pointer' }} onClick={() => void handleDelete(show)} disabled={deletingId === show.id}>{deletingId === show.id ? 'DELETING…' : 'DELETE'}</button></div>)}</div>}</section>
  </main>;
}
