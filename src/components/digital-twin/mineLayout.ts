// ============================================================================
// digital-twin/mineLayout.ts
//
// Single source of truth for the procedural fallback mine's dimensions.
// Every other file (terrain, camera presets, orbit-control bounds) derives
// its numbers from here so the scene, sector positions and camera targets
// can never drift out of sync when the layout is tuned.
//
// REBUILT as an underground room-and-shaft network (was previously an
// open-pit layout). y = 0 is still the surface; everything the mine
// actually consists of now hangs below it as horizontal tunnel levels
// connected by one vertical shaft, instead of a stepped excavated crater.
//
// Units are arbitrary world units (treat as ~metres for intuition).
// ============================================================================

export const MINE_LAYOUT = {
  /** Radius of the semi-transparent surface reference disc at y = 0. */
  terrainRadius: 520,
} as const;

/** Named depths for each horizontal working level. */
export const LEVELS = {
  surface: 0,
  level1: -15, // North Section
  level2: -30, // Main Tunnel Network
  level3: -50, // shaft sump / deepest point
} as const;

/** Deepest point in the whole layout — used for camera pan/zoom bounds. */
export const FLOOR_Y = LEVELS.level3;

/** The single vertical access shaft. Wide near the surface, narrowing for
 * its lower run (that narrower lower run is what "Deep Shaft B" refers to),
 * ending in a slightly flared sump instead of an open-ended tube. */
export const SHAFT = {
  upperRadius: 5,
  lowerRadius: 3,
  collarRadius: 7.5,
  /** y at which the shaft narrows from upperRadius to lowerRadius. */
  narrowAtY: LEVELS.level2,
  sumpRadius: 4,
  sumpHeight: 3,
};

/** Shared cross-section for every tunnel segment — a round tube (matching
 * the reference digital-twin imagery's tunnels, which read as cylindrical
 * pipes with a ring+longitude wireframe cage, not rectangular corridors). */
export const TUNNEL = {
  radius: 4.5,
};

// ----------------------------------------------------------------------------
// Organic vein network generator.
//
// A regular perpendicular comb grid (the previous approach) reads as
// obviously artificial — real mine drifts, and the branching tunnels in the
// reference photo, wander and fork at irregular angles like veins or river
// tributaries, not a rectangle of right angles. This grows each primary
// vein as a sequence of short, gently curving segments (heading drifts by a
// small random amount every step) and forks off child veins at irregular
// angles and irregular points along the way, tapering in length each
// generation. A small deterministic PRNG (not Math.random) keeps the shape
// stable across reloads/HMR instead of reshuffling every time.
// ----------------------------------------------------------------------------

/** Deterministic PRNG (mulberry32) — same seed always produces the same
 * branching pattern, so the layout doesn't reshuffle on every reload. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface VeinOptions {
  /** How many branching generations deep child veins can go. */
  maxDepth: number;
  /** Length multiplier applied to a child vein relative to its parent. */
  lengthDecay: number;
  /** A vein shorter than this stops recursing instead of forking further. */
  minLength: number;
  /** Approximate length of each straight micro-segment along a vein. */
  stepLength: number;
  /** Max random heading change (radians) applied at each step — the "wander". */
  angleJitter: number;
  /** Base angle (radians) a child vein forks away from its parent's heading. */
  branchAngle: number;
}

/** Recursively grows one vein starting at (startIdx, startPoint) heading in
 * direction `heading` (radians) for roughly `length` units, mutating the
 * shared `points`/`segments` arrays as it goes. Forks 1-2 child veins at
 * irregular points along itself, each at an irregular angle. */
function growVein(
  points: [number, number][],
  segments: [number, number][],
  rng: () => number,
  startIdx: number,
  startPoint: [number, number],
  heading: number,
  length: number,
  depth: number,
  opts: VeinOptions
): void {
  if (depth > opts.maxDepth || length < opts.minLength) return;

  const stepCount = Math.max(2, Math.round(length / opts.stepLength));
  const stepLen = length / stepCount;

  // Pick a handful of irregular points along this vein (never the very
  // first step) to fork child veins from, but never at the deepest allowed
  // generation. More forks at shallow depth (main drifts get many
  // crosscuts), tapering off deeper — a real coal mine's tunnel density.
  const forkSteps = new Set<number>();
  if (depth < opts.maxDepth) {
    const forkCount = depth === 0 ? 4 : depth === 1 ? 2 : 1;
    for (let f = 0; f < forkCount; f++) {
      forkSteps.add(1 + Math.floor(rng() * (stepCount - 1)));
    }
  }

  let curPoint = startPoint;
  let curIdx = startIdx;
  let curHeading = heading;

  for (let i = 0; i < stepCount; i++) {
    curHeading += (rng() - 0.5) * opts.angleJitter;
    const nextPoint: [number, number] = [
      curPoint[0] + Math.cos(curHeading) * stepLen,
      curPoint[1] + Math.sin(curHeading) * stepLen,
    ];
    points.push(nextPoint);
    const nextIdx = points.length - 1;
    segments.push([curIdx, nextIdx]);

    if (forkSteps.has(i)) {
      const side = rng() < 0.5 ? 1 : -1;
      const forkHeading = curHeading + side * (opts.branchAngle + (rng() - 0.5) * 0.5);
      growVein(
        points,
        segments,
        rng,
        nextIdx,
        nextPoint,
        forkHeading,
        length * opts.lengthDecay * (0.55 + rng() * 0.5),
        depth + 1,
        opts
      );
    }

    curPoint = nextPoint;
    curIdx = nextIdx;
  }
}

