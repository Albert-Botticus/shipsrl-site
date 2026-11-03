# SRL Logistics website

Static site for shipsrl.com (SRL Logistics, an Armstrong Transport Group agency). No build step.

- index.html, carriers.html, ltl-quote.html
- css/, js/, img/
- Forms post to Formspree (see js/ltl.js and js/main.js)
- Hosted on GitHub Pages; CNAME = shipsrl.com

## Forms

Both forms POST JSON to one Formspree endpoint (`https://formspree.io/f/mqpplker`), which
emails the request to SRLteam@armstrongtransport.com. They are told apart by subject:

- home truckload form: `Quote request: <origin> to <destination> (<company>)`, `kind: TRUCKLOAD_QUOTE_REQUEST`
- LTL form: `LTL Quote Request: <origin zip> to <dest zip> (<company>)`, with a `--- JSON ---`
  block inside `message` that `srl-ltl-quotes/parse-request.mjs` reads

`mailto:` is a **fallback only**, used when the POST fails. It never reports success.
Do not mistake it for the primary path.

The LTL form deliberately mirrors Armstrong's ATGFr8 LTL Quoting screen field for field so a
submission can be typed into the TMS without translation. Do not rename or remove its fields,
accessorial values, or JSON structure.

Added 2026-11-03 (JSON `version: 2`, all additive):

- `contact.website`: optional company website (free text; type=url would reject "example.com").
- Per item: `estimated_class` and `class_source` (`customer` | `estimated` | `unknown`). The
  estimate is the NMFC 13-sub density scale (Docket 2025-1, July 2025) in `DENSITY_SCALE` in
  js/ltl.js. It is shown under the class dropdown as the visitor types, and it also warns when a
  customer-entered class disagrees with density and no NMFC number was given.
- `freight_class_notice`: `{ items_without_class, acknowledged }`. The page shows a standing
  notice that carriers can reweigh/reclass and bill the corrected class. When any item is left on
  "Not sure", a required acknowledgment checkbox appears (hidden and not required otherwise).
- Plain-text copy gains `Website:` and `Freight class notice:` lines, and an `| est. class ...`
  tail on each item line (appended last so `parse-request.mjs` positional parsing is unchanged).

### Spam

Both forms carry a hidden `_gotcha` honeypot (Formspree's documented honeypot field). The page
also checks it client-side and silently drops the submission. No CAPTCHA, by choice.

### Formspree quota - known limitation

The free plan allows **50 submissions per month, shared by both forms**. Formspree offers no
public API for reading your usage on the free plan, and polling it would require account
credentials, which must never go into this static site. So automated quota monitoring is not
possible here without a backend.

What happens at the cap: Formspree starts rejecting the POST, the page falls back to opening
the visitor's email app, and leads still reach SRLteam - just less smoothly. Nothing is lost
silently.

Simplest mitigations, in order of effort:
1. Formspree's own dashboard shows the monthly count - check it at formspree.io/forms/mqpplker.
2. Turn on Formspree's email notification for approaching limits in the form settings, if offered.
3. If volume gets real, upgrade the plan. That is the only durable fix.

## Conversion tracking

`js/track.js` records three events: `truckload_quote_submitted`, `ltl_quote_submitted`, and
`quote_submit_failed`. A success is recorded **only after Formspree accepts the POST**.

It never transmits form contents - no name, email, phone, company, zip, or shipment detail.
Only the event name, which form it was, and a coarse failure reason.

**It is inert until a provider is added.** With no analytics script on the page, every call is a
silent no-op. To switch it on, add exactly one of these to the pages and nothing else is needed:

- **Google Analytics 4**: add the gtag.js snippet (needs a GA4 Measurement ID, `G-XXXXXXX`)
- **Plausible** or **Fathom**: add their script tag (needs an account; both are paid, privacy-first)
- **Google Tag Manager**: add the GTM snippet (events are pushed to `window.dataLayer`)

Nathan has to create the account and supply the ID; no tracking ID is hardcoded here.

## Email signatures

`signature/nathan.html` is Nathan's, ready to use. `signature/team.html` is an intentional
**template** for Alex and David: `FIRST LAST` and `EMAIL@armstrongtransport.com` are meant to
be replaced per person before pasting into Gmail. Do not hardcode a shared address there.
