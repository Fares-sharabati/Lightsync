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
   * Check whether the selected file looks like
   * a supported audio file.
   *
   * We check both MIME type AND file extension
   * because some browsers do not provide a
   * reliable MIME type.
   */
  function isAudioFile(file: File): boolean {
    if (file.type.startsWith('audio/')) {
      return true;
    }
  
    const fileName =
      file.name.toLowerCase();
  
    const audioExtensions = [
      '.mp3',
      '.wav',
      '.m4a',
      '.aac',
      '.ogg',
      '.oga',
      '.flac',
      '.webm',
      '.opus',
    ];
  
    return audioExtensions.some(
      (extension) =>
        fileName.endsWith(extension)
    );
  }
  
  
  /*
   * Decode an audio file into raw PCM audio data.
   *
   * Everything happens locally in the browser.
   *
   * The file is NOT uploaded anywhere.
   */
  async function decodeAudioFile(
    file: File
  ): Promise<AudioBuffer> {
  
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
   * This gives us an approximation of how
   * energetic each small section of the song is.
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
   * Detect beat-like peaks.
   *
   * This is our first version of the detector.
   *
   * Later we can make this considerably smarter
   * by looking at frequency bands and estimating BPM.
   */
  function detectBeats(
    energy: {
      time: number;
      value: number;
    }[]
  ): Beat[] {
  
    const beats: Beat[] = [];

  if (energy.length < 10) {
      return [];
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
  
  
    /*
     * If the song is extremely quiet,
     * avoid dividing by a tiny number.
     */
    if (average <= 0.000001) {
      return [];
    }
  
  
    /*
     * Peaks need to be noticeably stronger
     * than the average.
     */
    const threshold =
      average * 1.35;
  
  
    /*
     * Do not allow extremely rapid flashes.
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
       * Local maximum.
       */
      const isPeak =
        current.value >=
          previous.value &&
        current.value >=
          next.value;
  
  
      /*
       * Strong enough to potentially
       * represent a beat.
       */
      const isStrongEnough =
        current.value >=
        threshold;
  
  
      /*
       * Prevent excessive flashing.
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
         * Normalize beat strength
         * approximately from 0 to 1.
         */
        const strength =
          Math.min(
            1,
            current.value /
              (average * 3)
          );
  
  
        /*
         * Avoid accepting extremely tiny
         * floating-point values.
         */
        if (strength > 0.05) {
  
          /*
           * Store the detected beat.
           */
        
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
   * No API.
   * No upload.
   * No external service.
   */
  export async function analyzeAudioFile(
    file: File
  ): Promise<AudioAnalysis> {
  
    /*
     * Validate using MIME type OR extension.
     */
    if (!isAudioFile(file)) {
  
      throw new Error(
        `Unsupported audio file: ${file.name}`
      );
  
    }
  
  
    /*
     * Make sure the file actually contains data.
     */
    if (file.size === 0) {
  
      throw new Error(
        'The selected audio file is empty.'
      );
  
    }
  
  
    /*
     * Decode the audio locally.
     */
    const audioBuffer =
      await decodeAudioFile(
        file
      );
  
  
    /*
     * Convert to mono.
     */
    const mono =
      getMonoSamples(
        audioBuffer
      );
  
  
    /*
     * Calculate energy.
     */
    const energy =
      calculateEnergy(
        mono,
        audioBuffer.sampleRate
      );
  
  
    /*
     * Detect beats.
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
  