/** A network of tunnel points/segments, plus a human-readable place name
 * for every segment (e.g. "North-East Branch") — carried through every
 * transform below (merge, translate, connect, split) so a click on any
 * tunnel can report exactly which named place it hit, not just which of
 * the 4 broad sectors it's in. */
interface VeinNet {
  points: [number, number][];
  segments: [number, number][];
  labels: string[];
}

/** Grows one full vein tree from the shaft ([0, 0]) heading in the given
 * direction, self-contained with its own local origin at index 0 (matching
 * the shape mergeCombNetworks expects). Every segment in the result is
 * labelled `name` — forks belong to the same named place as their trunk. */
function buildVeinNetwork({
  seed,
  heading,
  length,
  name,
  ...opts
}: VeinOptions & { seed: number; heading: number; length: number; name: string }): VeinNet {
  const points: [number, number][] = [[0, 0]];
  const segments: [number, number][] = [];
  growVein(points, segments, mulberry32(seed), 0, [0, 0], heading, length, 0, opts);
  return { points, segments, labels: segments.map(() => name) };
}

/** After merging several vein trees, connects a handful of nearby branch
 * tips that belong to different veins — irregular "anastomosis" loops, the
 * way real vein/root systems occasionally reconnect, rather than the clean
 * repeating lattice a regular grid would produce. */
function addOrganicCrossLinks(
  net: VeinNet,
  rng: () => number,
  { count, minDist, maxDist, label }: { count: number; minDist: number; maxDist: number; label: string }
): void {
  const { points, segments } = net;
  const existing = new Set(segments.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
  const candidates: { a: number; b: number; d: number }[] = [];

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]);
      if (d >= minDist && d <= maxDist && !existing.has(`${i}-${j}`)) {
        candidates.push({ a: i, b: j, d });
      }
    }
  }
  candidates.sort((c1, c2) => c1.d - c2.d);

  const used = new Set<number>();
  let added = 0;
  for (const c of candidates) {
    if (added >= count) break;
    if (used.has(c.a) && used.has(c.b)) continue; // spread the links out
    if (rng() < 0.5) continue; // keep it irregular, not "always the closest pair"
    net.segments.push([c.a, c.b]);
    net.labels.push(label);
    used.add(c.a);
    used.add(c.b);
    added++;
  }
}

/** Combines several independent vein trees (each with its own trunk
 * starting back at the shaft) into one points/segments/labels array. Every
 * trunk re-starts from its own coincident [0, 0] origin point rather than
 * sharing a single index — harmless (it's just an extra point sitting
 * exactly on the shaft) and far simpler than re-indexing every trunk into a
 * shared origin. */
function mergeCombNetworks(...networks: VeinNet[]): VeinNet {
  const points: [number, number][] = [];
  const segments: [number, number][] = [];
  const labels: string[] = [];
  for (const net of networks) {
    const offset = points.length;
    points.push(...net.points);
    segments.push(...net.segments.map(([a, b]): [number, number] => [a + offset, b + offset]));
    labels.push(...net.labels);
  }
  return { points, segments, labels };
}

/** Shifts every point in a network by (dx, dz) — used to re-root a vein
 * tree (always grown from a local [0, 0]) at some other hub, such as the
 * surface conveyor's own footprint. */
function translateNetwork(net: VeinNet, dx: number, dz: number): VeinNet {
  return {
    points: net.points.map(([x, z]): [number, number] => [x + dx, z + dz]),
    segments: net.segments,
    labels: net.labels,
  };
}

/** Guarantees `fromIdx` is physically connected to the rest of the network
 * by linking it to whichever existing point (searched over [0, searchEnd))
 * is nearest — so a hub merged in from elsewhere (e.g. a conveyor's own
 * tunnel cluster) never ends up floating, disconnected from everything. */
