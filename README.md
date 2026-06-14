# SDR Geometry Universe

A standalone Three.js / PWA museum-style gallery for the SDR model:

```text
X = Γf(Y) + Γ₀Φ(u) + ε
```

The experience presents the same equation through multiple visual metaphors. Users can switch pages with the left navigation, use previous/next controls, or start autoplay presentation mode.

On phones, swipe left/right to move through the universe. The app can also be installed from a mobile browser with **Add to Home Screen**.

## Lock-Screen Animation

This folder also includes a standalone 30-second 16:10 cinematic loop:

```text
From Chaos to Meaning: The Geometry of Sufficient Dimension Reduction
```

Open it locally at:

```text
http://127.0.0.1:5173/lockscreen.html
```

If Vite chooses another port because 5173 is busy, use the printed port with `/lockscreen.html`.

The lock-screen scene has no dashboard UI. It maps high-dimensional observations `X` to a chaotic blue-purple particle field, `Γf(Y)` to a warm golden low-dimensional manifold, `Γ₀u` to a cooler separated nuisance stream, and `ε` to persistent silver dust. The upper center is intentionally left dark for the macOS clock and date.

## Gallery Pages

1. **Cosmic Universe**  
   A complete six-stage documentary sequence for `X = Γf(Y) + Γ₀Φ(u) + ε`: drift through persistent noise `ε`, discover the dominant blue latent universe `Γ₀Φ(u)`, watch golden signal manifolds `Γf(Y)` emerge, observe the crystal world `X` form, move inside the observation, and reveal the luminous SDR core `u = BᵀX`.

2. **Hidden Structure**  
   A latent-only page for `Γ₀Φ(u)`: apparent randomness slowly aligns into nebula oceans, dark matter rivers, gravitational currents, and giant coherent vortices. This page intentionally shows no observation sphere, no SDR core, and no dimensionality reduction. It ends with: `Latent Structure`, `Γ₀Φ(u)`, the hidden geometry beneath observation.

3. **Crystallization of Reality**  
   Observation is born: latent currents `Γ₀Φ(u)`, golden signal manifolds `Γf(Y)`, and persistent noise `ε` interact until a living crystal world `X` assembles itself. No SDR core is shown yet.

4. **Representation**  
   The central SDR idea: the camera enters the crystal observation world `X`, discovers a compact information nucleus `u = BᵀX`, and watches high-dimensional complexity collapse into a sufficient representation.

5. **Latent Dynamics**  
   Representation becomes temporal: the SDR core moves through hidden space as `uₜ → uₜ₊₁`, leaving memory constellations, fading trajectories, and branching latent geodesics.

6. **Cosmic Planning**  
   The trajectory gains purpose: state, goal, and action select one path through branching latent futures. Planning becomes navigation through possibility.

7. **From Chaos to Intelligence**  
   The final unification: noise, hidden structure, observation, representation, dynamics, and planning coexist around the SDR core. The page ends with `Noise → Structure → Observation → Representation → Dynamics → Planning → Intelligence` and the equations `X = Γf(Y) + Γ₀Φ(u) + ε`, `u = BᵀX`.

8. **World Models**  
   Intelligence begins to imagine: the SDR core generates branching possible realities, simulated future observations, alternate timelines, and world trees. The page follows `X → u = BᵀX → uₜ → uₜ₊₁ → Goal + State + Action → Predict Future Observations` and ends with `Observation → Representation → Dynamics → Planning → World Model`. The final quote: the most powerful models do not merely understand the world; they create possible worlds.

## Visual Language

- `Γf(Y)` is consistently gold: signal structure, predictive geometry, alpha factors, active pathways, roads, or stable attractors.
- `Γ₀Φ(u)` is consistently blue: transformed latent structure, calibration fields, background dynamics, geography, regime, or hidden environment.
- `ε` is white dust or fluctuations: random perturbation around each world.
- `X` is the observed system: crystal planet, detector sphere, brain activity, civilization, market ecosystem, or high-dimensional observation cloud.
- `u = BᵀX` is the luminous representation core.
- Final synthesis displays both `X = Γf(Y) + Γ₀Φ(u) + ε` and `u = BᵀX`: the geometry of meaning.
- World-model synthesis shows the next step: compact representation generates possible future observations.

## Run Locally

From this folder:

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite, usually:

```text
http://127.0.0.1:5173
```

## Build

```bash
npm run build
npm run preview
```

## Publish to GitHub Pages

This folder is ready to be pushed as a standalone GitHub repository.

```bash
cd experiments/latent_visualization_demo/sdr_geometry_universe
git init
git add .
git commit -m "Publish SDR Geometry Universe"
git branch -M main
git remote add origin git@github.com:<your-user>/<your-repo>.git
git push -u origin main
```

Then, on GitHub:

1. Open the repository **Settings**.
2. Go to **Pages**.
3. Under **Build and deployment**, choose **GitHub Actions**.
4. Open the **Actions** tab and run or wait for `Deploy SDR Geometry Universe`.

The deployed URL will look like:

```text
https://<your-user>.github.io/<your-repo>/
```

## Install on Phone

After the GitHub Pages URL is live:

- **iPhone Safari:** open the URL, tap Share, then **Add to Home Screen**.
- **Android Chrome:** open the URL, tap the menu, then **Install app** or **Add to Home screen**.

The PWA files are:

```text
public/manifest.webmanifest
public/sw.js
public/icons/
```

## Notes

This gallery is independent from the repository's training and benchmarking code. It only adds files under:

```text
experiments/latent_visualization_demo/sdr_geometry_universe
```
