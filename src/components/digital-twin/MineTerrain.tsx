"use client";

// ============================================================================
// digital-twin/MineTerrain.tsx
//
// Procedural fallback environment, used whenever /models/mine.glb is not
// present (see MineModel.tsx).
//
// Rendered as a "holographic blueprint": every structural surface is a pair
// of unlit meshes (a faint translucent fill + a brighter wireframe shell)
// instead of a solid lit material, so the network reads as glowing cyan
// wireframe on a dark navy void. Sector color follows live risk — a sector
// with an active WARNING/CRITICAL sensor shifts from the default cyan to
// amber/red and, at CRITICAL, pulses and gets a floating danger label. All
// dimensions still come from mineLayout.ts — no magic numbers here.
// ============================================================================

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { Vector3 } from "three";
import SectorMesh from "./SectorMesh";
import { computeBeamTransform } from "./geometryUtils";
import { mineSectors } from "./sectors";
import { RISK_COLOR, type RiskLevel } from "./riskColors";
import type { BlueprintTunnelSection, MineSectorId, SensorFrame } from "./types";
import {
  LEVELS,
  MAIN_NETWORK_LABELS,
  MAIN_NETWORK_POINTS,
  MAIN_NETWORK_SEGMENTS,
  MINE_LAYOUT,
  NORTH_SECTION_LABELS,
  NORTH_SECTION_POINTS,
  NORTH_SECTION_SEGMENTS,
  SHAFT,
  SURFACE_CONVEYOR,
  TUNNEL,
} from "./mineLayout";

// ----------------------------------------------------------------------------
// Risk -> color. Sectors default to NORMAL and shift to WARNING/CRITICAL's
// color when an active sensor in that sector reports it — using the same
// shared RISK_COLOR trio SensorPlaceholder's markers use, so "red" always
// means the same thing everywhere in the view.
// ----------------------------------------------------------------------------

const SECTOR_RISK_COLOR = RISK_COLOR;

const SEVERITY: Record<RiskLevel, number> = { NORMAL: 0, WARNING: 1, CRITICAL: 2 };

function useSectorRisk(sensors: SensorFrame[]): Record<MineSectorId, RiskLevel> {
  return useMemo(() => {
    const result = {} as Record<MineSectorId, RiskLevel>;
    for (const id of Object.keys(mineSectors) as MineSectorId[]) result[id] = "NORMAL";
    for (const sensor of sensors) {
      const sectorId = sensor.sector_id as MineSectorId;
      if (!(sectorId in result)) continue;
      if (SEVERITY[sensor.risk_level] > SEVERITY[result[sectorId]]) {
        result[sectorId] = sensor.risk_level;
      }
    }
    return result;
  }, [sensors]);
}

// ----------------------------------------------------------------------------
// Holo: the core visual unit — a translucent fill shell plus a brighter
// wireframe shell over the same geometry, both unlit (MeshBasicMaterial) so
// the look stays flat/glowing rather than realistically lit. `pulse` slowly
// breathes the wireframe opacity for CRITICAL sectors.
// ----------------------------------------------------------------------------

