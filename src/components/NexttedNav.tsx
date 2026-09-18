import { Link } from 'react-router-dom';
import { useLanguage, useTranslate } from '../i18n/LanguageContext';

export default function NexttedNav() {
  const { language, toggleLanguage } = useLanguage();
  const t = useTranslate();

  return (
    <header className="nextted-nav">
      <Link to="/" className="nextted-logo">NEXTT<span>ED</span></Link>
      <nav className="nextted-nav-links">
        <Link to="/mission">{t({ tr: 'Misyon & Vizyon', en: 'Mission & Vision' })}</Link>
        <Link to="/projects">{t({ tr: 'Projeler', en: 'Projects' })}</Link>
        <Link to="/contact">{t({ tr: 'İletişim', en: 'Contact' })}</Link>
        <Link to="/admin" className="nextted-light-btn">{t({ tr: "FanCourt360'i Aç", en: 'Open FanCourt360' })}</Link>
        <button type="button" className="nextted-lang-toggle" onClick={toggleLanguage} aria-label="Switch language">
          {language === 'tr' ? 'EN' : 'TR'}
        </button>
      </nav>
    </header>
  );
}
