# Occlusion test fixture

`fixture.html` reproduces the four ways a page can silently swallow an
automated click. It is the regression check for ChromeBoost's cursor upgrade.

| Case | Element | What blocks it |
|---|---|---|
| Invisible click-catcher | `#btn-catcher` | `#catcher` — full-viewport, `background: transparent`, `z-index: 900` |
| Modal backdrop | any | `#scrim` — full-viewport, `rgba(0,0,0,.45)` |
| Pinned bar | `#btn-sticky` | `#stickybar` — `position: fixed`, bottom 90px |
| Shadow DOM | `#host` → `#inner` | open shadow root; `document.elementFromPoint` stops at the host |

## Running it

Serve the directory and load the fixture:

```bash
cd tests/overlays && python3 -m http.server 8931
```

Then, from a browser context with ChromeBoost's `hittest` module available:

```js
const btn = document.getElementById('btn-catcher');
const naive = document.elementFromPoint(...centreOf(btn));  // → div#catcher  (the bug)
const clear = CB.findClearPoint(btn);                        // → occluded, names div#catcher
const p = CB.pierceAt(x, y, btn);                            // → point now resolves to the button
CB.unpierce(p.token);                                        // → DOM byte-identical again
```

To exercise the exact shipped code rather than a copy, bundle the module and
load it as a script:

```bash
cd packages/extension
echo 'import * as H from "./src/content/hittest.js"; globalThis.CB = H;' > cb-test-entry.ts
npx esbuild cb-test-entry.ts --bundle --format=iife --outfile=../../tests/overlays/cb-hittest.js
rm cb-test-entry.ts
```

`cb-hittest.js` is a build artifact — do not commit it.

## Expected results

| Case | `found` | `via` | `probes` | Notes |
|---|---|---|---|---|
| Clear button | `true` | `target` | 1 | centre works, no false positive |
| Shadow inner | `true` | `target` | 1 | `deepElementFromPoint` reaches `button#inner`, plain stops at `div#host` |
| Half-covered | `true` | `target` | ~5 | grid search finds the uncovered edge — no pierce or scroll needed |
| Invisible catcher | `false` | — | 21 | `occluder: div#catcher`, `transparent: true`, `full_screen_scrim: true` |
| Sticky bar | `false` → `true` | `target` | 21 → 1 | `pinned: true`; `scrollClearOfPinned` moves the page, then it resolves |

After every pierce, `unpierce` must leave the occluder's `style` attribute
exactly as it was — including removing the attribute entirely when the element
had none to begin with.
