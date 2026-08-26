# The Equation

A math idle about a growing function *f(t)*. Original game, inspired by the *feel* of Exponential Idle (not a clone: different name, art, costs, and prestige curve).

You do not click to produce. Time integrates the equation. You spend *f(t)* on variables that multiply the exponent, then prestige into **b** and **μ**.

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

1. Watch *f(t)* grow. Buy **x** when you can afford it (Buy 1 / Buy max). Spending *divides* *f* by the cost, then growth continues from the new *f*.
2. Every 10 levels, a variable gets a stepwise bump.
3. **y**, **z**, **u**, **v** unlock as lifetime-max *f* this run climbs. Each multiplies the exponent.
4. On the Upgrades tab: faster **dt**, cheaper **x**. Optional **Advance t** spends ~10% of *f* to push the equation forward. Not a clicker.
5. When Δb is meaningful (progress bar on Prestige), prestige: reset *t*, *f*, and variable levels; keep **b** and **μ**. Next run is faster. Two μ lemmas unlock after the first prestige.
6. Autobuy appears after you have prestiged once.

Keyboard: **M** buy max on the last hovered variable, **P** prestige (opens the confirm modal; P again confirms). **1–5** switch tabs.

## Notation

- Below 1,000,000: `12,345`
- Then scientific: `1.23e9` = 1.23 × 10^9
- Huge exponents: `ee3` = 10^(10^3) = 10^1000

*f(t)* is stored as log10 (plus a layer for ee-scale), never as a raw JavaScript `Number`.

## Save

Autosaves to `localStorage` every few seconds and on prestige. Stats tab: export / import JSON, hard reset (with confirm). Offline progress is granted at the last known rate, capped at 8 hours, with a recap toast.

## Formula

\[
f(t + dt) = f(t) \cdot \exp(b \cdot x \cdot y \cdot z \cdot u \cdot v \cdot dt)
\]

Locked variables are omitted (treated as 1). *dt* starts below 1 real-second and is an upgrade, so *t* is equation time.
