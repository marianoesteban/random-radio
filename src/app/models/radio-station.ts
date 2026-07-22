export interface RadioStationSource {
  readonly provider: string;
  readonly externalId: string;
}

export interface RadioStation {
  readonly source: RadioStationSource;
  readonly name: string;
  readonly streamUrl: string;
  readonly homepageUrl: string;
  readonly imageUrl: string;
  readonly countryCode: string;
}

export function radioStationId(station: RadioStation): string {
  return `${station.source.provider}:${station.source.externalId}`;
}
