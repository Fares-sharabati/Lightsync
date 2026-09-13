import NexttedNav from '../components/NexttedNav';
import { useTranslate } from '../i18n/LanguageContext';
import '../styles/nextted.css';

export default function Contact() {
  const t = useTranslate();

  return (
    <div className="nextted-site">
      <NexttedNav />
      <main>
        <section className="nextted-page-head"><div className="nextted-container">
          <p className="nextted-kicker">{t({ tr: 'İletişime geçin', en: 'Get in touch' })}</p>
          <h1>{t({ tr: 'Çözülmeye değer bir probleminiz mi var?', en: 'Have a problem worth solving?' })}</h1>
          <p>{t({
            tr: 'Üzerinde çalıştığınız şeyi bize anlatın. Dijital ürünler, kullanıcı deneyimi, teknoloji ve gerçek bir fark yaratabilecek fikirlerle ilgileniyoruz.',
            en: 'Tell us what you are working on. We are interested in digital products, user experience, technology and ideas that can make a real difference.',
          })}</p>
        </div></section>

        <section className="nextted-section"><div className="nextted-container">
          <div className="nextted-contact-grid">
            <div className="nextted-contact-card">
              <h3>{t({ tr: 'E-posta', en: 'Email' })}</h3>
              <p><a href="mailto:info@nextted.com">info@nextted.com</a></p>
            </div>
            <div className="nextted-contact-card">
              <h3>{t({ tr: 'Telefon', en: 'Phone' })}</h3>
              <p><a href="tel:+905393833403">+90 539 383 34 03</a></p>
            </div>
            <div className="nextted-contact-card">
              <h3>Gaziantep</h3>
              <p>{t({
                tr: <>Hasan Kalyoncu Üniversitesi<br />Gaziantep, Türkiye</>,
                en: <>Hasan Kalyoncu University<br />Gaziantep, Türkiye</>,
              })}</p>
            </div>
            <div className="nextted-contact-card">
              <h3>{t({ tr: 'İstanbul', en: 'Istanbul' })}</h3>
              <p>{t({
                tr: <>Küçükyalı, Maltepe<br />İstanbul, Türkiye</>,
                en: <>Küçükyalı, Maltepe<br />Istanbul, Türkiye</>,
              })}</p>
            </div>
          </div>
          <div className="nextted-quote">{t({
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
