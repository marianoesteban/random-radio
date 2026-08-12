import { ComponentFixture, TestBed } from '@angular/core/testing';
import { type Mock, type MockInstance, vi } from 'vitest';
import {
  AudioPreferencesStorage,
  type AudioPreferences,
} from '../../storage/audio-preferences-storage';
import { AudioPlayer, AudioSource } from './audio-player';

function createSource(overrides: Partial<AudioSource> = {}): AudioSource {
  return {
    url: 'https://stream.example.com/live',
    ...overrides,
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('AudioPlayer', () => {
  let loadAudio: MockInstance<() => void>;
  let playAudio: MockInstance<() => Promise<void>>;
  let pauseAudio: MockInstance<() => void>;
  let preferencesStorage: {
    load: Mock;
    saveVolume: Mock;
    saveMuted: Mock;
  };

  beforeEach(async () => {
    preferencesStorage = {
      load: vi.fn((): AudioPreferences => ({ volume: 1, muted: false })),
      saveVolume: vi.fn(),
      saveMuted: vi.fn(),
    };
    loadAudio = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    playAudio = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    pauseAudio = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [AudioPlayer],
      providers: [{ provide: AudioPreferencesStorage, useValue: preferencesStorage }],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createFixture(source = createSource()): {
    fixture: ComponentFixture<AudioPlayer>;
    stateHandler: Mock;
    playbackStartedHandler: Mock;
    playbackFailedHandler: Mock;
  } {
    const fixture = TestBed.createComponent(AudioPlayer);
    const stateHandler = vi.fn();
    const playbackStartedHandler = vi.fn();
    const playbackFailedHandler = vi.fn();

    fixture.componentInstance.playerStateChanged.subscribe(stateHandler);
    fixture.componentInstance.playbackStarted.subscribe(playbackStartedHandler);
    fixture.componentInstance.playbackFailed.subscribe(playbackFailedHandler);
    fixture.componentRef.setInput('source', source);
    fixture.componentRef.setInput('disabled', false);
    fixture.detectChanges();

    return { fixture, stateHandler, playbackStartedHandler, playbackFailedHandler };
  }

  it('should render a source without playing when autoplay is disabled', async () => {
    const source = createSource();
    const fixture = TestBed.createComponent(AudioPlayer);

    fixture.componentRef.setInput('source', source);
    fixture.componentRef.setInput('autoplay', false);
    fixture.detectChanges();
    await settlePlayback(fixture);

    const playbackButton = fixture.nativeElement.querySelector(
      '.playback-action',
    ) as HTMLButtonElement;

    expect(playbackButton.getAttribute('aria-label')).toBe('Play audio');
    expect(loadAudio).not.toHaveBeenCalled();
    expect(playAudio).not.toHaveBeenCalled();

    playbackButton.click();
    await settlePlayback(fixture);

    expect(loadAudio).toHaveBeenCalledOnce();
    expect(playAudio).toHaveBeenCalledOnce();
  });

  it('should not present a generic disabled state as tuning', async () => {
    const fixture = TestBed.createComponent(AudioPlayer);

    fixture.componentRef.setInput('source', createSource());
    fixture.componentRef.setInput('autoplay', false);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    await settlePlayback(fixture);

    const playbackButton = fixture.nativeElement.querySelector(
      '.playback-action',
    ) as HTMLButtonElement;

    expect(playbackButton.disabled).toBe(true);
    expect(playbackButton.getAttribute('aria-label')).toBe('Play audio');
    expect(playbackButton.getAttribute('aria-busy')).toBe('false');
    expect(playbackButton.querySelector('.tuning-indicator')).toBeNull();
  });

  async function settlePlayback(fixture: ComponentFixture<AudioPlayer>): Promise<void> {
    await fixture.whenStable();
    await flushPromises();
    fixture.detectChanges();
  }

  it('should render controls and play the selected station', async () => {
    const source = createSource();
    const { fixture, stateHandler, playbackStartedHandler } = createFixture(source);

    await settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;

    expect(fixture.nativeElement.querySelector('app-audio-controls')).not.toBeNull();
    expect(audio.src).toBe('https://stream.example.com/live');
    expect(audio.volume).toBe(1);
    expect(audio.muted).toBe(false);
    expect(audio.hasAttribute('controls')).toBe(false);
    expect(loadAudio).toHaveBeenCalledOnce();
    expect(playAudio).toHaveBeenCalledOnce();
    expect(playbackStartedHandler).toHaveBeenCalledWith(source);
    expect(stateHandler).toHaveBeenCalledWith({
      isPlaying: false,
      isBuffering: true,
      error: null,
    });
  });

  it('should stop the stream and reconnect when played again', async () => {
    const { fixture } = createFixture();

    await settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    audio.dispatchEvent(new Event('playing'));
    fixture.detectChanges();

    const playbackButton = fixture.nativeElement.querySelector(
      '.playback-action',
    ) as HTMLButtonElement;

    playbackButton.click();
    fixture.detectChanges();

    expect(pauseAudio).toHaveBeenCalledOnce();
    expect(audio.src).toBe('');
    expect(loadAudio).toHaveBeenCalledTimes(2);
    expect(playbackButton.getAttribute('aria-label')).toBe('Play audio');

    playbackButton.click();
    await settlePlayback(fixture);
    audio.dispatchEvent(new Event('playing'));
    fixture.detectChanges();

    expect(audio.src).toBe('https://stream.example.com/live');
    expect(loadAudio).toHaveBeenCalledTimes(3);
    expect(playAudio).toHaveBeenCalledTimes(2);
    expect(playbackButton.getAttribute('aria-label')).toBe('Stop audio');
  });

  it('should update the audio volume from the controls', async () => {
    const { fixture } = createFixture();

    await settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    const volumeInput = fixture.nativeElement.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;

    volumeInput.value = '0.35';
    volumeInput.dispatchEvent(new Event('input'));
    volumeInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(audio.volume).toBe(0.35);
    expect(preferencesStorage.saveVolume).toHaveBeenCalledWith(0.35);
  });

  it('should mute without changing volume and unmute at the same level', async () => {
    const { fixture } = createFixture();

    await settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    const volumeInput = fixture.nativeElement.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    const volumeButton = fixture.nativeElement.querySelector('.volume-action') as HTMLButtonElement;

    volumeInput.value = '0.35';
    volumeInput.dispatchEvent(new Event('input'));
    volumeInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    volumeButton.click();
    fixture.detectChanges();

    expect(audio.volume).toBe(0.35);
    expect(audio.muted).toBe(true);
    expect(volumeInput.value).toBe('0');
    expect(volumeButton.getAttribute('aria-label')).toBe('Unmute audio');
    expect(preferencesStorage.saveVolume).toHaveBeenCalledWith(0.35);
    expect(preferencesStorage.saveMuted).toHaveBeenLastCalledWith(true);

    volumeButton.click();
    fixture.detectChanges();

    expect(audio.volume).toBe(0.35);
    expect(audio.muted).toBe(false);
    expect(volumeInput.value).toBe('0.35');
    expect(volumeButton.getAttribute('aria-label')).toBe('Mute audio');
    expect(preferencesStorage.saveMuted).toHaveBeenLastCalledWith(false);
  });

  it('should treat dragging to zero as mute and restore the pre-drag level', async () => {
    const { fixture } = createFixture();

    await settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    const volumeInput = fixture.nativeElement.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    const volumeButton = fixture.nativeElement.querySelector('.volume-action') as HTMLButtonElement;

    volumeInput.value = '0.65';
    volumeInput.dispatchEvent(new Event('input'));
    volumeInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    volumeInput.value = '0.05';
    volumeInput.dispatchEvent(new Event('input'));
    volumeInput.value = '0';
    volumeInput.dispatchEvent(new Event('input'));
    volumeInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(audio.volume).toBe(0.65);
    expect(audio.muted).toBe(true);
    expect(volumeInput.value).toBe('0');
    expect(volumeButton.getAttribute('aria-label')).toBe('Unmute audio');
    expect(volumeButton.getAttribute('aria-pressed')).toBe('true');
    expect(preferencesStorage.saveVolume).toHaveBeenCalledOnce();
    expect(preferencesStorage.saveVolume).toHaveBeenCalledWith(0.65);
    expect(preferencesStorage.saveMuted).toHaveBeenLastCalledWith(true);

    volumeButton.click();
    fixture.detectChanges();

    expect(audio.volume).toBe(0.65);
    expect(audio.muted).toBe(false);
    expect(volumeInput.value).toBe('0.65');
    expect(volumeButton.getAttribute('aria-label')).toBe('Mute audio');
    expect(preferencesStorage.saveMuted).toHaveBeenLastCalledWith(false);
  });

  it('should unmute when the volume slider is moved', async () => {
    const { fixture } = createFixture();

    await settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    const volumeInput = fixture.nativeElement.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    const volumeButton = fixture.nativeElement.querySelector('.volume-action') as HTMLButtonElement;

    volumeButton.click();
    fixture.detectChanges();
    expect(audio.muted).toBe(true);

    volumeInput.value = '0.4';
    volumeInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(audio.volume).toBe(0.4);
    expect(audio.muted).toBe(false);
    expect(volumeButton.getAttribute('aria-label')).toBe('Mute audio');
  });

  it('should apply the loaded audio preferences', async () => {
    preferencesStorage.load.mockReturnValue({ volume: 0.6, muted: true });

    const { fixture } = createFixture();

    await settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    const volumeInput = fixture.nativeElement.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    const volumeButton = fixture.nativeElement.querySelector('.volume-action') as HTMLButtonElement;

    expect(audio.volume).toBe(0.6);
    expect(audio.muted).toBe(true);
    expect(volumeInput.value).toBe('0');
    expect(volumeButton.getAttribute('aria-label')).toBe('Unmute audio');
    expect(preferencesStorage.load).toHaveBeenCalledOnce();

    volumeButton.click();
    fixture.detectChanges();

    expect(audio.volume).toBe(0.6);
    expect(audio.muted).toBe(false);
    expect(volumeInput.value).toBe('0.6');
  });

  it('should play again when a new source is selected', async () => {
    const { fixture } = createFixture();

    await settlePlayback(fixture);

    const nextSource = createSource({ url: 'https://stream.example.com/two' });

    fixture.componentRef.setInput('source', nextSource);
    fixture.detectChanges();
    await settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;

    expect(audio.src).toBe('https://stream.example.com/two');
    expect(loadAudio).toHaveBeenCalledTimes(2);
    expect(playAudio).toHaveBeenCalledTimes(2);
  });

  it('should replay when the same URL is selected in a new source', async () => {
    const { fixture } = createFixture();

    await settlePlayback(fixture);

    fixture.componentRef.setInput('source', createSource());
    fixture.detectChanges();
    await settlePlayback(fixture);

    expect(loadAudio).toHaveBeenCalledTimes(2);
    expect(playAudio).toHaveBeenCalledTimes(2);
  });

  it('should ignore playback completion from a replaced source', async () => {
    let finishFirstPlayback = (): void => undefined;
    const firstPlayback = new Promise<void>((resolve) => {
      finishFirstPlayback = resolve;
    });
    const firstSource = createSource();
    const nextSource = createSource({ url: 'https://stream.example.com/two' });

    playAudio.mockReturnValueOnce(firstPlayback).mockResolvedValueOnce(undefined);

    const { fixture, playbackStartedHandler } = createFixture(firstSource);

    fixture.componentRef.setInput('source', nextSource);
    fixture.detectChanges();
    await flushPromises();

    expect(playbackStartedHandler).toHaveBeenCalledOnce();
    expect(playbackStartedHandler).toHaveBeenCalledWith(nextSource);

    finishFirstPlayback();
    await flushPromises();

    expect(playbackStartedHandler).toHaveBeenCalledOnce();
  });

  it('should emit an error when playback fails', async () => {
    playAudio.mockRejectedValue(new Error('blocked'));
    const source = createSource();

    const { fixture, stateHandler, playbackStartedHandler, playbackFailedHandler } =
      createFixture(source);

    await settlePlayback(fixture);

    expect(playbackStartedHandler).not.toHaveBeenCalled();
    expect(stateHandler).toHaveBeenCalledWith({
      isPlaying: false,
      isBuffering: false,
      error: 'playback-failed',
    });
    expect(playbackFailedHandler).toHaveBeenCalledWith({
      source,
      error: 'playback-failed',
    });
  });

  it('should distinguish autoplay being blocked from a broken stream', async () => {
    const blockedError = new Error('Autoplay is not allowed');
    blockedError.name = 'NotAllowedError';
    playAudio.mockRejectedValue(blockedError);

    const { fixture, stateHandler, playbackFailedHandler } = createFixture();

    await settlePlayback(fixture);

    expect(stateHandler).toHaveBeenCalledWith({
      isPlaying: false,
      isBuffering: false,
      error: 'autoplay-blocked',
    });
    expect(playbackFailedHandler).toHaveBeenCalledWith({
      source: createSource(),
      error: 'autoplay-blocked',
    });
  });

  it('should emit an error when the stream stops responding', async () => {
    const source = createSource();
    const { fixture, stateHandler, playbackFailedHandler } = createFixture(source);

    await settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    audio.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(stateHandler).toHaveBeenCalledWith({
      isPlaying: false,
      isBuffering: false,
      error: 'stream-failed',
    });
    expect(playbackFailedHandler).toHaveBeenCalledWith({
      source,
      error: 'stream-failed',
    });
  });

  it('should distinguish a disconnect after playback started from an unplayable stream', async () => {
    const source = createSource();
    const { fixture, stateHandler, playbackFailedHandler } = createFixture(source);

    await settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    audio.dispatchEvent(new Event('playing'));
    audio.dispatchEvent(new Event('error'));
    audio.dispatchEvent(new Event('pause'));
    fixture.detectChanges();

    expect(stateHandler).toHaveBeenLastCalledWith({
      isPlaying: false,
      isBuffering: false,
      error: 'stream-disconnected',
    });
    expect(playbackFailedHandler).toHaveBeenCalledWith({
      source,
      error: 'stream-disconnected',
    });
  });

  it('should allow tuning to be cancelled', async () => {
    playAudio.mockReturnValue(new Promise<void>(() => undefined));
    const { fixture, stateHandler, playbackFailedHandler } = createFixture();
    await flushPromises();
    fixture.detectChanges();

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    const playbackButton = fixture.nativeElement.querySelector(
      '.playback-action',
    ) as HTMLButtonElement;

    expect(playbackButton.getAttribute('aria-label')).toBe('Cancel tuning');
    expect(playbackButton.querySelector('.tuning-indicator')).not.toBeNull();

    playbackButton.click();
    fixture.detectChanges();

    expect(pauseAudio).toHaveBeenCalledOnce();
    expect(audio.src).toBe('');
    expect(playbackButton.getAttribute('aria-label')).toBe('Play audio');
    expect(stateHandler).toHaveBeenLastCalledWith({
      isPlaying: false,
      isBuffering: false,
      error: null,
    });
    expect(playbackFailedHandler).not.toHaveBeenCalled();
  });

  it('should stop tuning and report a timeout when a station does not respond', async () => {
    vi.useFakeTimers();
    playAudio.mockReturnValue(new Promise<void>(() => undefined));

    try {
      const source = createSource();
      const { fixture, stateHandler, playbackFailedHandler } = createFixture(source);
      await flushPromises();
      fixture.detectChanges();

      await vi.advanceTimersByTimeAsync(15_000);
      fixture.detectChanges();

      const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
      const playbackButton = fixture.nativeElement.querySelector(
        '.playback-action',
      ) as HTMLButtonElement;

      expect(pauseAudio).toHaveBeenCalledOnce();
      expect(audio.src).toBe('');
      expect(playbackButton.getAttribute('aria-label')).toBe('Play audio');
      expect(stateHandler).toHaveBeenLastCalledWith({
        isPlaying: false,
        isBuffering: false,
        error: 'stream-timeout',
      });
      expect(playbackFailedHandler).toHaveBeenCalledWith({
        source,
        error: 'stream-timeout',
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
