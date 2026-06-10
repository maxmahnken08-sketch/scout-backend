// Scout marketing landing page — served at GET /. Premium, animated, self-contained.
// Brand: deep charcoal + sunset coral, aurora glows, glassmorphism. Real screenshots from /assets/.

export const landingHTML = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Scout — Your perfect trip, scouted.</title>
<meta name="description" content="Scout is your AI travel planner. Describe your trip and get real flights, hotels, and ideas in seconds — within your budget."/>
<meta property="og:title" content="Scout — Your perfect trip, scouted."/>
<meta property="og:description" content="Plan any trip in seconds with AI. Real flights, hotels & ideas."/>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#0A0B0E; --bg2:#101218; --card:rgba(255,255,255,.04); --line:rgba(255,255,255,.09);
    --text:#F4F5F7; --muted:#9AA0AB; --coral:#FF6B4A; --peach:#FF9466; --violet:#8B5CF6; --cyan:#36D1DC;
    --radius:20px;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  html{scroll-behavior:smooth;}
  body{background:var(--bg);color:var(--text);font:16px/1.65 Inter,-apple-system,system-ui,sans-serif;
    -webkit-font-smoothing:antialiased;overflow-x:hidden;}
  h1,h2,h3,.display{font-family:'Space Grotesk',Inter,sans-serif;letter-spacing:-.02em;}
  a{color:inherit;text-decoration:none;}
  .wrap{max-width:1120px;margin:0 auto;padding:0 24px;}
  .g{background:linear-gradient(110deg,var(--coral),var(--peach) 55%,#FFB37A);-webkit-background-clip:text;background-clip:text;color:transparent;}

  /* aurora background */
  .aurora{position:fixed;inset:0;z-index:-2;overflow:hidden;}
  .aurora span{position:absolute;border-radius:50%;filter:blur(90px);opacity:.5;animation:float 18s ease-in-out infinite;}
  .a1{width:560px;height:560px;background:radial-gradient(circle,#FF6B4A,transparent 70%);top:-160px;left:-120px;}
  .a2{width:520px;height:520px;background:radial-gradient(circle,#8B5CF6,transparent 70%);top:-80px;right:-140px;animation-delay:-6s;}
  .a3{width:480px;height:480px;background:radial-gradient(circle,#36D1DC,transparent 70%);top:520px;left:30%;opacity:.28;animation-delay:-11s;}
  @keyframes float{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(40px,30px) scale(1.08);}}
  .grain{position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.04;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");}

  /* nav */
  nav{position:sticky;top:0;z-index:50;backdrop-filter:blur(14px);background:rgba(10,11,14,.55);border-bottom:1px solid var(--line);}
  nav .inner{display:flex;align-items:center;justify-content:space-between;padding:16px 0;}
  .brand{display:flex;align-items:center;gap:11px;font-weight:700;font-size:20px;font-family:'Space Grotesk';}
  .mark{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,var(--coral),var(--peach));
    box-shadow:0 6px 22px rgba(255,107,74,.5);display:grid;place-items:center;color:#fff;font-size:17px;}
  .navlinks{display:flex;gap:26px;align-items:center;color:var(--muted);font-weight:500;font-size:15px;}
  .navlinks a:hover{color:var(--text);}
  .btn{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,var(--coral),var(--peach));
    color:#fff;font-weight:600;padding:12px 20px;border-radius:13px;border:0;cursor:pointer;font-size:15px;
    box-shadow:0 8px 26px rgba(255,107,74,.34);transition:transform .15s,box-shadow .15s;}
  .btn:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(255,107,74,.45);}
  .btn.ghost{background:rgba(255,255,255,.05);border:1px solid var(--line);box-shadow:none;color:var(--text);}

  /* hero */
  .hero{padding:70px 0 40px;display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center;}
  .pill{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:#FFD7C8;
    background:rgba(255,107,74,.12);border:1px solid rgba(255,107,74,.3);padding:7px 13px;border-radius:999px;margin-bottom:22px;}
  .pill .dot{width:7px;height:7px;border-radius:50%;background:var(--coral);box-shadow:0 0 0 4px rgba(255,107,74,.25);}
  .hero h1{font-size:clamp(42px,6vw,68px);line-height:1.02;font-weight:700;margin-bottom:20px;}
  .hero .lead{font-size:20px;color:var(--muted);max-width:520px;margin-bottom:30px;}
  .cta-row{display:flex;gap:14px;flex-wrap:wrap;align-items:center;}
  .trust{display:flex;gap:22px;margin-top:30px;color:var(--muted);font-size:14px;flex-wrap:wrap;}
  .trust b{color:var(--text);font-family:'Space Grotesk';font-size:18px;display:block;}

  /* hero chat demo */
  .demo{background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px solid var(--line);
    border-radius:26px;padding:18px;box-shadow:0 40px 90px rgba(0,0,0,.5);backdrop-filter:blur(6px);}
  .demo .bar{display:flex;align-items:center;gap:7px;padding:4px 6px 14px;}
  .demo .bar i{width:11px;height:11px;border-radius:50%;background:#3a3d46;}
  .bubble{max-width:80%;padding:12px 15px;border-radius:16px;font-size:15px;margin:8px 0;opacity:0;transform:translateY(8px);}
  .bubble.show{opacity:1;transform:none;transition:.5s;}
  .u{margin-left:auto;background:#2b2e36;border-bottom-right-radius:5px;}
  .s{background:rgba(255,107,74,.13);border:1px solid rgba(255,107,74,.22);border-bottom-left-radius:5px;}
  .typing{display:inline-flex;gap:4px;padding:12px 15px;}
  .typing i{width:7px;height:7px;border-radius:50%;background:var(--muted);animation:blink 1.2s infinite;}
  .typing i:nth-child(2){animation-delay:.2s;}.typing i:nth-child(3){animation-delay:.4s;}
  @keyframes blink{0%,60%,100%{opacity:.3;}30%{opacity:1;}}
  .tripcard{margin-top:8px;border-radius:16px;overflow:hidden;border:1px solid var(--line);opacity:0;transform:translateY(10px);}
  .tripcard.show{opacity:1;transform:none;transition:.6s;}
  .tripcard .ban{height:74px;background:linear-gradient(120deg,#FF6B4A,#8B5CF6);display:flex;align-items:flex-end;padding:12px;font-weight:700;font-family:'Space Grotesk';}
  .tripcard .row{display:flex;justify-content:space-between;padding:10px 13px;font-size:14px;border-top:1px solid var(--line);}
  .tripcard .row span:last-child{color:var(--coral);font-weight:600;}

  /* marquee */
  .marquee{margin:18px 0 0;overflow:hidden;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:16px 0;-webkit-mask:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);}
  .track{display:flex;gap:46px;width:max-content;animation:scroll 26s linear infinite;color:var(--muted);font-weight:600;font-size:15px;white-space:nowrap;}
  .track span{display:flex;gap:46px;}
  @keyframes scroll{to{transform:translateX(-50%);}}

  section{padding:80px 0;}
  .eyebrow{color:var(--coral);font-weight:700;font-size:13px;letter-spacing:.12em;text-transform:uppercase;text-align:center;}
  .h2{font-size:clamp(30px,4vw,44px);text-align:center;margin:10px 0 8px;font-weight:700;}
  .sub{color:var(--muted);text-align:center;max-width:560px;margin:0 auto 50px;font-size:18px;}

  /* bento features */
  .bento{display:grid;grid-template-columns:repeat(6,1fr);gap:18px;}
  .tile{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:26px;
    transition:transform .2s,border-color .2s,background .2s;}
  .tile:hover{transform:translateY(-4px);border-color:rgba(255,107,74,.4);background:rgba(255,107,74,.05);}
  .tile.wide{grid-column:span 4;}.tile.half{grid-column:span 3;}.tile.third{grid-column:span 2;}
  .tile .ic{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:21px;
    background:rgba(255,107,74,.13);border:1px solid rgba(255,107,74,.25);margin-bottom:16px;}
  .tile h3{font-size:20px;margin-bottom:7px;}.tile p{color:var(--muted);font-size:15px;}

  /* showcase — even 3-up grid, each with a caption */
  .stage{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;align-items:start;}
  .screen{display:flex;flex-direction:column;align-items:center;text-align:center;gap:18px;}
  .device{width:100%;max-width:260px;border-radius:40px;border:1px solid var(--line);
    box-shadow:0 36px 80px rgba(0,0,0,.5);transition:transform .25s,box-shadow .25s;}
  .screen:hover .device{transform:translateY(-8px);box-shadow:0 46px 96px rgba(255,107,74,.22);}
  .screen .cap h3{font-size:19px;margin-bottom:5px;}
  .screen .cap p{color:var(--muted);font-size:14.5px;max-width:280px;}

  /* steps */
  .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;}
  .step{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:28px;}
  .step .n{font-family:'Space Grotesk';font-size:15px;font-weight:700;color:var(--coral);}
  .step h3{margin:8px 0 6px;font-size:20px;}.step p{color:var(--muted);font-size:15px;}

  /* cta band */
  .band{position:relative;text-align:center;padding:90px 24px;border-radius:32px;overflow:hidden;
    border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,107,74,.10),rgba(139,92,246,.06));}
  .band::before{content:"";position:absolute;width:600px;height:300px;background:radial-gradient(closest-side,rgba(255,107,74,.4),transparent);left:50%;top:-60px;transform:translateX(-50%);filter:blur(20px);}
  .band h2{font-size:clamp(32px,5vw,52px);position:relative;}
  .band p{color:var(--muted);font-size:19px;margin:12px 0 28px;position:relative;}

  footer{border-top:1px solid var(--line);padding:36px 0 70px;color:var(--muted);font-size:14px;}
  footer .fr{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;}
  footer a{margin-left:20px;}footer a:hover{color:var(--text);}

  .reveal{opacity:0;transform:translateY(26px);transition:.7s cubic-bezier(.2,.7,.2,1);}
  .reveal.in{opacity:1;transform:none;}

  @media(max-width:880px){
    .hero{grid-template-columns:1fr;text-align:center;padding-top:44px;}
    .hero .lead{margin-inline:auto;} .cta-row,.trust{justify-content:center;}
    .navlinks{display:none;}
    .bento{grid-template-columns:1fr;} .tile.wide,.tile.half,.tile.third{grid-column:span 1;}
    .steps{grid-template-columns:1fr;}
    .stage{grid-template-columns:1fr;gap:44px;}
  }
  @media(max-width:880px) and (min-width:601px){.stage{grid-template-columns:repeat(3,1fr);}}
</style></head><body>
<div class="aurora"><span class="a1"></span><span class="a2"></span><span class="a3"></span></div>
<div class="grain"></div>

<nav><div class="wrap inner">
  <div class="brand"><span class="mark">◇</span>Scout</div>
  <div class="navlinks"><a href="#how">How it works</a><a href="#features">Features</a><a href="#peek">Screens</a></div>
  <a class="btn" href="#get">Get the app</a>
</div></nav>

<header class="wrap hero">
  <div>
    <span class="pill"><span class="dot"></span>AI travel planner</span>
    <h1>Your perfect trip,<br><span class="g">scouted.</span></h1>
    <p class="lead">Just say where you want to go. Scout compares real flights, hotels, and ideas — and builds a full plan in seconds, all within your budget.</p>
    <div class="cta-row">
      <a class="btn" href="#get">Download on the App Store →</a>
      <a class="btn ghost" href="#how">See how it works</a>
    </div>
    <div class="trust">
      <div><b>All airlines</b>live flight prices</div>
      <div><b>2M+ hotels</b>incl. major chains</div>
      <div><b>Seconds</b>to a full plan</div>
    </div>
  </div>

  <div class="demo" id="demo">
    <div class="bar"><i></i><i></i><i></i></div>
    <div class="bubble u" data-step="1">5 days in Lisbon under $1,500 🇵🇹</div>
    <div id="typewrap" data-step="2"><div class="typing" id="typing"><i></i><i></i><i></i></div></div>
    <div class="bubble s" data-step="3">Here's a 5-night Lisbon trip — flights compared across airlines, boutique stays, and the best eats, under your budget.</div>
    <div class="tripcard" data-step="4">
      <div class="ban">Lisbon · Portugal</div>
      <div class="row"><span>✈︎ TAP Air · nonstop</span><span>$612</span></div>
      <div class="row"><span>🛏 Lisbon Boutique Stay</span><span>$104/night</span></div>
      <div class="row"><span>🍴 Time Out Market</span><span>4.7★</span></div>
      <div class="row"><span>Total estimate</span><span>$1,344</span></div>
    </div>
  </div>
</header>

<div class="wrap"><div class="marquee"><div class="track" id="track">
  <span>Tokyo&nbsp;·&nbsp;Lisbon&nbsp;·&nbsp;Barcelona&nbsp;·&nbsp;Bali&nbsp;·&nbsp;New York&nbsp;·&nbsp;Reykjavik&nbsp;·&nbsp;Cape Town&nbsp;·&nbsp;Mexico City&nbsp;·&nbsp;Rome&nbsp;·&nbsp;Bangkok&nbsp;·&nbsp;</span>
  <span>Tokyo&nbsp;·&nbsp;Lisbon&nbsp;·&nbsp;Barcelona&nbsp;·&nbsp;Bali&nbsp;·&nbsp;New York&nbsp;·&nbsp;Reykjavik&nbsp;·&nbsp;Cape Town&nbsp;·&nbsp;Mexico City&nbsp;·&nbsp;Rome&nbsp;·&nbsp;Bangkok&nbsp;·&nbsp;</span>
</div></div></div>

<section id="how" class="wrap reveal">
  <div class="eyebrow">How it works</div>
  <h2 class="h2">Three taps to a real trip</h2>
  <p class="sub">No tabs, no spreadsheets, no twelve booking sites. Just a conversation.</p>
  <div class="steps">
    <div class="step"><div class="n">01</div><h3>Tell Scout</h3><p>Describe the vibe, the dates, the budget — like texting a friend who knows travel.</p></div>
    <div class="step"><div class="n">02</div><h3>Get a plan</h3><p>Real flights, hotels, experiences and a day-by-day itinerary, ranked to your budget.</p></div>
    <div class="step"><div class="n">03</div><h3>Book it</h3><p>Reserve hotels right in the app and book flights with a tap. Done.</p></div>
  </div>
</section>

<section id="features" class="wrap reveal">
  <div class="eyebrow">Why Scout</div>
  <h2 class="h2">Smart where it counts</h2>
  <p class="sub">The planning magic of an AI, the data of a real travel agency.</p>
  <div class="bento">
    <div class="tile wide"><div class="ic">💬</div><h3>Just ask, in plain English</h3><p>"Somewhere warm in February under $800." "A foodie weekend in Mexico City." Scout gets it — and answers any travel question, too.</p></div>
    <div class="tile third"><div class="ic">📸</div><h3>Snap a place</h3><p>Send a photo — Scout finds where it is, or somewhere with the same vibe.</p></div>
    <div class="tile third"><div class="ic">✈️</div><h3>Real prices</h3><p>Live fares across airlines, ranked to your budget.</p></div>
    <div class="tile third"><div class="ic">💡</div><h3>Smart timing</h3><p>"Leaving a day earlier saves ~$40." Gentle, never pushy.</p></div>
    <div class="tile half"><div class="ic">🏨</div><h3>Book hotels in-app</h3><p>Major chains and boutique stays, reserved without leaving Scout.</p></div>
    <div class="tile half"><div class="ic">🌙</div><h3>Truly yours</h3><p>Light or dark, your home airport and language, saved trips and notes — all kept on your device.</p></div>
  </div>
</section>

<section id="peek" class="wrap reveal">
  <div class="eyebrow">A look inside</div>
  <h2 class="h2">Beautiful, down to the detail</h2>
  <p class="sub">Real itineraries, real prices, laid out like a magazine.</p>
  <div class="stage">
    <div class="screen">
      <img class="device" src="/assets/screen-home.png" alt="Scout home with suggested prompts"/>
      <div class="cap"><h3>Start with a prompt</h3><p>Tap an idea or type your own — Tokyo under $2k, a foodie weekend, somewhere warm.</p></div>
    </div>
    <div class="screen">
      <img class="device" src="/assets/screen-agents.png" alt="Scout's specialist agents"/>
      <div class="cap"><h3>Your travel crew</h3><p>Specialists for flights, stays, experiences, and trending eats — working for you.</p></div>
    </div>
    <div class="screen">
      <img class="device" src="/assets/screen-itinerary.png" alt="Scout day-by-day itinerary"/>
      <div class="cap"><h3>Day-by-day itinerary</h3><p>A complete plan with a budget breakdown, beautifully laid out.</p></div>
    </div>
  </div>
</section>

<section class="wrap reveal" id="get">
  <div class="band">
    <h2>Start scouting.</h2>
    <p>Free to use. Your next trip, planned in seconds.</p>
    <a class="btn" href="#" style="font-size:17px;padding:15px 26px;">Download on the App Store</a>
    <div style="color:var(--muted);font-size:14px;margin-top:14px;position:relative;">Launching soon — built for iPhone.</div>
  </div>
</section>

<footer><div class="wrap fr">
  <div class="brand" style="font-size:17px;"><span class="mark" style="width:26px;height:26px;font-size:14px;">◇</span>Scout</div>
  <div>© 2026 Scout · <a href="/legal/privacy">Privacy</a><a href="/legal/terms">Terms</a><a href="/legal/support">Support</a></div>
</div></footer>

<script>
  // Scroll reveal
  var io = new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12});
  document.querySelectorAll('.reveal').forEach(function(el){io.observe(el);});

  // Animated hero chat demo (loops)
  function runDemo(){
    var steps=[].slice.call(document.querySelectorAll('[data-step]'));
    var typing=document.getElementById('typewrap');
    steps.forEach(function(s){s.classList.remove('show');});
    typing.style.display='none';
    var seq=[
      [300, function(){show(1);}],
      [900, function(){typing.style.display='block';}],
      [2600,function(){typing.style.display='none';show(3);}],
      [3200,function(){show(4);}],
      [9000,function(){runDemo();}]
    ];
    function show(n){var el=document.querySelector('[data-step="'+n+'"]');if(el){el.classList.add('show');}}
    seq.forEach(function(s){setTimeout(s[1],s[0]);});
  }
  runDemo();
</script>
</body></html>`;
