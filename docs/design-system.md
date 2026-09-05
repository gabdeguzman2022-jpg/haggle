## chosen_direction
CORNER COPY, locked as the base system, with three grafts from the losing directions and two self-inflicted contradictions fixed before build. Renamed internally to "Corner Copy v2" only insofar as the two flagged wireframe errors (the middle-dot meta string and the bordered category box) are corrected — the palette, type system, and Spine device ship exactly as specified, plus the grafts below.

## why
Scoring the three lenses on evidence, not average: Originality — Setpoint 8.5, Corner Copy 6.5, House Lights 5. Usability — Corner Copy 8.5, Setpoint 7.5, House Lights 6. Demo impact — House Lights 9, Corner Copy 7, Setpoint 6.

House Lights is disqualified as the base despite winning demo-impact outright, because its two weaknesses are both load-bearing, not cosmetic: (1) the Script Result — the exact screen the user reads FROM during a real, stressful phone call — is the one dark screen in the app, which is a genuine outdoor/bright-room legibility risk the spec never addresses, and (2) it renders the "if they say" objection text at 55% opacity, i.e. it deliberately lowers contrast at the single moment of highest live cognitive load, which is backwards for an anti-anxiety product. Both judges independently called these fatal-flaw-adjacent. On top of that, its own hex values fail its originality claims (Paper #F5F3ED is a 1-2-point-per-channel match to the explicitly banned cream #F4F1EA) and its Stage+Brass pairing is structurally tell #2 (near-black + single saturated accent) wearing a good rationale. A direction that both under-delivers on its stated originality AND creates real user harm at the exact moment the product exists to help is too risky to build from, however good its demo-camera instincts are.

Setpoint is disqualified as the base for the opposite reason: it is the most defensible design under slow, close scrutiny (best-surviving hex check, most original typographic argument — demoting the one loaded font to spoken-word body copy) but is the weakest by a full 3 points on the lens that most directly maps to this competition's actual judging mechanism (a 2-minute video watched across ~540 entries). A 180ms numeral tick on a pale, uniformly light page is a real risk of reading as "nothing happened" to a judge scrubbing at 2x speed, and Setpoint's own quiet loading/paywall treatment compounds that. Optimizing hardest for a slow, careful reader when the actual reader is a fast, tired judge is the wrong bet for a hackathon entry, however good the underlying product would be to live with.

Corner Copy wins because it has no lens where it is worst, no risk that is genuinely fatal (its two flaws are wireframe-execution slips that contradict its OWN stated rules, not design-concept flaws — meaning they are fixable by simply drawing the mockup correctly, not by rethinking the direction), and it is the only direction whose signature device — the Spine — does real, mechanism-level work on all three lenses simultaneously: it is a genuine usability aid (place-tracking without sacrificing text contrast, unlike House Lights' opacity trick), a genuine demo device (a describable, camera-legible "line that follows you down the call," turning red at objections during a scroll), and a genuinely original structural idea (no direction in the calibration set has anything like it). It also independently avoids the single most consequential originality tell (near-black + single accent), because it stays light-mode end to end — which is also exactly what fixes House Lights' daylight-glare risk. The grafts below close the remaining demo-impact gap against House Lights without reintroducing its user-facing risk.

## grafts
1. FROM SETPOINT — the before/after readout. House Lights and Corner Copy's own base wireframe both show only the NEW number on the Script Result; a judge glancing at the screen has to remember the old bill amount from earlier in the video to register savings. Graft Setpoint's exact device: the old monthly amount renders struck-through in a muted tone immediately beside the new target-ask number in Brass — "$89 → $62/mo" as a single glanceable unit, so the money moment reads in one frame with no memory required from the viewer. This becomes the top of the Script Result, before "Ask for."

2. FROM SETPOINT — non-spinner RevenueCat loading state. The only real network calls in the whole app (getOfferings, purchasePackage, restorePurchases) need a "working" signal that can't look frozen mid-recording. Graft Setpoint's exact mechanism: the button's label stays in place, its fill dims from solid Corner-teal to a flat neutral (Rule-grey #D8D4C7 fill, Ink 50% label), and a 1px Corner-teal line animates left-to-right along the button's bottom edge on a ~900ms loop until the call resolves. No spinner icon anywhere in the app.

3. FROM HOUSE LIGHTS — a scene-level reveal, kept in light mode. Corner Copy's stock animation (Spine draws down over ~400ms while text fades in) is real but localized to the left margin — a subtler beat than House Lights' full-frame light-to-dark cut, which is the single reason House Lights won the demo-impact lens outright. Graft the CONCEPT (a full-frame, unmissable, binary "something happened" event) without the LIABILITY (going dark). On "Generate script," a solid Corner-teal bar sweeps top-to-bottom across the full screen width in 150ms like a curtain, revealing the finished Script Result underneath as it passes (the content is already laid out beneath it, not rendered after) — then the Spine draws and the text cascades in per the original Corner Copy spec, landing on the fully static page by ~650ms total. This gives a camera-legible, full-bleed motion event (registers even muted, on a scrubbed timeline, exactly what House Lights' judges praised) while staying entirely on Paper's light values, so the real-world daylight-legibility risk never enters the product at all. The teal sweep also visually rhymes with the Subscribe button's fill, so — per House Lights' own good instinct — the free-script moment and the paywall moment read as one continuous, deliberately designed system.

4. FROM HOUSE LIGHTS — the fixed five-beat skeleton. Adopt verbatim as a hard rule: the Script Result may contain exactly five structural beats and no others — Ask for → What to say → Your target ask → If they push back → Before you hang up. Any label that doesn't map to one of these five doesn't ship. This was House Lights' best editorial discipline and Corner Copy's spec left its section list open-ended; closing it removes any temptation to add a sixth "helpful" card later that would dilute the document-not-dashboard read.

5. FROM HOUSE LIGHTS — cold-start behavior. App launch shows a bare Paper screen with nothing on it for up to 150ms while AsyncStorage is read; only if it runs longer than that does a single static wordmark ("Haggle," Public Sans SemiBold, Ink) fade in once at 200ms and hold. Never a spinner, never a splash animation loop.

FIXES TO CORNER COPY'S OWN CONTRADICTIONS (both flagged as fatal-flaw-adjacent by the fidelity judge — corrected, not reconsidered):
(a) Add a Bill's category picker loses its enclosing border box entirely. The three category rows (Phone / Internet or cable / Auto or home insurance) are separated only by 1px Rule hairlines, full-bleed to the 24dp margins, with no drawn rectangle around the group — matching Corner Copy's own "no card grid anywhere" principle exactly. Selection is shown by a Corner-teal Spine tick (2px, 16dp tall) at the left edge of the selected row plus a weight shift on its label (Public Sans Regular → SemiBold), never by a fill or box.
(b) Remove the middle dot from the provider/category meta line everywhere it appears ("Xfinity · Internet & cable" → two stacked lines: "Xfinity" at H1 weight, "Internet & cable" directly beneath at the small/meta style, Ink 65%). No middle dots, no spaced em-dashes, anywhere in the shipped copy.

## design_tokens
COLOR (all hex locked; contrast ratios computed against their actual stated use, not assumed):
- Paper (background, all "writing" screens: Home, Add Bill, Bill Detail, Paywall, Settings) — #F3F2ED. This is the ONLY background in the app; Script Result also uses Paper (no second dark room — this is the deliberate divergence from House Lights that fixes its daylight-legibility flaw).
- Ink (primary text, icons, default Spine state) — #1B1D18. Ink-on-Paper = 15.1:1 (computed), passes AAA for all text sizes.
- Corner (the one bold action/trust color: buttons, Spine default, links, selected-row tick, focus ring, teal reveal-sweep) — #2F5D53. White-on-Corner = 7.46:1 (button labels always white, never teal-on-teal). Corner-text-on-Paper = 6.66:1 — safe for links/labels down to 13px.
- Brass-Large (money color, ≥24px / bold ≥18.66px only — the target-ask hero number, the tracker total headline) — #9C6B2E. Brass-Large-on-Paper = 4.11:1 — passes AA-large (3:1 floor) with margin, does NOT pass AA-normal, so it is NEVER used below 24px regular / 18.66px bold.
- Brass-Small (every OTHER dollar figure: inline running-text amounts, the paywall price line at 15-20px, footnote figures) — #7A5220, a darkened variant of the same hue/family. Brass-Small-on-Paper = 5.88:1 — passes AA-normal. Money is always visually "the brass family" at a glance; which exact shade is a size-driven accessibility rule, not a design inconsistency, and is documented as such in the design README.
- Friction (objection cue in the Spine + all real form/purchase errors) — #A23B32. Friction-on-Paper = 5.85:1, passes AA-normal at any body size used.
- Rule (structure only: dividers, input underlines, inactive Spine segments, disabled-state neutral fill) — #D8D4C7. Never used for text.
No other colors exist in the system. Seven tokens total (Paper, Ink, Corner, Brass-Large, Brass-Small, Friction, Rule) — down from the original spec's implicit six-plus-opacity-tricks, because opacity-as-a-color-substitute is banned per the accessibility floor below.

TYPOGRAPHY (unchanged from Corner Copy's original scale — it already survived both the originality and usability lenses cleanly):
- Hero number (target ask, tracker total, Brass-Large): IBM Plex Mono Medium 500, 44px / line-height 48 / letter-spacing -0.5.
- Struck-through "before" amount (new, grafted role): IBM Plex Mono Regular 400, 20px / 24 / 0, Ink 65%, single strikethrough rule, positioned immediately left of the hero number on the same baseline.
- Screen title / H1: Public Sans SemiBold 600, 28px / 34 / -0.3, Ink.
- Section header / H2 (one of the five fixed beats only): Public Sans SemiBold 600, 17px / 22 / 0, Ink.
- Body text: Public Sans Regular 400, 16px / 24 / 0.1, Ink.
- Script line (verbatim quote, inside the Spine): IBM Plex Mono Regular 400, 17px / 26 / 0, Ink. Column width capped at ~38 characters (grafted explicitly from House Lights' arm's-length teleprompter reasoning, tighter than the general 58-char product ceiling).
- Inline dollar figure in running text: IBM Plex Mono Medium 500, 15px / 22 / 0, Brass-Small (never Brass-Large).
- Small/meta (helper text, footnotes, source citations, the two-line provider/category stack's second line): Public Sans Regular 400, 13px / 18 / 0.15, Ink 65% — this is the ONLY sanctioned use of reduced opacity in the whole system, reserved for genuinely secondary meta copy, never for content the user must read accurately under stress (this explicitly overrides House Lights' 55%-opacity objection text, which is banned).
- Button label: Public Sans SemiBold 600, 16px / 20 / 0.2. No appended arrow glyph, ever.
- Input field text: Public Sans Regular 400, 17px / 22 / 0; amount fields use Plex Mono Medium 20px.
Two families only: Public Sans (@expo-google-fonts/public-sans, static weight files: Regular, SemiBold) and IBM Plex Mono (@expo-google-fonts/ibm-plex-mono, static weight files: Regular, Medium). Four font files total.

SPACING SCALE (4px base grid): 4, 8, 12, 16, 24, 32, 48. Side margins: 24dp fixed on every screen. Vertical rhythm between major form blocks: 32dp. Between a label and its field/value: 8dp. Between Script Result beats (across a hairline): 24dp above and below the rule.

RADIUS: Interactive controls only (buttons, text-input underline's focus-state hit target, category rows' tap target) — 10px. Passive content (script text blocks, list rows, footnotes, the reveal-sweep bar) — 0px, no radius, no shadow. This is a hard binary, not a scale: a surface is either fully square (informational) or 10px (tappable) — nothing in between.

ELEVATION: Zero box-shadow anywhere in the entire app, on any surface, in any state. Grouping and hierarchy come exclusively from whitespace, the Rule hairline, and the Spine. This is non-negotiable per both the client brief and all three directions' shared principle.

BORDERS: 1px Rule hairlines mark real content/section boundaries only (never decorative, never a full box around a group). Text inputs use a 1px Rule underline (not a bordered box). Focus states thicken to 2px Corner (inputs) or add a 2px Corner outline offset 2dp (buttons/rows) — color change plus weight change together, never color alone.

## screen_specs
SCREEN 1 — HOME / BILL LIST (Paper)
┌──────────────────────────────────────┐
│  Haggle                    [Settings] │  H1 28/34 Ink, settings as plain text link top-right
│                                        │
│  Money saved so far          — Premium│  Brass-Large hero row if unlocked;
│  $ 0  (disabled outline, Ink 50%,     │  if locked: outline-only Rule box,
│   Rule fill, "— Premium" trailing)    │  Ink 50% label, "— Premium" suffix, always visible
│  ──────────────────────────────────   │  hairline
│  (list of saved bills, one row each,  │  each row: provider (SemiBold 16),
│   separated by Rule hairlines, no     │  category + last-called-date (13, Ink 65%),
│   cards, no shadows)                  │  no thumbnails/icons
│                                        │
│  No bills yet.                        │  EMPTY STATE ONLY, centered block,
│  [small Corner Spine tick]            │  upper third, Body 16/24
│                                        │
│ ┌────────────────────────────────────┐│
│ │           Add a bill                ││  full-width, Corner fill, 10px radius,
│ └────────────────────────────────────┘│  sticky bottom on scroll
└──────────────────────────────────────┘
Component breakdown: HeaderRow, SavingsTrackerRow (gated), BillListRow[] | HairlineDivider, EmptyState, PrimaryButton (sticky).

SCREEN 2 — ADD A BILL (Paper)
┌──────────────────────────────────────┐
│ ←  Add a bill                         │  H1
│                                        │
│  Which bill is this?                  │  Body
│  ┃ Phone                              │  Spine tick = selected, no box, full-bleed rows
│    Cell or landline service            │  meta 13/18 Ink65
│  ──────────────────────────────────   │  hairline between rows, NOT a border box
│    Internet or cable                   │
│    Broadband, TV, or bundle            │
│  ──────────────────────────────────   │
│    Auto or home insurance              │
│    Vehicle, renters, or homeowners     │
│                                        │
│  Provider                             │  small label 13
│  Comcast Xfinity______________         │  underline input (Rule, 2px Corner on focus)
│                                        │
│  Current monthly amount               │
│  $ 89.00 (Plex Mono 20)_______         │
│                                        │
│  ⌄ Add more detail (optional)         │  collapsed toggle: tenure, trigger radios,
│                                        │  competitor quote — same underline pattern
│ ┌────────────────────────────────────┐│
│ │        Generate script              ││  disabled: Corner @35% fill, Ink@50% label,
│ └────────────────────────────────────┘│  until Category+Provider+Amount valid
└──────────────────────────────────────┘
Component breakdown: CategoryRow[] (no container), TextInputUnderline, AmountInputMono, CollapsibleSection (tenure TextInputUnderline, trigger RadioRow[], competitor TextInputUnderline), PrimaryButton (disabled-state variant).

SCREEN 3 — SCRIPT RESULT (Paper — the hero, full spec below in hero_moment_spec)
┌──────────────────────────────────────┐
│ ←                              Save    │  minimal chrome
│  Xfinity                               │  H1 28/34
│  Internet or cable                     │  meta 13/18 Ink65 (two lines, no dot)
│                                        │
│  $ 89 (struck, 20/24, Ink65)  → $62/mo │  Brass-Large 44/48, new grafted readout row
│                                        │
│  Ask for the Retention Department      │  H2 17/22 (beat 1)
│  Say "cancel my service" at the first  │  Body 16/24
│  menu — it routes you past general     │
│  support.                              │
│  ──────────────────────────────────    │  hairline (real boundary: end of setup)
│┃ What to say                           │  H2 (beat 2) — Spine begins here, Corner
│┃ "Hi, I've been with Xfinity for       │  Plex Mono 17/26, capped ~38 chars/line
│┃  3 years and my bill just jumped      │
│┃  to $89. I'd like to see what you     │
│┃  can do to keep me as a customer."    │
│┃                                        │
│┃ If they push back                     │  H2 (beat 4) — Spine turns Friction here
│┃ If they say: "That's the best rate."  │
│┃ Say back: "I have a written quote     │
│┃  for $58/mo from AT&T for the same    │
│┃  speed. Can you match or beat it?"    │  Spine returns to Corner after resolution
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │  heavier rule = mandatory close boundary
│  Before you hang up                    │  H2 (beat 5)
│┃ "Can you email me a confirmation of   │
│┃  the new rate and the start date?"     │
│                                        │
│  Estimated $180–$310/yr, based on FCC  │  13/18 Ink65 footnote, sourced/ranged
│  complaint data + retention medians.   │
│ ┌────────────────────────────────────┐│
│ │           I made the call            ││  sticky bottom CTA
│ └────────────────────────────────────┘│
└──────────────────────────────────────┘
Component breakdown: BeforeAfterReadout (new), BeatSection×5 (Ask-for / What-to-say / TargetAsk-is-folded-into-readout / IfTheyPushBack / BeforeYouHangUp), Spine (color-stateful vertical rule component spanning beats 2-5), HairlineDivider, HeavyDivider (mandatory-close only), SourceFootnote, PrimaryButton (sticky).

SCREEN 4 — PAYWALL (Paper, triggered on 2nd bill or reminder/tracker tap)
┌──────────────────────────────────────┐
│ ✕                                      │  plain close
│  Your next bill is worth negotiating   │  H1
│  too.                                  │
│  Your first script was free. Premium   │  Body
│  removes the one-bill limit.           │
│┃ Unlimited bills and scripts            │  Spine continues (Corner only, no
│┃ Renegotiation reminder in 6–12 months  │  objection state on this screen)
│┃ Your total savings, tracked            │
│  ──────────────────────────────────    │
│  Haggle Premium                        │  H2
│  $ 4.99 /mo (live via getOfferings())  │  Brass-Small 20px (price, small-size rule)
│  Cancel anytime.                       │  13/18 Ink65
│ ┌────────────────────────────────────┐│
│ │    Subscribe — $4.99/mo              ││  Corner fill; loading = dim+charging-line
│ └────────────────────────────────────┘│  graft (see interaction_states)
│           Restore purchases            │  plain centered link
│  Some subscriptions fund free access   │  13/18 Ink65
│  for people in financial hardship.     │
└──────────────────────────────────────┘
Component breakdown: CloseButton, PaywallHeadline, SpineFeatureList (Corner-only variant), PriceRow, PrimaryButton (async-loading variant), RestoreLink, LegalFootnote.

SCREEN 5 — BILL DETAIL / SAVED SCRIPT: identical component set to Script Result, plus an outcome-logging block ("New rate" AmountInputMono, "Date" TextInputUnderline, "Save outcome" button that swaps label to "Saved" for 1.2s per Corner Copy's original success spec) appended below the footnote, above the sticky CTA.

SCREEN 6 — SETTINGS: plain Rule-separated list rows (Restore purchases, Manage reminder, About, Legal/disclaimer) — same row pattern as Home's bill list, no new components.

## hero_moment_spec
The Script Result must win twice: instantly for the user holding the phone, and within a few seconds of scrubbed video for a judge. Sequence, precisely timed:

T+0ms — User taps "Generate script" on Add a Bill. The local engine has already computed the full ScriptResult object synchronously (no await, no network) before the tap handler's next frame — there is nothing to wait for, which is the entire point.

T+0–150ms — GRAFTED REVEAL: a solid Corner-teal (#2F5D53) bar, full device width, sweeps top-to-bottom across the screen in 150ms (ease-out). The Script Result's content is already mounted and laid out beneath it before the sweep starts; the bar's downward motion progressively uncovers the finished page rather than the page rendering after the bar passes. This is the app's one full-frame, binary "something happened" event — registers on a scrubbed timeline and even muted, closing the demo-impact gap against House Lights without ever leaving the light Paper surface (so the real-world daylight-glare risk that sank House Lights' usability score never enters this design).

T+150–650ms — CASCADE (Corner Copy's original spec, unchanged): once the sweep clears a section, that section's content fades in top-to-bottom in one continuous pass (not per-line stagger) — the before/after readout first, then "Ask for," then the hairline, then "What to say" and its Spine tick drawing downward alongside the text, each beat ~80-120ms behind the last. By 650ms the page is fully static.

T+650ms onward — Nothing moves again on this screen. Hierarchy is carried entirely by type scale and the Spine, never by color-blocking, boxes, or repeated motion.

CONTENT ORDER (fixed, matches real call chronology per the usability lens' strongest finding — you navigate the phone menu before you negotiate the number):
1. Before/after readout — "$89" struck through (Ink 65%, Plex Mono 20px) beside "$62/mo" (Brass-Large, Plex Mono 44px) on one baseline. This is the money moment at a glance; a judge who watches only 3 seconds of this screen sees the entire value proposition in one frame.
2. Ask for [department] + IVR trick — first prose beat, because it's the first thing the user actually needs when the call connects.
3. What to say — the opening line, inside the Spine, Plex Mono, capped ~38 chars/line.
4. If they push back — one or two If-they-say/Say-back pairs, inside the Spine, which turns Friction-red for exactly the "if they say" line and back to Corner for "say back."
5. Before you hang up — the mandatory written-confirmation close, set off by a heavier rule (not just a hairline) because it is non-negotiable on every script.
6. Estimated savings — sourced, ranged, in the small/meta style, never presented as a bare or guaranteed figure.

No sixth beat is permitted (grafted rule from House Lights). For the demo video specifically: because generation is instant and the reveal is a fixed 650ms full-frame event, every take is frame-identical — the video can hold one continuous shot (tap → sweep → cascade → a slow scroll down a real script with a named department and provider) with zero cuts needed to hide a loading state, and zero risk of a network hiccup ruining the one take that gets submitted.

## motion_spec
Exactly two orchestrated moments in the entire app, and nothing else:
1. Script generation (detailed above): the 150ms Corner-teal reveal sweep + 500ms cascade, total 650ms, on Add-a-Bill → Script Result only. Fires once per generation.
2. Purchase success: the Subscribe button's label swaps in place to a checkmark + "Subscribed" for 600ms (Corner Copy's original spec, unchanged), then the paywall sheet dismisses and the previously-disabled reminder toggle and tracker rows resolve from their Rule/Ink-50% disabled state to full Ink/Brass-Large color in place — using the same fade-in-place technique as the cascade above (not a new animation invented for this moment), so the app has exactly one motion "language," reused meaningfully rather than two unrelated effects.

ACTION-RESPONSE MOTION (not "orchestrated," always tied 1:1 to a user gesture, never ambient):
- Button press: opacity 1.0 → 0.85 on press-in, back on release. No scale/bounce.
- Text input focus/blur: underline thickness 1px → 2px and color Rule → Corner over 100ms linear, reversed on blur. No glow, no shadow.
- Async button (RevenueCat calls only): fill Corner → Rule-grey, label Ink 50%, plus the grafted 1px Corner charging-line looping left-to-right along the bottom edge every ~900ms until resolution.
- Success label swap ("Saved," "Subscribed"): instant crossfade, 150ms, no bounce.
- Category row / radio selection: Spine tick appears instantly (no fade) with a 100ms opacity ramp on the label weight change only.

DELIBERATELY STATIC (no animation, ever): the Home bill list on scroll, the Spine's draw is the only per-element sequencing anywhere (no other list, card, or row ever staggers in), disabled-state transitions (they snap, because a re-enabling recompute is itself information, not decoration), and the app icon/splash (a single static wordmark, never a loop, per the grafted cold-start rule).

REDUCED MOTION: When the OS "Reduce Motion" accessibility setting is on, both orchestrated moments collapse to their end-state instantly (no sweep, no cascade, no crossfade — the Script Result and the post-purchase UI simply render in their final form the frame after the trigger). Action-response opacity/color transitions stay (they are not classified as "motion" for this purpose, being sub-150ms state changes rather than animated sequences) but any looping element (the charging-line) is replaced by a static "Working…" label in Ink 50% while the RevenueCat call is in flight.

## interaction_states
LOADING — The only asynchronous operations in the entire app are the three RevenueCat calls (getOfferings, purchasePackage, restorePurchases). Script generation is local/synchronous and has no loading state by construction. During any RevenueCat call, the triggering button keeps its label in place, dims its fill from solid Corner to flat Rule-grey with Ink-50% label text, and runs the grafted 1px Corner charging-line left-to-right along its bottom edge on a ~900ms loop; the button is non-interactive (no press feedback) until the call resolves. getOfferings() price text, if not yet resolved when the paywall opens, shows as a Rule-grey bar with one single ~1.2s ease opacity pulse (not an infinite shimmer sweep) then holds. Cold app start reads AsyncStorage against a bare Paper screen for up to 150ms; only past that does a single static wordmark fade in once and hold — never a spinner, never a looping indicator, anywhere in the app.

EMPTY — Home with zero bills: a short, calm, left-aligned block in the upper third — "No bills yet." (Body 16/24, Ink) with a small Corner Spine tick beside it as the only brand mark — then the primary "Add a bill" button beneath with generous whitespace. No illustration, no mascot, no dashed-outline placeholder.

ERROR — Inline only, directly beneath the offending field or action, in Friction (#A23B32) 13px text, sentence case, stating the fact and the fix ("Enter an amount greater than $0," "That didn't go through — try again or restore purchases"). The field's underline (normally 1px Rule) turns 2px Friction as the only additional visual escalation. No toast, no banner, no shake, no red glow/halo.

SUCCESS — No modal, no confetti, anywhere. Logging a call outcome: the button's own label swaps from "Save outcome" to "Saved" for 1.2s (crossfade, not a new animation), then returns to Bill Detail with the tracker number updated using the same in-place resolve as purchase success. Purchase success: the Subscribe button shows a checkmark + "Subscribed" for 600ms, the paywall dismisses, and `customerInfo.entitlements.active['premium']` flips the reminder toggle and tracker rows from disabled to full color live, with no app restart.

DISABLED — Premium-gated rows (reminder toggle, savings tracker) render fully visible at all times in a quiet disabled state: Rule-grey outline only (no fill), Ink-50% label, trailing "— Premium" suffix in Ink-50% — the value is always shown, never hidden, so the paywall explains a real seen feature rather than concealing one. "Generate script" and "Subscribe" keep their exact shape, hue, and label; only fill opacity drops to Corner @35% and label opacity to Ink @50% while required inputs are invalid or an async call is pending — the control stays recognizably itself rather than flipping to a generic grey, and going enabled is a solid-fill snap, not a fade (the state change itself is the affordance).

FOCUS — Every focusable control gets two simultaneous cues, never color alone (hard accessibility requirement, not a style preference): text inputs thicken their underline from 1px Rule to 2px Corner AND their label shifts from Ink-65% to full Ink; buttons and rows gain a 2px Corner outline offset 2dp AND a faint 10%-opacity Corner fill wash inside their existing shape. No glow, no drop shadow, no box-shadow halo (explicitly the "glowing AI effect" the brief bans). Verified for physical-keyboard and Android switch-control navigation, per Corner Copy's original accessibility statement.

## accessibility_floor
CONTRAST — Every text/background pairing in the locked token system is computed above WCAG AA for its actual use size, not assumed:
- Ink (#1B1D18) on Paper (#F3F2ED): 15.1:1 — AAA at all sizes.
- Corner (#2F5D53) text/links on Paper: 6.66:1 — AA at all sizes down to 13px.
- White button labels on Corner fill: 7.46:1 — AAA.
- Brass-Large (#9C6B2E) on Paper: 4.11:1 — AA-large only (3:1 floor); consequently Brass-Large is HARD-RESTRICTED to ≥24px regular or ≥18.66px bold text — the target-ask hero number and the tracker headline, nothing smaller.
- Brass-Small (#7A5220) on Paper: 5.88:1 — AA-normal; used for every other dollar figure (inline running text, the paywall price line, footnotes) so money is never rendered under 4.5:1 anywhere in the app.
- Friction (#A23B32) on Paper: 5.85:1 — AA-normal, safe for 13px error captions.
This is a hard build-time rule, not a suggestion: a lint/review pass must reject any component that renders Brass-Large below the 24px/18.66px-bold floor.

OPACITY-AS-CONTRAST BAN — Ink-65% and Ink-50% are reserved exclusively for genuinely secondary meta copy (timestamps, provider/category sub-line, disabled-state labels) that the user does not need to read with full accuracy under stress. It is explicitly forbidden to render any objection-handling line, script body text, or dollar figure at reduced opacity — this directly overturns House Lights' 55%-opacity treatment of "if they say" lines, which both usability and demo-impact judges flagged as counter to the product's purpose.

TOUCH TARGETS — Minimum 44×44dp hit area on every interactive element (buttons, category rows, radio rows, the Spine's tappable "read more" affordances if any, Restore Purchases link). Category rows and list rows use their full row height (min 48dp) as the hit target, not just the visible text.

DYNAMIC TYPE — All type sizes are defined in dp/sp and must scale with the OS font-size setting; RN's `allowFontScaling` stays true everywhere except the 44px hero number and the 28px H1, which cap their growth at 1.3× to prevent the Script Result's fixed-width Plex Mono script column from wrapping mid-word at extreme scale factors — verified against the ~38-char mono column width at 1.3× scale before locking that cap. No text is ever set in a fixed-height container that would clip at larger font sizes; sections grow vertically instead.

REDUCED MOTION — Both orchestrated moments (script-reveal sweep+cascade, purchase-success resolve) collapse to their instant end-state when the OS reduced-motion flag is set, per the motion_spec above. This is tested, not assumed — RN's `AccessibilityInfo.isReduceMotionEnabled()` gates both animation paths at the component level.

COLOR-INDEPENDENCE — No state anywhere in the app is communicated by color alone: focus pairs color with weight/thickness, disabled pairs color with a trailing text suffix ("— Premium"), error pairs color with an inline text caption, and the Spine's Friction-red objection state is paired with the "If they say" / "Say back" text labels themselves (so a colorblind user or a screen-reader user gets the same information from the words as from the rule color).

SCREEN READER — Every screen gets a logical heading order matching the visual H1→H2 hierarchy (Screen title as `header`, each of the five fixed beats as its own accessible heading), the Spine is marked `accessibilityElementsHidden` (it is a sighted-user visual aid duplicating information already in the "If they say / Say back" text, not new information), and the before/after readout is exposed as one combined accessibility label ("Current bill 89 dollars a month, target 62 dollars a month") rather than two separate unlabeled numbers.

## implementation_notes
FONTS — Load exactly four static weight files via `expo-font` at app boot (before first render, with a bare-Paper 150ms allowance per the cold-start rule): `PublicSans-Regular.ttf`, `PublicSans-SemiBold.ttf`, `PlexMono-Regular.ttf`, `PlexMono-Medium.ttf`, sourced from `@expo-google-fonts/public-sans` and `@expo-google-fonts/ibm-plex-mono`. Use the static per-weight packages, not the variable-font builds, so bundle size and exact rendered weight are both predictable and reviewable in a public repo. Reference Expo SDK 57's exact `expo-font`/`useFonts` API at https://docs.expo.dev/versions/v57.0.0/sdk/font/ per the repo's AGENTS.md instruction before wiring this up — do not assume an older SDK's API shape.

PRIMITIVES — Build every screen from `View`, `Text`, `Pressable` (not `TouchableOpacity`, which is legacy), `TextInput`, and `ScrollView`/`FlatList` for the bill list. No third-party UI kit (no Tamagui/NativeBase/Paper) — the entire visual system is flat fills, 1px hairlines, and text, which plain RN primitives express directly and which keeps the open-source repo legible to judges as hand-built rather than a component-library reskin. The Spine is a single absolutely-positioned `View` (2px wide, full height of its script block) whose `backgroundColor` is driven by a small array of `{color, startY, endY}` segments computed from the ScriptResult's objection-pair boundaries — not a set of separately-colored per-line borders, so it reads as one continuous stroke.

ANIMATION — Use RN's built-in `Animated` API (or `react-native-reanimated` if already a project dependency — check `package.json` before adding a new native dependency for two animations) for exactly the two orchestrated moments and the handful of action-response transitions listed above. The reveal sweep is a single `Animated.View` (full-width, Corner-teal fill) animating `translateY` from `-height` to `height` (or height→0 via a clip mask) over 150ms; do not implement it as a series of per-section opacity animations pretending to be a sweep. Gate every animated path behind `AccessibilityInfo.isReduceMotionEnabled()`.

STATE / PERSISTENCE — AsyncStorage for the first-script-free flag, saved bills, saved scripts, and self-reported outcomes; no backend, per spec. Wrap `Purchases.configure()` in a module-level guard (`let configured = false`) to survive Fast Refresh/StrictMode double-invocation. Read the RevenueCat Test Store key from `.env` via `expo-constants`/`app.config.ts` `extra` — never hardcode it, never log it, and never let a `console.log` of `customerInfo` or SDK config reach a committed file or a demo-video-visible debug overlay.

WHAT TO AVOID — No `boxShadow`/`shadowColor`+`elevation` anywhere (zero drop shadows is a hard rule across the whole spec). No `LinearGradient` (no gradients anywhere in any direction's spec, and none should be introduced here either). No `borderRadius` values outside the two locked options (0 or 10px) — do not let a component library's default (commonly 4, 6, 8, 12, 16) leak in. No web-only CSS (`box-shadow` strings, `filter: blur()`, CSS gradients as strings) — this is React Native, not a WebView; every visual effect must be expressible as RN `style` props or a `View` composition. No monospace font anywhere except the two sanctioned Plex Mono roles (spoken/verbatim script lines, dollar figures) — never for labels, dates, or metadata, which is the exact generic-AI tell this system is built to avoid. No middle-dot-joined meta strings, no spaced-em-dash "WORD — fragment" headers, no tracked-out ALL-CAPS labels, no arrow glyph appended to any button label — enforced as a copy-review checklist item before each screen ships, not just a design intention.

TESTABILITY / DEMO SAFETY — Because script generation is pure and synchronous (`lib/scriptEngine.ts`), write it as a plain function with no React/RN import at all, unit-testable in isolation and guaranteed to render identically on every take of the demo video. Rehearse the RevenueCat purchase flow multiple times against the Test Store key before recording the final take, since it is the one live-network dependency in the whole recorded sequence — the design's job (the dimmed-fill + charging-line loading state) is to make any real-world latency look intentional rather than broken, but a slow/flaky Test Store response on the one submitted take is a production risk no design choice fully eliminates.