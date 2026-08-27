export type LightState = {
    time: number;
    on: boolean;
  };
  
  export type LightTimeline =
    LightState[];
  
  /**
   * Convert detected beats into a flashlight
   * timeline.
   *
   * Each detected beat produces a short flash.
   */
  export function generateLightTimeline(
    beats: {
      time: number;
      strength: number;
    }[]
  ): LightTimeline {
    const timeline: LightTimeline = [];
  
    for (const beat of beats) {
      const time =
        Math.round(
          beat.time * 1000
        );
  
      /*
       * Flash duration changes slightly
       * depending on beat strength.
       *
       * Strong beat = slightly longer flash.
       * Weak beat = shorter flash.
       */
      const flashDuration =
        Math.round(
          80 +
          beat.strength * 100
        );
  
      timeline.push({
        time,
        on: true,
      });
  
      timeline.push({
        time:
          time + flashDuration,
        on: false,
      });
    }
  
    return timeline;
  }
  
  /**
   * Find the current light state.
   *
   * This is also what allows a phone to join
   * after the show has already started.
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
  
  /**
   * Find the next light event.
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
  