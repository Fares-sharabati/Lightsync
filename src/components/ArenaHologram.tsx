// Signature background element — flat, layered, and slow-moving. Dots
// spread across the whole stage represent the crowd's flashlights. A
// handful of soft diagonal beams drift sideways independently — that's
// the "light moving through the arena." Purely decorative — inert to
// clicks (pointer-events disabled in CSS).
export default function ArenaHologram() {
  return (
    <div className="hologram-stage" aria-hidden="true">
      <div className="arena-dots" />

      <div className="arena-beam arena-beam--1" />
      <div className="arena-beam arena-beam--2" />
      <div className="arena-beam arena-beam--3" />
      <div className="arena-beam arena-beam--4" />
    </div>
  );
}