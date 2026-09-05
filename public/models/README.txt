Place an optimized mine.glb (or mine.gltf + assets) here as:

    public/models/mine.glb

See src/components/digital-twin/README.md for the sector-naming
convention the model should follow so sector highlighting works.

If this file is absent, the app automatically falls back to the
procedural terrain in MineTerrain.tsx — no crash, no build step needed.
