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
    if (winnerCount > connected.length) { setMessage(`You selected ${winnerCount} winners, but only ${connected.length} phone${connected.length === 1 ? '' : 's'} are connected.`); return; }
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

  const button: CSSProperties = { border: 0, borderRadius: 12, padding: '14px 18px', fontWeight: 900, letterSpacing: '.08em', cursor: busy || lottery?.status === 'running' ? 'not-allowed' : 'pointer' };
  const ghostButton: CSSProperties = { border: '1px solid color-mix(in srgb,var(--ls-accent) 42%,#343940 58%)', borderRadius: 10, padding: '10px 16px', fontWeight: 800, letterSpacing: '.06em', cursor: cancelling ? 'not-allowed' : 'pointer', background: 'color-mix(in srgb,var(--ls-accent) 7%,transparent)', color: 'var(--ls-accent)' };

  return (
    <div className="ls-card ls-lottery-card" style={{ gridColumn: '1 / -1' }}>
      <div className="ls-section-title">
        <div><p className="ls-eyebrow">LOTTERY</p><h2>Pick winners from the crowd</h2></div>
        <div className="ls-lottery-connected"><div className="ls-eyebrow">CONNECTED PHONES</div><strong>{connected.length}</strong></div>
      </div>
      <p className="ls-muted" style={{ marginTop: 0 }}>All currently connected phones are automatically eligible for the draw. The audience will see a 10-second synchronized flash countdown before the result is revealed.</p>

      <div className="ls-winner-selector">
        <div>
          <span className="ls-field-label">NUMBER OF WINNERS</span>
          <div className="ls-winner-stepper">
            <button type="button" className="ls-stepper-button" aria-label="Decrease number of winners" onClick={() => changeWinnerCount(-1)} disabled={winnerCount <= 1 || lottery?.status === 'running'}>−</button>
            <div className="ls-winner-value"><input aria-label="Number of winners" type="number" inputMode="numeric" min={1} max={100} step={1} value={winnerCount} disabled={lottery?.status === 'running'} onChange={e => { const value = Number(e.target.value); if (Number.isFinite(value)) { setWinnerCount(Math.max(1, Math.min(100, Math.floor(value)))); setMessage(''); } }} /></div>
            <button type="button" className="ls-stepper-button" aria-label="Increase number of winners" onClick={() => changeWinnerCount(1)} disabled={lottery?.status === 'running' || winnerCount >= 100}>+</button>
          </div>
          <p className="ls-muted ls-winner-hint">{connected.length === 0 ? 'Connect audience phones before starting the lottery.' : `Up to ${connected.length} connected participant${connected.length === 1 ? '' : 's'} can be selected.`}</p>
        </div>
        <div className="ls-winner-summary"><span>SELECTED</span><strong>{lottery?.status === 'running' || lottery?.status === 'revealed' ? lottery.winnerCount : winnerCount}</strong></div>
      </div>

      {(!lottery || lottery.status === 'revealed' || lottery.status === 'idle') && <button type="button" className="ls-button ls-primary ls-lottery-start" onClick={() => void runLottery()} disabled={busy || connected.length === 0} style={{ ...button, width: '100%', opacity: busy || connected.length === 0 ? .45 : 1 }}>{busy ? 'STARTING...' : 'START LOTTERY'}</button>}

      {lottery?.status === 'running' && <div className="ls-lottery-running"><div className="ls-eyebrow">LOTTERY RUNNING</div><strong>{seconds}</strong><p>The result will be revealed automatically when the countdown reaches zero.</p><button type="button" onClick={() => void stopLottery()} disabled={cancelling} style={{ ...ghostButton, opacity: cancelling ? .5 : 1 }}>{cancelling ? 'CANCELLING...' : 'CANCEL LOTTERY'}</button></div>}

      {lottery?.status === 'revealed' && <div className="ls-lottery-result"><strong>{lottery.winnerCount} winner(s) selected</strong><p>Randomly selected from {lottery.eligibleCount} connected participants.</p></div>}

      {lottery?.status === 'revealed' && winnerUidList.length > 0 && <div style={{ marginTop: 16 }}><div className="ls-eyebrow" style={{ marginBottom: 10 }}>WINNERS / CONTACT DETAILS</div><div style={{ display: 'grid', gap: 8 }}>{winnerUidList.map(uid => { const contact = contacts[uid]; return <div key={uid} className="ls-winner-row">{contact ? <><strong>{contact.name} {contact.surname}</strong><div>{contact.phone}</div></> : <span>Winner has not entered contact details yet.</span>}</div>; })}</div><div className="ls-winner-submitted">{winnerRows.length}/{winnerUidList.length} winners have submitted contact details.</div></div>}
      {message && <p className="ls-error" style={{ margin: '14px 0 0' }}>{message}</p>}
    </div>
  );
}
