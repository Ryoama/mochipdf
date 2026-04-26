// Components for もちPDF site
const { useState, useEffect, useRef } = React;

// Stable, version-free download URLs. The CI ships these exact filenames every
// release, so /releases/latest/download/<file> 302-redirects to the real asset
// and the browser starts the download immediately.
const DL_BASE = "https://github.com/Ryoama/mochipdf/releases/latest/download";
const LINKS = {
  repo: "https://github.com/Ryoama/mochipdf",
  releasesLatest: "https://github.com/Ryoama/mochipdf/releases/latest",
  releases: "https://github.com/Ryoama/mochipdf/releases",
  issues: "https://github.com/Ryoama/mochipdf/issues",
  sourceZip: "https://github.com/Ryoama/mochipdf/archive/refs/heads/main.zip",
  winPortable: `${DL_BASE}/MochiPDF-windows-portable.zip`,
  macApp: `${DL_BASE}/MochiPDF-mac.dmg`,
};

function detectOS() {
  if (typeof navigator === "undefined") return "other";
  const ua = (navigator.userAgent || "").toLowerCase();
  if (/win/.test(ua)) return "windows";
  if (/mac|iphone|ipad|ipod/.test(ua)) return "mac";
  if (/linux/.test(ua)) return "linux";
  return "other";
}

// Hero CTA target: if we can guess the OS, deep-link straight to its asset;
// otherwise default to the Windows portable since that's the primary build.
function pickHeroDownloadHref() {
  const os = detectOS();
  if (os === "mac") return LINKS.macApp;
  return LINKS.winPortable;
}

function Header({ t, lang, setLang }) {
  return (
    <header className="site-header">
      <div className="container row">
        <a className="brand" href="#top">
          <img src="assets/icon-only.png" alt="もちPDF" />
          <span>もちPDF</span>
        </a>
        <nav className="nav">
          <a href="#features">{t.nav.features}</a>
          <a href="#specs">{t.nav.specs}</a>
          <a href="#download">{t.nav.download}</a>
          <a href="#guide">{t.nav.guide}</a>
          <a href="#faq">{t.nav.faq}</a>
        </nav>
        <div className="header-cta">
          <div className="lang-switch" role="tablist">
            <button className={lang==='ja'?'on':''} onClick={()=>setLang('ja')}>日本語</button>
            <button className={lang==='en'?'on':''} onClick={()=>setLang('en')}>EN</button>
          </div>
        </div>
      </div>
    </header>
  );
}

// HERO Variant 1 — Split with mascot + chips
function HeroV1({ t }) {
  return (
    <section className="hero" id="top">
      <div className="container hero-inner">
        <div>
          <span className="hero-eyebrow">
            <span className="dot">{t.hero.eyebrow_a}</span>
            {t.hero.eyebrow_text}
          </span>
          <h1>
            <span className="y">{t.hero.title_a}</span>
            <br/>
            {t.hero.title_b} <span className="stamp">{t.hero.title_c}</span>
          </h1>
          <p className="lede">{t.hero.lede}</p>
          <div className="cta">
            <a className="btn btn-primary" href={pickHeroDownloadHref()}>
              <Ic.Download size={16}/> {t.hero.cta_primary}
            </a>
            <a className="btn btn-secondary" href="#features">{t.hero.cta_secondary} <Ic.ArrowRight/></a>
          </div>
          <div className="meta">
            {t.hero.meta.map((m,i)=>(
              <span key={i}><span className="ck"><Ic.Check size={13}/></span> {m}</span>
            ))}
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-blob"></div>
          <div className="hero-mascot">
            <img src="assets/mascot-cutout.png" alt="もちキャラ" />
          </div>
          <div className="chip c1"><span className="ic"><Ic.Drop size={16}/></span> {t.hero.chip4}</div>
          <div className="chip c2"><span className="ic"><Ic.Eye size={16}/></span> {t.hero.chip3}</div>
          <div className="chip c3"><span className="ic"><Ic.Merge size={16}/></span> {t.hero.chip1}</div>
          <div className="chip c4"><span className="ic"><Ic.Split size={16}/></span> {t.hero.chip2}</div>
        </div>
      </div>
    </section>
  );
}

