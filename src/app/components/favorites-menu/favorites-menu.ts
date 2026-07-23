import { Component, input, output } from '@angular/core';
import { TitleOnOverflow } from '../../directives/title-on-overflow';
import { RadioStation, radioStationId } from '../../models/radio-station';
import { CountryLabel } from '../country-label/country-label';

@Component({
  selector: 'app-favorites-menu',
  imports: [CountryLabel, TitleOnOverflow],
  templateUrl: './favorites-menu.html',
  styleUrl: './favorites-menu.css',
})
export class FavoritesMenu {
  protected readonly stationId = radioStationId;

  readonly favorites = input.required<RadioStation[]>();
  readonly isOpen = input.required<boolean>();
  readonly isLoading = input.required<boolean>();
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

  protected selectStation(station: RadioStation): void {
    this.stationSelected.emit(station);
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
