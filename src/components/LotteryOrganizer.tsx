import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { type ParticipantInfo } from '../firebase/participants';
import { cancelLottery, revealLottery, shuffleAndPick, startLottery, watchLottery, watchLotteryContacts, watchLotteryPrivate, type LotteryContact, type LotteryState } from '../firebase/lottery';
import { serverNow, watchServerTimeOffset } from '../firebase/serverTime';

interface LotteryOrganizerProps { participants: Record<string, ParticipantInfo>; participantCount: number; }

export default function LotteryOrganizer({ participants }: LotteryOrganizerProps) {
  const { eventId } = useParams();
  const [lottery, setLottery] = useState<LotteryState | null>(null);
  const [winnerIds, setWinnerIds] = useState<Record<string, boolean>>({});
  const [contacts, setContacts] = useState<Record<string, LotteryContact>>({});
  const [winnerCount, setWinnerCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState('');
  const [seconds, setSeconds] = useState(10);

  useEffect(() => watchServerTimeOffset(() => {}), []);
  useEffect(() => { if (!eventId) return; return watchLottery(eventId, setLottery); }, [eventId]);
  useEffect(() => { if (!eventId) return; return watchLotteryContacts(eventId, setContacts); }, [eventId]);
  useEffect(() => { if (!eventId) return; return watchLotteryPrivate(eventId, lottery?.runId ?? null, setWinnerIds); }, [eventId, lottery?.runId]);

  const connected = useMemo(() => Object.values(participants).filter(p => p.connected === true && Boolean(p.uid)), [participants]);
  const winnerUidList = useMemo(() => Object.keys(winnerIds).filter(uid => winnerIds[uid]), [winnerIds]);
  const winnerRows = winnerUidList.map(uid => ({ uid, contact: contacts[uid] })).filter(row => row.contact);

  useEffect(() => {
    if (!lottery || lottery.status !== 'running') return;
    const update = () => setSeconds(Math.max(0, Math.ceil((lottery.revealAt - serverNow()) / 1000)));
    update(); const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [lottery?.status, lottery?.revealAt]);

  useEffect(() => {
    if (!eventId || lottery?.status !== 'running') return;
    const delay = Math.max(0, lottery.revealAt - serverNow()) + 150;
    const timer = window.setTimeout(() => { void revealLottery(eventId).catch(error => { console.error(error); setMessage('Could not reveal the lottery result.'); }); }, delay);
    return () => window.clearTimeout(timer);
  }, [eventId, lottery?.status, lottery?.revealAt, lottery?.runId]);

  function changeWinnerCount(delta: number) {
    setWinnerCount(current => Math.max(1, Math.min(100, current + delta)));
    setMessage('');
  }

  async function runLottery() {
    if (!eventId || busy || lottery?.status === 'running') return;
    if (connected.length === 0) { setMessage('There are no connected participants.'); return; }
    if (winnerCount > connected.length) {
      setMessage(`You selected ${winnerCount} winners, but only ${connected.length} phone${connected.length === 1 ? '' : 's'} are connected.`);
      return;
    }
    const count = winnerCount;
    setBusy(true); setMessage('');
    try {
      const eligibleIds = connected.map(p => p.uid as string);
      const selected = shuffleAndPick(connected, count).map(p => p.uid as string);
      await startLottery(eventId, selected, eligibleIds, eligibleIds.length, count);
      setWinnerCount(count);
    } catch (error) { console.error(error); setMessage(error instanceof Error ? error.message : 'Could not start the lottery.'); }
    finally { setBusy(false); }
  }

  async function stopLottery() {
    if (!eventId || cancelling || lottery?.status !== 'running') return;
    setCancelling(true); setMessage('');
    try { await cancelLottery(eventId); }
    catch (error) { console.error(error); setMessage(error instanceof Error ? error.message : 'Could not cancel the lottery.'); }
    finally { setCancelling(false); }
  }

  const button: CSSProperties = { border: 0, borderRadius: 10, padding: '13px 18px', fontWeight: 900, letterSpacing: '.08em', cursor: busy || lottery?.status === 'running' ? 'not-allowed' : 'pointer', background: '#fff', color: '#08090b' };
  const ghostButton: CSSProperties = { border: '1px solid #5b4820', borderRadius: 10, padding: '10px 16px', fontWeight: 800, letterSpacing: '.06em', cursor: cancelling ? 'not-allowed' : 'pointer', background: 'transparent', color: '#f2c66d' };

  return (
    <div className="ls-card" style={{ gridColumn: '1 / -1' }}>
      <div className="ls-section-title">
        <div><p className="ls-eyebrow">LOTTERY</p><h2>Pick winners from the crowd</h2></div>
        <div style={{ textAlign: 'right' }}><div className="ls-eyebrow">CONNECTED PHONES</div><strong style={{ fontSize: 30 }}>{connected.length}</strong></div>
      </div>
      <p className="ls-muted" style={{ marginTop: 0 }}>All currently connected phones are automatically eligible for the draw. The audience will see a 10-second synchronized flash countdown before the result is revealed.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 16, alignItems: 'end', marginTop: 18 }}>
        <div>
          <span className="ls-field-label">NUMBER OF WINNERS</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 7 }}>
            <button type="button" aria-label="Decrease number of winners" onClick={() => changeWinnerCount(-1)} disabled={winnerCount <= 1 || lottery?.status === 'running'} style={{ width: 42, height: 42, border: '1px solid #343940', borderRadius: 10, background: '#080a0d', color: '#fff', fontSize: 22, fontWeight: 700, cursor: winnerCount <= 1 || lottery?.status === 'running' ? 'not-allowed' : 'pointer', opacity: winnerCount <= 1 || lottery?.status === 'running' ? .4 : 1 }}>−</button>
            <input aria-label="Number of winners" type="number" min={1} max={100} value={winnerCount} disabled={lottery?.status === 'running'} onChange={e => { const value = Number(e.target.value); if (Number.isFinite(value)) setWinnerCount(Math.max(1, Math.min(100, Math.floor(value)))); }} style={{ width: 76, height: 42, boxSizing: 'border-box', border: '1px solid #343940', background: '#080a0d', color: '#fff', borderRadius: 10, padding: '10px 12px', fontWeight: 800, textAlign: 'center' }} />
            <button type="button" aria-label="Increase number of winners" onClick={() => changeWinnerCount(1)} disabled={lottery?.status === 'running' || winnerCount >= 100} style={{ width: 42, height: 42, border: '1px solid #343940', borderRadius: 10, background: '#080a0d', color: '#fff', fontSize: 22, fontWeight: 700, cursor: lottery?.status === 'running' || winnerCount >= 100 ? 'not-allowed' : 'pointer', opacity: lottery?.status === 'running' || winnerCount >= 100 ? .4 : 1 }}>+</button>
            <span className="ls-muted" style={{ fontSize: 12 }}>max 100</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}><div className="ls-eyebrow">WINNERS</div><strong style={{ fontSize: 28, color: lottery?.status === 'running' ? '#f2c66d' : lottery?.status === 'revealed' ? '#9fe0ad' : '#fff' }}>{lottery?.status === 'running' || lottery?.status === 'revealed' ? lottery.winnerCount : winnerCount}</strong></div>
      </div>

      {(!lottery || lottery.status === 'revealed' || lottery.status === 'idle') && <button type="button" onClick={() => void runLottery()} disabled={busy || connected.length === 0} style={{ ...button, width: '100%', marginTop: 14, opacity: busy || connected.length === 0 ? .45 : 1 }}>{busy ? 'STARTING...' : 'START LOTTERY'}</button>}

      {lottery?.status === 'running' && <div style={{ marginTop: 14, borderRadius: 14, padding: 18, background: '#17120a', border: '1px solid #5b4820', textAlign: 'center' }}><div className="ls-eyebrow">LOTTERY RUNNING</div><strong style={{ display: 'block', fontSize: 64, lineHeight: 1, marginTop: 8, color: '#f2c66d' }}>{seconds}</strong><p style={{ margin: '8px 0 0', color: '#c9c0ae', fontSize: 12 }}>The result will be revealed automatically when the countdown reaches zero.</p><button type="button" onClick={() => void stopLottery()} disabled={cancelling} style={{ ...ghostButton, marginTop: 14, opacity: cancelling ? .5 : 1 }}>{cancelling ? 'CANCELLING...' : 'CANCEL LOTTERY'}</button></div>}

      {lottery?.status === 'revealed' && <div style={{ marginTop: 14, borderRadius: 14, padding: 16, background: '#0e1711', border: '1px solid #294b35' }}><strong>{lottery.winnerCount} winner(s) selected</strong><p style={{ margin: '7px 0 0', color: '#9eb5a5', fontSize: 12 }}>Randomly selected from {lottery.eligibleCount} connected participants.</p></div>}

      {lottery?.status === 'revealed' && winnerUidList.length > 0 && <div style={{ marginTop: 16 }}><div className="ls-eyebrow" style={{ marginBottom: 10 }}>WINNERS / CONTACT DETAILS</div><div style={{ display: 'grid', gap: 8 }}>{winnerUidList.map(uid => { const contact = contacts[uid]; return <div key={uid} style={{ border: '1px solid #292d32', borderRadius: 10, padding: 12, background: '#090b0e' }}>{contact ? <><strong>{contact.name} {contact.surname}</strong><div style={{ color: '#aab0b8', fontSize: 13, marginTop: 4 }}>{contact.phone}</div></> : <span style={{ color: '#777d86', fontSize: 12 }}>Winner has not entered contact details yet.</span>}</div>; })}</div><div style={{ marginTop: 10, color: '#7fba92', fontSize: 12 }}>{winnerRows.length}/{winnerUidList.length} winners have submitted contact details.</div></div>}
      {message && <p style={{ margin: '14px 0 0', color: '#ff9c9c', fontSize: 12 }}>{message}</p>}
    </div>
  );
}
