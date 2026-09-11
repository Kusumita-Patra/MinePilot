"use client";

// ============================================================================
// digital-twin/MineLighting.tsx
//
// Lighting rig shared by both the GLB model and the procedural fallback.
// Goal: a dark, readable, "industrial digital twin" look — enough contrast
// for future risk-colored sensor markers to pop, without being noisy or
// game-like. No HDRI/environment maps (avoids a network fetch at runtime),
// just a small, fixed set of lights.
// ============================================================================

export default function MineLighting() {
  return (
    <>
      {/* Cool sky / warm ground fill — keeps shadow areas from going pure black */}
      <hemisphereLight args={["#8fb4d9", "#2b241d", 0.68]} />

      {/* Soft ambient base so nothing is fully unlit */}
      <ambientLight intensity={0.18} />

      {/* Primary "sun" — cast from the north-east, moderate intensity */}
      <directionalLight
        position={[60, 90, -40]}
        intensity={1.1}
        color="#fff2df"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-bias={-0.0005}
      />

      {/* Secondary rim/fill light from the opposite side to avoid a flat,
          single-source look on the pit walls */}
      <directionalLight position={[-50, 40, 60]} intensity={0.25} color="#c9d8ff" />

      {/* Low warm accent down in the pit floor / shaft area so depth reads
          clearly even where the directional lights graze at a low angle */}
      <pointLight position={[10, -20, -6]} intensity={40} distance={60} color="#ffb066" decay={2} />

      {/* Gentle site-lighting accent near the surface conveyor */}
      <pointLight position={[-58, 14, 25]} intensity={25} distance={40} color="#ffe9b0" decay={2} />
    </>
  );
}
