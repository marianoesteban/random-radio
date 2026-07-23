import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Service, signal } from '@angular/core';
import { FavoritesStore } from '../stores/favorites-store';

@Service()
export class FavoritesTransfer {
  private readonly favoritesStore = inject(FavoritesStore);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly importing = signal(false);
  private readonly transferMessage = signal('');
  private readonly transferFailed = signal(false);
  private messageTimer: ReturnType<typeof setTimeout> | undefined;

  readonly isImporting = this.importing.asReadonly();
  readonly message = this.transferMessage.asReadonly();
  readonly failed = this.transferFailed.asReadonly();

  constructor() {
    this.destroyRef.onDestroy(() => this.cancelMessageTimer());
  }

  exportToFile(): void {
    this.clearMessage();
    let downloadUrl = '';
    let link: HTMLAnchorElement | null = null;

    try {
      const file = new Blob([this.favoritesStore.exportFavorites()], {
        type: 'application/json',
      });
      downloadUrl = URL.createObjectURL(file);
      link = this.document.createElement('a');

      link.href = downloadUrl;
      link.download = 'random-radio-favorites.json';
      link.hidden = true;
      this.document.body.append(link);
      link.click();
      this.showMessage('Favorites exported.');
    } catch {
      this.showMessage('Favorites could not be exported.', true);
    } finally {
      link?.remove();

      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    }
  }

  async importFromFile(file: File): Promise<void> {
    this.importing.set(true);
    this.clearMessage();

    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File too large');
      }

      const result = this.favoritesStore.importFavorites(await file.text());

      if (!result.success) {
        this.showMessage(
          result.reason === 'invalid'
            ? 'That file is not a valid Random Radio favorites export.'
            : 'The imported favorites could not be saved in this browser.',
          true,
        );
        return;
      }

      this.showMessage(
        result.imported === 0
          ? 'No new favorites were found in that file.'
          : `${result.imported} ${result.imported === 1 ? 'favorite' : 'favorites'} imported.`,
      );
    } catch {
      this.showMessage('Favorites could not be read from that file.', true);
    } finally {
      this.importing.set(false);
    }
  }

  clearMessage(): void {
    this.cancelMessageTimer();
    this.transferMessage.set('');
    this.transferFailed.set(false);
  }

  private showMessage(message: string, failed = false): void {
    this.clearMessage();
    this.transferMessage.set(message);
    this.transferFailed.set(failed);

    if (!failed) {
      this.messageTimer = setTimeout(() => this.clearMessage(), 5_000);
    }
  }

  private cancelMessageTimer(): void {
    if (this.messageTimer === undefined) {
      return;
    }

    clearTimeout(this.messageTimer);
    this.messageTimer = undefined;
  }
}
