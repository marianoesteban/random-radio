import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { CountryLabel } from '../../shared/country-label/country-label';
import { ExpandableText } from '../../shared/expandable-text/expandable-text';
import { RadioStation } from '../radio-station';

@Component({
  selector: 'app-station-card',
  imports: [CountryLabel, ExpandableText, NgTemplateOutlet],
  templateUrl: './station-card.html',
  styleUrl: './station-card.css',
})
export class StationCard {
  readonly station = input.required<RadioStation>();
  readonly isFavorite = input.required<boolean>();
  readonly favoriteToggled = output<RadioStation>();

  protected readonly homepage = computed(() => {
    const homepage = this.station().homepageUrl.trim();

    if (!homepage) {
      return '';
    }

    return /^https?:\/\//i.test(homepage) ? homepage : '';
  });

  protected toggleFavorite(): void {
    this.favoriteToggled.emit(this.station());
  }
}
