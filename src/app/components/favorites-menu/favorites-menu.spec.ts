import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { RadioStation } from '../../radio-browser';
import { FavoritesMenu } from './favorites-menu';

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

describe('FavoritesMenu', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FavoritesMenu],
    }).compileComponents();
  });

  it('should render the closed menu button with the favorite count', () => {
    const fixture = TestBed.createComponent(FavoritesMenu);
    fixture.componentRef.setInput('favorites', [
      createStation(),
      createStation({ stationuuid: '2' }),
    ]);
    fixture.componentRef.setInput('isOpen', false);
    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement;
    const count = fixture.nativeElement.querySelector('.favorite-count') as HTMLElement;

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(count.textContent).toContain('2');
    expect(fixture.nativeElement.querySelector('.favorites-panel')).toBeNull();
  });

  it('should render favorite stations and emit menu and selection events', () => {
    const station = createStation();
    const fixture = TestBed.createComponent(FavoritesMenu);
    const menuHandler = vi.fn();
    const selectionHandler = vi.fn();

    fixture.componentInstance.menuToggled.subscribe(menuHandler);
    fixture.componentInstance.stationSelected.subscribe(selectionHandler);
    fixture.componentRef.setInput('favorites', [station]);
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();

    const menuButton = fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement;
    const favoriteButton = fixture.nativeElement.querySelector(
      '.favorite-station',
    ) as HTMLButtonElement;

    expect(menuButton.getAttribute('aria-expanded')).toBe('true');
    expect(favoriteButton.textContent).toContain('Station One');
    expect(favoriteButton.textContent).toContain('Argentina');
    expect(favoriteButton.getAttribute('aria-label')).toBe('Play favorite station Station One');

    menuButton.click();
    favoriteButton.click();

    expect(menuHandler).toHaveBeenCalledOnce();
    expect(selectionHandler).toHaveBeenCalledWith(station);
  });

  it('should show an empty state and disable station buttons while loading', () => {
    const station = createStation();
    const loadingFixture = TestBed.createComponent(FavoritesMenu);
    loadingFixture.componentRef.setInput('favorites', [station]);
    loadingFixture.componentRef.setInput('isOpen', true);
    loadingFixture.componentRef.setInput('isLoading', true);
    loadingFixture.detectChanges();

    const disabledStation = loadingFixture.nativeElement.querySelector(
      '.favorite-station',
    ) as HTMLButtonElement;

    expect(disabledStation.disabled).toBe(true);

    const emptyFixture = TestBed.createComponent(FavoritesMenu);
    emptyFixture.componentRef.setInput('favorites', []);
    emptyFixture.componentRef.setInput('isOpen', true);
    emptyFixture.componentRef.setInput('isLoading', false);
    emptyFixture.detectChanges();

    const emptyMessage = emptyFixture.nativeElement.querySelector(
      '.empty-favorites',
    ) as HTMLElement;

    expect(emptyMessage.textContent).toContain('Your favorite stations will show up here.');
  });
});
