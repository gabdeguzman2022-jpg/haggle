## one_liner
Haggle turns the bill info you type in into a ready-to-read, personalized negotiation script in seconds — so you make the call yourself and keep 100% of whatever you save, instead of paying a negotiation service 30-50% of it.

## core_loop
1) User taps "Add a bill." 2) Picks a category: Phone, Internet/Cable, or Auto/Home Insurance (medical and health-insurance premiums explicitly excluded — see mvp_out). 3) Enters provider name, current monthly amount, and — optionally — tenure, the trigger (rate increase / promo just expired / just checking), and a competitor's quoted price. 4) Taps "Generate script" — a local, deterministic engine composes the script instantly, no network call, no spinner. 5) Script Result screen (the hero moment) shows: the exact department to ask for (with the IVR trick to reach it), an opening that embeds the user's real numbers, a computed target ask, 2-3 objection/rebuttal pairs, and a "get it in writing" close, plus a sourced, ranged projected-savings estimate. 6) User makes the call themselves (outside the app). 7) User returns and logs what actually happened, which feeds a self-reported "money saved" tracker. 8) The first script ever generated is free in full; adding a second bill surfaces a custom-built paywall. Purchasing (via RevenueCat, Test Store in dev) unlocks unlimited bills, a 6-12 month renegotiation reminder (local notification), and the cumulative savings tracker.

## screens
- Home / Bill List — saved bills, empty state for new users, savings-tracker total (premium), primary "Add a bill" CTA
- Add Bill — category picker, provider, current amount, optional tenure/trigger/competitor-offer fields, inline validation
- Script Result — the hero screen: department + IVR tip, opening, leverage statement, computed ask, objection/rebuttal pairs, written-confirmation close, sourced savings range
- Paywall — hand-coded (not RevenueCat remote Paywalls v2), triggered on the 2nd bill or on tapping reminders/tracker; shows live price from getOfferings(), Subscribe button, Restore Purchases
- Bill Detail / Saved Script — re-view a past script, log the outcome (new rate, date) that feeds the tracker
- Settings — restore purchases, manage reminder, savings-claim disclaimer/legal, about

## mvp_in
- Local deterministic script engine (lib/scriptEngine.ts) covering Phone, Internet/Cable, Auto/Home Insurance
- Curated dataset of ~5-10 real providers per category (real retention-department names, category vocabulary) + a generic fallback template for any unlisted provider
- Tactic-selection branching: competitor-offer anchor / loyalty-tenure / cancellation-signal / insurance-shopping / generic no-leverage
- Structured script output with objection handling (2-3 if/then pairs) and a mandatory written-confirmation close on every script
- Computed (not hardcoded) target ask and projected annual savings range, sourced/ranged, never a guaranteed figure
- First-script-free gating via a persisted local flag (AsyncStorage)
- RevenueCat SDK integration (react-native-purchases + react-native-purchases-ui installed, but paywall UI is hand-built in-repo) wired to a single `premium` entitlement via RevenueCat Test Store
- Custom-coded paywall screen using Purchases.getOfferings()/purchasePackage()/restorePurchases()
- Premium gates: unlimited bills, 6-12 month renegotiation reminder, cumulative self-reported savings tracker
- expo-router navigation, AsyncStorage persistence, expo-notifications local scheduled reminder, one deliberate loaded font via expo-font
- README section documenting the local-engine-over-LLM decision and RevenueCat Test Store setup, for judge legibility

## mvp_out
- Medical bills — different UX shape (document checklist vs. single script), heavier data-sensitivity/privacy burden; flagged as a labeled V2 expansion, not the demo's 'one thing'
- Health insurance premiums as a category — not negotiable via a retention-department call at all; 'insurance' is scoped explicitly to auto/home/renters in all copy to avoid a broken first experience
- Any LLM call (client-embedded or server-proxied) for script generation — rejected per research: client-embedded key is a public-repo security/cost hazard, a proxy adds unbounded marginal cost against a flat subscription and a network dependency on the one moment that must never fail on camera
- Accounts/auth and cloud sync — judged on a local demo video and open-source code, not multi-device scale; AsyncStorage is sufficient and keeps the build surface small
- Analytics dashboards / usage tracking backend — no product or judging need in 25 days
- iOS build — no Mac, no paid Apple developer account, no Xcode on this machine; Android-only via EAS cloud dev-build satisfies the 'no paid developer account' rule
- Broad multi-provider database beyond ~5-10 curated providers per category — a small curated set plus a generic fallback avoids stale/shallow data while keeping the engine's craft the focus
- In-app dialer/click-to-call integration — the user places the call themselves outside the app; adding telephony integration is out of scope and not needed for the loop
- OneSignal / push notifications — the reminder is a local scheduled notification only; OneSignal would force a native dev-build dependency for a Shipaton bonus prize the product doesn't need
- RevenueCat remote Paywalls v2 (dashboard-designed) — rejected in favor of a hand-built paywall so the paywall's design lives in the open-source repo and to avoid the documented generic-fallback-UI risk on camera
- 'Pay it forward' hardship program as working functionality — kept as a documented roadmap/marketing line only pending a client scope decision (see open_questions), not built into the MVP loop or paywall

