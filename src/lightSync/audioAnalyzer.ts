export type Beat = {
    time: number;
    strength: number;
  };
  
  export type AudioAnalysis = {
    duration: number;
    beats: Beat[];
    energy: number[];
  };
  
  
  /*
   * Decode the selected audio file locally.
   *
   * We deliberately do NOT reject the file based
   * on its extension or MIME type.
   *
   * The browser's Web Audio decoder will determine
   * whether the file can actually be decoded.
   */
  async function decodeAudioFile(
    file: File
  ): Promise<AudioBuffer> {
  
    if (file.size === 0) {
      throw new Error(
        'The selected audio file is empty.'
      );
    }
  
  
    const arrayBuffer =
      await file.arrayBuffer();
  
  
    const audioContext =
      new AudioContext();
  
  
    try {
  
      const audioBuffer =
        await audioContext.decodeAudioData(
          arrayBuffer
        );
  
  
      return audioBuffer;
  
    } catch (error) {
  
      console.error(
        'Browser could not decode audio:',
        error
      );
  
  
      throw new Error(
        `The browser could not decode "${file.name}". Try an MP3, WAV, M4A, OGG, or AAC file.`
      );
  
    } finally {
  
      await audioContext.close();
  
    }
  }
  
  
  /*
   * Convert stereo/multi-channel audio
   * into a single mono channel.
   */
  function getMonoSamples(
    audioBuffer: AudioBuffer
  ): Float32Array {
  
    const channelCount =
      audioBuffer.numberOfChannels;
  
    const length =
      audioBuffer.length;
  
    const mono =
      new Float32Array(length);
  
  
    for (
      let channel = 0;
      channel < channelCount;
      channel++
    ) {
  
      const data =
        audioBuffer.getChannelData(
          channel
        );
  
  
      for (
        let i = 0;
        i < length;
        i++
      ) {
  
        mono[i] +=
          data[i] / channelCount;
  
      }
    }
  
  
    return mono;
  }
  
  
  /*
   * Calculate short-term RMS energy.
   *
   * We analyze small portions of the song
   * to determine how energetic each moment is.
   */
  function calculateEnergy(
    samples: Float32Array,
    sampleRate: number
  ): {
    time: number;
    value: number;
  }[] {
  
    /*
     * 50 ms analysis window.
     */
    const windowSize =
      Math.floor(
        sampleRate * 0.05
      );
  
  
    /*
     * Analyze every 25 ms.
     */
    const hopSize =
      Math.floor(
        sampleRate * 0.025
      );
  
  
    const result: {
      time: number;
      value: number;
    }[] = [];
  
  
    for (
      let start = 0;
      start + windowSize < samples.length;
      start += hopSize
    ) {
  
      let sum = 0;
  
  
      for (
        let i = start;
        i < start + windowSize;
        i++
      ) {
  
        const sample =
          samples[i];
  
  
        sum +=
          sample * sample;
  
      }
  
  
      const rms =
        Math.sqrt(
          sum / windowSize
        );
  
  
      result.push({
  
        time:
          start / sampleRate,
  
        value:
          rms,
  
      });
    }
  
  
    return result;
  }
  
  
  /*
   * Detect beat-like energy peaks.
   *
   * This is our first automatic detector.
   *
   * Later we will improve this with BPM,
   * rhythm analysis, and frequency bands.
   */
  function detectBeats(
    energy: {
      time: number;
      value: number;
    }[]
  ): Beat[] {
  
    const beats: Beat[] = [];
  
  
    if (energy.length < 10) {
      return beats;
    }
  
  
    /*
     * Calculate average energy.
     */
    let total = 0;
  
  
    for (const point of energy) {
      total += point.value;
    }
  
  
    const average =
      total / energy.length;
  
  
    if (average <= 0.000001) {
      return beats;
    }
  
  
    /*
     * A candidate beat must be stronger
     * than the average energy.
     */
    const threshold =
      average * 1.35;
  
  
    /*
     * Prevent excessively fast flashes.
     *
     * 180 ms ≈ 333 BPM.
     */
    const minimumInterval =
      0.18;
  
  
    let lastBeatTime =
      -Infinity;
  
  
    for (
      let i = 2;
      i < energy.length - 2;
      i++
    ) {
  
      const current =
        energy[i];
  
      const previous =
        energy[i - 1];
  
      const next =
        energy[i + 1];
  
  
      /*
       * Check whether this point is
       * a local maximum.
       */
      const isPeak =
        current.value >=
          previous.value &&
        current.value >=
          next.value;
  
  
      /*
       * Check whether the peak is strong
       * enough to be considered a beat.
       */
      const isStrongEnough =
        current.value >=
        threshold;
  
  
      /*
       * Prevent multiple detections
       * of the same beat.
       */
      const enoughTimePassed =
        current.time -
          lastBeatTime >=
        minimumInterval;
  
  
      if (
        isPeak &&
        isStrongEnough &&
        enoughTimePassed
      ) {
  
        /*
         * Convert the peak into a strength
         * value between approximately 0 and 1.
         */
        const strength =
          Math.min(
            1,
            current.value /
              (average * 3)
          );
  
  
        if (strength > 0.05) {
  
          beats.push({
  
            time:
              current.time,
  
            strength,
  
          });
  
  
          lastBeatTime =
            current.time;
  
        }
      }
    }
  
  
    return beats;
  }
  
  
  /*
   * Analyze any local audio file.
   *
   * IMPORTANT:
   *
   * The file remains on the organizer's computer.
   *
   * It is never uploaded to Firebase.
   * It is never sent to an external API.
   */
  export async function analyzeAudioFile(
    file: File
  ): Promise<AudioAnalysis> {
  
    /*
     * Decode the file locally.
     */
    const audioBuffer =
      await decodeAudioFile(
        file
      );
  
  
    /*
     * Convert the audio to mono.
     */
    const mono =
      getMonoSamples(
        audioBuffer
      );
  
  
    /*
     * Calculate short-term energy.
     */
    const energy =
      calculateEnergy(
        mono,
        audioBuffer.sampleRate
      );
  
  
    /*
     * Detect beat-like peaks.
     */
    const beats =
      detectBeats(
        energy
      );
  
  
    return {
  
      duration:
        audioBuffer.duration,
  
      beats,
  
      energy:
        energy.map(
          (point) =>
            point.value
        ),
  
    };
  }
  