export type LightState = {
  time: number;
  on: boolean;
  color?: string;
};

export type LightTimeline = LightState[];

export function generateLightTimeline(
  beats: { time: number; strength: number }[],
  color?: string
): LightTimeline {
  const timeline: LightTimeline = [];

  for (const beat of beats) {
    const time = Math.round(beat.time * 1000);
    const flashDuration = Math.round(80 + beat.strength * 100);
    timeline.push({ time, on: true, ...(color ? { color } : {}) });
    timeline.push({ time: time + flashDuration, on: false, ...(color ? { color } : {}) });
  }

  return timeline;
}

export function getLightStateAtTime(
  timeline: LightTimeline,
  position: number
): boolean {
  if (!timeline.length) return false;
  let state = false;
  for (const event of timeline) {
    if (event.time > position) break;
    state = event.on;
  }
  return state;
}

export function getNextLightEvent(
  timeline: LightTimeline,
  position: number
): LightState | null {
  for (const event of timeline) {
    if (event.time > position) return event;
  }
  return null;
}
