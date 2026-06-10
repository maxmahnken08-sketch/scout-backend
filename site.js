// Scout marketing landing page — served at GET /. Brand: dark + coral.
// Uses the app's real screenshots from /assets/.

export const landingHTML = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Scout — Your perfect trip, scouted.</title>
<meta name="description" content="Scout is an AI travel planner. Describe your trip and get real flights, hotels, and ideas in seconds — within your budget."/>
<meta property="og:title" content="Scout — Your perfect trip, scouted."/>
<meta property="og:description" content="Plan any trip in seconds with AI. Real flights, hotels & ideas."/>
<style>
  :root{--bg:#0E0F13;--card:#16181F;--line:#262A33;--text:#F5F5F7;--muted:#9BA0AB;--coral:#FF6B4A;--peach:#FF9466;}
  *{box-sizing:border-box;} html{scroll-behavior:smooth;}
  body{margin:0;background:var(--bg);color:var(--text);font:17px/1.6 -apple-system,system-ui,Segoe UI,Roboto,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;}
  .wrap{max-width:1040px;margin:0 auto;padding:0 22px;}
  a{color:var(--coral);text-decoration:none;}
  /* nav */
  nav{display:flex;align-items:center;justify-content:space-between;padding:22px 0;}
  .brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:20px;}
  .mark{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,var(--coral),var(--peach));display:inline-block;}
  .btn{display:inline-block;background:linear-gradient(135deg,var(--coral),var(--peach));color:#fff;font-weight:700;
       padding:13px 22px;border-radius:14px;border:0;cursor:pointer;font-size:16px;}
  .btn.ghost{background:transparent;border:1px solid var(--line);color:var(--text);}
  /* hero */
  .hero{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:center;padding:50px 0 30px;}
  .hero h1{font-size:54px;line-height:1.05;margin:0 0 16px;letter-spacing:-1px;}
  .hero h1 .g{background:linear-gradient(135deg,var(--coral),var(--peach));-webkit-background-clip:text;background-clip:text;color:transparent;}
  .hero p{font-size:20px;color:var(--muted);margin:0 0 26px;max-width:520px;}
  .cta-row{display:flex;gap:12px;flex-wrap:wrap;align-items:center;}
  .soon{color:var(--muted);font-size:14px;}
  .phone{justify-self:center;width:280px;border-radius:42px;border:1px solid var(--line);box-shadow:0 30px 80px rgba(255,107,74,.18);}
  /* glow */
  .glow{position:absolute;top:-120px;left:50%;transform:translateX(-50%);width:700px;height:400px;
        background:radial-gradient(closest-side,rgba(255,107,74,.18),transparent);filter:blur(10px);z-index:-1;}
  /* sections */
  section{padding:54px 0;border-top:1px solid var(--line);}
  h2{font-size:32px;letter-spacing:-.5px;margin:0 0 8px;text-align:center;}
  .sub{color:var(--muted);text-align:center;margin:0 auto 36px;max-width:560px;}
  .feats{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
  .feat{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:22px;}
  .feat .ic{font-size:24px;}
  .feat h3{margin:10px 0 6px;font-size:18px;}
  .feat p{margin:0;color:var(--muted);font-size:15px;}
  .shots{display:flex;gap:22px;justify-content:center;flex-wrap:wrap;}
  .shots img{width:240px;border-radius:34px;border:1px solid var(--line);}
  .center{text-align:center;}
  footer{border-top:1px solid var(--line);padding:30px 0 60px;color:var(--muted);font-size:14px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;}
  footer a{color:var(--muted);margin-left:18px;}
  @media(max-width:780px){.hero{grid-template-columns:1fr;text-align:center;}.hero h1{font-size:40px;}.hero p{margin-inline:auto;}
    .cta-row{justify-content:center;}.feats{grid-template-columns:1fr;}.phone{width:240px;}}
</style></head><body>
<div class="glow"></div>
<div class="wrap">
  <nav>
    <div class="brand"><span class="mark"></span>Scout</div>
    <a class="btn ghost" href="#download">Get the app</a>
  </nav>

  <header class="hero">
    <div>
      <h1>Your perfect trip,<br/><span class="g">scouted.</span></h1>
      <p>Scout is your AI travel planner. Just describe the trip — Scout compares real flights, hotels, and ideas and builds a plan in seconds, all within your budget.</p>
      <div class="cta-row">
        <a class="btn" href="#download">Download on the App Store</a>
        <span class="soon">Coming soon to iPhone</span>
      </div>
    </div>
    <img class="phone" src="/assets/screen-detail.png" alt="Scout trip plan on iPhone"/>
  </header>

  <section>
    <h2>Plan less. Travel more.</h2>
    <p class="sub">Like texting a friend who happens to know everything about travel.</p>
    <div class="feats">
      <div class="feat"><div class="ic">💬</div><h3>Just ask</h3><p>“5 days in Lisbon under $1,500.” Scout handles the rest — flights, stays, day-by-day.</p></div>
      <div class="feat"><div class="ic">✈️</div><h3>Real options</h3><p>Live flight prices across airlines and real hotels from the big chains, ranked to your budget.</p></div>
      <div class="feat"><div class="ic">📸</div><h3>Snap a place</h3><p>Send a photo and Scout figures out where it is — or finds you somewhere with the same vibe.</p></div>
      <div class="feat"><div class="ic">💡</div><h3>Smart timing</h3><p>Gentle tips when shifting your dates a day or two saves you real money.</p></div>
      <div class="feat"><div class="ic">🏨</div><h3>Book it</h3><p>Reserve hotels right inside the app, and book flights with a tap.</p></div>
      <div class="feat"><div class="ic">🌙</div><h3>Yours</h3><p>Light or dark, your home airport and language, saved trips and notes — all on your device.</p></div>
    </div>
  </section>

  <section>
    <h2>See it in action</h2>
    <p class="sub">Real itineraries, real prices, beautifully laid out.</p>
    <div class="shots">
      <img src="/assets/screen-trip.png" alt="Scout experiences and dining"/>
      <img src="/assets/screen-detail.png" alt="Scout day-by-day itinerary"/>
      <img src="/assets/screen-light.png" alt="Scout in light mode"/>
    </div>
  </section>

  <section id="download" class="center">
    <h2>Start scouting</h2>
    <p class="sub">Free to use. Plan your next trip in seconds.</p>
    <a class="btn" href="#">Download on the App Store</a>
    <p class="soon" style="margin-top:14px;">Launching soon — built for iPhone.</p>
  </section>

  <footer>
    <div>© 2026 Scout</div>
    <div>
      <a href="/legal/privacy">Privacy</a>
      <a href="/legal/terms">Terms</a>
      <a href="/legal/support">Support</a>
    </div>
  </footer>
</div>
</body></html>`;