// HERO Variant 2 — Mascot + app-mock screenshot
function HeroV2({ t }) {
  return (
    <section className="hero hero-v2" id="top">
      <div className="container hero-inner">
        <div>
          <span className="hero-eyebrow">
            <span className="dot">{t.hero.eyebrow_a}</span>
            {t.hero.eyebrow_text}
          </span>
          <h1>
            <span className="y">{t.hero.title_a}</span>{' '}
            {t.hero.title_b}<br/>
            <span className="stamp">{t.hero.title_c}</span>
          </h1>
          <p className="lede">{t.hero.lede}</p>
          <div className="cta">
            <a className="btn btn-primary" href="#download"><Ic.Download size={16}/> {t.hero.cta_primary}</a>
            <a className="btn btn-secondary" href="#features">{t.hero.cta_secondary} <Ic.ArrowRight/></a>
          </div>
          <div className="meta">
            {t.hero.meta.map((m,i)=>(
              <span key={i}><span className="ck"><Ic.Check size={13}/></span> {m}</span>
            ))}
          </div>
        </div>
        <div className="hero-art" style={{position:'relative'}}>
          <div className="hero-blob"></div>
          <div className="hero-mascot" style={{width:'min(360px,80%)'}}>
            <img src="assets/mascot-cutout.png" alt="もちキャラ" />
          </div>
          <div className="feature-stack">
            <div className="row"><span className="ck"><Ic.Check size={16}/></span> {t.hero.chip4}</div>
            <div className="row"><span className="ck"><Ic.Check size={16}/></span> {t.hero.chip1}</div>
            <div className="row"><span className="ck"><Ic.Check size={16}/></span> {t.hero.chip2}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// HERO Variant 3 — Centered minimal
function HeroV3({ t }) {
  return (
    <section className="hero hero-v3" id="top">
      <div className="container hero-inner">
        <div>
          <span className="hero-eyebrow" style={{margin:'0 auto'}}>
            <span className="dot">{t.hero.eyebrow_a}</span>
            {t.hero.eyebrow_text}
          </span>
          <h1>{t.hero_v3_title}</h1>
          <p className="lede">{t.hero.lede}</p>
          <div className="cta">
            <a className="btn btn-primary" href="#download"><Ic.Download size={16}/> {t.hero.cta_primary}</a>
            <a className="btn btn-secondary" href="#features">{t.hero.cta_secondary} <Ic.ArrowRight/></a>
          </div>
          <div className="meta">
            {t.hero.meta.map((m,i)=>(
              <span key={i}><span className="ck"><Ic.Check size={13}/></span> {m}</span>
            ))}
          </div>
          <div className="hero-art">
            <div className="hero-blob"></div>
            <div className="hero-mascot">
              <img src="assets/mascot-cutout.png" alt="もちキャラ" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Hero({ t, variant }) {
  if (variant === 2) return <HeroV2 t={t} />;
  if (variant === 3) return <HeroV3 t={t} />;
  return <HeroV1 t={t} />;
}

function Marquee({ t }) {
  const items = [...t.marquee, ...t.marquee, ...t.marquee, ...t.marquee];
  return (
    <div className="marquee">
      <div className="track">
        {items.map((m, i) => (
          <span key={i}>{m} <span className="sep">●</span></span>
        ))}
      </div>
    </div>
  );
}

function Features({ t }) {
  const icons = [Ic.Eye, Ic.Merge, Ic.Split, Ic.Extract, Ic.Rotate, Ic.Lock];
  return (
    <section className="section" id="features">
      <div className="container">
        <span className="eyebrow"><span className="num">1</span>{t.features.eyebrow}</span>
        <h2 className="section-title">{t.features.title}<span className="accent">{t.features.title_accent}</span></h2>
        <p className="section-sub">{t.features.sub}</p>
        <div className="features-grid">
          <div className="feature-card big">
            <div className="copy">
              <span className="tag">{t.features.big.tag}</span>
              <h3 style={{fontSize:'28px',marginTop:'10px'}}>{t.features.big.t}</h3>
              <p style={{marginTop:'10px'}}>{t.features.big.d}</p>
            </div>
            <div className="visual">
              <img src="assets/mascot-cutout.png" alt="" />
            </div>
          </div>
          <div className="feature-card">
            {(()=>{const I=icons[0];return <div className="ic"><I size={26}/></div>;})()}
            <span className="tag">{t.features.cards[0].tag}</span>
            <h3>{t.features.cards[0].t}</h3>
            <p>{t.features.cards[0].d}</p>
          </div>
          {t.features.cards.slice(1).map((c, i) => {
            const I = icons[i+1];
            return (
              <div className="feature-card" key={i}>
                <div className="ic"><I size={26}/></div>
                <span className="tag">{c.tag}</span>
                <h3>{c.t}</h3>
                <p>{c.d}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Specs({ t }) {
  return (
    <section className="section" id="specs" style={{background:'linear-gradient(180deg,transparent,#FFF1D1 50%, transparent)'}}>
      <div className="container">
        <span className="eyebrow"><span className="num">2</span>{t.specs.eyebrow}</span>
        <h2 className="section-title">{t.specs.title}</h2>
        <p className="section-sub">{t.specs.sub}</p>
        <div className="specs">
          {[t.specs.win, t.specs.mac].map((s, i) => {
            const dlHref = i === 0 ? LINKS.winPortable : LINKS.macApp;
            return (
              <div className="spec-card" key={i}>
                <div className="head">
                  <div className="os-icon">{i===0 ? <Ic.Window/> : <Ic.Apple/>}</div>
                  <div>
                    <h3>{s.os}</h3>
                    <div className="ver">{s.ver}</div>
                  </div>
                </div>
                <dl className="spec-list">
                  <div className="row"><dt>{t.specs.label.cpu}</dt><dd>{s.cpu}</dd></div>
                  <div className="row"><dt>{t.specs.label.ram}</dt><dd>{s.ram}</dd></div>
                  <div className="row"><dt>{t.specs.label.disk}</dt><dd>{s.disk}</dd></div>
                  <div className="row"><dt>{t.specs.label.net}</dt><dd>{s.net}</dd></div>
                </dl>
                <div className="dl">
                  <a className="btn btn-primary" href={dlHref} style={{padding:'10px 16px',fontSize:'13px'}}><Ic.Download size={14}/> {t.specs.download}</a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Download({ t }) {
  const icons = [Ic.Window, Ic.Apple, Ic.Folder];
  const hrefs = [LINKS.winPortable, LINKS.macApp, LINKS.sourceZip];
  return (
    <section className="section" id="download">
      <div className="container">
        <span className="eyebrow"><span className="num">3</span>{t.download.eyebrow}</span>
        <h2 className="section-title">{t.download.title}<span className="accent">{t.download.title_accent}</span></h2>
        <p className="section-sub">{t.download.sub}</p>
        <div className="download-hero">
          <div>
            <h3>{t.download.headline}</h3>
            <p>{t.download.desc}</p>
            <div className="checksum">{t.download.checksum}</div>
          </div>
          <div className="options">
            {t.download.rows.map((r, i) => {
              const I = icons[i] || Ic.Folder;
              return (
                <a className="dl-row" key={i} href={hrefs[i]}>
                  <div className="left">
                    <div className="os"><I size={18}/></div>
                    <div>
                      <div className="name">{r.os}</div>
                      <div className="file">{r.file} ・ {r.size}</div>
                    </div>
                  </div>
                  <span className="btn btn-primary"><Ic.Download size={14}/> {t.download.btn}</span>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function AppMockup({ tabIdx }) {
  // a small demo that updates with tab
  const variants = [
    { tools: ['開く','閲覧','検索'], pages: 8, sel: [] },
    { tools: ['結合','並替','保存'], pages: 6, sel: [0,1,2,3,4,5] },
    { tools: ['分割','範囲','保存'], pages: 6, sel: [0,1,2] },
    { tools: ['抽出','選択','保存'], pages: 8, sel: [1,3,5] },
    { tools: ['回転','削除','保存'], pages: 6, sel: [2] },
  ];
  const v = variants[tabIdx] || variants[0];
  return (
    <div className="app-mock">
      <div className="titlebar">
        <div className="dots"><span className="dot"/><span className="dot"/><span className="dot"/></div>
        <div className="name">もちPDF — sample.pdf</div>
      </div>
      <div className="body">
        <div className="toolbar">
          {v.tools.map((b, i) => (
            <div key={i} className={'b ' + (i===0?'active':'')}>{b}</div>
          ))}
        </div>
        <div className="canvas">
          {Array.from({length:v.pages}).map((_, i) => (
            <div key={i} className={'page ' + (v.sel.includes(i)?'sel':'')}/>
          ))}
        </div>
      </div>
    </div>
  );
}

function Guide({ t }) {
  const [tab, setTab] = useState(0);
  const cur = t.guide.tabs[tab];
  return (
    <section className="section" id="guide">
      <div className="container">
        <span className="eyebrow"><span className="num">4</span>{t.guide.eyebrow}</span>
        <h2 className="section-title">{t.guide.title}</h2>
        <p className="section-sub">{t.guide.sub}</p>
        <div className="guide-tabs">
          <div className="tab-list">
            {t.guide.tabs.map((g, i) => (
              <button key={i} className={tab===i?'on':''} onClick={()=>setTab(i)}>
                <span className="num">{i+1}</span>{g.name}
              </button>
            ))}
          </div>
          <div className="tab-panel">
            <div>
              <h3>{cur.h}</h3>
              <p>{cur.d}</p>
              <ol>
                {cur.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
            <div className="demo-stage">
              <AppMockup tabIdx={tab}/>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Reviews({ t }) {
  return (
    <section className="section">
      <div className="container">
        <span className="eyebrow"><span className="num">6</span>{t.reviews.eyebrow}</span>
        <h2 className="section-title">{t.reviews.title}</h2>
        <p className="section-sub">{t.reviews.sub}</p>
        <div className="review-grid">
          {t.reviews.items.map((r, i) => (
            <div className="review" key={i}>
              <div className="stars">{r.stars}</div>
              <p className="quote">「{r.q}」</p>
              <div className="who">
                <div className="av">{r.av}</div>
                <div>
                  <div className="name">{r.name}</div>
                  <div className="role">{r.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ({ t }) {
  return (
    <section className="section" id="faq">
      <div className="container">
        <div style={{textAlign:'center'}}>
          <span className="eyebrow"><span className="num">5</span>{t.faq.eyebrow}</span>
          <h2 className="section-title">{t.faq.title}</h2>
          <p className="section-sub" style={{margin:'12px auto 0'}}>{t.faq.sub}</p>
        </div>
        <div className="faq-list">
          {t.faq.items.map((f, i) => (
            <details className="faq-item" key={i} open={i===0}>
              <summary>
                <span className="q"><span className="qmark">Q</span>{f.q}</span>
                <span className="chev"><Ic.Chevron/></span>
              </summary>
              <div className="a">{f.a}</div>
            </details>
          ))}
        </div>
        <div className="donate">
          <img src="assets/mascot-cutout.png" alt="" />
          <div>
            <h3>{t.donate.title}</h3>
            <p>{t.donate.d}</p>
            <div className="actions">
              <a className="btn btn-primary" href={LINKS.repo} target="_blank" rel="noopener"><Ic.Heart size={14}/> {t.donate.btn1}</a>
              <a className="btn btn-secondary" href={LINKS.repo} target="_blank" rel="noopener"><Ic.Github size={14}/> {t.donate.btn2}</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({ t }) {
  const productHrefs = ["#features", "#download", "#guide", LINKS.releases, LINKS.issues];
  const communityHrefs = [LINKS.repo, LINKS.issues, LINKS.repo, LINKS.repo, LINKS.repo];
  const aboutHrefs = [LINKS.repo, LINKS.repo, LINKS.repo, LINKS.repo, LINKS.issues];
  const ext = (h) => h.startsWith("http");
  const link = (h, label, i) => (
    <li key={i}><a href={h} {...(ext(h) ? { target: "_blank", rel: "noopener" } : {})}>{label}</a></li>
  );
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="grid">
          <div>
            <div className="brand" style={{display:'flex',alignItems:'center',gap:'10px'}}>
              <img src="assets/icon-only.png" alt="" style={{width:32,height:32}} />
              <span>もちPDF</span>
            </div>
            <p className="desc">{t.footer.desc}</p>
          </div>
          <div>
            <h4>{t.footer.product}</h4>
            <ul>{t.footer.product_links.map((l,i)=>link(productHrefs[i] || "#", l, i))}</ul>
          </div>
          <div>
            <h4>{t.footer.community}</h4>
            <ul>{t.footer.community_links.map((l,i)=>link(communityHrefs[i] || LINKS.repo, l, i))}</ul>
          </div>
          <div>
            <h4>{t.footer.about}</h4>
            <ul>{t.footer.about_links.map((l,i)=>link(aboutHrefs[i] || LINKS.repo, l, i))}</ul>
          </div>
        </div>
        <div className="legal">
          <span>{t.footer.legal}</span>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { Header, Hero, Marquee, Features, Specs, Download, Guide, Reviews, FAQ, Footer });
