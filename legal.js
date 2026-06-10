// Hosted legal pages for the App Store (Terms, Privacy, Support). Served by the
// backend so they have real, working URLs. Plain, accurate to what Scout does.
// NOTE: review/customize the contact details and have a lawyer check before launch.

const CONTACT = 'maxmahnken08@gmail.com';
const UPDATED = 'June 2026';

function page(title, body) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Scout — ${title}</title>
<style>
  body{margin:0;background:#0E0F13;color:#ECECEC;font:16px/1.6 -apple-system,system-ui,Segoe UI,Roboto,sans-serif;}
  .wrap{max-width:720px;margin:0 auto;padding:40px 22px 80px;}
  h1{font-size:26px;margin:0 0 4px;} h2{font-size:18px;margin:28px 0 8px;color:#FF8E6E;}
  p,li{color:#C7C7C7;} a{color:#FF6B4A;} .muted{color:#8E8E8E;font-size:14px;}
  .mark{display:inline-block;width:26px;height:26px;border-radius:7px;background:linear-gradient(135deg,#FF6B4A,#FF9466);vertical-align:-6px;margin-right:8px;}
</style></head><body><div class="wrap">
<p><span class="mark"></span><strong>Scout</strong></p>
<h1>${title}</h1><p class="muted">Last updated: ${UPDATED}</p>
${body}
<h2>Contact</h2><p>Questions? Email <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>
</div></body></html>`;
}

export const termsHTML = page('Terms of Service', `
<p>Welcome to Scout. By using the Scout app you agree to these terms.</p>
<h2>What Scout does</h2>
<p>Scout is an AI travel-planning assistant. It helps you plan trips and shows flight, hotel, and
activity options from third-party travel providers. Scout is a discovery and planning tool — when
you book, you transact with the relevant travel provider (e.g. the airline, hotel, Booking.com,
or our booking partner), subject to their terms.</p>
<h2>Pricing & bookings</h2>
<p>Prices, availability, and trip details are provided by third parties and may change at any time.
Scout makes no guarantee that any price or option will remain available. Review all details with
the provider before purchasing.</p>
<h2>Affiliate disclosure</h2>
<p>Scout may earn a commission when you book through links or partners in the app, at no extra cost
to you.</p>
<h2>Subscriptions</h2>
<p>Scout is free to use. An optional "Scout Pro" subscription may be offered through the App Store;
it auto-renews unless cancelled at least 24 hours before the period ends, and is managed in your
Apple ID settings.</p>
<h2>Acceptable use</h2>
<p>Don't misuse the service, attempt to disrupt it, or use it for unlawful purposes.</p>
<h2>Disclaimer</h2>
<p>Scout is provided "as is" without warranties. We are not liable for third-party travel services,
price changes, or trip outcomes. Scout is not a licensed travel agency, and its suggestions are not
professional travel, financial, legal, or medical advice.</p>
<h2>Changes</h2>
<p>We may update these terms; continued use means you accept the changes.</p>
`);

export const privacyHTML = page('Privacy Policy', `
<p>Scout is built to respect your privacy. This explains what we collect and why.</p>
<h2>What we collect</h2>
<ul>
<li><strong>Account:</strong> when you use Sign in with Apple, we receive your name and (if you allow)
an email relay, to create your account.</li>
<li><strong>Trip requests:</strong> the text you send to plan trips is sent to our backend and to our
AI provider to generate results.</li>
<li><strong>Photos (optional):</strong> if you attach a photo, it's sent to the AI for that request to
help answer you. We do not store your photos.</li>
<li><strong>Location (optional):</strong> if you tap "Use my location," your approximate location is
used to pick your nearest airport. It is not stored or shared beyond that purpose.</li>
<li><strong>Preferences:</strong> your home airport, language, travel style, and budget are stored on
your device.</li>
</ul>
<h2>How it's used</h2>
<p>Only to provide and improve trip planning and bookings. We do <strong>not</strong> sell your
personal data, and Scout does not track you across other apps or websites.</p>
<h2>Third parties</h2>
<p>To deliver results we share necessary request data with service providers including our AI provider
(Anthropic), travel data/booking partners (e.g. Travelpayouts, LiteAPI/Nuitée, Booking.com), and our
hosting provider. Each handles data under their own policies.</p>
<h2>Your choices</h2>
<p>You can revoke Sign in with Apple, disable location, and delete your locally stored trips, notes,
and preferences from within the app or your device settings.</p>
<h2>Children</h2>
<p>Scout is not directed to children under 13.</p>
`);

export const supportHTML = page('Support', `
<p>Need help with Scout? We're happy to assist.</p>
<h2>Get in touch</h2>
<p>Email <a href="mailto:${CONTACT}">${CONTACT}</a> with your question and, if relevant, your device
model and iOS version. We aim to reply within a few business days.</p>
<h2>Common topics</h2>
<ul>
<li><strong>Bookings:</strong> after you book, your reservation is with the travel provider — contact
them for changes or cancellations.</li>
<li><strong>Subscriptions:</strong> manage or cancel Scout Pro in your Apple ID → Subscriptions.</li>
<li><strong>Data:</strong> see our <a href="/legal/privacy">Privacy Policy</a>.</li>
</ul>
`);
