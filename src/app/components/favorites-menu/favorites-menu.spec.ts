import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { RadioStation } from '../../models/radio-station';
import { FavoriteStationItem } from '../favorite-station-item/favorite-station-item';
import { FavoritesMenu } from './favorites-menu';

function createStation(overrides: Partial<RadioStation> = {}): RadioStation {
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
      createStation({ source: { provider: 'radio-browser', externalId: '2' } }),
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

  it('should emit when the menu button is clicked', () => {
    const fixture = TestBed.createComponent(FavoritesMenu);
    const menuHandler = vi.fn();

    fixture.componentInstance.menuToggled.subscribe(menuHandler);
    fixture.componentRef.setInput('favorites', []);
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();

    const menuButton = fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement;

    expect(menuButton.getAttribute('aria-expanded')).toBe('true');

    menuButton.click();

    expect(menuHandler).toHaveBeenCalledOnce();
  });

  it('should dismiss an open menu when clicking outside it', () => {
    const fixture = TestBed.createComponent(FavoritesMenu);
    const menuHandler = vi.fn();

    fixture.componentInstance.menuToggled.subscribe(menuHandler);
    fixture.componentRef.setInput('favorites', []);
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();

    document.body.click();

    expect(menuHandler).toHaveBeenCalledOnce();
  });

  it('should keep an open menu open when clicking inside it', () => {
    const fixture = TestBed.createComponent(FavoritesMenu);
    const menuHandler = vi.fn();

    fixture.componentInstance.menuToggled.subscribe(menuHandler);
    fixture.componentRef.setInput('favorites', []);
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.favorites-panel') as HTMLElement;

    panel.click();

    expect(menuHandler).not.toHaveBeenCalled();
  });

  it('should dismiss an open menu with Escape and return focus to its button', () => {
    const fixture = TestBed.createComponent(FavoritesMenu);
    const menuHandler = vi.fn();

    fixture.componentInstance.menuToggled.subscribe(menuHandler);
    fixture.componentRef.setInput('favorites', []);
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    const menuButton = fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement;

    expect(menuHandler).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(menuButton);
  });

  it('should render an item for each favorite and forward station selections', () => {
    const station = createStation();
    const secondStation = createStation({
      source: { provider: 'radio-browser', externalId: 'station-2' },
    });
    const fixture = TestBed.createComponent(FavoritesMenu);
    const selectionHandler = vi.fn();

    fixture.componentInstance.stationSelected.subscribe(selectionHandler);
    fixture.componentRef.setInput('favorites', [station, secondStation]);
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();

    const favoriteItems = fixture.debugElement.queryAll(By.directive(FavoriteStationItem));
    const firstItem = favoriteItems[0].componentInstance as FavoriteStationItem;
    const secondItem = favoriteItems[1].componentInstance as FavoriteStationItem;

    expect(firstItem.station()).toBe(station);
    expect(secondItem.station()).toBe(secondStation);

    firstItem.stationSelected.emit(station);

    expect(selectionHandler).toHaveBeenCalledWith(station);
  });

  it('should disable favorite items while a station is loading', () => {
    const station = createStation();
    const fixture = TestBed.createComponent(FavoritesMenu);
    fixture.componentRef.setInput('favorites', [station]);
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('isLoading', true);
    fixture.detectChanges();

    const favoriteItem = fixture.debugElement.query(By.directive(FavoriteStationItem))
      .componentInstance as FavoriteStationItem;

    expect(favoriteItem.disabled()).toBe(true);
  });

  it('should show an empty state when there are no favorites', () => {
    const fixture = TestBed.createComponent(FavoritesMenu);
    fixture.componentRef.setInput('favorites', []);
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();

    const emptyMessage = fixture.nativeElement.querySelector('.empty-favorites') as HTMLElement;

    expect(emptyMessage.textContent).toContain('Your favorite stations will show up here.');
  });

  it('should emit export and import requests', () => {
    const station = createStation();
    const fixture = TestBed.createComponent(FavoritesMenu);
    const exportHandler = vi.fn();
    const importHandler = vi.fn();
    const file = new File(['{}'], 'favorites.json', { type: 'application/json' });

    fixture.componentInstance.exportRequested.subscribe(exportHandler);
    fixture.componentInstance.importRequested.subscribe(importHandler);
    fixture.componentRef.setInput('favorites', [station]);
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();

    const exportButton = fixture.nativeElement.querySelector(
      '.transfer-action[type="button"]',
    ) as HTMLButtonElement;
    const fileInput = fixture.nativeElement.querySelector('.file-input') as HTMLInputElement;

    exportButton.click();
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: { item: () => file },
    });
    fileInput.dispatchEvent(new Event('change'));

    expect(exportHandler).toHaveBeenCalledOnce();
    expect(importHandler).toHaveBeenCalledWith(file);
    expect(fileInput.value).toBe('');
  });

  it('should disable unavailable transfers and announce an import error', () => {
    const fixture = TestBed.createComponent(FavoritesMenu);
    fixture.componentRef.setInput('favorites', []);
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('isLoading', false);
    fixture.componentRef.setInput('isImporting', true);
    fixture.componentRef.setInput('transferMessage', 'The import failed.');
    fixture.componentRef.setInput('transferFailed', true);
    fixture.detectChanges();

    const exportButton = fixture.nativeElement.querySelector(
      '.transfer-action[type="button"]',
    ) as HTMLButtonElement;
    const fileInput = fixture.nativeElement.querySelector('.file-input') as HTMLInputElement;
    const message = fixture.nativeElement.querySelector('.transfer-message') as HTMLElement;

    expect(exportButton.disabled).toBe(true);
    expect(fileInput.disabled).toBe(true);
    expect(message.getAttribute('role')).toBe('alert');
    expect(message.textContent).toContain('The import failed.');
  });
});
