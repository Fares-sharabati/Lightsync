import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { createShow, deleteShow, updateShow, watchOrganizerShows, type Show } from '../firebase/shows';
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
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [creating, setCreating] = useState(false); const [deletingId, setDeletingId] = useState<string | null>(null); const [message, setMessage] = useState(''); const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(!!auth.currentUser && !auth.currentUser.isAnonymous);
  const [search, setSearch] = useState(''); const [showFinished, setShowFinished] = useState(false);

  useEffect(() => auth.onAuthStateChanged(user => setAuthenticated(!!user && !user.isAnonymous)), [auth]);
  useEffect(() => { if (!authenticated || !auth.currentUser) return; return watchOrganizerShows(auth.currentUser.uid, setShows); }, [authenticated, auth]);

  const theme = useMemo(() => ({ ...baseTheme, '--ls-accent': home.primaryColor || '#FFFFFF', '--ls-accent-2': away.primaryColor || home.primaryColor || '#FFFFFF' }) as CSSProperties, [home.primaryColor, away.primaryColor]);
  const lightColor = lightTeam === 'away' ? away.primaryColor : lightTeam === 'custom' ? customLightColor : home.primaryColor;
  const filteredShows = useMemo(() => { const term = search.trim().toLowerCase(); return term ? shows.filter(show => show.name.toLowerCase().includes(term) || show.venue.toLowerCase().includes(term)) : shows; }, [shows, search]);
  const upcomingShows = useMemo(() => filteredShows.filter(show => show.status !== 'finished').sort((a, b) => a.date.localeCompare(b.date)), [filteredShows]);
  const finishedShows = useMemo(() => filteredShows.filter(show => show.status === 'finished').sort((a, b) => b.date.localeCompare(a.date)), [filteredShows]);

  async function login() { try { setMessage(''); await signInOrganizer(email.trim(), password); } catch (error) { console.error(error); setMessage('Login failed. Check your organizer email and password.'); } }

  async function handleCreate() {
    if (!auth.currentUser) return; if (!date || !venue.trim()) return setMessage('Please enter the date and venue.'); if (!home.name.trim() || !away.name.trim()) return setMessage('Please enter both team names.');
    setCreating(true); setMessage('');
    try {
      const id = await createShow(auth.currentUser.uid, { name: `${home.name.trim()} vs ${away.name.trim()}`, date, venue });
      await saveSportsGame(id, { sport, homeTeam: { ...home, name: home.name.trim() }, awayTeam: { ...away, name: away.name.trim() }, lightTeam, customLightColor });
      await updateShow(id, { phoneUiColor: lightColor, screenLightColor: lightColor });
      setDate(''); setVenue(''); setHome(blankTeam('')); setAway(blankTeam('')); setSport('Basketball'); setLightTeam('home'); setCustomLightColor('#FFFFFF');
      navigate(`/admin/event/${id}`);
    } catch (error) { console.error(error); setMessage(error instanceof Error ? error.message : 'Could not create the sports event.'); } finally { setCreating(false); }
  }

  async function handleDelete(show: Show) {
    if (!auth.currentUser || deletingId) return; if (!window.confirm(`Delete "${show.name}"?\n\nThis permanently removes the event and audience data.`)) return;
    setDeletingId(show.id); setMessage(''); try { await deleteShow(show.id); setMessage(`"${show.name}" was deleted.`); } catch (error) { console.error(error); setMessage(error instanceof Error ? error.message : 'Could not delete the event.'); } finally { setDeletingId(null); }
  }

  async function handleStatusChange(show: Show, status: 'waiting' | 'finished') {
    if (!auth.currentUser || statusUpdatingId || show.status === status || show.status === 'running') return;
    setStatusUpdatingId(show.id); setMessage('');
    try { await updateShow(show.id, { status, showStartTime: null }); setMessage(`"${show.name}" is now ${status}.`); }
    catch (error) { console.error(error); setMessage(error instanceof Error ? error.message : 'Could not update event status.'); }
    finally { setStatusUpdatingId(null); }
  }

  if (!authenticated) return <main className="ls-shell" style={baseTheme}><section className="ls-auth-card"><div className="ls-brand">LIGHTSYNC</div><p className="ls-eyebrow">ORGANIZER ACCESS</p><h1>Control the crowd.</h1><p className="ls-muted">Sports event control for LightSync.</p><input className="ls-input" type="email" placeholder="Organizer email" value={email} onChange={e => setEmail(e.target.value)} /><input className="ls-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && void login()} /><button className="ls-button ls-primary" onClick={() => void login()}>ENTER DASHBOARD</button>{message && <p className="ls-error">{message}</p>}</section></main>;

  const teamFields = (side: 'home' | 'away', team: SportsTeam, setTeam: Dispatch<SetStateAction<SportsTeam>>) => (
    <div className="ls-team-card" style={{ '--side-color': team.primaryColor } as CSSProperties}>
      <p className="ls-eyebrow"><span className="ls-swatch-dot" style={{ '--side-color': team.primaryColor } as CSSProperties} />{side === 'home' ? 'HOME TEAM' : 'AWAY TEAM'}</p>
      <input className="ls-input" placeholder={side === 'home' ? 'Home Team' : 'Away Team'} value={team.name} onChange={e => setTeam(value => ({ ...value, name: e.target.value }))} />
      <div className="ls-swatch-row">
        <label className="ls-swatch-field"><input type="color" value={team.primaryColor} onChange={e => setTeam(value => ({ ...value, primaryColor: e.target.value.toUpperCase() }))} /><div><span>PRIMARY</span><b>{team.primaryColor}</b></div></label>
        <label className="ls-swatch-field"><input type="color" value={team.secondaryColor} onChange={e => setTeam(value => ({ ...value, secondaryColor: e.target.value.toUpperCase() }))} /><div><span>SECONDARY</span><b>{team.secondaryColor}</b></div></label>
      </div>
    </div>
  );

  const renderShowRow = (show: Show) => <div className="ls-show-row" key={show.id}>
    <button className="ls-show-main" style={{ flex: 1, border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', textAlign: 'left', padding: '17px' }} onClick={() => navigate(`/admin/event/${show.id}`)}>
      <div><strong>{show.name}</strong><span>{show.venue} &middot; {show.date}</span></div>
      <div><span className={`ls-status ls-${show.status}`}>{show.status}</span><b>&rarr;</b></div>
    </button>
    {show.status !== 'running' && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
      <button type="button" onClick={() => void handleStatusChange(show, 'waiting')} disabled={statusUpdatingId === show.id || show.status === 'waiting'} style={{ border: '1px solid #45494e', background: show.status === 'waiting' ? '#24282c' : '#111315', color: '#c9cdd2', borderRadius: 8, padding: '7px 9px', fontSize: 9, fontWeight: 800, letterSpacing: '.06em', cursor: show.status === 'waiting' ? 'default' : 'pointer' }}>WAITING</button>
      <button type="button" onClick={() => void handleStatusChange(show, 'finished')} disabled={statusUpdatingId === show.id || show.status === 'finished'} style={{ border: '1px solid #45494e', background: show.status === 'finished' ? '#24282c' : '#111315', color: '#c9cdd2', borderRadius: 8, padding: '7px 9px', fontSize: 9, fontWeight: 800, letterSpacing: '.06em', cursor: show.status === 'finished' ? 'default' : 'pointer' }}>{statusUpdatingId === show.id ? '...' : 'FINISHED'}</button>
    </div>}
    <button className="ls-delete-show" style={{ marginRight: 10, border: '1px solid #45494e', background: '#111315', color: '#c9cdd2', borderRadius: 8, padding: '8px 10px', fontSize: 10, fontWeight: 800, letterSpacing: '.08em', cursor: 'pointer' }} onClick={() => void handleDelete(show)} disabled={deletingId === show.id}>{deletingId === show.id ? 'DELETING...' : 'DELETE'}</button>
  </div>;

  return <main className="ls-shell" style={theme}>
    <header className="ls-header"><div><div className="ls-brand">LIGHTSYNC</div><p className="ls-eyebrow">SPORTS CONTROL</p></div><button className="ls-button ls-secondary" onClick={() => navigate('/')}>HOME</button></header>
    <section className="ls-hero-grid"><div><p className="ls-eyebrow">SPORTS EVENT CONTROL</p><h1>Synchronize the audience.</h1><p className="ls-muted">Create a match, choose its colors, then control the music and audience interactions from one event page.</p></div><div className="ls-orbit"><div className="ls-arena" style={{ borderColor: home.primaryColor }}><span style={{ color: home.primaryColor }}>LIGHTSYNC</span></div></div></section>
    <section className="ls-card"><div className="ls-section-title"><div><p className="ls-eyebrow">NEW SPORTS EVENT</p><h2>Create a match</h2></div></div>
      <div className="ls-form-grid"><input className="ls-input" type="date" value={date} onChange={e => setDate(e.target.value)} /><input className="ls-input" placeholder="Venue" value={venue} onChange={e => setVenue(e.target.value)} /><select className="ls-input" value={sport} onChange={e => setSport(e.target.value)}><option>Basketball</option><option>Football</option><option>Volleyball</option><option>Handball</option><option>Other</option></select></div>
      <div className="ls-matchup" style={{ marginBottom: 4 }}><div className="ls-matchup-side" style={{ '--side-color': home.primaryColor } as CSSProperties}><strong>{home.name.trim() || 'Home Team'}</strong><small>HOME</small></div><div className="ls-matchup-vs">VS</div><div className="ls-matchup-side" style={{ '--side-color': away.primaryColor } as CSSProperties}><strong>{away.name.trim() || 'Away Team'}</strong><small>AWAY</small></div></div>
      <p className="ls-muted" style={{ marginTop: 10, fontSize: 12 }}>The event name is automatically created as Home Team vs Away Team.</p>
      <div className="ls-team-grid">{teamFields('home', home, setHome)}{teamFields('away', away, setAway)}</div>
      <div className="ls-light-grid"><div className="ls-light-option"><span>PHONE LIGHT TEAM</span><select className="ls-input" value={lightTeam} onChange={e => setLightTeam(e.target.value as 'home' | 'away' | 'custom')}><option value="home">Home team primary</option><option value="away">Away team primary</option><option value="custom">Custom</option></select></div><div className="ls-light-option"><span>CUSTOM LIGHT COLOR</span><label className={`ls-swatch-field ${lightTeam !== 'custom' ? 'is-disabled' : ''}`}><input type="color" value={customLightColor} disabled={lightTeam !== 'custom'} onChange={e => setCustomLightColor(e.target.value.toUpperCase())} /><div><span>{lightTeam === 'custom' ? 'TAP TO PICK' : 'ENABLE CUSTOM'}</span><b>{customLightColor}</b></div></label></div><div className="ls-light-option"><span>RESULT</span><div className="ls-swatch-field" style={{ cursor: 'default' }}><span className="ls-swatch-dot" style={{ '--side-color': lightColor, width: 30, height: 30 } as CSSProperties} /><div><span>APPLIED</span><b>{lightColor}</b></div></div></div></div>
      <button className="ls-button ls-primary" style={{ marginTop: 18, width: '100%' }} disabled={creating} onClick={() => void handleCreate()}>{creating ? 'CREATING...' : '+ CREATE SPORTS EVENT'}</button>{message && <p className="ls-error">{message}</p>}
    </section>
    <section className="ls-card">
      <div className="ls-section-title"><div><p className="ls-eyebrow">YOUR SPORTS EVENTS</p><h2>Matches</h2></div><span className="ls-count">{shows.length}</span></div>
      {shows.length > 0 && <input className="ls-input" style={{ marginBottom: 18 }} placeholder="Search by team or venue..." value={search} onChange={e => setSearch(e.target.value)} />}
      {shows.length === 0 ? <div className="ls-empty">No sports events yet.</div> : <>
        {upcomingShows.length === 0 && finishedShows.length === 0 && <div className="ls-empty">No events match "{search}".</div>}
        {upcomingShows.length > 0 && <div className="ls-show-list">{upcomingShows.map(show => renderShowRow(show))}</div>}
        {finishedShows.length > 0 && <div style={{ marginTop: upcomingShows.length > 0 ? 22 : 0 }}>
          <button type="button" className="ls-button ls-secondary" style={{ width: '100%', marginBottom: showFinished ? 10 : 0 }} onClick={() => setShowFinished(value => !value)}>{showFinished ? 'HIDE' : 'SHOW'} {finishedShows.length} FINISHED EVENT{finishedShows.length === 1 ? '' : 'S'} {showFinished ? '\u25B2' : '\u25BC'}</button>
          {showFinished && <div className="ls-show-list">{finishedShows.map(show => renderShowRow(show))}</div>}
        </div>}
      </>}
    </section>
  </main>;
}