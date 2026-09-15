import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { watchParticipants, type ParticipantInfo } from '../firebase/participants';
import { revealLottery, shuffleAndPick, startLottery, watchLottery, watchLotteryContacts, type LotteryContact, type LotteryState } from '../firebase/lottery';
import { useTranslate } from '../i18n/LanguageContext';

export default function LotteryOrganizer() {
  const { eventId } = useParams();
  const t = useTranslate();
  const [participants, setParticipants] = useState<Record<string, ParticipantInfo>>({});
  const [lottery, setLottery] = useState<LotteryState | null>(null);
  const [contacts, setContacts] = useState<Record<string, LotteryContact>>({});
  const [winnerCount, setWinnerCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!eventId) return;
    const stopParticipants = watchParticipants(eventId, setParticipants);
    const stopLottery = watchLottery(eventId, setLottery);
    const stopContacts = watchLotteryContacts(eventId, setContacts);
    return () => { stopParticipants(); stopLottery(); stopContacts(); };
  }, [eventId]);

  useEffect(() => {
    if (!eventId || lottery?.status !== 'running') return;
    const delay = Math.max(0, lottery.revealAt - Date.now());
    const timer = window.setTimeout(() => {
      void revealLottery(eventId).catch(error => {
        console.error(error);
        setMessage(t({ tr: 'Çekiliş sonucu yayınlanamadı.', en: 'Could not reveal the lottery result.' }));
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [eventId, lottery?.status, lottery?.revealAt, t]);

  const connected = useMemo(() => Object.values(participants).filter(participant => participant.connected && participant.uid), [participants]);
  const winnerIds = lottery?.winnerIds ? Object.keys(lottery.winnerIds).filter(uid => lottery.winnerIds?.[uid]) : [];
  const winnerRows = winnerIds.map(uid => ({ uid, contact: contacts[uid] })).filter(row => row.contact);

  async function runLottery() {
    if (!eventId || busy || lottery?.status === 'running') return;
    if (connected.length === 0) {
      setMessage(t({ tr: 'Bağlı katılımcı yok.', en: 'There are no connected participants.' }));
      return;
    }
    const count = Math.max(1, Math.min(Number(winnerCount) || 1, connected.length));
    setBusy(true); setMessage('');
    try {
      const selected = shuffleAndPick(connected, count).map(participant => participant.uid as string);
      await startLottery(eventId, selected, connected.length, count);
      setWinnerCount(count);
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : t({ tr: 'Çekiliş başlatılamadı.', en: 'Could not start the lottery.' }));
    } finally { setBusy(false); }
  }

  const card: CSSProperties = { background: 'linear-gradient(145deg,#101216,#0b0d10)', border: '1px solid #292d32', borderRadius: 18, padding: 22, marginTop: 20, boxShadow: '0 16px 50px rgba(0,0,0,.18)' };
  const button: CSSProperties = { border: 0, borderRadius: 10, padding: '13px 18px', fontWeight: 900, letterSpacing: '.08em', cursor: busy || lottery?.status === 'running' ? 'not-allowed' : 'pointer', background: '#fff', color: '#08090b' };

  return <section style={card}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: '.22em', fontWeight: 800, color: '#aab0b8', marginBottom: 7 }}>{t({ tr: 'ÇEKİLİŞ', en: 'LOTTERY' })}</div>
        <h2 style={{ margin: 0, fontSize: 26 }}>{t({ tr: 'Kalabalıktan kazanan seç', en: 'Pick winners from the crowd' })}</h2>
        <p style={{ margin: '8px 0 0', color: '#9298a1', fontSize: 13 }}>{connected.length} {t({ tr: 'bağlı telefon', en: 'connected phones' })}</p>
      </div>
      <div style={{ textAlign: 'right' }}><div style={{ fontSize: 10, color: '#777d86', letterSpacing: '.12em' }}>{t({ tr: 'KAZANAN SAYISI', en: 'WINNERS' })}</div><strong style={{ fontSize: 28 }}>{lottery?.status === 'running' || lottery?.status === 'revealed' ? lottery.winnerCount : winnerCount}</strong></div>
    </div>

    {(!lottery || lottery.status === 'revealed') && <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
      <input aria-label={t({ tr: 'Kazanan sayısı', en: 'Number of winners' })} type="number" min={1} max={Math.max(1, connected.length)} value={winnerCount} onChange={e => setWinnerCount(Math.max(1, Math.min(Number(e.target.value) || 1, Math.max(1, connected.length))))} style={{ width: 120, border: '1px solid #343940', background: '#080a0d', color: '#fff', borderRadius: 10, padding: '12px 13px', fontWeight: 800 }} />
      <button type="button" onClick={() => void runLottery()} disabled={busy || connected.length === 0} style={{ ...button, opacity: busy || connected.length === 0 ? .45 : 1 }}>{busy ? t({ tr: 'BAŞLATILIYOR...', en: 'STARTING...' }) : t({ tr: 'ÇEKİLİŞİ BAŞLAT', en: 'START LOTTERY' })}</button>
    </div>}

    {lottery?.status === 'running' && <div style={{ marginTop: 18, borderRadius: 14, padding: 18, background: '#17120a', border: '1px solid #5b4820' }}><strong style={{ fontSize: 18 }}>{t({ tr: 'ÇEKİLİŞ DEVAM EDİYOR', en: 'LOTTERY RUNNING' })}</strong><p style={{ margin: '7px 0 0', color: '#c9c0ae', fontSize: 13 }}>{t({ tr: '10 saniye dolduğunda sonuçlar otomatik olarak yayınlanacak.', en: 'The result will be revealed automatically after 10 seconds.' })}</p></div>}

    {lottery?.status === 'revealed' && <div style={{ marginTop: 18, borderRadius: 14, padding: 18, background: '#0e1711', border: '1px solid #294b35' }}><strong style={{ fontSize: 18 }}>{lottery.winnerCount} {t({ tr: 'kazanan seçildi', en: 'winner(s) selected' })}</strong><p style={{ margin: '7px 0 0', color: '#9eb5a5', fontSize: 13 }}>{t({ tr: `${lottery.eligibleCount} bağlı katılımcı arasından rastgele seçildi.`, en: `Randomly selected from ${lottery.eligibleCount} connected participants.` })}</p></div>}

    {lottery?.status === 'revealed' && winnerIds.length > 0 && <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 10, letterSpacing: '.18em', color: '#777d86', fontWeight: 800, marginBottom: 10 }}>{t({ tr: 'KAZANANLAR / İLETİŞİM BİLGİLERİ', en: 'WINNERS / CONTACT DETAILS' })}</div>
      <div style={{ display: 'grid', gap: 8 }}>{winnerIds.map(uid => { const contact = contacts[uid]; return <div key={uid} style={{ border: '1px solid #292d32', borderRadius: 10, padding: 12, background: '#090b0e' }}>{contact ? <><strong>{contact.name} {contact.surname}</strong><div style={{ color: '#aab0b8', fontSize: 13, marginTop: 4 }}>{contact.phone}</div></> : <span style={{ color: '#777d86' }}>{t({ tr: 'Kazanan henüz iletişim bilgilerini girmedi.', en: 'Winner has not entered contact details yet.' })}</span>}</div>; })}</div>
      {winnerRows.length > 0 && <div style={{ marginTop: 10, color: '#7fba92', fontSize: 12 }}>{winnerRows.length}/{winnerIds.length} {t({ tr: 'kazanan iletişim bilgilerini gönderdi.', en: 'winners have submitted contact details.' })}</div>}
    </div>}

    {message && <p style={{ margin: '14px 0 0', color: '#ff9c9c', fontSize: 12 }}>{message}</p>}
  </section>;
}
