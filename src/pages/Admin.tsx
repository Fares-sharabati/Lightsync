import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { createShow, deleteShow, watchOrganizerShows, type Show } from '../firebase/shows';
import { signInOrganizer } from '../firebase/auth';
import '../styles/lightsync.css';

export default function Admin() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [shows, setShows] = useState<Show[]>([]);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [venue, setVenue] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [authenticated, setAuthenticated] = useState(!!auth.currentUser && !auth.currentUser.isAnonymous);

  useEffect(() => { const unsubscribe = auth.onAuthStateChanged(user => setAuthenticated(!!user && !user.isAnonymous)); return unsubscribe; }, [auth]);
  useEffect(() => { if (!authenticated || !auth.currentUser) return; return watchOrganizerShows(auth.currentUser.uid, setShows); }, [authenticated, auth]);

  async function login() { try { setMessage(''); await signInOrganizer(email.trim(), password); } catch (error) { console.error(error); setMessage('Login failed. Check your organizer email and password.'); } }

  async function handleCreateShow() {
    if (!auth.currentUser) return;
    if (!name.trim() || !date || !venue.trim()) { setMessage('Please enter the show name, date and venue.'); return; }
    setCreating(true); setMessage('');
    try { const id = await createShow(auth.currentUser.uid, { name, date, venue }); setName(''); setDate(''); setVenue(''); navigate(`/admin/show/${id}`); }
    catch (error) { console.error(error); setMessage('Could not create the show.'); }
    finally { setCreating(false); }
  }

  async function handleDeleteShow(show: Show) {
    if (!auth.currentUser || deletingId) return;
    const confirmed = window.confirm(`Delete “${show.name}”?\n\nThis permanently removes the show, its public QR data, audience records and statistics. This cannot be undone.`);
    if (!confirmed) return;
    setDeletingId(show.id); setMessage('');
    try { await deleteShow(show.id); setMessage(`“${show.name}” was deleted.`); }
    catch (error) { console.error(error); setMessage('Could not delete the show. Check your Firebase rules and try again.'); }
    finally { setDeletingId(null); }
  }

  if (!authenticated) return <main className="ls-shell"><section className="ls-auth-card"><div className="ls-brand">LIGHTSYNC</div><p className="ls-eyebrow">ORGANIZER ACCESS</p><h1>Control the crowd.</h1><p className="ls-muted">Organizer access is restricted to authorized accounts.</p><input className="ls-input" type="email" placeholder="Organizer email" value={email} onChange={e => setEmail(e.target.value)} /><input className="ls-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && void login()} /><button className="ls-button ls-primary" onClick={() => void login()}>ENTER DASHBOARD</button>{message && <p className="ls-error">{message}</p>}</section></main>;

  return <main className="ls-shell">
    <header className="ls-header"><div><div className="ls-brand">LIGHTSYNC</div><p className="ls-eyebrow">ORGANIZER CONTROL</p></div><button className="ls-button ls-secondary" onClick={() => navigate('/')}>HOME</button></header>
    <section className="ls-hero-grid"><div><p className="ls-eyebrow">LIVE SHOW CONTROL</p><h1>Synchronize the audience.</h1><p className="ls-muted">Create one LightSync show for every game, then control its music, timeline and crowd.</p></div><div className="ls-orbit"><div className="ls-arena"><span>LIGHTSYNC</span></div></div></section>
    <section className="ls-card"><div className="ls-section-title"><div><p className="ls-eyebrow">NEW SHOW</p><h2>Create a show</h2></div></div><div className="ls-form-grid"><input className="ls-input" placeholder="Show name — e.g. Mersin SK vs ..." value={name} onChange={e => setName(e.target.value)} /><input className="ls-input" type="date" value={date} onChange={e => setDate(e.target.value)} /><input className="ls-input" placeholder="Venue" value={venue} onChange={e => setVenue(e.target.value)} /></div><button className="ls-button ls-primary" disabled={creating} onClick={() => void handleCreateShow()}>{creating ? 'CREATING...' : '+ CREATE SHOW'}</button>{message && <p className="ls-error">{message}</p>}</section>
    <section className="ls-card"><div className="ls-section-title"><div><p className="ls-eyebrow">SHOW HISTORY</p><h2>Your shows</h2></div><span className="ls-count">{shows.length}</span></div>
      {shows.length === 0 ? <div className="ls-empty">No shows yet. Create your first show above.</div> : <div className="ls-show-list">{shows.map(show => <div className="ls-show-row" key={show.id}>
        <button className="ls-show-main" onClick={() => navigate(`/admin/show/${show.id}`)} aria-label={`Open ${show.name}`}><div><strong>{show.name}</strong><span>{show.venue} · {show.date}</span></div><div><span className={`ls-status ls-${show.status}`}>{show.status}</span><b>→</b></div></button>
        <button className="ls-delete-show" onClick={() => void handleDeleteShow(show)} disabled={deletingId === show.id} aria-label={`Delete ${show.name}`}>{deletingId === show.id ? 'DELETING…' : 'DELETE'}</button>
      </div>)}</div>}
    </section>
  </main>;
}
