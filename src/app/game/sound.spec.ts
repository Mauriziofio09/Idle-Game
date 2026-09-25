import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { AUDIO_CONTEXT, SOUND_KEY, Sound } from './sound';
import { GAME_STORAGE, memoryStorage, type KeyValueStorage } from './storage';

/**
 * A stand-in for the Web Audio graph. It records what was asked for rather than making a
 * sound, which is the only way to test this: jsdom has no audio device, and a real
 * AudioContext cannot start before the player has interacted with the page.
 */
function fakeContext() {
  const started: string[] = [];
  const context = {
    sampleRate: 44100,
    currentTime: 0,
    destination: { connect: () => undefined },
    createBuffer: (_channels: number, frames: number) => ({
      getChannelData: () => new Float32Array(frames),
    }),
    createBufferSource: () => {
      const node = {
        buffer: null as unknown,
        loop: false,
        connect: (next: unknown) => next,
        start: () => started.push('rain'),
        stop: () => started.push('rain-stop'),
      };
      return node;
    },
    createBiquadFilter: () => ({
      type: '',
      frequency: { value: 0 },
      connect: (next: unknown) => next,
    }),
    createGain: () => ({
      gain: {
        value: 0,
        setValueAtTime: () => undefined,
        exponentialRampToValueAtTime: () => undefined,
      },
      connect: (next: unknown) => next,
    }),
    createOscillator: () => ({
      type: '',
      frequency: { value: 0 },
      connect: (next: unknown) => next,
      start: () => started.push('cue'),
      stop: () => undefined,
    }),
  };
  return { context, started };
}

describe('Sound', () => {
  let storage: KeyValueStorage;
  let audio: ReturnType<typeof fakeContext>;
  let sound: Sound;

  beforeEach(() => {
    storage = memoryStorage();
    audio = fakeContext();
    TestBed.configureTestingModule({
      providers: [
        { provide: GAME_STORAGE, useValue: storage },
        { provide: AUDIO_CONTEXT, useValue: () => audio.context as unknown as BaseAudioContext },
      ],
    });
    sound = TestBed.inject(Sound);
  });

  it('is off until the player asks for it, and builds nothing meanwhile', () => {
    expect(sound.enabled()).toBe(false);
    sound.cue('note');
    expect(audio.started).toEqual([]);
  });

  it('starts the rain when switched on and stops it when switched off', () => {
    sound.setEnabled(true);
    expect(sound.enabled()).toBe(true);
    expect(audio.started).toContain('rain');

    sound.setEnabled(false);
    expect(sound.enabled()).toBe(false);
    expect(audio.started).toContain('rain-stop');
  });

  it('plays one tone per line, and none at all while switched off', () => {
    sound.setEnabled(true);
    audio.started.length = 0;
    sound.cue('loss');
    expect(audio.started).toEqual(['cue']);

    sound.setEnabled(false);
    audio.started.length = 0;
    sound.cue('loss');
    expect(audio.started).toEqual([]);
  });

  it('remembers the choice, so the archive does not ask twice', () => {
    sound.setEnabled(true);
    expect(storage.getItem(SOUND_KEY)).toBe('on');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: GAME_STORAGE, useValue: storage },
        { provide: AUDIO_CONTEXT, useValue: () => audio.context as unknown as BaseAudioContext },
      ],
    });
    expect(TestBed.inject(Sound).enabled()).toBe(true);
  });

  it('carries on silently when the browser refuses an audio context', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: GAME_STORAGE, useValue: storage },
        { provide: AUDIO_CONTEXT, useValue: () => null },
      ],
    });
    const silent = TestBed.inject(Sound);
    expect(() => {
      silent.setEnabled(true);
      silent.cue('end');
    }).not.toThrow();
    // The switch still reflects what the player asked for, even with nothing to play it.
    expect(silent.enabled()).toBe(true);
  });

  it('never lets a broken audio graph take the run down', () => {
    TestBed.resetTestingModule();
    const exploding = {
      sampleRate: 44100,
      currentTime: 0,
      destination: {},
      createBuffer: () => {
        throw new Error('no');
      },
      createBufferSource: () => {
        throw new Error('no');
      },
      createOscillator: () => {
        throw new Error('no');
      },
      createGain: () => {
        throw new Error('no');
      },
      createBiquadFilter: () => {
        throw new Error('no');
      },
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: GAME_STORAGE, useValue: storage },
        { provide: AUDIO_CONTEXT, useValue: () => exploding as unknown as BaseAudioContext },
      ],
    });
    const broken = TestBed.inject(Sound);
    expect(() => {
      broken.setEnabled(true);
      broken.cue('note');
    }).not.toThrow();
  });

  it('survives a browser that refuses storage', () => {
    TestBed.resetTestingModule();
    const refusing: KeyValueStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: GAME_STORAGE, useValue: refusing },
        { provide: AUDIO_CONTEXT, useValue: () => audio.context as unknown as BaseAudioContext },
      ],
    });
    const sandboxed = TestBed.inject(Sound);
    expect(sandboxed.enabled()).toBe(false);
    expect(() => sandboxed.setEnabled(true)).not.toThrow();
    // It still works for this session; only remembering it fails.
    expect(sandboxed.enabled()).toBe(true);
  });
});
