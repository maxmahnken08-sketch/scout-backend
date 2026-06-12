// Private admin dashboard — served at GET /admin (requires ADMIN_KEY).
export const adminHTML = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Scout · Admin</title>
<meta name="robots" content="noindex,nofollow"/>
<style>
  :root{--bg:#0A0B0E;--card:#16181F;--line:rgba(255,255,255,.08);--text:#F4F5F7;--muted:#9AA0AB;
        --coral:#FF6B4A;--peach:#FF9466;--green:#34C77B;}
  *{box-sizing:border-box;margin:0}
  body{background:var(--bg);color:var(--text);font:15px/1.5 -apple-system,system-ui,sans-serif;padding:28px;}
  .wrap{max-width:1060px;margin:0 auto;}
  h1{font-size:22px;display:flex;align-items:center;gap:10px;}
  h1 img{width:30px;height:30px;border-radius:8px;}
  .sub{color:var(--muted);font-size:13px;margin:4px 0 26px;}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin-bottom:14px;}
  .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;}
  .k{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.6px;}
  .v{font-size:30px;font-weight:800;margin-top:4px;}
  .v small{font-size:14px;color:var(--muted);font-weight:600;}
  .row{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px;}
  @media(max-width:760px){.row{grid-template-columns:1fr}}
  .bar{display:flex;align-items:flex-end;gap:6px;height:140px;margin-top:14px;}
  .bar div{flex:1;background:linear-gradient(180deg,var(--coral),var(--peach));border-radius:6px 6px 2px 2px;min-height:3px;position:relative;}
  .bar div span{position:absolute;top:-20px;left:50%;transform:translateX(-50%);font-size:10px;color:var(--muted);}
  .dates{display:flex;gap:6px;margin-top:6px;}
  .dates div{flex:1;text-align:center;font-size:9px;color:var(--muted);}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px;}
  td,th{padding:7px 8px;text-align:left;border-top:1px solid var(--line);}
  th{color:var(--muted);font-weight:600;border:none;font-size:11px;text-transform:uppercase;letter-spacing:.5px;}
  .pill{display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;}
  .ok{background:rgba(52,199,123,.15);color:var(--green);} .bad{background:rgba(255,107,74,.15);color:var(--coral);}
  .dest{display:flex;justify-content:space-between;padding:7px 0;border-top:1px solid var(--line);font-size:14px;}
  .dest b{color:var(--peach);}
</style></head><body><div class="wrap">
<h1><img src="/assets/icon.png" alt=""/>Scout Admin</h1>
<div class="sub" id="sub">Loading…</div>

<div class="grid">
  <div class="card"><div class="k">Chats</div><div class="v" id="chats">–</div></div>
  <div class="card"><div class="k">Trips planned</div><div class="v" id="plans">–</div></div>
  <div class="card"><div class="k">Bookings</div><div class="v" id="bookings">–</div></div>
  <div class="card"><div class="k">Booked volume</div><div class="v" id="volume">–</div></div>
</div>

<div class="row">
  <div class="card">
    <div class="k">Trips planned — last 14 days</div>
    <div class="bar" id="chart"></div>
    <div class="dates" id="chartDates"></div>
  </div>
  <div class="card">
    <div class="k">Top destinations</div>
    <div id="dests" style="margin-top:8px;"></div>
  </div>
</div>

<div class="row">
  <div class="card">
    <div class="k">Recent activity</div>
    <table><thead><tr><th>When</th><th>Event</th><th>Detail</th></tr></thead><tbody id="recent"></tbody></table>
  </div>
  <div class="card">
    <div class="k">Providers</div>
    <div id="health" style="margin-top:8px;"></div>
  </div>
</div>

<script>
const fmt=n=>n>=1000?(n/1000).toFixed(1).replace(/\\.0$/,'')+'k':String(n);
async function load(){
  const [s,h]=await Promise.all([
    fetch('/admin/data'+location.search).then(r=>r.json()),
    fetch('/health').then(r=>r.json()).catch(()=>null)
  ]);
  if(s.error){document.getElementById('sub').textContent='Unauthorized — open /admin?key=YOUR_ADMIN_KEY';return;}
  document.getElementById('sub').textContent='Live since '+new Date(s.startedAt).toLocaleString()+' · auto-refreshes every 30s';
  chats.textContent=fmt(s.totals.chats); plans.textContent=fmt(s.totals.plans);
  bookings.textContent=fmt(s.totals.bookings);
  volume.innerHTML='$'+fmt(Math.round(s.totals.bookedVolume));
  const max=Math.max(1,...s.days.map(d=>d.plans));
  chart.innerHTML=s.days.map(d=>'<div style="height:'+(d.plans/max*100)+'%" title="'+d.date+': '+d.plans+'"><span>'+(d.plans||'')+'</span></div>').join('');
  chartDates.innerHTML=s.days.map(d=>'<div>'+d.date.slice(5)+'</div>').join('');
  dests.innerHTML=s.topDestinations.length
    ? s.topDestinations.map(d=>'<div class="dest"><span>'+d.name+'</span><b>'+d.count+'</b></div>').join('')
    : '<div class="dest"><span>No trips yet</span></div>';
  recent.innerHTML=s.recent.map(r=>{
    const t=new Date(r.at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
    const detail=r.destination?r.destination+(r.budget?' · $'+r.budget:''):(r.amount?'$'+r.amount:'');
    return '<tr><td>'+t+'</td><td>'+r.event+'</td><td>'+detail+'</td></tr>';
  }).join('')||'<tr><td colspan=3>Nothing yet</td></tr>';
  if(h)health.innerHTML=Object.entries(h.keys).map(([k,v])=>'<div class="dest"><span>'+k+'</span><span class="pill '+(v?'ok':'bad')+'">'+(v?'connected':'missing')+'</span></div>').join('');
}
load(); setInterval(load,30000);
</script>
</div></body></html>`;
