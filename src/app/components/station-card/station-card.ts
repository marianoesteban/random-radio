import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { RadioStation } from '../../services/radio-browser';
import { CountryLabel } from '../country-label/country-label';

@Component({
  selector: 'app-station-card',
  imports: [CountryLabel, NgTemplateOutlet],
  templateUrl: './station-card.html',
  styleUrl: './station-card.css',
})
export class StationCard {
  readonly station = input.required<RadioStation>();
  readonly isFavorite = input.required<boolean>();
  readonly favoriteToggled = output<RadioStation>();

  protected readonly homepage = computed(() => {
    const homepage = this.station().homepage.trim();

    if (!homepage) {
      return '';
    }

    return /^https?:\/\//i.test(homepage) ? homepage : '';
  });

  protected toggleFavorite(): void {
    this.favoriteToggled.emit(this.station());
  }
}
