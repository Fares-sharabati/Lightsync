import { Link } from 'react-router-dom';
import NexttedNav from '../components/NexttedNav';
import { useTranslate } from '../i18n/LanguageContext';
import '../styles/nextted.css';

export default function NexttedHome() {
  const t = useTranslate();

  return (
    <div className="nextted-site">
      <NexttedNav />
      <main>
        <section className="nextted-hero"><div className="nextted-container">
          <p className="nextted-kicker">Technology · Education · Design</p>
          <h1>{t({
            tr: <>Gerçek problemlerin etrafında <em>dijital deneyimler</em> tasarlıyoruz.</>,
            en: <>We build digital experiences around <em>real problems.</em></>,
          })}</h1>
          <p className="nextted-lead">{t({
            tr: 'Nextted; gerçek deneyimlerden doğan dijital ürünler, kullanıcı deneyimleri ve yeni fikirler üzerinde çalışan bir teknoloji ve tasarım stüdyosudur.',
            en: 'Nextted is a technology and design studio working on digital products, user experiences and new ideas born from real-world experience.',
          })}</p>
          <div className="nextted-actions">
            <Link to="/projects" className="nextted-btn nextted-btn-primary">{t({ tr: 'Çalışmalarımıza bakın', en: 'See our work' })}</Link>
            <Link to="/mission" className="nextted-btn nextted-btn-secondary">{t({ tr: 'Nextted neden var?', en: 'Why Nextted?' })}</Link>
          </div>
        </div></section>

        <section className="nextted-section"><div className="nextted-container">
          <div className="nextted-section-head">
            <h2>{t({ tr: 'Ne yapıyoruz?', en: 'What we do' })}</h2>
            <p>{t({
              tr: 'İnsanlar, teknoloji ve işlerin gerçekte nasıl yürüdüğü arasındaki alanla ilgileniyoruz. Önce problemi anlıyor, sonra ürünü bu probleme göre tasarlıyoruz.',
              en: 'We are interested in the space between people, technology and the way things actually work. That means understanding the problem first, then designing the product around it.',
            })}</p>
          </div>
          <div className="nextted-project-grid">
            <Link to="/projects#koza" className="nextted-project-card">
              <span className="nextted-project-no">{t({ tr: '01 / ÜRÜN TASARIMI', en: '01 / PRODUCT DESIGN' })}</span>
              <h3>Koza Halı</h3>
              <p>{t({
                tr: 'Calvin Klein üretici ve distribütörü tarafından kullanılan canlı bir iş uygulaması için B2B iş akışı ve UX/UI tasarımı.',
                en: 'B2B workflow mapping and UX/UI for a live business application used by a manufacturer and distributor for Calvin Klein.',
              })}</p>
              <span className="nt-tag">{t({ tr: 'Canlı ürün →', en: 'Live product →' })}</span>
            </Link>
            <Link to="/projects#enyakit" className="nextted-project-card">
              <span className="nextted-project-no">{t({ tr: '02 / UX ARAŞTIRMASI', en: '02 / UX RESEARCH' })}</span>
              <h3>En Yakıt</h3>
              <p>{t({
                tr: 'THY iş birliği yolculuğunu da kapsayan elektrikli araç şarj deneyimi için kullanıcı araştırması, saha çalışması ve UX/UI.',
                en: 'User research, fieldwork and UX/UI for an EV charging experience, including the THY partnership journey.',
              })}</p>
              <span className="nt-tag">{t({ tr: 'Geliştiriliyor →', en: 'In development →' })}</span>
            </Link>
            <Link to="/projects#fancourt360" className="nextted-project-card">
              <span className="nextted-project-no">{t({ tr: '03 / SPOR TEKNOLOJİSİ', en: '03 / SPORTS TECHNOLOGY' })}</span>
              <h3>FanCourt360</h3>
              <p>{t({
                tr: 'Canlı spor etkinliklerinde tüm taraftarları aynı deneyimde buluşturan bir etkileşim platformu.',
                en: 'An audience engagement platform that brings every fan into the same live game experience.',
              })}</p>
              <span className="nt-tag">{t({ tr: 'Ürünümüz →', en: 'Our product →' })}</span>
            </Link>
          </div>
        </div></section>

        <section className="nextted-section"><div className="nextted-container">
          <div className="nextted-story">
            <h2>{t({ tr: 'Problemin içinden geldik.', en: 'We came from inside the problem.' })}</h2>
            <div>
              <p>{t({
                tr: <>Profesyonel spordaki çalışmalarımız bu platformdan yıllar önce başladı. <strong>Basketbol ve voleybol takımlarıyla</strong> müzik, ışık, anons ve maç günü operasyonlarında çalıştık. Bugün de bu deneyimin içinde olmaya ve takımlarla birlikte çalışmaya devam ediyoruz.</>,
                en: <>Our work in professional sports started years before this platform. We have worked with <strong>basketball and volleyball teams</strong> across music, lighting, announcing and game-day operations. We continue to work alongside teams today.</>,
              })}</p>
              <p>{t({
                tr: 'Bu ortamların içinde olmak, canlı bir maçın ne kadar daha etkileşimli olabileceğini gösterdi. FanCourt360, bu deneyimi değiştirmek için geliştirdiğimiz platform.',
                en: 'Being inside those environments showed us how much more engaging a live game could be. FanCourt360 is the platform we are building to change that experience.',
              })}</p>
              <Link to="/mission" className="nextted-btn nextted-btn-secondary">{t({ tr: 'Hikâyemizi okuyun →', en: 'Read our story →' })}</Link>
            </div>
          </div>
          <div className="nextted-stat-row">
            <div className="nextted-stat"><b>1</b><span>{t({ tr: 'Geliştirdiğimiz spor teknolojisi ürünü', en: 'Sports technology product being built by us' })}</span></div>
            <div className="nextted-stat"><b>2</b><span>{t({ tr: "Gaziantep'teki büyük ürün tasarımı projesi", en: 'Major product design projects in Gaziantep' })}</span></div>
            <div className="nextted-stat"><b>3</b><span>{t({ tr: 'Deneyimimizle bağlantılı spor organizasyonu', en: 'Sports organizations connected to our experience' })}</span></div>
            <div className="nextted-stat"><b>∞</b><span>{t({ tr: 'Deneyimi daha iyi hale getirmek için alan', en: 'Room to make the experience better' })}</span></div>
          </div>
        </div></section>
      </main>
      <footer className="nextted-footer"><div className="nextted-container nextted-footer-inner">
        <span>© {new Date().getFullYear()} Nextted</span>
        <span>Technology. Education. Design.</span>
      </div></footer>
    </div>
  );
}
