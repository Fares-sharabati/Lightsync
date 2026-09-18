import { Link } from 'react-router-dom';
import NexttedNav from '../components/NexttedNav';
import { useTranslate } from '../i18n/LanguageContext';
import '../styles/nextted.css';

export default function Projects() {
  const t = useTranslate();

  return (
    <div className="nextted-site">
      <NexttedNav />
      <main>
        <section className="nextted-page-head"><div className="nextted-container">
          <p className="nextted-kicker">{t({ tr: 'Seçili çalışmalar', en: 'Selected work' })}</p>
          <h1>{t({ tr: 'Gerçek kullanıcılar ve gerçek ortamlar etrafında geliştirilmiş projeler.', en: 'Projects built around real users and real environments.' })}</h1>
          <p>{t({
            tr: 'Bu projeler sektör ve ölçek olarak farklı olsa da aynı yaklaşımı paylaşır: iş akışını anlayın, insanları anlayın, sonra ürünü tasarlayın.',
            en: 'These projects are different in industry and scale, but they share the same approach: understand the workflow, understand the people, then design the product.',
          })}</p>
        </div></section>

        <section className="nextted-container">
          <article id="koza" className="nextted-case">
            <div className="nextted-case-meta"><span>01 · Koza Halı</span><span>{t({ tr: 'Ürün Tasarımı / UX/UI', en: 'Product Design / UX/UI' })}</span></div>
            <h2>{t({ tr: 'Gerçek iş akışı etrafında tasarlanmış bir B2B deneyimi.', en: 'A B2B experience built around the actual workflow.' })}</h2>
            <p className="nextted-case-intro">{t({
              tr: 'Calvin Klein üreticisi ve distribütörü Koza Halı için mesele yalnızca daha güzel bir arayüz tasarlamak değildi. B2B operasyonunun nasıl yürüdüğünü analiz ettik ve bu anlayışla uygulamayı daha kolay kullanılabilir hale getirdik.',
              en: 'For Koza Halı, a manufacturer and distributor for Calvin Klein, the challenge was not simply making a nicer interface. We mapped how the B2B operation worked and used that understanding to make the application easier to use.',
            })}</p>
            <div className="nextted-case-grid">
              <div className="nextted-case-block"><h3>{t({ tr: 'İş akışı analizi', en: 'Workflow mapping' })}</h3><p>{t({
                tr: 'Kullanıcıların ne yapması gerektiğini, adımlar arasında nasıl ilerlediklerini ve dijital deneyimin nerelerde sürtünme yarattığını anlamak için mevcut süreci analiz ettik.',
                en: 'We mapped the existing process to understand what users needed to do, where they moved between steps and where the digital experience created friction.',
              })}</p></div>
              <div className="nextted-case-block"><h3>{t({ tr: 'Kullanıcı deneyimi', en: 'User experience' })}</h3><p>{t({
                tr: 'Uygulamanın yapısını, kullanıcıları arayüze uyum sağlamaya zorlamak yerine insanların gerçekte çalışma biçimine göre yeniden tasarladık.',
                en: 'The application structure was redesigned around the way people actually work instead of forcing users to adapt to the interface.',
              })}</p></div>
              <div className="nextted-case-block"><h3>{t({ tr: 'Sonuç', en: 'Outcome' })}</h3><p>{t({
                tr: 'Nextted olarak B2B uygulamasının UX ve UI tasarımını hazırladık. Ürün şu anda aktif olarak kullanılıyor.',
                en: 'Nextted prepared the UX and UI for the B2B application. The product is currently live.',
              })}</p></div>
            </div>
          </article>

          <article id="enyakit" className="nextted-case">
            <div className="nextted-case-meta"><span>02 · En Yakıt</span><span>{t({ tr: 'UX Araştırması / UX/UI', en: 'UX Research / UX/UI' })}</span></div>
            <h2>{t({ tr: 'Elektrikli araç şarj yolculuğunu sahadan başlayarak tasarlamak.', en: 'Designing the EV charging journey from the field.' })}</h2>
            <p className="nextted-case-intro">{t({
              tr: 'En Yakıt için yalnızca uygulama ekranlarına değil, uçtan uca şarj deneyimine baktık. Kullanıcı yolculuğu, şarj akışı ve şirketin THY iş birliği etrafındaki deneyim dahil olmak üzere sürecin tamamını ele aldık.',
              en: "For En Yakıt, we looked at the complete charging experience rather than only the screens inside the app. This included the user journey, the charging flow and the experience around the company's collaboration with THY.",
            })}</p>
            <div className="nextted-case-grid">
              <div className="nextted-case-block"><h3>{t({ tr: 'Uygulama haritalama', en: 'App mapping' })}</h3><p>{t({
                tr: "Uygulamanın nasıl çalıştığını ve farklı kullanıcı yolculuklarının nasıl bağlandığını, THY iş birliğinin getirdiği ek bağlamı da dikkate alarak haritaladık.",
                en: 'We mapped how the application works and how different journeys connect, including the additional context created by the THY partnership.',
              })}</p></div>
              <div className="nextted-case-block"><h3>{t({ tr: 'Saha araştırması', en: 'Field research' })}</h3><p>{t({
                tr: 'Elektrikli araç şarj istasyonlarını kullanan insanların gerçekte ne yaşadığını ve dijital deneyimin nerelerde iyileştirilebileceğini anlamak için sahaya çıktık.',
                en: 'We went into the field to understand what users actually faced while using EV chargers and where the digital experience could be improved.',
              })}</p></div>
              <div className="nextted-case-block"><h3>{t({ tr: 'Sonuç', en: 'Outcome' })}</h3><p>{t({
                tr: 'Bulguları UX ve UI tasarımına dönüştürdük. Uygulamanın geliştirme süreci tamamlanmak üzere.',
                en: 'We translated the findings into the UX and UI design. App development is now approaching completion.',
              })}</p></div>
            </div>
          </article>

          <article id="lightsync" className="nextted-case">
            <div className="nextted-case-meta"><span>03 · LightSync</span><span>{t({ tr: 'Spor Teknolojisi / Ürün', en: 'Sports Technology / Product' })}</span></div>
            <h2>{t({ tr: 'Taraftarı oyunun bir parçası haline getirmek.', en: 'Making the audience part of the game.' })}</h2>
            <p className="nextted-case-intro">{t({
              tr: 'LightSync, profesyonel spor etkinliklerinin içinde geçirdiğimiz yıllardan doğdu. Maçı prodüksiyon tarafından gördükten sonra taraftarların yalnızca izlemekle kalmayıp nasıl aktif şekilde katılabileceğini değiştirecek bir ürün geliştirmek istedik.',
              en: 'LightSync came from years of working inside professional sports events. After seeing the game from the production side, we wanted to build a product that could change how fans participate — not just watch.',
            })}</p>
            <div className="nextted-case-grid">
              <div className="nextted-case-block"><h3>{t({ tr: 'Nereden doğdu?', en: 'Where it came from' })}</h3><p>{t({
                tr: 'Ekibimiz basketbol ve voleybol takımlarıyla çalıştı ve bu çalışmalar bugün de devam ediyor.',
                en: 'Our team has worked with basketball and volleyball teams, and that work continues today.',
              })}</p></div>
              <div className="nextted-case-block"><h3>{t({ tr: 'Işıktan daha fazlası', en: 'More than lights' })}</h3><p>{t({
                tr: 'Senkronize telefon ışığı bunun yalnızca bir parçası. Anketler, sorular ve canlı etkileşimler kalabalığı deneyimin aktif bir parçası haline getirmenin merkezinde.',
                en: 'The synchronized phone light is only one part. Polls, questions and live interactions are central to making the crowd an active part of the experience.',
              })}</p></div>
              <div className="nextted-case-block"><h3>{t({ tr: 'Hedef', en: 'The ambition' })}</h3><p>{t({
                tr: 'Türkiye\'de başlamak, gerçek salonlarda deneyimi kanıtlamak ve spor taraftar etkileşimi için yeni bir standart oluşturmak.',
                en: 'Start in Türkiye, prove the experience in real venues and build toward a new standard for sports audience engagement.',
              })}</p></div>
            </div>
            <div className="nextted-actions">
              <Link to="/admin" className="nextted-btn nextted-btn-primary">{t({ tr: "LightSync'i Aç", en: 'Open LightSync' })}</Link>
            </div>
          </article>
        </section>
      </main>
      <footer className="nextted-footer"><div className="nextted-container nextted-footer-inner">
        <span>© {new Date().getFullYear()} Nextted</span>
        <span>Technology. Education. Design.</span>
      </div></footer>
    </div>
  );
}
