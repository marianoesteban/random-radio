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
  readonly menuToggled = output<void>();
  readonly stationSelected = output<RadioStation>();

  protected toggleMenu(): void {
    this.menuToggled.emit();
  }

  protected selectStation(station: RadioStation): void {
    this.stationSelected.emit(station);
  }
}
