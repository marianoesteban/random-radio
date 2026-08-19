import { Component, computed, input, output, signal } from '@angular/core';
import { RadioStation } from '../../radio/radio-station';
import { CountryLabel } from '../../shared/country-label/country-label';
import { TitleOnOverflow } from '../../shared/title-on-overflow';

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
  readonly isTuning = input(false);
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
