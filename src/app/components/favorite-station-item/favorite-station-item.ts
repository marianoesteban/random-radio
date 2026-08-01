import { Component, computed, input, output, signal } from '@angular/core';
import { TitleOnOverflow } from '../../directives/title-on-overflow';
import { RadioStation } from '../../models/radio-station';
import { CountryLabel } from '../country-label/country-label';

@Component({
  selector: 'app-favorite-station-item',
  imports: [CountryLabel, TitleOnOverflow],
  templateUrl: './favorite-station-item.html',
  styleUrl: './favorite-station-item.css',
})
export class FavoriteStationItem {
  private readonly failedImageUrl = signal('');

  readonly station = input.required<RadioStation>();
  readonly disabled = input(false);
  readonly isSelected = input(false);
  readonly stationSelected = output<RadioStation>();

  protected readonly canShowImage = computed(() => {
    const imageUrl = this.station().imageUrl;
    return imageUrl.length > 0 && imageUrl !== this.failedImageUrl();
  });

  protected selectStation(): void {
    this.stationSelected.emit(this.station());
  }

  protected handleImageError(): void {
    this.failedImageUrl.set(this.station().imageUrl);
  }
}