function connectNearest(net: VeinNet, fromIdx: number, searchEnd: number, label: string): void {
  const [fx, fz] = net.points[fromIdx];
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < searchEnd; i++) {
    const d = Math.hypot(net.points[i][0] - fx, net.points[i][1] - fz);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  if (bestIdx >= 0) {
    net.segments.push([fromIdx, bestIdx]);
    net.labels.push(label);
  }
}

/** Finds every place two (non-adjacent) segments in a network actually
 * cross in the X/Z plane and splits BOTH of them at that point into a
 * shared new junction point — so a visual crossing always becomes a real,
 * physically connected intersection instead of two tunnels silently
 * passing through each other. This is a single global pass (not
 * iterative): whether segment A crosses segment B depends only on their
 * original endpoints, so testing every pair once and collecting all of a
 * segment's crossings before splitting it is already complete, regardless
 * of how many times that segment ends up subdivided. A split sub-segment
 * simply inherits its original segment's label. */
function resolveCrossings(net: VeinNet): VeinNet {
  const points = net.points.slice();
  const segs = net.segments;
  const labs = net.labels;
  const EPS = 1e-4;

  const intersect = (
    p1: [number, number],
    p2: [number, number],
    p3: [number, number],
    p4: [number, number]
  ): { x: number; z: number; t: number; u: number } | null => {
    const [x1, z1] = p1;
    const [x2, z2] = p2;
    const [x3, z3] = p3;
    const [x4, z4] = p4;
    const d = (x1 - x2) * (z3 - z4) - (z1 - z2) * (x3 - x4);
    if (Math.abs(d) < 1e-9) return null; // parallel/colinear — leave as-is
    const t = ((x1 - x3) * (z3 - z4) - (z1 - z3) * (x3 - x4)) / d;
    const u = ((x1 - x3) * (z1 - z2) - (z1 - z3) * (x1 - x2)) / d;
    if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) return null; // strictly interior on both segments
    return { x: x1 + t * (x2 - x1), z: z1 + t * (z2 - z1), t, u };
  };

  const pointCache = new Map<string, number>();
  const getOrCreatePoint = (x: number, z: number): number => {
    const key = `${x.toFixed(2)},${z.toFixed(2)}`;
    const cached = pointCache.get(key);
    if (cached !== undefined) return cached;
    points.push([x, z]);
    const idx = points.length - 1;
    pointCache.set(key, idx);
    return idx;
  };

  const splits: { t: number; idx: number }[][] = segs.map(() => []);
  for (let i = 0; i < segs.length; i++) {
    const [a1, b1] = segs[i];
    for (let j = i + 1; j < segs.length; j++) {
      const [a2, b2] = segs[j];
      if (a1 === a2 || a1 === b2 || b1 === a2 || b1 === b2) continue; // already share a joint
      const hit = intersect(points[a1], points[b1], points[a2], points[b2]);
      if (!hit) continue;
      const idx = getOrCreatePoint(hit.x, hit.z);
      splits[i].push({ t: hit.t, idx });
      splits[j].push({ t: hit.u, idx });
    }
  }

  const newSegments: [number, number][] = [];
  const newLabels: string[] = [];
  for (let i = 0; i < segs.length; i++) {
    const [a, b] = segs[i];
    const label = labs[i];
    if (splits[i].length === 0) {
      newSegments.push([a, b]);
      newLabels.push(label);
      continue;
    }
    const ordered = [...splits[i]].sort((x, y) => x.t - y.t);
    let prev = a;
    for (const s of ordered) {
      if (s.idx !== prev) {
        newSegments.push([prev, s.idx]);
        newLabels.push(label);
      }
      prev = s.idx;
    }
    if (prev !== b) {
      newSegments.push([prev, b]);
      newLabels.push(label);
    }
  }

  return { points, segments: newSegments, labels: newLabels };
}

const VEIN_OPTS: VeinOptions = {
  maxDepth: 3,
  lengthDecay: 0.62,
  minLength: 22,
  stepLength: 26,
  angleJitter: 0.32, // ~18° max drift per step — organic wander, not ruler-straight
  branchAngle: 0.85, // ~49° fork angle — clearly not a right angle
};

/** Level -1 network: four vein trees (north, south, and the NE/SW diagonal)
 * growing from the shaft, each wandering and forking irregularly (see
 * buildVeinNetwork) rather than running perfectly straight with
 * perpendicular crosscuts. A denser set of cross-links stitches branches
 * together into loops without any regular pattern. A real coal mine's
 * workings are a dense tangle of drifts, not a handful of lines — this and
 * the main network below are tuned for that density. */