function Holo({
  geometryEl,
  geometry,
  color,
  position,
  rotation,
  fillOpacity = 0.16,
  wireOpacity = 0.6,
  pulse = false,
  showWire = true,
}: {
  /** A geometry primitive as JSX (`<boxGeometry .../>`) — used for one-off
   * shapes. Mutually exclusive with `geometry`. */
  geometryEl?: ReactElement;
  /** A pre-built THREE.BufferGeometry, shared by reference between the fill
   * and wireframe meshes — used where many small parts (e.g. a tunnel
   * segment's floor + two walls) have already been merged into one
   * geometry so they cost one draw call each instead of three. */
  geometry?: THREE.BufferGeometry;
  color: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  fillOpacity?: number;
  wireOpacity?: number;
  pulse?: boolean;
  /** Set false to render only the translucent fill, no wireframe shell — a
   * CircleGeometry's wireframe is a triangle fan radiating from the center,
   * which reads as a wagon-wheel/spoke diagram rather than a mine surface,
   * so the ground reference disc below skips it. */
  showWire?: boolean;
}) {
  const wireMatRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (!pulse || !wireMatRef.current) return;
    wireMatRef.current.opacity = wireOpacity * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.2));
  });

  const geomNode = geometry ? <primitive object={geometry} attach="geometry" /> : geometryEl;

  return (
    <group position={position} rotation={rotation}>
      <mesh>
        {geomNode}
        <meshBasicMaterial
          color={color}
          transparent
          opacity={fillOpacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {showWire && (
        <mesh>
          {geomNode}
          <meshBasicMaterial
            ref={wireMatRef}
            color={color}
            wireframe
            transparent
            opacity={wireOpacity}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

function HazardLabel({ position }: { position: [number, number, number] }) {
  return (
    <Html position={position} center distanceFactor={40} occlude={false}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 999,
          border: "1px solid rgba(255,47,69,0.85)",
          background: "rgba(20,4,8,0.85)",
          color: "#ff6b7a",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          whiteSpace: "nowrap",
          textShadow: "0 0 6px rgba(255,47,69,0.9)",
          boxShadow: "0 0 14px rgba(255,47,69,0.55)",
          pointerEvents: "none",
        }}
      >
        ⚠ DANGER
      </div>
    </Html>
  );
}

/** Always-visible floating name tag for a blueprint-traced section — the
 * reference digital-twin imagery permanently labels each named area
 * ("SECTION 1 AREA", "MAIN CONNECTION", ...) rather than only revealing the
 * name on click, so real geographical/section names from an uploaded
 * blueprint get the same treatment. Pure DOM overlay (drei's Html), so it
 * never participates in raycasting — doesn't block clicking the tunnel
 * underneath it. */
function SectionLabel({
  position,
  text,
  color,
}: {
  position: [number, number, number];
  text: string;
  color: string;
}) {
  return (
    <Html position={position} center distanceFactor={45} occlude={false}>
      <div
        style={{
          padding: "2px 8px",
          borderRadius: 6,
          border: `1px solid ${color}66`,
          background: "rgba(5,10,20,0.72)",
          color: "#e4f1ff",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.03em",
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        {text}
      </div>
    </Html>
  );
}

const RISK_STATUS_LABEL: Record<RiskLevel, string> = {
  NORMAL: "SAFE",
  WARNING: "CAUTION",
  CRITICAL: "DANGER",
};

/** Click-to-inspect card: shows the exact place clicked (e.g. "North-East
 * Branch"), which broader section it's part of, and whether it's currently
 * dangerous — colored/labelled by its live risk level. Rendered at the
 * exact world point the user clicked, alongside the camera flying in to
 * focus on that spot. */
function RegionInfoCard({
  sectorId,
  label,
  risk,
  position,
  onClose,
}: {
  sectorId: MineSectorId;
  /** The specific place clicked — a named branch/trunk, or the sector's own
   * name for structures with no sub-branches (shaft, conveyor). */
  label: string;
  risk: RiskLevel;
  position: [number, number, number];
  onClose: () => void;
}) {
  const color = SECTOR_RISK_COLOR[risk];
  const sectorName = mineSectors[sectorId].name;
  return (
    <Html position={position} center distanceFactor={35} occlude={false}>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minWidth: 180,
          padding: "8px 10px",
          borderRadius: 10,
          border: `1px solid ${color}`,
          background: "rgba(5,10,20,0.92)",
          boxShadow: `0 0 16px ${color}66`,
          fontFamily: "inherit",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#e8f4ff", letterSpacing: "0.02em" }}>
              {label}
            </span>
            {label !== sectorName && (
              <span style={{ fontSize: 10, color: "#7f93a8", letterSpacing: "0.02em" }}>{sectorName}</span>
            )}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#7f93a8",
              cursor: "pointer",
              fontSize: 12,
              lineHeight: 1,
              padding: 0,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color, letterSpacing: "0.06em" }}>
          {risk === "CRITICAL" ? "⚠ " : ""}
          {RISK_STATUS_LABEL[risk]} · {risk}
        </span>
      </div>
    </Html>
  );
}

// ----------------------------------------------------------------------------
// Tunnel network — same segment/beam-transform approach as before, but each
// segment is now a round TUBE (a segmented, open-ended cylinder) rather than
// a rectangular open-top corridor — matching the reference digital-twin
// image, where every tunnel (and the main shaft) reads as a cylindrical
// pipe with a wireframe "cage" of cross-section rings + lengthwise lines.
// Rendered through the shared Holo component (fill + wireframe sharing one
// geometry), same as the shaft — a segmented cylinder's wireframe already
// draws every ring, every longitudinal line, AND the diagonal that splits
// each cell's two triangles, which is exactly that cage/lattice look.
// ----------------------------------------------------------------------------

function buildTunnelTubeGeometry(length: number): THREE.BufferGeometry {
  const { radius } = TUNNEL;
  const radialSegments = 10;
  // ~9 units per ring spacing, matching the density already tuned for the
  // shaft's own cylinders.
  const heightSegments = Math.max(1, Math.round(length / 9));

  const geometry = new THREE.CylinderGeometry(radius, radius, length, radialSegments, heightSegments, true);
  // CylinderGeometry's length runs along local Y by default; rotate so it
  // runs along Z instead, matching computeBeamTransform's convention (beam
  // geometry authored with its long axis along local Z).
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function TunnelSegment({
  from,
  to,
  y,
  color,
  pulse,
  label,
  onSelect,
}: {
  from: [number, number];
  to: [number, number];
  y: number;
  color: string;
  pulse?: boolean;
  /** This specific branch's place name (e.g. "North-East Branch"), reported
   * on click instead of the coarser sector name — see onSelect below. */
  label: string;
  onSelect: (label: string, point: [number, number, number]) => void;
}) {
  const transform = useMemo(() => {
    const a = new Vector3(from[0], y, from[1]);
    const b = new Vector3(to[0], y, to[1]);
    return computeBeamTransform(a, b);
  }, [from, to, y]);

  const geometry = useMemo(() => buildTunnelTubeGeometry(transform.length), [transform.length]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group
      position={transform.position}
      quaternion={transform.quaternion}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(label, [e.point.x, e.point.y, e.point.z]);
      }}
    >
      <Holo geometry={geometry} color={color} pulse={pulse} fillOpacity={0.1} wireOpacity={0.65} />
    </group>
  );
}

function TunnelNetwork({
  points,
  segments,
  labels,
  y,
  color,
  pulse,
  onSelect,
}: {
  points: [number, number][];
  segments: [number, number][];
  labels: string[];
  y: number;
  color: string;
  pulse?: boolean;
  onSelect: (label: string, point: [number, number, number]) => void;
}) {
  return (
    <>
      {segments.map(([aIdx, bIdx], i) => (
        <TunnelSegment
          key={`${aIdx}-${bIdx}-${i}`}
          from={points[aIdx]}
          to={points[bIdx]}
          y={y}
          color={color}
          pulse={pulse}
          label={labels[i]}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

/** Renders one tube per admin-traced blueprint section (each may sit at its
 * own depth, so — unlike the procedural TunnelNetwork — every section gets
 * its own <TunnelNetwork> rather than sharing one `y`). Always rendered
 * alongside the procedural network for that sector, never in place of it —
 * real, named branches added to the large-scale demo tunnels. */
function BlueprintTunnels({
  sections,
  color,
  pulse,
  onSelect,
}: {
  sections: BlueprintTunnelSection[];
  color: string;
  pulse?: boolean;
  onSelect: (label: string, point: [number, number, number]) => void;
}) {
  return (
    <>
      {sections.map((section) => {
        const segments: [number, number][] = section.path.slice(1).map((_, i) => [i, i + 1]);
        const labels = segments.map(() => section.name);
        const mid = section.path[Math.floor(section.path.length / 2)];
        return (
          <group key={section.id}>
            <TunnelNetwork
              points={section.path}
              segments={segments}
              labels={labels}
              y={section.depth}
              color={color}
              pulse={pulse}
              onSelect={onSelect}
            />
            <SectionLabel position={[mid[0], section.depth + 5, mid[1]]} text={section.name} color={color} />
          </group>
        );
      })}
    </>
  );
}

export default function MineTerrain({
  sensors = [],
  blueprintSections = [],
  onSelectTunnel,
}: {
  sensors?: SensorFrame[];
  /** Admin-traced tunnel sections (already in world coordinates — see
   * BlueprintTunnelSection's doc comment in ./types). Always layered ON TOP
   * of the dense procedural network (never replaces it) — real, named
   * branches alongside the large-scale demo tunnels, not instead of them. */
  blueprintSections?: BlueprintTunnelSection[];
  /** Fires with the exact world point clicked, in addition to this
   * component's own click-to-inspect card — lets a parent (MineScene) also
   * fly the camera in without MineTerrain needing to know about cameras. */
  onSelectTunnel?: (point: [number, number, number]) => void;
}) {
  const sectorRisk = useSectorRisk(sensors);

  const blueprintBySector = useMemo(() => {
    const groups = {} as Record<MineSectorId, BlueprintTunnelSection[]>;
    for (const id of Object.keys(mineSectors) as MineSectorId[]) groups[id] = [];
    for (const section of blueprintSections) {
      if (section.sectorId in groups) groups[section.sectorId].push(section);
    }
    return groups;
  }, [blueprintSections]);

  const shaftColor = SECTOR_RISK_COLOR[sectorRisk.sector_shaft_b];
  const northColor = SECTOR_RISK_COLOR[sectorRisk.sector_north_wall];
  const mainColor = SECTOR_RISK_COLOR[sectorRisk.sector_south_face];
  const conveyorColor = SECTOR_RISK_COLOR[sectorRisk.sector_conveyor_3];

  const shaftPulse = sectorRisk.sector_shaft_b === "CRITICAL";
  const northPulse = sectorRisk.sector_north_wall === "CRITICAL";
  const mainPulse = sectorRisk.sector_south_face === "CRITICAL";
  const conveyorPulse = sectorRisk.sector_conveyor_3 === "CRITICAL";

  // Sump floor is the one deliberately solid, unlit-black surface — it reads
  // as a physical cap at the bottom of the shaft rather than more wireframe.
  const sumpFloorMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#02050a" }), []);

  // Click-to-inspect: clicking anywhere in the mine (a specific tunnel
  // branch, the shaft, the conveyor) selects it — shows a card with that
  // exact place's name and live risk status at the point clicked, and
  // reports the point up so the camera can focus on it.
  const [selected, setSelected] = useState<{
    sectorId: MineSectorId;
    label: string;
    point: [number, number, number];
  } | null>(null);

  // For structures with no sub-branches (the shaft, the conveyor) — the
  // sector's own name doubles as the place name.
  const selectSector = (sectorId: MineSectorId) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const point: [number, number, number] = [event.point.x, event.point.y, event.point.z];
    setSelected({ sectorId, label: mineSectors[sectorId].name, point });
    onSelectTunnel?.(point);
  };

  // For tunnel networks — each click reports which specific branch was hit
  // (see TunnelSegment's onSelect), so the card names that branch, not just
  // the whole sector.
  const selectTunnelIn = (sectorId: MineSectorId) => (label: string, point: [number, number, number]) => {
    setSelected({ sectorId, label, point });
    onSelectTunnel?.(point);
  };

  return (
    <group name="mine-terrain-fallback">
      {/* Thin surface reference disc — fill only, no wireframe (a circle's
          wireframe is a spoke fan radiating from the center, which reads as
          a wagon-wheel diagram rather than ground). */}
      <Holo
        rotation={[-Math.PI / 2, 0, 0]}
        geometryEl={<circleGeometry args={[MINE_LAYOUT.terrainRadius, 64]} />}
        color="#1f6f8f"
        fillOpacity={0.035}
        showWire={false}
      />

      {/* Main vertical access shaft: wide upper run, narrower lower run
          (this narrower continuation is "Deep Shaft B"), ending in a
          flared sump instead of an open-ended tube. */}
      <SectorMesh sectorId="sector_shaft_b" onClick={selectSector("sector_shaft_b")}>
        <Holo
          position={[0, (LEVELS.surface + LEVELS.level2) / 2, 0]}
          geometryEl={
            <cylinderGeometry
              args={[SHAFT.upperRadius, SHAFT.upperRadius, LEVELS.surface - LEVELS.level2, 32, 3, true]}
            />
          }
          color={shaftColor}
          pulse={shaftPulse}
        />
        <Holo
          position={[0, (LEVELS.level2 + LEVELS.level3) / 2, 0]}
          geometryEl={
            <cylinderGeometry
              args={[SHAFT.lowerRadius, SHAFT.lowerRadius, LEVELS.level2 - LEVELS.level3, 24, 2, true]}
            />
          }
          color={shaftColor}
          pulse={shaftPulse}
        />
        <Holo
          position={[0, LEVELS.level3 - SHAFT.sumpHeight / 2, 0]}
          geometryEl={
            <cylinderGeometry args={[SHAFT.lowerRadius, SHAFT.sumpRadius, SHAFT.sumpHeight, 24, 1, true]} />
          }
          color={shaftColor}
          pulse={shaftPulse}
        />
        {/* dark floor closing the sump so it reads as a bottom, not a void */}
        <mesh
          position={[0, LEVELS.level3 - SHAFT.sumpHeight, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={sumpFloorMaterial}
        >
          <circleGeometry args={[SHAFT.sumpRadius, 24]} />
        </mesh>
        {/* collar ring at the surface marking the shaft opening */}
        <Holo
          position={[0, 0.05, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          geometryEl={<ringGeometry args={[SHAFT.upperRadius, SHAFT.collarRadius, 32]} />}
          color={shaftColor}
          fillOpacity={0.25}
          wireOpacity={0.78}
          pulse={shaftPulse}
        />
        {/* Any blueprint-traced tunnels tagged Deep Shaft B (e.g. a haul road
            reaching it) render alongside the structural shaft geometry above
            — this sector always keeps its procedural structure regardless. */}
        <BlueprintTunnels
          sections={blueprintBySector.sector_shaft_b}
          color={shaftColor}
          pulse={shaftPulse}
          onSelect={selectTunnelIn("sector_shaft_b")}
        />
        {shaftPulse && <HazardLabel position={[SHAFT.collarRadius + 4, LEVELS.level2, 0]} />}
      </SectorMesh>

      {/* Level -1: North Section branch network — the dense procedural
          network always renders (this is the "large number of tunnels"
          bulk); any blueprint-traced sections for this sector layer on top
          as extra, real-named branches rather than replacing it. */}
      <SectorMesh sectorId="sector_north_wall" onClick={selectSector("sector_north_wall")}>
        <TunnelNetwork
          points={NORTH_SECTION_POINTS}
          segments={NORTH_SECTION_SEGMENTS}
          labels={NORTH_SECTION_LABELS}
          y={LEVELS.level1}
          color={northColor}
          pulse={northPulse}
          onSelect={selectTunnelIn("sector_north_wall")}
        />
        <BlueprintTunnels
          sections={blueprintBySector.sector_north_wall}
          color={northColor}
          pulse={northPulse}
          onSelect={selectTunnelIn("sector_north_wall")}
        />
        {/* landing platform ring where this level meets the shaft */}
        <Holo
          position={[0, LEVELS.level1, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          geometryEl={<ringGeometry args={[SHAFT.upperRadius, SHAFT.upperRadius + 2, 32]} />}
          color={northColor}
          fillOpacity={0.25}
          wireOpacity={0.78}
          pulse={northPulse}
        />
        {northPulse && <HazardLabel position={[0, LEVELS.level1 + 6, -20]} />}
      </SectorMesh>

      {/* Level -2: Main Tunnel Network — same "always procedural bulk, plus
          named blueprint branches layered on top" approach as North Section. */}
      <SectorMesh sectorId="sector_south_face" onClick={selectSector("sector_south_face")}>
        <TunnelNetwork
          points={MAIN_NETWORK_POINTS}
          segments={MAIN_NETWORK_SEGMENTS}
          labels={MAIN_NETWORK_LABELS}
          y={LEVELS.level2}
          color={mainColor}
          pulse={mainPulse}
          onSelect={selectTunnelIn("sector_south_face")}
        />
        <BlueprintTunnels
          sections={blueprintBySector.sector_south_face}
          color={mainColor}
          pulse={mainPulse}
          onSelect={selectTunnelIn("sector_south_face")}
        />
        <Holo
          position={[0, LEVELS.level2, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          geometryEl={<ringGeometry args={[SHAFT.upperRadius, SHAFT.upperRadius + 2, 32]} />}
          color={mainColor}
          fillOpacity={0.25}
          wireOpacity={0.78}
          pulse={mainPulse}
        />
        {mainPulse && <HazardLabel position={[10, LEVELS.level2 + 6, 15]} />}
      </SectorMesh>

      {/* Surface conveyor / headframe structure at the shaft collar */}
      <SectorMesh
        sectorId="sector_conveyor_3"
        position={SURFACE_CONVEYOR.position}
        onClick={selectSector("sector_conveyor_3")}
      >
        {/* support base */}
        <Holo
          position={[0, 1, 0]}
          geometryEl={<boxGeometry args={[4, 2, 4]} />}
          color={conveyorColor}
          pulse={conveyorPulse}
        />
        {/* inclined belt, rotated up around Z so it rises along local X */}
        <group position={[0, 2, 0]} rotation={[0, 0, SURFACE_CONVEYOR.beltIncline]}>
          <Holo
            position={[SURFACE_CONVEYOR.beltLength / 2, 0, 0]}
            geometryEl={<boxGeometry args={[SURFACE_CONVEYOR.beltLength, 1.4, 3]} />}
            color={conveyorColor}
            pulse={conveyorPulse}
          />
          <Holo
            position={[SURFACE_CONVEYOR.beltLength / 2, 0.75, 0]}
            geometryEl={<boxGeometry args={[SURFACE_CONVEYOR.beltLength, 0.15, 2.6]} />}
            color={conveyorColor}
            fillOpacity={0.12}
            wireOpacity={0.7}
            pulse={conveyorPulse}
          />
          {/* support legs along the incline */}
          {[0.25, 0.5, 0.75].map((t) => (
            <Holo
              key={t}
              position={[SURFACE_CONVEYOR.beltLength * t, -3, 0]}
              geometryEl={<boxGeometry args={[0.6, 6, 0.6]} />}
              color={conveyorColor}
              pulse={conveyorPulse}
            />
          ))}
        </group>
        {/* hopper at the discharge end */}
        <Holo
          position={[SURFACE_CONVEYOR.beltLength + 2, 6.5, 0]}
          geometryEl={<boxGeometry args={[3, 4, 4]} />}
          color={conveyorColor}
          pulse={conveyorPulse}
        />
        {/* Blueprint-traced tunnels tagged Surface Conveyor (e.g. an access
            road to the headframe). BlueprintTunnelSection paths are already
            absolute world coordinates, but this SectorMesh's own position
            prop (SURFACE_CONVEYOR.position, applied above) would otherwise
            double-offset them — cancel it back out for just this group. */}
        <group
          position={[-SURFACE_CONVEYOR.position[0], -SURFACE_CONVEYOR.position[1], -SURFACE_CONVEYOR.position[2]]}
        >
          <BlueprintTunnels
            sections={blueprintBySector.sector_conveyor_3}
            color={conveyorColor}
            pulse={conveyorPulse}
            onSelect={selectTunnelIn("sector_conveyor_3")}
          />
        </group>
        {conveyorPulse && <HazardLabel position={[0, 10, 0]} />}
      </SectorMesh>

      {selected && (
        <RegionInfoCard
          sectorId={selected.sectorId}
          label={selected.label}
          risk={sectorRisk[selected.sectorId]}
          position={selected.point}
          onClose={() => setSelected(null)}
        />
      )}
    </group>
  );
}
