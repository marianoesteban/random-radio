import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { type MockInstance, vi } from 'vitest';
import { RadioStation } from '../../models/radio-station';
import { AudioPlayer, AudioPlayerError } from '../audio-player/audio-player';
import { PlaybackRecovery, RadioStationPlayer } from './radio-station-player';

function createStation(): RadioStation {
  return {
    source: {
      provider: 'radio-browser',
      externalId: 'station-1',
    },
    name: 'Station One',
    streamUrl: 'https://stream.example.com/live',
    homepageUrl: 'https://example.com',
    imageUrl: '',
    countryCode: 'AR',
  };
}

describe('RadioStationPlayer', () => {
  let fixture: ComponentFixture<RadioStationPlayer>;
  let loadAudio: MockInstance<() => void>;
  let playAudio: MockInstance<() => Promise<void>>;

  beforeEach(async () => {
    loadAudio = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    playAudio = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [RadioStationPlayer],
    }).compileComponents();

    fixture = TestBed.createComponent(RadioStationPlayer);
    fixture.componentRef.setInput('station', null);
    fixture.componentRef.setInput('isFavorite', false);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show the ready status until a station is selected', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.status')?.textContent).toContain('Ready when you are.');
    expect(compiled.querySelector('app-station-card')).toBeNull();
    expect(compiled.querySelector('app-audio-player')).toBeNull();
  });

  it('should compose the station card and audio player for a station', async () => {
    const station = createStation();

    fixture.componentRef.setInput('station', station);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const audio = compiled.querySelector('audio') as HTMLAudioElement;

    expect(compiled.querySelector('app-station-card')).not.toBeNull();
    expect(compiled.querySelector('app-audio-player')).not.toBeNull();
    expect(audio.src).toBe('https://stream.example.com/live');
    expect(loadAudio).toHaveBeenCalledOnce();
    expect(playAudio).toHaveBeenCalledOnce();
  });

  it('should expose station-level events and translate player errors', async () => {
    const station = createStation();
    const favoriteToggled = vi.fn();
    const playbackStarted = vi.fn();
    const playbackFailed = vi.fn();

    fixture.componentInstance.favoriteToggled.subscribe(favoriteToggled);
    fixture.componentInstance.playbackStarted.subscribe(playbackStarted);
    fixture.componentInstance.playbackFailed.subscribe(playbackFailed);
    fixture.componentRef.setInput('station', station);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const audio = compiled.querySelector('audio') as HTMLAudioElement;

    (compiled.querySelector('.favorite-toggle') as HTMLButtonElement).click();
    audio.dispatchEvent(new Event('playing'));
    audio.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(favoriteToggled).toHaveBeenCalledWith(station);
    expect(playbackStarted).toHaveBeenCalledWith(station.source);
    expect(playbackFailed).toHaveBeenCalledWith({
      source: station.source,
      recovery: 'user-action-required',
    });
  });

  it.each([
    ['playback-failed', 'select-another-station'],
    ['stream-disconnected', 'user-action-required'],
    ['stream-failed', 'select-another-station'],
    ['stream-timeout', 'select-another-station'],
    ['autoplay-blocked', 'user-action-required'],
    ['player-unavailable', 'none'],
  ] satisfies ReadonlyArray<readonly [AudioPlayerError, PlaybackRecovery]>)(
    'should translate %s to the %s recovery strategy',
    async (error, recovery) => {
      const station = createStation();
      const playbackFailed = vi.fn();

      fixture.componentInstance.playbackFailed.subscribe(playbackFailed);
      fixture.componentRef.setInput('station', station);
      fixture.detectChanges();
      await fixture.whenStable();

      const audioPlayer = fixture.debugElement.query(By.directive(AudioPlayer))
        .componentInstance as AudioPlayer;

      audioPlayer.playbackFailed.emit({
        source: audioPlayer.source(),
        error,
      });

      expect(playbackFailed).toHaveBeenCalledWith({
        source: station.source,
        recovery,
      });
    },
  );

  it.each([
    ['autoplay-blocked', 'Press play to start this station.'],
    ['player-unavailable', 'The audio player is not available.'],
    ['playback-failed', 'The station could not be played. Try another one.'],
    ['stream-disconnected', 'This stream disconnected. Press play to reconnect.'],
    ['stream-failed', 'This stream stopped responding. Try another station.'],
    ['stream-timeout', 'This station took too long to respond. Try another one.'],
  ] satisfies ReadonlyArray<readonly [AudioPlayerError, string]>)(
    'should translate %s to a user-facing message',
    async (error, message) => {
      fixture.componentRef.setInput('station', createStation());
      fixture.detectChanges();
      await fixture.whenStable();

      const audioPlayer = fixture.debugElement.query(By.directive(AudioPlayer))
        .componentInstance as AudioPlayer;

      audioPlayer.playerStateChanged.emit({
        isPlaying: false,
        isBuffering: false,
        error,
      });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.status')?.textContent).toContain(message);
    },
  );

  it('should not restart a playing station when it is selected again', async () => {
    const station = createStation();

    fixture.componentRef.setInput('station', station);
    fixture.detectChanges();
    await fixture.whenStable();

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    audio.dispatchEvent(new Event('playing'));
    fixture.detectChanges();

    fixture.componentRef.setInput('station', { ...station });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadAudio).toHaveBeenCalledOnce();
    expect(playAudio).toHaveBeenCalledOnce();
  });

  it('should restart a stopped station when it is selected again', async () => {
    const station = createStation();

    fixture.componentRef.setInput('station', station);
    fixture.detectChanges();
    await fixture.whenStable();

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    audio.dispatchEvent(new Event('pause'));
    fixture.detectChanges();

    fixture.componentRef.setInput('station', { ...station });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadAudio).toHaveBeenCalledTimes(2);
    expect(playAudio).toHaveBeenCalledTimes(2);
  });
});
