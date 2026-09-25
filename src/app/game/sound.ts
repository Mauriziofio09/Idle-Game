/**
 * The archive's sound. prompt.md section 7 lists it as optional (*KANN*): rain ambience
 * plus very restrained tones, generated through the Web Audio API so the game ships no
 * audio files, **off by default**, with a switch in the settings.
 *
 * Nothing is built until the player asks for sound. A browser that refuses audio, or a
 * page the player has not interacted with yet, must never break the game, so every call
 * into the audio graph is allowed to fail quietly — losing a sound is not worth losing a
 * run over.
 */

import { Injectable, InjectionToken, inject, signal } from '@angular/core';

import { GAME_STORAGE } from './storage';
import type { LogKind } from './log';

/** Where the preference lives. Its own key: sound is a setting, not part of a run. */
export const SOUND_KEY = 'entropie.sound';

/**
 * Creating the audio context, behind a token for the same reason localStorage and
 * requestAnimationFrame are: a test must be able to watch what the game asks for without
 * a real audio device, and jsdom has none.
 */
export const AUDIO_CONTEXT = new InjectionToken<() => BaseAudioContext | null>('AUDIO_CONTEXT', {
  factory: () => () => {
    try {
      const ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
      return ctor === undefined ? null : new ctor();
    } catch {
      return null;
    }
  },
});

/** How loud anything gets. Quiet by design: this is a room, not a soundtrack. */
const RAIN_GAIN = 0.05;
const CUE_GAIN = 0.07;
/** Seconds. Long enough to read as a tone, short enough never to become a melody. */
const CUE_SECONDS = 0.18;
/** Two seconds of noise, looped. Long enough that the loop is not audible as a loop. */
const RAIN_SECONDS = 2;

/** One tone per kind of news. A fifth apart, low: an instrument panel, not a game. */
const CUE_HZ: Record<LogKind, number> = {
  note: 440,
  loss: 220,
  end: 165,
};

@Injectable({ providedIn: 'root' })
export class Sound {
  private readonly storage = inject(GAME_STORAGE);
  private readonly createContext = inject(AUDIO_CONTEXT);

  private context: BaseAudioContext | null = null;
  private rain: AudioBufferSourceNode | null = null;

  private readonly _enabled = signal(this.read());
  readonly enabled = this._enabled.asReadonly();

  setEnabled(on: boolean): void {
    this._enabled.set(on);
    try {
      this.storage?.setItem(SOUND_KEY, on ? 'on' : 'off');
    } catch {
      // A browser that refuses storage still gets sound for this session.
    }
    if (on) {
      this.startRain();
    } else {
      this.stopRain();
    }
  }

  /**
   * A single quiet tone for a line that just arrived in the log. Called for one line at a
   * time on purpose: catching up on hours away produces dozens at once, and the caller
   * drops those rather than playing a burst at somebody who just opened the tab.
   */
  cue(kind: LogKind): void {
    if (!this._enabled()) {
      return;
    }
    const context = this.ensureContext();
    if (context === null || !('createOscillator' in context)) {
      return;
    }
    try {
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = CUE_HZ[kind];
      // A flat tone reads as a fault; fading out reads as a note.
      gain.gain.setValueAtTime(CUE_GAIN, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + CUE_SECONDS);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + CUE_SECONDS);
    } catch {
      // No sound this time. Not worth a broken frame.
    }
  }

  private read(): boolean {
    try {
      return this.storage?.getItem(SOUND_KEY) === 'on';
    } catch {
      return false;
    }
  }

  private ensureContext(): BaseAudioContext | null {
    this.context ??= this.createContext();
    return this.context;
  }

  /** Filtered noise, looped. The rain of a drowned city, not a rain sample. */
  private startRain(): void {
    const context = this.ensureContext();
    if (context === null || this.rain !== null || !('createBufferSource' in context)) {
      return;
    }
    try {
      const frames = Math.floor(context.sampleRate * RAIN_SECONDS);
      const buffer = context.createBuffer(1, frames, context.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < frames; i += 1) {
        // Math.random is fine here: this is a sound, not the simulation. The engine's
        // determinism rule covers the archive, and no save ever depends on this noise.
        channel[i] = Math.random() * 2 - 1;
      }

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      // Two filters: the low pass takes the hiss off, the high pass takes the rumble out.
      const lowPass = context.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 1400;
      const highPass = context.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = 300;

      const gain = context.createGain();
      gain.gain.value = RAIN_GAIN;

      source.connect(highPass).connect(lowPass).connect(gain).connect(context.destination);
      source.start();

      this.rain = source;
    } catch {
      this.rain = null;
    }
  }

  private stopRain(): void {
    try {
      this.rain?.stop();
    } catch {
      // Already stopped, or never really started.
    }
    this.rain = null;
  }
}
