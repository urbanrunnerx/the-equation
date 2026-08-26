# The Equation

A math idle about a growing function *f(t)*. Original game, inspired by the *feel* of Exponential Idle (not a clone: different name, art, costs, and prestige curve).

You do not click to produce. Time integrates the equation. You spend *f(t)* on variables that multiply the exponent, then prestige into **b** and **μ**. Later: **Rewrite** into **φ**, **Stars** from milestones, and **Theories** that produce **τ**.

## Open it

Play in the browser: **https://urbanrunnerx.github.io/the-equation/**

No build step. No accounts. On a phone, open that URL and use **Add to Home Screen** (standalone, charcoal/gold). Relative `css/`, `js/`, and `fonts/` paths also work from a local `file://` copy.

**Local:** open `index.html` in Chrome, or serve the folder:

```bash
cd /workspace/formula-idle
python3 -m http.server 8765
```

Then open `http://localhost:8765/`.

Files: `index.html` + `css/style.css` + `js/*.js` + bundled Liberation fonts + `manifest.webmanifest` + `icon-180.png`.

## How to play

1. *f(t)* starts at 10, enough to buy **x** immediately. Spending *divides* *f* by the cost, then growth continues from the new *f*.
2. Every 10 levels, a variable gets a stepwise bump.
3. **y**, **z**, **u**, **v** unlock as *f* this run climbs. Each multiplies the exponent. **w** and **α** are later still: they need a Stars-shop purchase *and* high *f*.
4. On the Upgrades tab: faster **dt**, cheaper **x**. Time is the engine — there is nothing you must click.
5. When Δb is meaningful (progress bar on Prestige), prestige: reset *t*, *f*, and variable levels; keep **b** and **μ**. Next run is faster. Six μ lemmas (finite ranks) unlock after the first prestige and survive Rewrite.
6. Autobuy (Equation tab) appears after you have prestiged once (or earlier if you buy it with stars). It buys toward the next ×10 milestone on one variable per tick, plus at most one upgrade.
7. **Stars** come from achievements (first buy, *f* milestones, prestiges, rewrites, play time, publications, …), never from clicking. Spend them in the Stars shop: extra variables, early autobuy, Buy 10, notation, persistent dt, a small capped production lemma, auto-prestige.
8. After several prestige cycles (8 prestiges and **b** ≥ 8, then enough extra **b** that Δφ ≥ 0.45), **Rewrite**: reset *t*, *f*, variables, f-upgrades, and *b* (returns to 1). Gain **φ**, which is the power on the variable product. μ lemmas, stars, and theories remain.
9. After the first rewrite, the **Theories** tab opens. Two mini-equations (Recurrence, Coupled rates) tick while active. **Publish** resets that theory and raises its τₙ. Main **τ** = (1+τ₁)(1+τ₂).

Keyboard: **M** buy max on the last hovered variable, **P** prestige (opens the confirm modal; P again confirms), **R** rewrite (same pattern). **1–7** switch tabs.

## Layers (when they open)

| Layer | Gate | Keeps | Resets |
| --- | --- | --- | --- |
| Prestige (b, μ) | log₁₀ f ≳ 12 | b, μ, stars, φ, theories | t, f, variables, f-upgrades |
| Rewrite (φ) | 8+ prestiges, b ≥ 8, and Δφ ≥ 0.45 | φ, μ lemmas, stars, theories | t, f, variables, f-upgrades, **b → 1** |
| Theories (τ) | first rewrite | theory τₙ across publishes | the published theory's currencies |
| Stars | achievements, any time | stars & shop through prestige/rewrite | wipe equation only |
| w, α | Stars shop + high f this run | — | with variables on prestige/rewrite |

## Notation

- Below 1,000,000: `12,345`
- Then scientific: `1.23e9` = 1.23 × 10^9
- Huge exponents: `ee3` = 10^(10^3) = 10^1000

*f(t)* is stored as log10 (plus a layer for ee-scale), never as a raw JavaScript `Number`.

## Save

Autosaves to `localStorage` key `the-equation-v2` every few seconds and on prestige/rewrite. If that key is empty, a one-shot migrate reads `the-equation-v1` and writes v2. Missing φ, τ, stars, w, α default to 0/1. Stats tab: export / import JSON (import also accepts an `EQ1.` save code), **Copy save code** (LZ-compressed, prefix `EQ1.`, for texting between devices), and **Wipe equation** (confirm modal; toast: *The chalkboard is clean*). Offline progress is granted at the last known rate, capped at 8 hours, with a recap toast. Active theories also tick while away.

## Formula

Early game (locked factors omitted, treated as 1):

\[
f(t + dt) = f(t) \cdot \exp(b \cdot x \cdot dt)
\]

After Rewrite and theories, φ powers only the variable product (dt stays linear; τ multiplies):

\[
f(t + dt) = f(t) \cdot \exp(b \cdot (x \cdot y \cdot \ldots)^{\varphi} \cdot \tau \cdot dt)
\]

φ starts at 1; τ starts at 1. A small Stars-shop multiplier is a silent coefficient (shown on the Stars tab, not in the live formula). *dt* starts below 1 real-second and is an upgrade, so *t* is equation time.
