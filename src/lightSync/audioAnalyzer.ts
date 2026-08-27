export type Beat = {
    time: number;
    strength: number;
  };
  
  export type AudioAnalysis = {
    duration: number;
    beats: Beat[];
    energy: number[];
  };
  
  /**
   * Decode an audio file into raw PCM audio data.
   *
   * Everything happens locally in the browser.
   * The file is NOT uploaded anywhere.
   */
  async function decodeAudioFile(
    file: File
  ): Promise<AudioBuffer> {
    const arrayBuffer = await file.arrayBuffer();
  
    const audioContext =
      new AudioContext();
  
    try {
      const audioBuffer =
        await audioContext.decodeAudioData(
          arrayBuffer
        );
  
      return audioBuffer;
    } finally {
      await audioContext.close();
    }
  }
  
  /**
   * Convert stereo/multi-channel audio into
   * a single mono channel.
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
  
    for (let channel = 0; channel < channelCount; channel++) {
      const data =
        audioBuffer.getChannelData(channel);
  
      for (let i = 0; i < length; i++) {
        mono[i] +=
          data[i] / channelCount;
      }
    }
  
    return mono;
  }
  
  /**
   * Calculate short-term energy over the song.
   *
   * We use RMS energy to determine how strong
   * different parts of the music are.
   */
  function calculateEnergy(
    samples: Float32Array,
    sampleRate: number
  ): {
    time: number;
    value: number;
  }[] {
    const windowSize =
      Math.floor(sampleRate * 0.05);
  
    const hopSize =
      Math.floor(sampleRate * 0.025);
  
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
  
        sum += sample * sample;
      }
  
      const rms =
        Math.sqrt(
          sum / windowSize
        );
  
      result.push({
        time: start / sampleRate,
        value: rms,
      });
    }
  
    return result;
  }
  
  /**
   * Detect beat-like energy peaks.
   *
   * This is intentionally conservative.
   * We don't want every little sound in a song
   * to become a flashlight event.
   */
  function detectBeats(
    energy: {
      time: number;
      value: number;
    }[]
  ): Beat[] {
    if (energy.length < 10) {
      return [];
    }
  
    const beats: Beat[] = [];
  
    /*
     * Calculate average energy.
     */
    let total = 0;
  
    for (const point of energy) {
      total += point.value;
    }
  
    const average =
      total / energy.length;
  
    /*
     * A beat needs to be noticeably stronger
     * than the surrounding audio.
     */
    const threshold =
      average * 1.35;
  
    /*
     * Prevent impossibly fast flashes.
     *
     * 180 ms = about 333 BPM maximum.
     */
    const minimumInterval = 0.18;
  
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
  
      const isPeak =
        current.value >= previous.value &&
        current.value >= next.value;
  
      const isStrongEnough =
        current.value >= threshold;
  
      const enoughTimePassed =
        current.time - lastBeatTime >=
        minimumInterval;
  
      if (
        isPeak &&
        isStrongEnough &&
        enoughTimePassed
      ) {
        /*
         * Normalize strength approximately
         * between 0 and 1.
         */
        const strength =
          Math.min(
            1,
            current.value /
              (average * 3)
          );
  
        beats.push({
          time: current.time,
          strength,
        });
  
        lastBeatTime =
          current.time;
      }
    }
  
    return beats;
  }
  
  /**
   * Analyze any local audio file.
   *
   * No API.
   * No upload.
   * No server.
   */
  export async function analyzeAudioFile(
    file: File
  ): Promise<AudioAnalysis> {
    if (!file.type.startsWith('audio/')) {
      throw new Error(
        'Please select an audio file.'
      );
    }
  
    const audioBuffer =
      await decodeAudioFile(file);
  
    const mono =
      getMonoSamples(audioBuffer);
  
    const energy =
      calculateEnergy(
        mono,
        audioBuffer.sampleRate
      );
  
    const beats =
      detectBeats(energy);
  
    return {
      duration:
        audioBuffer.duration,
  
      beats,
  
      energy: energy.map(
        (point) => point.value
      ),
    };
  }
  