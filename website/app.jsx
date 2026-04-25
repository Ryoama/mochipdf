// App entry — composes the page and exposes Tweaks
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "language": "ja",
  "showMarquee": true,
  "accentHue": "#FF8800"
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const lang = tweaks.language;
  const setLang = (l) => setTweak('language', l);
  const t = window.I18N[lang] || window.I18N.ja;

  useEffect(() => {
    document.documentElement.style.setProperty('--y-accent', tweaks.accentHue);
  }, [tweaks.accentHue]);

  return (
    <>
      <Header t={t} lang={lang} setLang={setLang} />
      <Hero t={t} variant={1} />
      {tweaks.showMarquee && <Marquee t={t} />}
      <LivePreview t={t} />
      <Features t={t} />
      <Specs t={t} />
      <Download t={t} />
      <Guide t={t} />
      <FAQ t={t} />
      <Footer t={t} />

      <TweaksPanel title="Tweaks">
        <TweakSection title="言語">
          <TweakRadio
            label="表示言語"
            value={tweaks.language}
            onChange={(v)=>setTweak('language', v)}
            options={[
              { value: 'ja', label: '日本語' },
              { value: 'en', label: 'English' },
            ]}
          />
        </TweakSection>
        <TweakSection title="表示">
          <TweakToggle label="マーキー帯" value={tweaks.showMarquee} onChange={(v)=>setTweak('showMarquee', v)} />
          <TweakColor label="アクセントカラー" value={tweaks.accentHue} onChange={(v)=>setTweak('accentHue', v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
