import { Component, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { RadioStation, radioStationId } from '../../models/radio-station';
import { FavoriteStationItem } from '../favorite-station-item/favorite-station-item';

@Component({
  selector: 'app-favorites-menu',
  imports: [FavoriteStationItem],
  templateUrl: './favorites-menu.html',
  styleUrl: './favorites-menu.css',
  host: {
    '(document:click)': 'handleDocumentClick($event)',
    '(document:keydown.escape)': 'handleEscapeKey()',
  },
})
export class FavoritesMenu {
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');

  protected readonly stationId = radioStationId;

  readonly favorites = input.required<RadioStation[]>();
  readonly selectedStation = input<RadioStation | null>(null);
  readonly isOpen = input.required<boolean>();
  readonly isLoading = input.required<boolean>();
  readonly loadingStationId = input<string | null>(null);
  readonly isImporting = input(false);
  readonly transferMessage = input('');
  readonly transferFailed = input(false);
  readonly menuToggled = output<void>();
  readonly stationSelected = output<RadioStation>();
  readonly exportRequested = output<void>();
  readonly importRequested = output<File>();

  protected toggleMenu(): void {
    this.menuToggled.emit();
  }

  protected handleDocumentClick(event: Event): void {
    const target = event.target;

    if (this.isOpen() && target instanceof Node && !this.element.nativeElement.contains(target)) {
      this.menuToggled.emit();
    }
  }

  protected handleEscapeKey(): void {
    if (!this.isOpen()) {
      return;
    }

    this.menuToggled.emit();
    this.menuButton().nativeElement.focus();
  }

  protected selectStation(station: RadioStation): void {
    this.stationSelected.emit(station);
  }

  protected isSelectedStation(station: RadioStation): boolean {
    const selectedStation = this.selectedStation();

    return selectedStation !== null && radioStationId(station) === radioStationId(selectedStation);
  }

  protected exportFavorites(): void {
    this.exportRequested.emit();
  }

  protected importFavorites(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.item(0);

    if (file) {
      this.importRequested.emit(file);
    }

    input.value = '';
  }
}
