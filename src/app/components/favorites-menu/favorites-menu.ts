import { Component, input, output } from '@angular/core';
import { RadioStation } from '../../radio-browser';
import { CountryLabel } from '../country-label/country-label';

@Component({
  selector: 'app-favorites-menu',
  imports: [CountryLabel],
  templateUrl: './favorites-menu.html',
  styleUrl: './favorites-menu.css',
})
export class FavoritesMenu {
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