## paywall_design
The core experience — generating one full-quality script — is never paywalled; the first script on a fresh install is completely free so the user feels the "money moment" of the product itself before any purchase ask, per the brief's explicit requirement. The paywall triggers the moment the user tries to add a SECOND bill/script, and also when they tap the reminder toggle or the savings tracker before purchasing. It is a single hand-coded screen (own design system, not RevenueCat's remote Paywalls v2) that calls `Purchases.getOfferings()` to display the live price of a single `premium` package and calls `Purchases.purchasePackage()` on Subscribe. In development/demo this runs against a RevenueCat Test Store `test_` key (kept in a gitignored `.env`, never hardcoded), so tapping Subscribe surfaces RevenueCat's real on-screen simulate-purchase modal — a visible, recordable "money moment" exactly as RevenueCat's own Next Gen guidance asks for. On simulated success, `customerInfo.entitlements.active['premium']` flips immediately and the UI unlocks in place (no restart): unlimited bills/scripts, the 6-12 month renegotiation reminder, and the cumulative money-saved tracker. Restore Purchases is available both on the paywall and in Settings. `Purchases.configure()` is guarded against double-invocation (Fast Refresh/StrictMode), and the Test Store key is switched via env/build profile so it can never reach a build presented as production (the SDK hard-crashes on that combination by design, which is treated as a safety feature, not a bug to route around).

## edge_cases
- Provider not in the curated dataset -> falls back to a generic, still category-correct template rather than breaking the flow
- User selects Auto/Home Insurance and expects a health-premium script -> UI copy explicitly labels the category 'Auto & Home Insurance' to prevent this exact confusion the research flagged as trust-damaging
- Blank or $0 monthly amount -> Generate button stays disabled with inline validation, no crash/garbage script
- App force-closed after the free script is used -> 'first script used' flag persisted in AsyncStorage survives relaunch, so the free tier can't be reset by restarting the app
- Purchases.configure() invoked twice via React Fast Refresh/StrictMode -> guarded with a module-level flag so the SDK isn't reconfigured mid-session
- Network unavailable -> script generation is unaffected (fully offline); only the paywall's getOfferings()/purchasePackage() calls can fail, and must show a retry/error state rather than freezing
- Restore Purchases tapped with no prior purchase on that RevenueCat user -> shows an explicit 'no purchases found' state, not a crash or false unlock
- RevenueCat Test Store subscriptions auto-renew a maximum of 5 times before self-canceling and use compressed renewal timing -> a known dev/demo quirk to account for when recording, not a user-facing bug to fix
- User denies the local-notification permission -> the reminder still saves as 'scheduled' in-app state, with a visible note that OS notifications are off, rather than silently failing
- Category-specific vocabulary must not leak (an insurance script must never say 'plan' where it should say 'policy', etc.) -> enforced by per-category data files and covered by unit tests, not left to string interpolation luck
- Overlong free-text input (competitor offer, provider name) -> length-validated so the Script Result layout never breaks
- Two categories given identical inputs must still branch into structurally different tactic families (telecom retention-department mechanics vs. insurance shopping/deductible mechanics) -> verified directly by reading scriptEngine.ts and by generating one script per category

