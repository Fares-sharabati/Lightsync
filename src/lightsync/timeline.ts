export type LightState = {
    time: number;
    on: boolean;
  };
  
  /*
   * Time is stored in milliseconds from
   * the beginning of the song.
   *
   * Example:
   *
   * 0ms     ON
   * 1200ms  OFF
   * 1500ms  ON
   * 4000ms  OFF
   *
   * This means the light stays ON from
   * 0 → 1200ms.
   */
  
  export type LightTimeline = LightState[];
  
  /*
   * Temporary test timeline.
   *
   * This is NOT the Gangnam Style choreography.
   *
   * We are using it only to test the
   * synchronization engine.
   */
  export const TEST_TIMELINE: LightTimeline = [
    { time: 0, on: false },
  
    { time: 1000, on: true },
    { time: 2000, on: false },
  
    { time: 2500, on: true },
    { time: 5000, on: false },
  
    { time: 5500, on: true },
    { time: 8000, on: false },
  
    { time: 9000, on: true },
    { time: 12000, on: false },
  ];
  
  /*
   * Find the flashlight state at a specific
   * position in the song.
   *
   * This is the key function that allows
   * late-joining phones to immediately know
   * whether they should be ON or OFF.
   */
  export function getLightStateAtTime(
    timeline: LightTimeline,
    position: number
  ): boolean {
    if (!timeline.length) {
      return false;
    }
  
    let state = false;
  
    for (const event of timeline) {
      if (event.time > position) {
        break;
      }
  
      state = event.on;
    }
  
    return state;
  }
  
  /*
   * Find the next timeline event after
   * the current position.
   */
  export function getNextLightEvent(
    timeline: LightTimeline,
    position: number
  ): LightState | null {
    for (const event of timeline) {
      if (event.time > position) {
        return event;
      }
    }
  
    return null;
  }