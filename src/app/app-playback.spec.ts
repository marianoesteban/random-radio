import { vi } from 'vitest';
import { AppTestSetup, createStation, flushPromises } from './testing/app-test-setup';

let setup: AppTestSetup;

beforeEach(async () => {
  setup = await AppTestSetup.create();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('station playback', () => {
  it('should fetch a random station and wire it into audio playback', async () => {
    const station = createStation();
    setup.stationService.getRandomStation.mockResolvedValue(station);
    const fixture = setup.createFixture();

    const button = fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Loading...');

    await setup.settlePlayback(fixture);
    await setup.settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;

    expect(setup.stationService.getRandomStation).toHaveBeenCalledOnce();
    expect(audio.src).toBe('https://stream.example.com/live');
    expect(setup.playAudio).toHaveBeenCalledOnce();
    expect(setup.stationService.reportPlayback).toHaveBeenCalledWith(station.source);
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain('Play a Random Station');
    expect(fixture.nativeElement.querySelector('app-station-card')).not.toBeNull();
  });
});

describe('random station recovery', () => {
  it('should show an error and reset loading when a station cannot be fetched', async () => {
    setup.stationService.getRandomStation.mockRejectedValue(new Error('offline'));
    const fixture = setup.createFixture();

    const button = fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(button.disabled).toBe(true);

    await fixture.whenStable();
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('.status') as HTMLElement;

    expect(button.disabled).toBe(false);
    expect(status.textContent).toContain('The station could not be played. Try another one.');
    expect(setup.playAudio).not.toHaveBeenCalled();
  });

  it('should stop retrying after three random stations fail to play', async () => {
    setup.playAudio.mockRejectedValue(new Error('blocked'));
    const fixture = setup.createFixture();
    await setup.playRandomStation(fixture);

    const status = fixture.nativeElement.querySelector('.status') as HTMLElement;

    expect(setup.stationService.getRandomStation).toHaveBeenCalledTimes(3);
    expect(setup.playAudio).toHaveBeenCalledTimes(3);
    expect(setup.title.getTitle()).toBe('Random Radio - Station One');
    expect(status.textContent).toContain('Could not find a playable station. Try again.');
  });

  it('should automatically play another random station after playback fails', async () => {
    const firstStation = createStation();
    const nextStation = createStation({
      source: { provider: 'radio-browser', externalId: 'station-2' },
      name: 'Station Two',
      streamUrl: 'https://stream.example.com/two',
    });
    setup.stationService.getRandomStation
      .mockResolvedValueOnce(firstStation)
      .mockResolvedValueOnce(nextStation);
    setup.playAudio
      .mockRejectedValueOnce(new Error('broken stream'))
      .mockResolvedValueOnce(undefined);
    const fixture = setup.createFixture();

    (fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement).click();
    await setup.settlePlayback(fixture);
    await setup.settlePlayback(fixture);
    await setup.settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    const status = fixture.nativeElement.querySelector('.status') as HTMLElement;

    expect(setup.stationService.getRandomStation).toHaveBeenCalledTimes(2);
    expect(setup.playAudio).toHaveBeenCalledTimes(2);
    expect(audio.src).toBe('https://stream.example.com/two');
    expect(setup.title.getTitle()).toBe('Random Radio - Station Two');
    expect(status.textContent).not.toContain('Could not find a playable station');
  });

  it('should not skip a random station when the browser blocks autoplay', async () => {
    const blockedError = new Error('Autoplay is not allowed');
    blockedError.name = 'NotAllowedError';
    setup.playAudio.mockRejectedValue(blockedError);
    const fixture = setup.createFixture();
    await setup.playRandomStation(fixture);

    expect(setup.stationService.getRandomStation).toHaveBeenCalledOnce();
    expect(setup.playAudio).toHaveBeenCalledOnce();
    expect(setup.title.getTitle()).toBe('Random Radio - Station One');
  });

  it('should automatically try another random station when a stream fails while tuning', async () => {
    const fixture = setup.createFixture();
    const firstStation = createStation();
    const nextStation = createStation({
      source: { provider: 'radio-browser', externalId: 'station-2' },
      name: 'Station Two',
      streamUrl: 'https://stream.example.com/two',
    });

    setup.stationService.getRandomStation
      .mockResolvedValueOnce(firstStation)
      .mockResolvedValueOnce(nextStation);
    setup.playAudio
      .mockReturnValueOnce(new Promise<void>(() => undefined))
      .mockResolvedValueOnce(undefined);

    (fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement).click();
    await flushPromises();
    fixture.detectChanges();

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;

    audio.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    await setup.settlePlayback(fixture);
    await setup.settlePlayback(fixture);

    expect(setup.stationService.getRandomStation).toHaveBeenCalledTimes(2);
    expect(setup.playAudio).toHaveBeenCalledTimes(2);
    expect(audio.src).toBe('https://stream.example.com/two');
    expect(setup.title.getTitle()).toBe('Random Radio - Station Two');
  });

  it('should keep the current random station when its stream disconnects after playing', async () => {
    const fixture = setup.createFixture();
    const audio = await setup.playRandomStation(fixture);

    audio.dispatchEvent(new Event('playing'));
    audio.dispatchEvent(new Event('error'));
    audio.dispatchEvent(new Event('pause'));
    fixture.detectChanges();
    await setup.settlePlayback(fixture);

    const status = fixture.nativeElement.querySelector('.status') as HTMLElement;

    expect(setup.stationService.getRandomStation).toHaveBeenCalledOnce();
    expect(setup.playAudio).toHaveBeenCalledOnce();
    expect(setup.title.getTitle()).toBe('Random Radio - Station One');
    expect(status.textContent).toContain('This stream disconnected. Press play to reconnect.');
  });

  it('should not select another random station when reconnecting the current station fails', async () => {
    const fixture = setup.createFixture();
    const audio = await setup.playRandomStation(fixture);

    audio.dispatchEvent(new Event('playing'));
    audio.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    setup.playAudio.mockRejectedValueOnce(new Error('reconnect failed'));

    const playbackButton = fixture.nativeElement.querySelector(
      '.playback-action',
    ) as HTMLButtonElement;
    playbackButton.click();
    await setup.settlePlayback(fixture);

    const status = fixture.nativeElement.querySelector('.status') as HTMLElement;

    expect(setup.stationService.getRandomStation).toHaveBeenCalledOnce();
    expect(setup.playAudio).toHaveBeenCalledTimes(2);
    expect(audio.src).toBe('https://stream.example.com/live');
    expect(setup.title.getTitle()).toBe('Random Radio - Station One');
    expect(status.textContent).toContain(
      'Could not reconnect to this station. Press play to try again.',
    );
  });
});
