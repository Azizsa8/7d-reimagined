# Scanned materials for the project flight

`scene.js` requests only maps explicitly listed in `manifest.js`. The manifest is currently
empty, so no texture images are requested. Loading completes once with no polling, including
on failure. If a base colour fails, the material keeps its flat colour.

Commit actual assets before adding their page-relative URLs to the manifest, for example:

```js
export const textureSets = {
  stone: {
    basecolor: 'assets/tex/stone-basecolor.png',
    normal: 'assets/tex/stone-normal.png',
    roughness: 'assets/tex/stone-roughness.png',
  },
};
```

Normal and roughness maps are optional. Suggested names:

```
stone-basecolor.png   stone-normal.png   stone-roughness.png    Riyadh limestone ashlar (buildings, plinths, steps)
sand-basecolor.png    sand-normal.png    sand-roughness.png     compacted Najd desert ground (the plain, low blocks, rocks)
paving-basecolor.png  paving-normal.png  paving-roughness.png   dark granite plaza paving (reserved; no site uses it yet)
```

Square, 1024 to 2048 px, PNG. No generated maps have been committed. Paid generation needs
explicit approval of the service, settings and cost. Keep each file under 2 MB:
run them through `pngquant` or export at 1024 if a set comes in heavier.
