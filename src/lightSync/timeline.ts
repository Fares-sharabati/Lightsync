export type LightState = {
    time: number;
    on: boolean;
  };
  
  export type LightTimeline = LightState[];
  
  /*
   * Temporary synchronization test.
   *
   * Time is measured in milliseconds.
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
   * Returns the flashlight state at
   * the current position in the show.
   *
   * This is what allows a late-joining
   * phone to immediately know whether
   * it should be ON or OFF.
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
   * Returns the next light change after
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