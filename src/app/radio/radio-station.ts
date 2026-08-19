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

export function parseRadioStation(value: unknown): RadioStation | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const station = value as Record<string, unknown>;

  if (
    !isRadioStationSource(station['source']) ||
    typeof station['name'] !== 'string' ||
    typeof station['streamUrl'] !== 'string' ||
    typeof station['homepageUrl'] !== 'string' ||
    typeof station['imageUrl'] !== 'string' ||
    typeof station['countryCode'] !== 'string'
  ) {
    return null;
  }

  return {
    source: {
      provider: station['source'].provider,
      externalId: station['source'].externalId,
    },
    name: station['name'],
    streamUrl: station['streamUrl'],
    homepageUrl: station['homepageUrl'],
    imageUrl: station['imageUrl'],
    countryCode: station['countryCode'],
  };
}

function isRadioStationSource(value: unknown): value is RadioStationSource {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const source = value as Record<string, unknown>;

  return typeof source['provider'] === 'string' && typeof source['externalId'] === 'string';
}
