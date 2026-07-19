import { ComponentFixture, TestBed } from '@angular/core/testing';
import { type Mock, type MockInstance, vi } from 'vitest';
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

  beforeEach(async () => {
    localStorage.clear();
    loadAudio = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    playAudio = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    pauseAudio = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [AudioPlayer],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createFixture(source = createSource()): {
    fixture: ComponentFixture<AudioPlayer>;
    stateHandler: Mock;
    playbackStartedHandler: Mock;
  } {
    const fixture = TestBed.createComponent(AudioPlayer);
    const stateHandler = vi.fn();
    const playbackStartedHandler = vi.fn();

    fixture.componentInstance.playerStateChanged.subscribe(stateHandler);
    fixture.componentInstance.playbackStarted.subscribe(playbackStartedHandler);
    fixture.componentRef.setInput('source', source);
    fixture.componentRef.setInput('disabled', false);
    fixture.detectChanges();

    return { fixture, stateHandler, playbackStartedHandler };
  }

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
    fixture.detectChanges();

    expect(audio.volume).toBe(0.35);
    expect(localStorage.getItem('random-radio:volume')).toBe('0.35');
  });

  it('should restore the stored volume when the player is recreated', async () => {
    localStorage.setItem('random-radio:volume', '0.6');

    const { fixture } = createFixture();

    await settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    const volumeInput = fixture.nativeElement.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;

    expect(audio.volume).toBe(0.6);
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

    const { fixture, stateHandler, playbackStartedHandler } = createFixture();

    await settlePlayback(fixture);

    expect(playbackStartedHandler).not.toHaveBeenCalled();
    expect(stateHandler).toHaveBeenCalledWith({
      isPlaying: false,
      isBuffering: false,
      error: 'playback-failed',
    });
  });

  it('should emit an error when the stream stops responding', async () => {
    const { fixture, stateHandler } = createFixture();

    await settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    audio.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(stateHandler).toHaveBeenCalledWith({
      isPlaying: false,
      isBuffering: false,
      error: 'stream-failed',
    });
  });
});
