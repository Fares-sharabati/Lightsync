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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    return watchLottery(eventId, setLottery);
  }, [eventId]);

  useEffect(() => {
    if (!eventId || !open) return;
    const stopParticipants = watchParticipants(eventId, setParticipants);
    const stopContacts = watchLotteryContacts(eventId, setContacts);
    return () => { stopParticipants(); stopContacts(); };
  }, [eventId, open]);

  useEffect(() => {
    if (!eventId || lottery?.status !== 'running') return;
    const delay = Math.max(0, lottery.revealAt - Date.now());
    const timer = window.setTimeout(() => {
      void revealLottery(eventId).catch(error => { console.error(error); setMessage('Could not reveal the lottery result.'); });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [eventId, lottery?.status, lottery?.revealAt]);

  const connected = useMemo(() => Object.values(participants).filter(participant => participant.connected && participant.uid), [participants]);
  const winnerIds = lottery?.winnerIds ? Object.keys(lottery.winnerIds).filter(uid => lottery.winnerIds?.[uid]) : [];
  const winnerRows = winnerIds.map(uid => ({ uid, contact: contacts[uid] })).filter(row => row.contact);

  async function runLottery() {
    if (!eventId || busy || lottery?.status === 'running') return;
    if (connected.length === 0) { setMessage(t({ tr: 'Bağlı katılımcı yok.', en: 'There are no connected participants.' })); return; }
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

  const winnerLabel = lottery?.status === 'running' || lottery?.status === 'revealed' ? lottery.winnerCount : winnerCount;
  const winnerColor = lottery?.status === 'running' ? '#f2c66d' : lottery?.status === 'revealed' ? '#9fe0ad' : '#fff';
  const button: CSSProperties = { border: 0, borderRadius: 10, padding: '13px 18px', fontWeight: 900, letterSpacing: '.08em', cursor: busy || lottery?.status === 'running' ? 'not-allowed' : 'pointer', background: '#fff', color: '#08090b' };

  return <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 8000, width: open ? 'min(420px, calc(100vw - 40px))' : 'auto' }}>
    {!open && <button type="button" onClick={() => setOpen(true)} style={{ ...button, boxShadow: '0 14px 40px rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 18 }}>🎟</span>{t({ tr: 'ÇEKİLİŞ', en: 'LOTTERY' })}{lottery?.status === 'running' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: winnerColor }} />}</button>}

    {open && <section style={{ background: 'linear-gradient(145deg,#101216,#0b0d10)', border: '1px solid #292d32', borderRadius: 18, padding: 22, boxShadow: '0 18px 70px rgba(0,0,0,.55)', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}><div><div style={{ fontSize: 10, letterSpacing: '.22em', fontWeight: 800, color: '#aab0b8', marginBottom: 7 }}>{t({ tr: 'ÇEKİLİŞ', en: 'LOTTERY' })}</div><h2 style={{ margin: 0, fontSize: 26 }}>{t({ tr: 'Kalabalıktan kazanan seç', en: 'Pick winners from the crowd' })}</h2><p style={{ margin: '8px 0 0', color: '#9298a1', fontSize: 13 }}>{connected.length} {t({ tr: 'bağlı telefon', en: 'connected phones' })}</p></div><button type="button" onClick={() => setOpen(false)} style={{ border: '1px solid #343940', background: '#0b0d10', color: '#aeb4bc', borderRadius: 8, padding: '7px 9px', cursor: 'pointer' }}>×</button></div>
      <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 12, marginTop: 18 }}><label style={{ flex: 1, fontSize: 10, letterSpacing: '.12em', color: '#777d86', fontWeight: 800 }}>{t({ tr: 'KAZANAN SAYISI', en: 'NUMBER OF WINNERS' })}<input aria-label={t({ tr: 'Kazanan sayısı', en: 'Number of winners' })} type="number" min={1} max={Math.max(1, connected.length)} value={winnerCount} disabled={lottery?.status === 'running'} onChange={e => setWinnerCount(Math.max(1, Math.min(Number(e.target.value) || 1, Math.max(1, connected.length))))} style={{ display: 'block', width: 110, marginTop: 7, border: '1px solid #343940', background: '#080a0d', color: '#fff', borderRadius: 10, padding: '12px 13px', fontWeight: 800 }} /></label><div style={{ textAlign: 'right' }}><div style={{ fontSize: 10, color: '#777d86', letterSpacing: '.12em' }}>{t({ tr: 'SONUÇ', en: 'RESULT' })}</div><strong style={{ fontSize: 28, color: winnerColor }}>{winnerLabel}</strong></div></div>
      {(!lottery || lottery.status === 'revealed') && <button type="button" onClick={() => void runLottery()} disabled={busy || connected.length === 0} style={{ ...button, width: '100%', marginTop: 14, opacity: busy || connected.length === 0 ? .45 : 1 }}>{busy ? t({ tr: 'BAŞLATILIYOR...', en: 'STARTING...' }) : t({ tr: 'ÇEKİLİŞİ BAŞLAT', en: 'START LOTTERY' })}</button>}
      {lottery?.status === 'running' && <div style={{ marginTop: 14, borderRadius: 14, padding: 16, background: '#17120a', border: '1px solid #5b4820' }}><strong>{t({ tr: 'ÇEKİLİŞ DEVAM EDİYOR', en: 'LOTTERY RUNNING' })}</strong><p style={{ margin: '7px 0 0', color: '#c9c0ae', fontSize: 12 }}>{t({ tr: '10 saniye dolduğunda sonuçlar otomatik olarak yayınlanacak.', en: 'The result will be revealed automatically after 10 seconds.' })}</p></div>}
      {lottery?.status === 'revealed' && <div style={{ marginTop: 14, borderRadius: 14, padding: 16, background: '#0e1711', border: '1px solid #294b35' }}><strong>{lottery.winnerCount} {t({ tr: 'kazanan seçildi', en: 'winner(s) selected' })}</strong><p style={{ margin: '7px 0 0', color: '#9eb5a5', fontSize: 12 }}>{t({ tr: `${lottery.eligibleCount} bağlı katılımcı arasından rastgele seçildi.`, en: `Randomly selected from ${lottery.eligibleCount} connected participants.` })}</p></div>}
      {lottery?.status === 'revealed' && winnerIds.length > 0 && <div style={{ marginTop: 16 }}><div style={{ fontSize: 10, letterSpacing: '.18em', color: '#777d86', fontWeight: 800, marginBottom: 10 }}>{t({ tr: 'KAZANANLAR / İLETİŞİM BİLGİLERİ', en: 'WINNERS / CONTACT DETAILS' })}</div><div style={{ display: 'grid', gap: 8 }}>{winnerIds.map(uid => { const contact = contacts[uid]; return <div key={uid} style={{ border: '1px solid #292d32', borderRadius: 10, padding: 12, background: '#090b0e' }}>{contact ? <><strong>{contact.name} {contact.surname}</strong><div style={{ color: '#aab0b8', fontSize: 13, marginTop: 4 }}>{contact.phone}</div></> : <span style={{ color: '#777d86', fontSize: 12 }}>{t({ tr: 'Kazanan henüz iletişim bilgilerini girmedi.', en: 'Winner has not entered contact details yet.' })}</span>}</div>; })}</div><div style={{ marginTop: 10, color: '#7fba92', fontSize: 12 }}>{winnerRows.length}/{winnerIds.length} {t({ tr: 'kazanan iletişim bilgilerini gönderdi.', en: 'winners have submitted contact details.' })}</div></div>}
      {message && <p style={{ margin: '14px 0 0', color: '#ff9c9c', fontSize: 12 }}>{message}</p>}
    </section>}
  </div>;
}
