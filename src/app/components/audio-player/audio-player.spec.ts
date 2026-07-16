import { ComponentFixture, TestBed } from '@angular/core/testing';
import { type Mock, type MockInstance, vi } from 'vitest';
import { RadioBrowser, RadioStation } from '../../services/radio-browser';
import { AudioPlayer } from './audio-player';

function createStation(overrides: Partial<RadioStation> = {}): RadioStation {
  return {
    stationuuid: 'station-1',
    name: 'Station One',
    url: 'https://example.com/live',
    url_resolved: 'https://stream.example.com/live',
    homepage: 'https://example.com',
    favicon: '',
    countrycode: 'AR',
    language: 'Spanish',
    tags: 'music',
    codec: 'MP3',
    bitrate: 128,
    ...overrides,
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('AudioPlayer', () => {
  let radioBrowser: {
    streamUrl: Mock<(station: RadioStation) => string>;
    reportStationClick: Mock<(stationUuid: string) => Promise<void>>;
  };
  let loadAudio: MockInstance<() => void>;
  let playAudio: MockInstance<() => Promise<void>>;
  let pauseAudio: MockInstance<() => void>;

  beforeEach(async () => {
    radioBrowser = {
      streamUrl: vi.fn((station) => station.url_resolved || station.url),
      reportStationClick: vi.fn(() => Promise.resolve()),
    };
    loadAudio = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    playAudio = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    pauseAudio = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [AudioPlayer],
      providers: [{ provide: RadioBrowser, useValue: radioBrowser }],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createFixture(station = createStation()): {
    fixture: ComponentFixture<AudioPlayer>;
    stateHandler: Mock;
  } {
    const fixture = TestBed.createComponent(AudioPlayer);
    const stateHandler = vi.fn();

    fixture.componentInstance.playerStateChanged.subscribe(stateHandler);
    fixture.componentRef.setInput('station', station);
    fixture.componentRef.setInput('isLoading', false);
    fixture.componentRef.setInput('playRequestId', 1);
    fixture.detectChanges();

    return { fixture, stateHandler };
  }

  async function settlePlayback(fixture: ComponentFixture<AudioPlayer>): Promise<void> {
    await fixture.whenStable();
    await flushPromises();
    fixture.detectChanges();
  }

  it('should render controls and play the selected station', async () => {
    const station = createStation();
    const { fixture, stateHandler } = createFixture(station);

    await settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;

    expect(fixture.nativeElement.querySelector('app-audio-controls')).not.toBeNull();
    expect(radioBrowser.streamUrl).toHaveBeenCalledWith(station);
    expect(audio.src).toBe('https://stream.example.com/live');
    expect(audio.hasAttribute('controls')).toBe(false);
    expect(loadAudio).toHaveBeenCalledOnce();
    expect(playAudio).toHaveBeenCalledOnce();
    expect(radioBrowser.reportStationClick).toHaveBeenCalledWith('station-1');
    expect(stateHandler).toHaveBeenCalledWith({
      isPlaying: false,
      isTuning: true,
      error: '',
    });
  });

  it('should pause and resume the current station', async () => {
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
    expect(playbackButton.getAttribute('aria-label')).toBe('Start current station');

    playbackButton.click();
    await settlePlayback(fixture);

    expect(playAudio).toHaveBeenCalledTimes(2);
    expect(playbackButton.getAttribute('aria-label')).toBe('Stop current station');
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
  });

  it('should play again when a new play request arrives', async () => {
    const { fixture } = createFixture();

    await settlePlayback(fixture);

    const nextStation = createStation({
      stationuuid: 'station-2',
      name: 'Station Two',
      url_resolved: 'https://stream.example.com/two',
    });

    fixture.componentRef.setInput('station', nextStation);
    fixture.componentRef.setInput('playRequestId', 2);
    fixture.detectChanges();
    await settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;

    expect(audio.src).toBe('https://stream.example.com/two');
    expect(loadAudio).toHaveBeenCalledTimes(2);
    expect(playAudio).toHaveBeenCalledTimes(2);
    expect(radioBrowser.reportStationClick).toHaveBeenCalledWith('station-2');
  });

  it('should emit an error when playback fails', async () => {
    playAudio.mockRejectedValue(new Error('blocked'));

    const { fixture, stateHandler } = createFixture();

    await settlePlayback(fixture);

    expect(radioBrowser.reportStationClick).not.toHaveBeenCalled();
    expect(stateHandler).toHaveBeenCalledWith({
      isPlaying: false,
      isTuning: false,
      error: 'The station could not be played. Try another one.',
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
      isTuning: false,
      error: 'This stream stopped responding. Try another station.',
    });
  });
});
