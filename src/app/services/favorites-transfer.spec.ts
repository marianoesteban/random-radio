import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FavoritesStore } from '../stores/favorites-store';
import { FavoritesTransfer } from './favorites-transfer';

describe('FavoritesTransfer', () => {
  const favoritesStore = {
    exportFavorites: vi.fn(() => '{"version":1,"stations":[]}'),
    importFavorites: vi.fn(),
  };

  beforeEach(() => {
    favoritesStore.exportFavorites.mockClear();
    favoritesStore.importFavorites.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: FavoritesStore, useValue: favoritesStore }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should download an export and clear its success message after five seconds', () => {
    vi.useFakeTimers();
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:favorites');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const transfer = TestBed.inject(FavoritesTransfer);

    transfer.exportToFile();

    expect(favoritesStore.exportFavorites).toHaveBeenCalledOnce();
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:favorites');
    expect(document.querySelector('a[download="random-radio-favorites.json"]')).toBeNull();
    expect(transfer.message()).toBe('Favorites exported.');
    expect(transfer.failed()).toBe(false);

    vi.advanceTimersByTime(5_000);

    expect(transfer.message()).toBe('');
  });

  it('should expose importing state and report a successful import', async () => {
    let resolveFile: ((contents: string) => void) | undefined;
    const contents = new Promise<string>((resolve) => {
      resolveFile = resolve;
    });
    const file = {
      size: 100,
      text: vi.fn(() => contents),
    } as unknown as File;
    favoritesStore.importFavorites.mockReturnValue({ success: true, imported: 2, total: 2 });
    const transfer = TestBed.inject(FavoritesTransfer);

    const importPromise = transfer.importFromFile(file);

    expect(transfer.isImporting()).toBe(true);
    resolveFile?.('{"version":1,"stations":[]}');
    await importPromise;

    expect(favoritesStore.importFavorites).toHaveBeenCalledWith('{"version":1,"stations":[]}');
    expect(transfer.isImporting()).toBe(false);
    expect(transfer.message()).toBe('2 favorites imported.');
    expect(transfer.failed()).toBe(false);
  });

  it('should keep validation errors visible until they are explicitly cleared', async () => {
    vi.useFakeTimers();
    const file = {
      size: 100,
      text: vi.fn().mockResolvedValue('{}'),
    } as unknown as File;
    favoritesStore.importFavorites.mockReturnValue({ success: false, reason: 'invalid' });
    const transfer = TestBed.inject(FavoritesTransfer);

    await transfer.importFromFile(file);
    vi.advanceTimersByTime(10_000);

    expect(transfer.message()).toBe('That file is not a valid Random Radio favorites export.');
    expect(transfer.failed()).toBe(true);

    transfer.clearMessage();

    expect(transfer.message()).toBe('');
    expect(transfer.failed()).toBe(false);
  });

  it('should explain when an import would exceed the favorite limit', async () => {
    const file = {
      size: 100,
      text: vi.fn().mockResolvedValue('{"version":1,"stations":[]}'),
    } as unknown as File;
    favoritesStore.importFavorites.mockReturnValue({ success: false, reason: 'limit' });
    const transfer = TestBed.inject(FavoritesTransfer);

    await transfer.importFromFile(file);

    expect(transfer.message()).toBe('You can save up to 500 favorite stations.');
    expect(transfer.failed()).toBe(true);
  });
});
