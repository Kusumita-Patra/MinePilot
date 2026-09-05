# digital-twin — 3D Mine Environment & Camera Module

Ownership: 3D Environment & Camera Specialist. Sensor pins, risk shaders,
tooltips, raycasting/selection and telemetry belong to the other 3D
developer — see `SensorPlaceholder.tsx` for the deliberately minimal
integration point they'll replace.

## Install

```bash
npm install @react-three/fiber @react-three/drei three
npm install -D @types/three
```
(already added to `package.json` — just run `npm install`.)

## Files

| File | Responsibility |
|---|---|
| `MineDigitalTwin.tsx` | Public component. Owns `<Canvas>`, the sector-registry provider, and the camera-preset HUD buttons. |
| `MineScene.tsx` | Everything inside `<Canvas>`: lighting, model-or-fallback, camera controller, sensor placeholder. |
| `MineModel.tsx` | Loads `/models/mine.glb` via `useGLTF`, auto-registers any object named after a known sector id. |
| `ModelErrorBoundary.tsx` | Catches a failed/missing GLB load and swaps in the procedural terrain — this is what makes "no model? no crash" actually work. |
| `MineTerrain.tsx` | Procedural fallback open-pit mine (benches, floor, north wall, deep shaft, surface conveyor, haul road, surrounding terrain). |
| `MineLighting.tsx` | Shared lighting rig for both the GLB and procedural paths. |
| `CameraController.tsx` | Bounded `OrbitControls` + exponential-decay camera-preset transitions. Exposes `flyToPreset`/`flyToPoint` via `ref`. |
| `SectorRegistry.tsx` / `SectorMesh.tsx` | The `sensor.sector_id -> 3D mesh` mapping. Wrap any sector geometry in `<SectorMesh sectorId="...">` and it's queryable via `useSectorRegistry().getSector(id)`. |
| `sectors.ts` | Sector metadata + camera presets (positions/targets derived from `mineLayout.ts`, so geometry and camera never drift apart). |
| `mineLayout.ts` | All procedural-mine dimensions in one place. |
| `geometryUtils.ts` | Pure math helpers (currently: beam-between-two-points, used for the haul road). |
| `SensorPlaceholder.tsx` | **Not this developer's scope.** Minimal instanced-sphere placeholder proving the coordinate/click contract works; meant to be deleted and replaced. |
| `types.ts` | All shared types. `SensorFrame` is re-exported from `shared/types/telemetry.ts` — not redefined. |
| `index.tsx` | Public barrel. Default export is wrapped in `next/dynamic(..., { ssr: false })` for SSR safety. Import `MineDigitalTwinInner` if you need the ref (`next/dynamic` can't forward refs). |

## Placing a real mine model

Drop an optimized `.glb` at:

```
public/models/mine.glb
```

For sector highlighting to work with a real model, name the relevant
objects (e.g. Empties in Blender, or mesh names) exactly:

```
sector_north_wall
sector_deep_shaft_b
sector_surface_conveyor
```

`MineModel.tsx` walks the loaded scene once and registers any object whose
`name` (or pre-set `userData.sectorId`) matches a known sector id. If none
match, a console warning fires so this doesn't fail silently.

If `mine.glb` is absent or fails to load, `MineTerrain.tsx` (procedural)
renders instead automatically — no crash, no blank screen.

## Coordinate system

No scaling or axis remapping happens anywhere in this module.
`sensor.coordinates` maps directly to `position={[x, y, z]}` in world space,
for both the GLB and procedural paths. If a future GLB is authored at a
different scale, apply a single group-level `scale`/`position` correction
in `MineModel.tsx` only, and document it there — never scatter ad-hoc
transforms across sensor-placement code.

## Sector highlighting (for the other developer)

```tsx
import { useSectorRegistry } from "@/components/digital-twin";

const { getSector } = useSectorRegistry();
const mesh = getSector(sensor.sector_id); // Object3D | undefined
```

`getSector` must be called from a component rendered under
`<MineDigitalTwin>` (it can be inside or outside `<Canvas>` — the registry
context bridges both, since it's provided above the Canvas).

## Camera presets

`northWall`, `deepShaftB`, `surfaceConveyor`, `overview` — defined in
`sectors.ts`. Trigger one of two ways:

```tsx
// 1. Controlled prop
<MineDigitalTwin cameraPreset="deepShaftB" onCameraPresetChange={setPreset} />

// 2. Imperative ref (needs MineDigitalTwinInner, not the dynamic default export)
import { MineDigitalTwinInner as MineDigitalTwin } from "@/components/digital-twin";
const ref = useRef<MineDigitalTwinHandle>(null);
ref.current?.flyToPreset("northWall");
```

## Performance notes

- Materials are created once via `useMemo` and reused across meshes in
  `MineTerrain.tsx`.
- The GLB scene is cloned once per mount (`scene.clone(true)`), never
  mutated in place, and `useGLTF.preload()` is called as early as possible.
- The sensor placeholder uses a single `InstancedMesh` regardless of sensor
  count — replace it with instancing (or an LOD/culling strategy) if the
  real implementation goes much past a few hundred markers.
- No HDRI/environment map is used (would require a runtime network fetch);
  the lighting rig is a fixed, cheap set of lights instead.
