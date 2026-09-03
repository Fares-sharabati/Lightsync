import { useEffect, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { createShow, deleteShow, watchOrganizerShows, type Show, type ShowKind } from '../firebase/shows';
import { signInOrganizer } from '../firebase/auth';
import { saveSportsGame, type SportsTeam } from '../firebase/sportsGame';
import '../styles/lightsync.css';

const organizerTheme: CSSProperties = { '--ls-accent': '#c9cdd2', '--ls-bg': '#050607', '--ls-card': '#0d0f11', '--ls-border': '#292c30', '--ls-text': '#f5f5f5', '--ls-muted': '#9a9da2' } as CSSProperties;
const blankTeam = (name: string): SportsTeam => ({ name, primaryColor: '#FFFFFF', secondaryColor: '#111111' });

export default function Admin() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [shows, setShows] = useState<Show[]>([]);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [venue, setVenue] = useState('');
  const [kind, setKind] = useState<ShowKind>('show');
  const [sport, setSport] = useState('Basketball');
  const [home, setHome] = useState<SportsTeam>(blankTeam(''));
  const [away, setAway] = useState<SportsTeam>(blankTeam(''));
  const [lightTeam, setLightTeam] = useState<'home' | 'away' | 'custom'>('home');
  const [customLightColor, setCustomLightColor] = useState('#FFFFFF');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [authenticated, setAuthenticated] = useState(!!auth.currentUser && !auth.currentUser.isAnonymous);

  useEffect(() => auth.onAuthStateChanged(user => setAuthenticated(!!user && !user.isAnonymous)), [auth]);
  useEffect(() => { if (!authenticated || !auth.currentUser) return; return watchOrganizerShows(auth.currentUser.uid, setShows); }, [authenticated, auth]);

  async function login() {
    try { setMessage(''); await signInOrganizer(email.trim(), password); }
    catch (error) { console.error(error); setMessage('Login failed. Check your organizer email and password.'); }
  }

  async function handleCreateShow() {
    if (!auth.currentUser) return;
    if (!date || !venue.trim()) return setMessage('Please enter the date and venue.');
    if (kind === 'show' && !name.trim()) return setMessage('Please enter the show name.');
    if (kind === 'sports' && (!home.name.trim() || !away.name.trim())) return setMessage('Please enter both team names.');
    setCreating(true); setMessage('');
    try {
      const eventName = kind === 'sports' ? `${home.name.trim()} vs ${away.name.trim()}` : name.trim();
      const id = await createShow(auth.currentUser.uid, { name: eventName, date, venue, kind });
      if (kind === 'sports') await saveSportsGame(id, { sport, homeTeam: { ...home, name: home.name.trim() }, awayTeam: { ...away, name: away.name.trim() }, lightTeam, customLightColor });
      setName(''); setDate(''); setVenue(''); setKind('show'); setHome(blankTeam('')); setAway(blankTeam('')); setSport('Basketball'); setLightTeam('home'); setCustomLightColor('#FFFFFF');
      navigate(`/admin/show/${id}`);
    } catch (error) { console.error(error); setMessage(error instanceof Error ? error.message : 'Could not create the event.'); }
    finally { setCreating(false); }
  }

  async function handleDeleteShow(show: Show) {
    if (!auth.currentUser || deletingId) return;
    if (!window.confirm(`Delete “${show.name}”?\n\nThis permanently removes the event, its public QR data, audience records and statistics. This cannot be undone.`)) return;
    setDeletingId(show.id); setMessage('');
    try { await deleteShow(show.id); setMessage(`“${show.name}” was deleted.`); }
    catch (error) { console.error(error); setMessage('Could not delete the event. Check your Firebase rules and try again.'); }
    finally { setDeletingId(null); }
  }

  if (!authenticated) return <main className="ls-shell" style={organizerTheme}><section className="ls-auth-card"><div className="ls-brand">LIGHTSYNC</div><p className="ls-eyebrow">ORGANIZER ACCESS</p><h1>Control the crowd.</h1><p className="ls-muted">Organizer access is restricted to authorized accounts.</p><input className="ls-input" type="email" placeholder="Organizer email" value={email} onChange={e => setEmail(e.target.value)} /><input className="ls-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && void login()} /><button className="ls-button ls-primary" onClick={() => void login()}>ENTER DASHBOARD</button>{message && <p className="ls-error">{message}</p>}</section></main>;

  const teamFields = (side: 'home' | 'away', team: SportsTeam, setTeam: Dispatch<SetStateAction<SportsTeam>>) => <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 16 }}><p className="ls-eyebrow">{side === 'home' ? 'HOME TEAM' : 'AWAY TEAM'}</p><input className="ls-input" style={{ marginTop: 8 }} placeholder={side === 'home' ? 'Gaziantep BB' : 'Kipas SK'} value={team.name} onChange={e => setTeam(value => ({ ...value, name: e.target.value }))} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}><label className="ls-muted">PRIMARY<input type="color" value={team.primaryColor} onChange={e => setTeam(value => ({ ...value, primaryColor: e.target.value.toUpperCase() }))} style={{ display: 'block', width: '100%', height: 40, marginTop: 4 }} /></label><label className="ls-muted">SECONDARY<input type="color" value={team.secondaryColor} onChange={e => setTeam(value => ({ ...value, secondaryColor: e.target.value.toUpperCase() }))} style={{ display: 'block', width: '100%', height: 40, marginTop: 4 }} /></label></div></div>;

  const renderEventRow = (show: Show) => <div className="ls-show-row" key={show.id} style={{ cursor: 'default', padding: 0, gap: 8 }}><button className="ls-show-main" style={{ flex: 1, border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', textAlign: 'left', padding: '17px' }} onClick={() => navigate(`/admin/show/${show.id}`)}><div><strong>{show.name}</strong><span>{show.venue} · {show.date}</span></div><div><span className={`ls-status ls-${show.status}`}>{show.status}</span><b>→</b></div></button><button className="ls-delete-show" style={{ marginRight: 10, border: '1px solid #45494e', background: '#111315', color: '#c9cdd2', borderRadius: 8, padding: '8px 10px', fontSize: 10, fontWeight: 800, letterSpacing: '.08em', cursor: 'pointer' }} onClick={() => void handleDeleteShow(show)} disabled={deletingId === show.id}>{deletingId === show.id ? 'DELETING…' : 'DELETE'}</button></div>;
  const lightShows = shows.filter(show => show.kind !== 'sports');
  const sportsShows = shows.filter(show => show.kind === 'sports');

  return <main className="ls-shell" style={organizerTheme}>
    <header className="ls-header"><div><div className="ls-brand">LIGHTSYNC</div><p className="ls-eyebrow">ORGANIZER CONTROL</p></div><button className="ls-button ls-secondary" onClick={() => navigate('/')}>HOME</button></header>
    <section className="ls-hero-grid"><div><p className="ls-eyebrow">LIVE EVENT CONTROL</p><h1>Synchronize the audience.</h1><p className="ls-muted">Create one LightSync event for every light show or sports game.</p></div><div className="ls-orbit"><div className="ls-arena"><span>LIGHTSYNC</span></div></div></section>

    <section className="ls-card"><div className="ls-section-title"><div><p className="ls-eyebrow">NEW EVENT</p><h2>Create an event</h2></div></div><div style={{ display: 'flex', gap: 8, marginBottom: 16 }}><button type="button" className={`ls-button ${kind === 'show' ? 'ls-primary' : 'ls-secondary'}`} onClick={() => setKind('show')}>LIGHT SHOW</button><button type="button" className={`ls-button ${kind === 'sports' ? 'ls-primary' : 'ls-secondary'}`} onClick={() => setKind('sports')}>SPORTS EVENT</button></div>
      <div className="ls-form-grid">{kind === 'show' && <input className="ls-input" placeholder="Show name" value={name} onChange={e => setName(e.target.value)} />}<input className="ls-input" type="date" value={date} onChange={e => setDate(e.target.value)} /><input className="ls-input" placeholder="Venue" value={venue} onChange={e => setVenue(e.target.value)} /></div>
      {kind === 'sports' && <div style={{ marginTop: 18 }}><p className="ls-muted" style={{ marginBottom: 12 }}>The event name is automatically created as Home Team vs Away Team.</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>{teamFields('home', home, setHome)}{teamFields('away', away, setAway)}</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14 }}><label className="ls-muted">SPORT<select value={sport} onChange={e => setSport(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 5, padding: 11, borderRadius: 10, background: 'var(--panel)', color: 'var(--ink)', border: '1px solid var(--line)' }}><option>Basketball</option><option>Football</option><option>Volleyball</option><option>Handball</option><option>Other</option></select></label><label className="ls-muted">LIGHT TEAM<select value={lightTeam} onChange={e => setLightTeam(e.target.value as 'home' | 'away' | 'custom')} style={{ display: 'block', width: '100%', marginTop: 5, padding: 11, borderRadius: 10, background: 'var(--panel)', color: 'var(--ink)', border: '1px solid var(--line)' }}><option value="home">Home team</option><option value="away">Away team</option><option value="custom">Custom</option></select></label><label className="ls-muted">CUSTOM COLOR<input type="color" value={customLightColor} disabled={lightTeam !== 'custom'} onChange={e => setCustomLightColor(e.target.value.toUpperCase())} style={{ display: 'block', width: '100%', height: 42, marginTop: 4 }} /></label></div></div>}
      <button className="ls-button ls-primary" style={{ marginTop: 18 }} disabled={creating} onClick={() => void handleCreateShow()}>{creating ? 'CREATING...' : kind === 'sports' ? '+ CREATE SPORTS EVENT' : '+ CREATE SHOW'}</button>{message && <p className="ls-error">{message}</p>}
    </section>

    <section className="ls-card"><div className="ls-section-title"><div><p className="ls-eyebrow">LIGHT SHOWS</p><h2>Events</h2></div><span className="ls-count">{lightShows.length}</span></div>{lightShows.length === 0 ? <div className="ls-empty">No light shows yet.</div> : <div className="ls-show-list">{lightShows.map(renderEventRow)}</div>}</section>
    <section className="ls-card"><div className="ls-section-title"><div><p className="ls-eyebrow">SPORTS EVENTS</p><h2>Sports</h2></div><span className="ls-count">{sportsShows.length}</span></div>{sportsShows.length === 0 ? <div className="ls-empty">No sports events yet.</div> : <div className="ls-show-list">{sportsShows.map(renderEventRow)}</div>}</section>
  </main>;
}
