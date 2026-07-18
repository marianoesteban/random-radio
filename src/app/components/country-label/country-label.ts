import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-country-label',
  templateUrl: './country-label.html',
  styleUrl: './country-label.css',
})
export class CountryLabel {
  readonly countryCode = input.required<string>();

  private readonly regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

  protected readonly normalizedCountryCode = computed(() =>
    this.countryCode().trim().toUpperCase(),
  );

  protected readonly countryName = computed(() => {
    const countryCode = this.normalizedCountryCode();

    if (!countryCode) {
      return '';
    }

    try {
      return this.regionNames.of(countryCode) ?? this.countryCode();
    } catch {
      return this.countryCode();
    }
  });

  protected readonly countryFlag = computed(() => {
    const countryCode = this.normalizedCountryCode();

    if (!/^[A-Z]{2}$/.test(countryCode)) {
      return '';
    }

    return String.fromCodePoint(
      ...[...countryCode].map((letter) => letter.codePointAt(0)! + 127397),
    );
  });
}
