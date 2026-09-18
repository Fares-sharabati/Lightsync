import NexttedNav from '../components/NexttedNav';
import { useTranslate } from '../i18n/LanguageContext';
import '../styles/nextted.css';

export default function Contact() {
  const t = useTranslate();

  return (
    <div className="nextted-site">
      <NexttedNav />
      <main>
        <section className="nextted-contact-hero">
          <div className="nextted-container nextted-contact-hero-inner">
            <div className="nextted-contact-hero-copy">
              <p className="nextted-kicker">{t({ tr: 'İletişime geçin', en: 'Get in touch' })}</p>
              <h1>{t({ tr: 'Çözülmeye değer bir probleminiz mi var?', en: 'Have a problem worth solving?' })}</h1>
            </div>
            <div className="nextted-contact-hero-note">
              <span className="nextted-contact-index">01 / CONTACT</span>
              <p>{t({
                tr: 'Üzerinde çalıştığınız şeyi bize anlatın. Dijital ürünler, kullanıcı deneyimi, teknoloji ve gerçek bir fark yaratabilecek fikirlerle ilgileniyoruz.',
                en: 'Tell us what you are working on. We are interested in digital products, user experience, technology and ideas that can make a real difference.',
              })}</p>
            </div>
          </div>
        </section>

        <section className="nextted-section nextted-contact-section"><div className="nextted-container">
          <div className="nextted-contact-heading">
            <div>
              <p className="nextted-kicker">{t({ tr: 'Doğrudan ulaşın', en: 'Reach us directly' })}</p>
              <h2>{t({ tr: 'Konuşmayı başlatalım.', en: 'Start the conversation.' })}</h2>
            </div>
            <span>{t({ tr: 'İstanbul · Türkiye', en: 'Istanbul · Türkiye' })}</span>
          </div>

          <div className="nextted-contact-grid nextted-contact-grid-pro">
            <a className="nextted-contact-card nextted-contact-card-featured" href="mailto:info@nextted.com">
              <div className="nextted-contact-card-top">
                <span className="nextted-contact-number">01</span>
                <span className="nextted-contact-arrow">↗</span>
              </div>
              <h3>{t({ tr: 'E-posta', en: 'Email' })}</h3>
              <p>info@nextted.com</p>
              <span className="nextted-contact-label">{t({ tr: 'En hızlı başlangıç', en: 'Best place to start' })}</span>
            </a>

            <a className="nextted-contact-card nextted-contact-card-featured" href="tel:+905393833403">
              <div className="nextted-contact-card-top">
                <span className="nextted-contact-number">02</span>
                <span className="nextted-contact-arrow">↗</span>
              </div>
              <h3>{t({ tr: 'Telefon', en: 'Phone' })}</h3>
              <p>+90 539 383 34 03</p>
              <span className="nextted-contact-label">{t({ tr: 'Doğrudan konuşalım', en: 'Talk directly' })}</span>
            </a>

            <div className="nextted-contact-card nextted-contact-card-featured">
              <div className="nextted-contact-card-top">
                <span className="nextted-contact-number">03</span>
                <span className="nextted-contact-arrow">⌖</span>
              </div>
              <h3>{t({ tr: 'İstanbul', en: 'Istanbul' })}</h3>
              <p>{t({
                tr: <>Küçükyalı, Maltepe<br />İstanbul, Türkiye</>,
                en: <>Küçükyalı, Maltepe<br />Istanbul, Türkiye</>,
              })}</p>
              <span className="nextted-contact-label">{t({ tr: 'Merkezimiz', en: 'Our base' })}</span>
            </div>
          </div>

          <div className="nextted-quote nextted-contact-quote">{t({
            tr: 'Her zaman iyi bir probleme, güçlü bir fikre ya da teknolojinin neyi daha iyi yapabileceği üzerine bir sohbete açığız.',
            en: 'We are always open to a good problem, a strong idea or a conversation about what technology could do better.',
          })}</div>
        </div></section>
      </main>
      <footer className="nextted-footer"><div className="nextted-container nextted-footer-inner">
        <span>© {new Date().getFullYear()} Nextted</span>
        <span>Technology. Education. Design.</span>
      </div></footer>
    </div>
  );
}