## acceptance_criteria
- Generating a script from a filled Add Bill form completes in well under 200ms with zero network requests — verifiable by testing in airplane mode
- The rendered script visibly contains the user's own entered values (amount, and tenure/competitor offer when provided) interpolated into sentences, not left as placeholder-style text
- Every generated script includes: a named retention/loyalty department (or category-correct equivalent) with an IVR routing tip for phone/internet/cable, a computed (not hardcoded) target ask, at least two objection/rebuttal pairs, and a 'get it in writing' confirmation close
- Phone/Internet/Cable and Auto/Home Insurance scripts are structurally different (different tactic family, different vocabulary), demonstrable both by reading scriptEngine.ts and by diffing two generated scripts
- A fresh install can generate exactly one full-quality script with no paywall interstitial shown beforehand
- Attempting to add a second bill (or toggle reminders/tracker before purchase) surfaces the custom paywall before any further script is generated
- Tapping Subscribe opens RevenueCat's Test Store simulate-purchase modal; confirming success flips the `premium` entitlement and unlocks premium screens immediately with no app restart
- Restore Purchases on a fresh app instance correctly re-activates the entitlement for a RevenueCat user with a prior Test Store purchase
- A scheduled renegotiation reminder fires as a local notification without requiring the app to be manually reopened (verified with a shortened dev-only interval)
- No in-app or marketing copy states a guaranteed or averaged savings dollar figure without a named, cited source; all savings language is a ranged, attributed estimate, and the in-app tracker is explicitly self-reported, not projected
- `tsc --noEmit` passes with zero errors, and scriptEngine.ts has unit tests exercising every category x tactic-branch combination
- The README explains, in plain language a judge can read in under two minutes, why the script engine is a local deterministic system rather than an LLM call, and documents the RevenueCat Test Store setup steps
- The full click-through (Add Bill -> Script Result -> paywall trigger) runs inside plain Expo Go; only an actual Test Store purchase round-trip additionally requires an EAS-built Android dev-client APK on a physical device

## script_architecture_decision
Build a pure, synchronous, local TypeScript rules engine (lib/scriptEngine.ts) — no LLM call anywhere in the generation path, whether client-embedded, server-proxied, or hybrid. Reasoning, decisively resolved from the research: a client-embedded API key is disqualifying in a public, judged-open-source repo (trivially extractable, guaranteed abuse vector); a backend LLM proxy reintroduces unbounded per-call marginal cost against a flat-subscription/unlimited-premium business model, adds a second deployable system to a 25-day solo build, and puts a network round-trip and generation-quality variance on the one moment (the Script Result) that must render identically and instantly on every take of the demo video; a hybrid (template default + optional LLM polish) requires building the full local engine anyway and then doubles the failure surface for a cosmetic benefit. The local engine wins outright: zero marginal cost per script (what actually makes 'unlimited bills for premium users' sustainable), nothing secret to leak (so open-source review becomes a strength judges can read as real engineering rather than an API wrapper), instant and fully offline (removing all demo-recording risk), and 100% reproducible output for both testing and every recording take. It is built as {category, provider, currentMonthlyAmount, tenureMonths?, trigger, competitorOffer?} -> a structured ScriptResult, composed from (1) a curated per-provider/category dataset carrying real retention-department names and category-correct vocabulary, (2) tactic-selection branching (competitor-anchor / loyalty / cancellation-signal / insurance-shopping / generic-fallback) so categories and situations produce genuinely different scripts rather than one skeleton with swapped nouns, (3) a fixed structural skeleton enforcing opening -> leverage -> computed ask -> objection/rebuttal pairs -> written-confirmation close, and (4) small deterministic phrasing-pool variation hashed on provider+category so output isn't visibly templated while staying fully reproducible. This choice is documented in the README as an intentional engineering decision — directly aligned with RevenueCat's own 'do one thing well' Next Gen guidance — not as an AI-avoidance compromise, with LLM-based personalization named explicitly as a post-hackathon roadmap item.

## open_questions
- Exact premium price point and billing period (monthly vs. annual) — a business decision not inferable from the research
- Which specific 5-10 providers to hand-curate first per category, and whether the product assumes US-only providers/regulations — needs the client's market scope confirmed before the dataset is written
- Whether the 'pay it forward' hardship program is real MVP functionality (e.g., a hardship code granting free premium) or marketing-only language deferred to a later version — it's part of the stated business model but not part of the required core loop or paywall, so scope needs an explicit call
- Renegotiation reminder default timing: 6 months, 12 months, or user-configurable — no source in the research pins a specific number
- Explicit sign-off that the Insurance category is scoped to Auto/Home/Renters only (never health premiums) in all product copy and the category picker, since this changes what the picker offers and is called out as trust-critical
- Whether the recorded demo video's 'money moment' must be a live Test Store purchase on a physical Android device via an EAS dev-build APK, or whether Expo Go's RevenueCat Preview API Mode is acceptable for the recording — this determines whether an EAS build cycle needs to be budgeted into the 25-day plan at all