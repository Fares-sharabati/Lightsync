import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { type ParticipantInfo } from '../firebase/participants';
import { revealLottery, shuffleAndPick, startLottery, watchLottery, watchLotteryContacts, type LotteryContact, type LotteryState } from '../firebase/lottery';

interface LotteryOrganizerProps {
  participants: Record<string, ParticipantInfo>;
  participantCount: number;
}

export default function LotteryOrganizer({ participants, participantCount }: LotteryOrganizerProps) {
  const { eventId } = useParams();
  const [lottery, setLottery] = useState<LotteryState | null>(null);
  const [contacts, setContacts] = useState<Record<string, LotteryContact>>({});
  const [winnerCount, setWinnerCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [seconds, setSeconds] = useState(10);

  useEffect(() => {
    if (!eventId) return;
    return watchLottery(eventId, setLottery);
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    return watchLotteryContacts(eventId, setContacts);
  }, [eventId]);

  const connected = useMemo(
    () => Object.values(participants).filter(participant => participant.connected === true && Boolean(participant.uid)),
    [participants],
  );
  const winnerIds = lottery?.winnerIds ? Object.keys(lottery.winnerIds).filter(uid => lottery.winnerIds?.[uid]) : [];
  const winnerRows = winnerIds.map(uid => ({ uid, contact: contacts[uid] })).filter(row => row.contact);

  useEffect(() => {
    if (!lottery || lottery.status !== 'running') return;
    const update = () => setSeconds(Math.max(0, Math.ceil((lottery.revealAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [lottery?.status, lottery?.revealAt]);

  useEffect(() => {
    if (!eventId || lottery?.status !== 'running') return;
    const delay = Math.max(0, lottery.revealAt - Date.now());
    const timer = window.setTimeout(() => {
      void revealLottery(eventId).catch(error => {
        console.error(error);
        setMessage('Could not reveal the lottery result.');
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [eventId, lottery?.status, lottery?.revealAt]);

  async function runLottery() {
    if (!eventId || busy || lottery?.status === 'running') return;
    if (connected.length === 0) {
      setMessage('There are no connected participants.');
      return;
    }
    const count = Math.max(1, Math.min(Number(winnerCount) || 1, connected.length));
    setBusy(true);
    setMessage('');
    try {
      const eligibleIds = connected.map(participant => participant.uid as string);
      const selected = shuffleAndPick(connected, count).map(participant => participant.uid as string);
      await startLottery(eventId, selected, eligibleIds, eligibleIds.length, count);
      setWinnerCount(count);
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : 'Could not start the lottery.');
    } finally {
      setBusy(false);
    }
  }

  const winnerLabel = lottery?.status === 'running' || lottery?.status === 'revealed' ? lottery.winnerCount : winnerCount;
  const winnerColor = lottery?.status === 'running' ? '#f2c66d' : lottery?.status === 'revealed' ? '#9fe0ad' : '#fff';
  const button: CSSProperties = {
    border: 0,
    borderRadius: 10,
    padding: '13px 18px',
    fontWeight: 900,
    letterSpacing: '.08em',
    cursor: busy || lottery?.status === 'running' ? 'not-allowed' : 'pointer',
    background: '#fff',
    color: '#08090b',
  };

  return (
    <div className="ls-card" style={{ gridColumn: '1 / -1' }}>
      <div className="ls-section-title">
        <div>
          <p className="ls-eyebrow">LOTTERY</p>
          <h2>Pick winners from the crowd</h2>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="ls-eyebrow">CONNECTED PHONES</div>
          <strong style={{ fontSize: 30 }}>{participantCount}</strong>
        </div>
      </div>

      <p className="ls-muted" style={{ marginTop: 0 }}>
        All currently connected phones are automatically eligible for the draw. The audience will see a 10-second synchronized flash countdown before the result is revealed.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 16, alignItems: 'end', marginTop: 18 }}>
        <label>
          <span className="ls-field-label">NUMBER OF WINNERS</span>
          <input
            aria-label="Number of winners"
            type="number"
            min={1}
            max={Math.max(1, participantCount)}
            value={winnerCount}
            disabled={lottery?.status === 'running'}
            onChange={e => setWinnerCount(Math.max(1, Math.min(Number(e.target.value) || 1, Math.max(1, participantCount))))}
            style={{ display: 'block', width: 120, marginTop: 7, border: '1px solid #343940', background: '#080a0d', color: '#fff', borderRadius: 10, padding: '12px 13px', fontWeight: 800 }}
          />
        </label>
        <div style={{ textAlign: 'right' }}>
          <div className="ls-eyebrow">WINNERS</div>
          <strong style={{ fontSize: 28, color: winnerColor }}>{winnerLabel}</strong>
        </div>
      </div>

      {(!lottery || lottery.status === 'revealed') && (
        <button type="button" onClick={() => void runLottery()} disabled={busy || participantCount === 0} style={{ ...button, width: '100%', marginTop: 14, opacity: busy || participantCount === 0 ? .45 : 1 }}>
          {busy ? 'STARTING...' : 'START LOTTERY'}
        </button>
      )}

      {lottery?.status === 'running' && (
        <div style={{ marginTop: 14, borderRadius: 14, padding: 18, background: '#17120a', border: '1px solid #5b4820', textAlign: 'center' }}>
          <div className="ls-eyebrow">LOTTERY RUNNING</div>
          <strong style={{ display: 'block', fontSize: 64, lineHeight: 1, marginTop: 8, color: '#f2c66d' }}>{seconds}</strong>
          <p style={{ margin: '8px 0 0', color: '#c9c0ae', fontSize: 12 }}>The result will be revealed automatically when the countdown reaches zero.</p>
        </div>
      )}

      {lottery?.status === 'revealed' && (
        <div style={{ marginTop: 14, borderRadius: 14, padding: 16, background: '#0e1711', border: '1px solid #294b35' }}>
          <strong>{lottery.winnerCount} winner(s) selected</strong>
          <p style={{ margin: '7px 0 0', color: '#9eb5a5', fontSize: 12 }}>
            Randomly selected from {lottery.eligibleCount} connected participants.
          </p>
        </div>
      )}

      {lottery?.status === 'revealed' && winnerIds.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="ls-eyebrow" style={{ marginBottom: 10 }}>WINNERS / CONTACT DETAILS</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {winnerIds.map(uid => {
              const contact = contacts[uid];
              return (
                <div key={uid} style={{ border: '1px solid #292d32', borderRadius: 10, padding: 12, background: '#090b0e' }}>
                  {contact ? (
                    <>
                      <strong>{contact.name} {contact.surname}</strong>
                      <div style={{ color: '#aab0b8', fontSize: 13, marginTop: 4 }}>{contact.phone}</div>
                    </>
                  ) : (
                    <span style={{ color: '#777d86', fontSize: 12 }}>Winner has not entered contact details yet.</span>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 10, color: '#7fba92', fontSize: 12 }}>
            {winnerRows.length}/{winnerIds.length} winners have submitted contact details.
          </div>
        </div>
      )}

      {message && <p style={{ margin: '14px 0 0', color: '#ff9c9c', fontSize: 12 }}>{message}</p>}
    </div>
  );
}
