import NexttedNav from '../components/NexttedNav';
import { useTranslate } from '../i18n/LanguageContext';
import '../styles/nextted.css';

const TIMELINE = [
  { year: { tr: '2020 — Günümüz', en: '2020 — Present' }, name: { tr: 'Basketbol takımları', en: 'Basketball teams' }, body: { tr: 'Müzik, ışık, anons ve maç günü operasyonları. Bugün hâlâ takımlarla çalışıyoruz.', en: 'Music, lighting, announcing and game-day operations. We continue to work with teams today.' } },
  { year: { tr: '2021 — Günümüz', en: '2021 — Present' }, name: { tr: 'Voleybol takımları', en: 'Volleyball teams' }, body: { tr: 'Müzik, ışık, anons ve canlı etkinlik deneyimi. Bu alandaki çalışmalarımız devam ediyor.', en: 'Music, lighting, announcing and live event experience. Our work in this space continues.' } },
];

export default function Mission() {
  const t = useTranslate();

  return (
    <div className="nextted-site">
      <NexttedNav />
      <main>
        <section className="nextted-page-head"><div className="nextted-container">
          <p className="nextted-kicker">{t({ tr: 'Neden varız?', en: 'Why we exist' })}</p>
          <h1>{t({ tr: 'Teknoloji deneyimi daha iyi hale getirmeli.', en: 'Technology should make the experience better.' })}</h1>
          <p>{t({
            tr: 'Nextted; teknoloji, tasarım ve gerçek dünya deneyimini bir araya getirir. Bir özellik listesiyle başlamayız. Önce insanların gerçekte ne yapmaya çalıştığını anlamaya çalışırız.',
            en: 'Nextted brings technology, design and real-world experience together. We do not start with a feature list. We start by understanding what people are actually trying to do.',
          })}</p>
        </div></section>

        <section className="nextted-section"><div className="nextted-container">
          <div className="nextted-mission-grid">
            <article className="nextted-mission-card">
              <p className="nextted-kicker">{t({ tr: 'Misyon', en: 'Mission' })}</p>
              <h2>{t({ tr: 'Önce anla. Sonra geliştir.', en: 'Understand first. Build second.' })}</h2>
              <p>{t({
                tr: 'Misyonumuz, gerçek dünya problemlerini faydalı dijital ürünlere dönüştürmek. Teknolojiyi daha anlaşılır, kolay ve ilgi çekici hale getirmek için araştırma, iş akışı analizi ve ürün tasarımını bir araya getiriyoruz.',
                en: 'Our mission is to turn real-world problems into useful digital products. We combine research, workflow understanding and product design to make technology clearer, easier and more engaging.',
              })}</p>
            </article>
            <article className="nextted-mission-card">
              <p className="nextted-kicker">{t({ tr: 'Vizyon', en: 'Vision' })}</p>
              <h2>{t({ tr: 'Canlı sporu daha canlı hale getirmek.', en: 'Make live sports more alive.' })}</h2>
              <p>{t({
                tr: "Uzun vadeli hedefimiz Türkiye'deki spor deneyiminin değişmesine katkı sağlamak. Taraftarların sadece seyirci değil, salonun içinde olup bitenlerde gerçek bir rolü olmasını istiyoruz.",
                en: 'Our long-term ambition is to help change the sports experience in Türkiye. We want fans to be more than spectators — we want them to have a real role in what happens inside the venue.',
              })}</p>
            </article>
          </div>
          <div className="nextted-quote">{t({
            tr: '"Problemin içinden geldik. Şimdi sahip olmak istediğimiz teknolojiyi geliştiriyoruz."',
            en: '"We came from inside the problem. Now we are building the technology we wish we had."',
          })}</div>
        </div></section>

        <section className="nextted-section"><div className="nextted-container">
          <div className="nextted-story">
            <h2>{t({ tr: 'Salondan ürüne.', en: 'From the venue to the product.' })}</h2>
            <div>
              <p>{t({
                tr: 'Spor hikâyemiz yıllar önce maç günü çalışmalarıyla başladı. Müzik, ışık, anons ve bir maçın sıradan ya da unutulmaz olmasını belirleyen küçük detaylar.',
                en: 'Our sports story started years ago with game-day work. Music, lighting, announcing and the small details that decide whether a game feels flat or unforgettable.',
              })}</p>
              <p>{t({
                tr: 'Bu deneyim, çalıştığımız basketbol ve voleybol takımlarıyla büyüdü. Her biri canlı bir spor deneyiminin nasıl oluşturulduğuna dair farklı bir bakış açısı kazandırdı.',
                en: 'That experience grew through the basketball and volleyball teams we worked with, each adding a different perspective on how a live sports experience is created.',
              })}</p>

              <div className="nextted-timeline">
                {TIMELINE.map(item => (
                  <div className="nextted-timeline-item" key={typeof item.name === 'string' ? item.name : item.name.en}>
                    <span className="nextted-timeline-year">{t(item.year)}</span>
                    <div>
                      <h3>{t(item.name)}</h3>
                      <p>{t(item.body)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p>{t({
                tr: <>Bu deneyim sonunda basit bir soru ortaya çıktı: <strong>ya seyirci de gösterinin bir parçası olabilseydi?</strong></>,
                en: <>That experience eventually led to a simple question: <strong>what if the audience could become part of the show?</strong></>,
              })}</p>
              <p>{t({
                tr: 'LightSync şimdilik bizim cevabımız. Senkronize efektleri anketler, sorular ve diğer taraftar etkileşimleriyle birleştirerek kalabalığı oyunun aktif bir parçası haline getiriyor.',
                en: 'LightSync is our answer so far. It combines synchronized effects with polls, questions and other audience interactions to make the crowd part of the game.',
              })}</p>
              <p>{t({
                tr: 'Türkiye\'de başlıyoruz çünkü problemi burada, ilk elden biliyoruz. Ama hedef çok daha büyük.',
                en: 'We are starting in Türkiye because that is where we know the problem first-hand. The ambition is much bigger.',
              })}</p>
            </div>
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
