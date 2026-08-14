import { RadioStation } from './models/radio-station';
import { vi } from 'vitest';
import { AppTestSetup, createStation } from './testing/app-test-setup';

let setup: AppTestSetup;

beforeEach(async () => {
  setup = await AppTestSetup.create();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('last played station restoration', () => {
  it('should refresh and persist the last played station without starting playback', async () => {
    const storedStation = createStation({ name: 'Previously Playing' });
    const currentStation = createStation({
      name: 'Currently Available',
      streamUrl: 'https://stream.example.com/current',
    });
    setup.lastPlayedStationStorage.load.mockReturnValue(storedStation);
    localStorage.setItem(
      'random-radio:favorites',
      JSON.stringify({ version: 1, stations: [storedStation] }),
    );
    setup.stationService.refreshStation.mockResolvedValue(currentStation);

    const fixture = setup.createFixture();

    const initialCompiled = fixture.nativeElement as HTMLElement;
    const initialPlaybackButton = initialCompiled.querySelector(
      '.playback-action',
    ) as HTMLButtonElement;
    const randomButton = initialCompiled.querySelector('.primary-action') as HTMLButtonElement;

    expect(initialCompiled.querySelector('.station-details h2')?.textContent).toContain(
      'Previously Playing',
    );
    expect(initialCompiled.querySelector('.status')?.textContent).toContain('Tuning in...');
    expect(initialPlaybackButton.disabled).toBe(true);
    expect(randomButton.disabled).toBe(false);

    await setup.settlePlayback(fixture);

    const compiled = fixture.nativeElement as HTMLElement;
    const playbackButton = compiled.querySelector('.playback-action') as HTMLButtonElement;
    const favorites = JSON.parse(localStorage.getItem('random-radio:favorites') ?? 'null') as {
      stations: RadioStation[];
    };

    expect(compiled.querySelector('.station-details h2')?.textContent).toContain(
      'Currently Available',
    );
    expect(compiled.querySelector('.status')?.textContent).toContain('Stopped.');
    expect(playbackButton.disabled).toBe(false);
    expect(setup.playAudio).not.toHaveBeenCalled();
    expect(setup.loadAudio).not.toHaveBeenCalled();
    expect(setup.stationService.reportPlayback).not.toHaveBeenCalled();
    expect(setup.stationService.refreshStation).toHaveBeenCalledWith(storedStation);
    expect(setup.lastPlayedStationStorage.save).toHaveBeenCalledWith(currentStation);
    expect(favorites.stations).toEqual([currentStation]);
    expect(setup.title.getTitle()).toBe('Random Radio - Currently Available');

    playbackButton.click();
    await setup.settlePlayback(fixture);

    expect(setup.playAudio).toHaveBeenCalledOnce();
    expect(setup.loadAudio).toHaveBeenCalledOnce();
    expect(setup.stationService.reportPlayback).toHaveBeenCalledWith(currentStation.source);
  });

  it('should keep a stored last played station when its refresh fails', async () => {
    const station = createStation({ name: 'Previously Playing' });
    setup.lastPlayedStationStorage.load.mockReturnValue(station);
    setup.stationService.refreshStation.mockRejectedValue(new Error('offline'));

    const fixture = setup.createFixture();
    await setup.settlePlayback(fixture);

    const compiled = fixture.nativeElement as HTMLElement;
    const playbackButton = compiled.querySelector('.playback-action') as HTMLButtonElement;

    expect(compiled.querySelector('.station-details h2')?.textContent).toContain(
      'Previously Playing',
    );
    expect(compiled.querySelector('.status')?.textContent).toContain('Stopped.');
    expect(playbackButton.disabled).toBe(false);
    expect(setup.lastPlayedStationStorage.save).not.toHaveBeenCalled();
    expect(setup.title.getTitle()).toBe('Random Radio - Previously Playing');
  });
});
