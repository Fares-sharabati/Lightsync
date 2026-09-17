import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { ensureAnonymousAuth } from '../firebase/auth';
import { submitLotteryContact, watchLottery, watchLotteryContact, watchLotteryEligibility, watchLotteryResult, type LotteryContact, type LotteryState } from '../firebase/lottery';
import { serverNow, watchServerTimeOffset } from '../firebase/serverTime';
import { watchPublicShow, type PublicShow } from '../firebase/shows';
import { watchSportsInteractions } from '../firebase/sports';
import { getReadableTextColor } from '../utils/color';
import { useTranslate } from '../i18n/LanguageContext';

export default function LotteryAudience() {
  const { eventId } = useParams();
  const t = useTranslate();
  const [lottery, setLottery] = useState<LotteryState | null>(null);
  const [show, setShow] = useState<PublicShow | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [eligible, setEligible] = useState(false);
  const [eligibilityLoaded, setEligibilityLoaded] = useState(false);
  const [winner, setWinner] = useState(false);
  const [resultLoaded, setResultLoaded] = useState(false);
  const [contact, setContact] = useState<LotteryContact | null>(null);
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [phone, setPhone] = useState('');
  const [seconds, setSeconds] = useState(10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [interactions, setInteractions] = useState<Array<{ status: 'open' | 'closed'; createdAt: number }>>([]);

  useEffect(() => watchServerTimeOffset(() => {}), []);

  useEffect(() => {
    if (!eventId) return;
    const stopLottery = watchLottery(eventId, setLottery);
    const stopShow = watchPublicShow(eventId, setShow);
    return () => {
      stopLottery();
      stopShow();
    };
  }, [eventId]);

  // Keep lottery and audience interactions independent. A running lottery is
  // the highest-priority audience state, so an already-open poll/question must
  // not cover the synchronized lottery countdown. After the result is shown,
  // only activity created after that result can replace it permanently.
  useEffect(() => {
    if (!eventId) {
      setInteractions([]);
      return;
    }
    return watchSportsInteractions(eventId, items => {
      setInteractions(items.map(item => ({ status: item.status, createdAt: item.createdAt })));
    });
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    void ensureAnonymousAuth()
      .then(user => {
        if (active) setUid(user.uid);
      })
      .catch(console.error);
    return () => {
      active = false;
    };
  }, [eventId]);

  useEffect(() => {
    setEligibilityLoaded(false);
    setEligible(false);
    setResultLoaded(false);
    setWinner(false);
    if (!eventId || !uid || !lottery?.runId || lottery.status === 'idle') return;

    const stopEligibility = watchLotteryEligibility(eventId, lottery.runId, uid, value => {
      setEligible(value);
      setEligibilityLoaded(true);
    });
    const stopResult = watchLotteryResult(eventId, lottery.runId, uid, value => {
      setWinner(value);
      setResultLoaded(true);
    });

    return () => {
      stopEligibility();
      stopResult();
    };
  }, [eventId, uid, lottery?.runId, lottery?.status]);

  useEffect(() => {
    if (!eventId || !uid) return;
    return watchLotteryContact(eventId, uid, setContact);
  }, [eventId, uid]);

  useEffect(() => {
    if (!lottery || lottery.status !== 'running') return;
    const update = () => setSeconds(Math.max(0, Math.ceil((lottery.revealAt - serverNow()) / 1000)));
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [lottery?.status, lottery?.revealAt]);

  const isEligible = !!uid && eligible;
  const resolving = lottery?.status === 'revealed' && (!lottery.resultsReady || !resultLoaded);
  const isWinner = isEligible && winner;
  const active = isEligible && eligibilityLoaded && (lottery?.status === 'running' || lottery?.status === 'revealed');
  const flashColor = /^#[0-9a-fA-F]{6}$/.test(show?.screenLightColor || '') ? show!.screenLightColor! : '#FFFFFF';
  const background = lottery?.status === 'running'
    ? `radial-gradient(circle, ${flashColor} 0%, ${flashColor} 48%, rgba(255,255,255,.12) 100%)`
    : 'rgba(4,5,7,.97)';
  const formValid = useMemo(
    () => name.trim().length >= 2 && surname.trim().length >= 2 && phone.trim().length >= 7,
    [name, surname, phone],
  );

  async function submitContact() {
    if (!eventId || !uid || !isWinner || !formValid || saving) return;
    setSaving(true);
    setError('');
    try {
      await submitLotteryContact(eventId, uid, {
        name: name.trim(),
        surname: surname.trim(),
        phone: phone.trim(),
      });
    } catch (err) {
      console.error(err);
      setError(t({
        tr: 'Bilgiler gönderilemedi. Lütfen tekrar deneyin.',
        en: 'Could not submit your details. Please try again.',
      }));
    } finally {
      setSaving(false);
    }
  }

  // A lottery countdown must always be visible to eligible participants while
  // it is running. Open/unanswered interactions temporarily yield to it.
  if (!active || !lottery) return null;

  const latestInteractionAfterResult = lottery.status === 'revealed'
    ? interactions.some(item => item.createdAt > lottery.revealAt)
    : false;
  const showStartedAfterResult = lottery.status === 'revealed'
    && typeof show?.showStartTime === 'number'
    && show.showStartTime > lottery.revealAt;
  const resultSuperseded = latestInteractionAfterResult || showStartedAfterResult;

  if (lottery.status === 'running') {
    const overlayBase: CSSProperties = {
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'grid',
      placeItems: 'center',
      background,
      color: '#fff',
      textAlign: 'center',
      padding: 24,
    };
    return (
      <div
        role="status"
        aria-live="assertive"
        style={{
          ...overlayBase,
          color: '#050505',
          animation: 'lightsync-lottery-flash .55s ease-in-out infinite alternate',
        }}
      >
        <style>{'@keyframes lightsync-lottery-flash{from{filter:brightness(.72)}to{filter:brightness(1.18)}}'}</style>
        <div>
          <div style={{ fontSize: 12, letterSpacing: '.35em', fontWeight: 900 }}>
            {t({ tr: 'ÇEKİLİŞ', en: 'LOTTERY' })}
          </div>
          <div style={{ fontSize: 'clamp(88px,22vw,220px)', lineHeight: .85, fontWeight: 950 }}>
            {seconds}
          </div>
          <div style={{ fontSize: 'clamp(16px,3vw,28px)', fontWeight: 900 }}>
            {t({ tr: 'SONUCU BEKLEYİN', en: 'WAIT FOR THE RESULT' })}
          </div>
        </div>
      </div>
    );
  }

  // A later poll/question or a newly-started show is a new program state.
  // Once that happens, never let the previous lottery result take the screen
  // back when the interaction is closed or the show changes state.
  if (resultSuperseded) return null;

  const overlayBase: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'grid',
    placeItems: 'center',
    background,
    color: '#fff',
    textAlign: 'center',
    padding: 24,
  };

  if (resolving) {
    return (
      <div role="status" aria-live="polite" style={overlayBase}>
        <div style={{ fontSize: 'clamp(20px,4vw,32px)', fontWeight: 900 }}>
          {t({ tr: 'SONUÇLAR AÇIKLANIYOR...', en: 'REVEALING RESULTS...' })}
        </div>
      </div>
    );
  }

  if (!isWinner) {
    return (
      <div role="status" aria-live="assertive" style={overlayBase}>
        <div style={{ width: 'min(92vw,520px)' }}>
          <div style={{ fontSize: 11, letterSpacing: '.3em', color: '#8d939d', fontWeight: 800 }}>
            {t({ tr: 'ÇEKİLİŞ SONUCU', en: 'LOTTERY RESULT' })}
          </div>
          <h2 style={{ fontSize: 'clamp(38px,9vw,68px)', lineHeight: 1.05, margin: '16px 0 10px' }}>
            {t({ tr: 'MAALESEF KAZANAMADINIZ', en: 'UNFORTUNATELY, YOU DID NOT WIN' })}
          </h2>
          <p style={{ color: '#9ba1aa', margin: 0 }}>
            {t({ tr: 'Katıldığınız için teşekkürler.', en: 'Thank you for taking part.' })}
          </p>
        </div>
      </div>
    );
  }

  if (contact && show?.status === 'running') return null;

  if (contact) {
    return (
      <div role="status" aria-live="assertive" style={overlayBase}>
        <div style={{ width: 'min(92vw,520px)' }}>
          <div style={{ fontSize: 11, letterSpacing: '.3em', color: '#9fe0ad', fontWeight: 800 }}>
            {t({ tr: 'TEBRİKLER', en: 'CONGRATULATIONS' })}
          </div>
          <h2 style={{ fontSize: 'clamp(42px,10vw,72px)', margin: '14px 0' }}>
            {t({ tr: 'KAZANDINIZ!', en: 'YOU WON!' })}
          </h2>
          <p style={{ color: '#aeb5bd' }}>
            {t({
              tr: 'İletişim bilgileriniz alındı. Ödülünüz için sizinle iletişime geçeceğiz.',
              en: 'Your contact details were received. We will contact you about your prize.',
            })}
          </p>
        </div>
      </div>
    );
  }

  const input: CSSProperties = {
    width: '100%',
    border: '1px solid #343940',
    background: '#0b0d10',
    color: '#fff',
    borderRadius: 10,
    padding: '13px 14px',
    fontSize: 16,
    outline: 'none',
    ...({ '--phone-accent': flashColor } as CSSProperties),
  };

  return (
    <div role="status" aria-live="assertive" style={{ ...overlayBase, textAlign: 'left', overflowY: 'auto' }}>
      <div style={{ width: 'min(92vw,520px)', background: '#090b0e', border: '1px solid #30343a', borderRadius: 20, padding: '28px 22px', boxShadow: '0 30px 100px rgba(0,0,0,.5)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, letterSpacing: '.3em', color: '#9fe0ad', fontWeight: 800 }}>
            {t({ tr: 'TEBRİKLER', en: 'CONGRATULATIONS' })}
          </div>
          <h2 style={{ fontSize: 42, margin: '12px 0 8px' }}>{t({ tr: 'KAZANDINIZ!', en: 'YOU WON!' })}</h2>
          <p style={{ color: '#9ba1aa', margin: 0 }}>
            {t({ tr: 'Ödülünüz için iletişim bilgilerinizi girin.', en: 'Enter your contact details to claim your prize.' })}
          </p>
        </div>
        <div style={{ display: 'grid', gap: 10, marginTop: 22 }}>
          <input className="ls-mobile-input" style={input} placeholder={t({ tr: 'Ad', en: 'First name' })} value={name} onChange={e => setName(e.target.value)} autoComplete="given-name" />
          <input className="ls-mobile-input" style={input} placeholder={t({ tr: 'Soyad', en: 'Surname' })} value={surname} onChange={e => setSurname(e.target.value)} autoComplete="family-name" />
          <input className="ls-mobile-input" style={input} placeholder={t({ tr: 'Telefon numarası', en: 'Phone number' })} value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" />
          <button type="button" className="ls-mobile-cta" onClick={() => void submitContact()} disabled={!formValid || saving} style={{ border: 0, borderRadius: 10, padding: 14, marginTop: 4, background: formValid ? flashColor : '#363a40', color: formValid ? getReadableTextColor(flashColor) : '#fff', fontWeight: 900, cursor: formValid ? 'pointer' : 'not-allowed' }}>
            {saving ? t({ tr: 'GÖNDERİLİYOR...', en: 'SUBMITTING...' }) : t({ tr: 'BİLGİLERİ GÖNDER', en: 'SUBMIT DETAILS' })}
          </button>
        </div>
        {error && <p style={{ color: '#ff9c9c', fontSize: 12, marginBottom: 0 }}>{error}</p>}
        <p style={{ color: '#666c75', fontSize: 11, lineHeight: 1.5, marginBottom: 0 }}>
          {t({
            tr: 'Bu bilgiler yalnızca çekiliş ödülünüz için sizinle iletişime geçmek amacıyla kullanılır.',
            en: 'These details are used only to contact you about the lottery prize.',
          })}
        </p>
      </div>
    </div>
  );
}
