# GhostWorld — The World That Keeps Moving

**An offline, interactive blind-prediction laboratory.** Two moving objects carry distinct identity marks. Observe them, switch off the sensor, watch a separate internal model autonomously continue its best guesses, and reveal the world. Predictions are scored **before** sensor data re-enters the model.

Open **[the GhostWorld live demo](https://anttiluode.github.io/GhostWorld/)** if GitHub Pages is enabled, or download the repository and open `index.html` directly in Chrome/Edge/Firefox. No server, network, libraries, Python, model weights or GPU required.

![Status: research prototype](https://img.shields.io/badge/status-auditable%20prototype-0d9488)

## Controls

- **BLACKOUT / REVEAL**: Disconnect all observations, then compare predicted positions with hidden ground truth **before** the predictor is allowed another observation.
- **AUTO 6s**: Six simulated real-time seconds of blackout before automatic reveal (pausing also pauses its timer).
- **PAUSE / RESUME**: Stop or continue the physical simulation. **Replay buffer** scrubs roughly the last 40 seconds without recomputing past predictions with new evidence.
- **NEW WORLD**: Start a fresh seeded scene and reset all scores, tracks, and the medium.
- **HOLD / LINEAR / 3 PATHS**: Compare static memory, constant-velocity extrapolation, and a three-hypothesis constant-turn predictor. The 3-path solution is not guaranteed to beat the cheap baseline.
- **Central occluding wall**: Sensor sightings are blocked when objects pass behind the central wall. The predictor advances during the unseen interval.
- **Wave graph**: Eight continuously updated damped oscillators, 16 locally writable edges, adjustable plasticity and a snapshot-only probe-frequency sweep. **This is a separate causal instrument and visualization; it does not currently steer visual predictions.**
- Keyboard: **Space** pause/resume, **B** blackout, **R** reveal.

## What actually runs

`core.js` is deterministic, testable, and independent of the page. The hidden `World` generates truth. Its `observe()` method yields **only visible, noisy position measurements**. `Belief.observe()` never receives the true hidden state or a hidden trajectory; after blackout, `Belief.predict(t)` extrapolates entirely from its past measurements.

The 3-path model is a simple online state estimate with a mixture of constant-turn continuations. Its position/velocity/curvature guesses are not trained weights or a neural network. Uncertainty is the spread of those continuations plus a time-since-sighting allowance; **it is not a calibrated posterior confidence interval**. We deliberately keep the estimate readable and falsifiable before adding a trainable MEMORILLA-style reader or Sihti/Slider structural encoder.

The wave graph is a genuine autonomous coupled-oscillator model. Only observed innovations can excite it. Local strain exposure makes small, centered changes to edge weights, bounded with homeostatic pull toward initial values. Probing simulates a **copy** of current conductances, not the live fast state. The graph is **not yet proven to retain recoverable visual identity or to improve motion forecasting**. Its amplitude and graph activity visuals should not be treated as learned semantic knowledge.

## Critical no-leak guarantee

The world simulator and predictor are separate objects. `World.snapshot()` is accessed by the **renderer** and the **scorer**, but not the estimator. During blackout, `World.observe(true)` returns `[]` and the estimator advances only through elapsed time. On REVEAL, the code computes both forecast and the linear baseline, scores each against the still-hidden truth, **then** reconnects the sensor at the next observation. Replay records the predictions made at the time instead of rerunning historical frames with newly learned data.

To audit: search for `world.snapshot()` in `app.js`; only the evaluator and the separate visual/recording snapshot path should call it. The model itself operates on `Belief.observe()` inputs.

## Test locally

Node 18+ is optional, used only for the headless deterministic tests:

```bash
node test_core.js
node test_browser_smoke.js
```

Tests cover blind observation, future-time dependence, identical past observations despite different hidden worlds, non-writing wave probes, read/writer bounds and the no-update behavior during blackout. The browser app needs **no Node installation** to run.

## What this proves and does not

This is a working, attractive mechanism test, **not** a trained live latent neural video model. A constant-turn hypothesis filter is conventional and quite capable for synthetic motion. A 16-edge wave graph and a query-conditioned memory transformer would require supervised training and matched ablations before claiming identity binding, sophisticated world understanding or improved performance. The scene is synthetic; no webcam is used. Real object permanence, video reconstruction, VLM soft tokens, diffusion conditioning, and comparisons with a GRU/Kalman filter are future experiments, not claimed accomplishments.

### Next research gate

Keep this visual instrument fixed and add a **trained history-to-forecast memory** behind the same `Belief` interface. Use identical sensor histories and compute budgets for three arms: (1) explicit state-space / Kalman-IMM baseline, (2) compact recurrent network, (3) SliderV3-style structural graph read through a learned query-conditioned memory bridge. Evaluate unseen seeds, unseen occlusion durations, mark identity tracking, noise and abrupt turns; report pre-reveal error and calibration. Only connect the wave graph to the renderer when a blind test shows useful state, and only claim an advantage when it beats the conventional controls.

## Roots

This builds on the questions and experiments in [SihtiImageModel5](https://github.com/anttiluode/SihtiImageModel5) (living paper), [Sihtiimagemodel7](https://github.com/anttiluode/Sihtiimagemodel7) (temporal consistency and trust), [RoundAndRound](https://github.com/anttiluode/RoundAndRound) (autonomous latent dynamics), [SihtiResponseGraph](https://github.com/anttiluode/SihtiResponseGraph) (query-sensitive structural image memory), and [SliderV3](https://github.com/anttiluode/SliderV3) (phase/strain-written graph).

MIT License (repository license).