const NORTH_SECTION = mergeCombNetworks(
  buildVeinNetwork({ seed: 101, heading: -Math.PI / 2, length: 310, name: "North Trunk", ...VEIN_OPTS }),
  buildVeinNetwork({ seed: 202, heading: Math.PI / 2, length: 280, name: "South Trunk", ...VEIN_OPTS }),
  buildVeinNetwork({
    seed: 107,
    heading: -Math.PI / 4,
    length: 300,
    name: "North-East Branch",
    ...VEIN_OPTS,
  }),
  buildVeinNetwork({
    seed: 208,
    heading: (3 * Math.PI) / 4,
    length: 300,
    name: "South-West Branch",
    ...VEIN_OPTS,
  })
);
addOrganicCrossLinks(NORTH_SECTION, mulberry32(303), {
  count: 12,
  minDist: 18,
  maxDist: 55,
  label: "Connector Drift",
});
// Turn every remaining visual crossing into a real, physically joined
// junction — nothing should pass through anything else unconnected.
const NORTH_SECTION_RESOLVED = resolveCrossings(NORTH_SECTION);
export const NORTH_SECTION_POINTS = NORTH_SECTION_RESOLVED.points;
export const NORTH_SECTION_SEGMENTS = NORTH_SECTION_RESOLVED.segments;
export const NORTH_SECTION_LABELS = NORTH_SECTION_RESOLVED.labels;

export const SURFACE_CONVEYOR = {
  position: [270, 0, 110] as [number, number, number],
  beltLength: 18,
  beltIncline: -0.3,
};

/** Level -2 network: same idea as the north section — vein trees growing
 * east, west, and the NW/SE diagonal from the shaft — PLUS a second,
 * denser cluster of veins rooted at the surface conveyor's own footprint
 * (translated onto its position, then guaranteed-connected back into the
 * shaft's network via connectNearest so it never floats disconnected). A
 * real headframe/conveyor sits above its own local working area, not just
 * a single haul road, so that area gets noticeably more tunnels than the
 * rest of the level. */
const MAIN_NETWORK_CORE = mergeCombNetworks(
  buildVeinNetwork({ seed: 404, heading: 0, length: 360, name: "East Trunk", ...VEIN_OPTS }),
  buildVeinNetwork({ seed: 505, heading: Math.PI, length: 310, name: "West Trunk", ...VEIN_OPTS }),
  buildVeinNetwork({
    seed: 407,
    heading: (-3 * Math.PI) / 4,
    length: 300,
    name: "North-West Branch",
    ...VEIN_OPTS,
  }),
  buildVeinNetwork({
    seed: 508,
    heading: Math.PI / 4,
    length: 300,
    name: "South-East Branch",
    ...VEIN_OPTS,
  })
);
const CONVEYOR_HUB = translateNetwork(
  mergeCombNetworks(
    buildVeinNetwork({
      seed: 609,
      heading: Math.PI,
      length: 200,
      name: "Conveyor Hub — Shaft Link",
      ...VEIN_OPTS,
    }),
    buildVeinNetwork({
      seed: 710,
      heading: Math.PI / 2,
      length: 180,
      name: "Conveyor Hub — North Spur",
      ...VEIN_OPTS,
    }),
    buildVeinNetwork({
      seed: 811,
      heading: -Math.PI / 6,
      length: 170,
      name: "Conveyor Hub — East Spur",
      ...VEIN_OPTS,
    }),
    buildVeinNetwork({
      seed: 912,
      heading: -Math.PI / 2,
      length: 170,
      name: "Conveyor Hub — South Spur",
      ...VEIN_OPTS,
    })
  ),
  SURFACE_CONVEYOR.position[0],
  SURFACE_CONVEYOR.position[2]
);
const MAIN_NETWORK = mergeCombNetworks(MAIN_NETWORK_CORE, CONVEYOR_HUB);
connectNearest(
  MAIN_NETWORK,
  MAIN_NETWORK_CORE.points.length,
  MAIN_NETWORK_CORE.points.length,
  "Conveyor Hub — Shaft Link"
);
addOrganicCrossLinks(MAIN_NETWORK, mulberry32(606), {
  count: 16,
  minDist: 18,
  maxDist: 55,
  label: "Connector Drift",
});
const MAIN_NETWORK_RESOLVED = resolveCrossings(MAIN_NETWORK);
export const MAIN_NETWORK_POINTS = MAIN_NETWORK_RESOLVED.points;
export const MAIN_NETWORK_SEGMENTS = MAIN_NETWORK_RESOLVED.segments;
export const MAIN_NETWORK_LABELS = MAIN_NETWORK_RESOLVED.labels;
