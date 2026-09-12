# Scanned materials for the project flight

`scene.js` looks for these files and falls back to flat colour when any set is missing:

```
stone-basecolor.png   stone-normal.png   stone-roughness.png    Riyadh limestone ashlar (buildings, plinths, steps)
sand-basecolor.png    sand-normal.png    sand-roughness.png     compacted Najd desert ground (the plain, low blocks, rocks)
paving-basecolor.png  paving-normal.png  paving-roughness.png   dark granite plaza paving (reserved; no site uses it yet)
```

Square, 1024 to 2048 px, PNG. Generated in Magnific (Seedream 5 Pro tiles, Patina PBR maps);
the creations are in the Personal project of the Magnific account. Keep each file under 2 MB:
run them through `pngquant` or export at 1024 if a set comes in heavier.
