# The Equation

A math idle about a growing function *f(t)*. Original game, inspired by the *feel* of Exponential Idle (not a clone: different name, art, costs, and prestige curve).

You do not click to produce. Time integrates the equation. You spend *f(t)* on variables that multiply the exponent, then prestige into **b** and **μ**. Later: **Rewrite** into **φ**, **Stars** from milestones, and **Theories** that produce **τ**.

## Open it

No build step. No network. No accounts.

**Fastest:** in Chrome,

```
file:///workspace/formula-idle/index.html
```

Or serve the folder:

```bash
cd /workspace/formula-idle
python3 -m http.server 8765
```

Then open `http://localhost:8765/`.

Files: `index.html` + `css/style.css` + `js/*.js` + bundled Liberation fonts.

## How to play

1. *f(t)* starts at 10, enough to buy **x** immediately. Spending *divides* *f* by the cost, then growth continues from the new *f*.
2. Every 10 levels, a variable gets a stepwise bump.
3. **y**, **z**, **u**, **v** unlock as *f* this run climbs. Each multiplies the exponent. **w** and **α** are later still: they need a Stars-shop purchase *and* high *f*.
4. On the Upgrades tab: faster **dt**, cheaper **x**. Time is the engine — there is nothing you must click.
5. When Δb is meaningful (progress bar on Prestige), prestige: reset *t*, *f*, and variable levels; keep **b** and **μ**. Next run is faster. Two μ lemmas unlock after the first prestige.
6. Autobuy (Equation tab) appears after you have prestiged once (or earlier if you buy it with stars). It buys toward the next ×10 milestone on one variable per tick, plus at most one upgrade.
7. **Stars** come from achievements (first buy, *f* milestones, prestiges, play time, …), never from clicking. Spend them in the Stars shop: extra variables, early autobuy, a small permanent production multiplier, auto-prestige.
8. After a few prestiges and enough **b**, **Rewrite**: reset *t*, *f*, variables, f-upgrades, and *b* (returns to 1). Gain **φ**, which multiplies the exponent. μ lemmas, stars, and theories remain.
9. After the first rewrite, the **Theories** tab opens. Two mini-equations (Recurrence, Coupled rates) tick while active. **Publish** resets that theory and raises its τₙ. Main **τ** = (1+τ₁)(1+τ₂).

Keyboard: **M** buy max on the last hovered variable, **P** prestige (opens the confirm modal; P again confirms), **R** rewrite (same pattern). **1–7** switch tabs.

## Layers (when they open)

| Layer | Gate | Keeps | Resets |
| --- | --- | --- | --- |
| Prestige (b, μ) | log₁₀ f ≳ 12 | b, μ, stars, φ, theories | t, f, variables, f-upgrades |
| Rewrite (φ) | 3+ prestiges and b ≥ 2.6 | φ, μ lemmas, stars, theories | t, f, variables, f-upgrades, **b → 1** |
| Theories (τ) | first rewrite | theory τₙ across publishes | the published theory's currencies |
| Stars | achievements, any time | stars & shop through prestige/rewrite | hard reset only |
| w, α | Stars shop + high f this run | — | with variables on prestige/rewrite |

## Notation

- Below 1,000,000: `12,345`
- Then scientific: `1.23e9` = 1.23 × 10^9
- Huge exponents: `ee3` = 10^(10^3) = 10^1000

*f(t)* is stored as log10 (plus a layer for ee-scale), never as a raw JavaScript `Number`.

## Save

Autosaves to `localStorage` every few seconds and on prestige/rewrite. Save schema **v2** (v1 files still load: missing φ, τ, stars, w, α default to 0/1). Stats tab: export / import JSON, hard reset (with confirm). Offline progress is granted at the last known rate, capped at 8 hours, with a recap toast. Active theories also tick while away.

## Formula

Early game (locked factors omitted, treated as 1):

\[
f(t + dt) = f(t) \cdot \exp(b \cdot x \cdot dt)
\]

After Rewrite and theories:

\[
f(t + dt) = f(t) \cdot \exp(b \cdot \varphi \cdot \tau \cdot x \cdot y \cdot \ldots \cdot dt)
\]

φ starts at 1; τ starts at 1. A small Stars-shop multiplier also folds into the coefficient (shown on the Stars tab, not in the live formula). *dt* starts below 1 real-second and is an upgrade, so *t* is equation time.
