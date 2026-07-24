import { parseRadioStation, RadioStation } from './radio-station';

describe('parseRadioStation', () => {
  const station: RadioStation = {
    source: { provider: 'radio-browser', externalId: 'station-1' },
    name: 'Station One',
    streamUrl: 'https://stream.example.com/live',
    homepageUrl: 'https://example.com',
    imageUrl: '',
    countryCode: 'AR',
  };

  it('should return a sanitized radio station', () => {
    expect(parseRadioStation({ ...station, ignored: 'value' })).toEqual(station);
  });

  it('should reject incomplete or invalid station values', () => {
    expect(parseRadioStation(null)).toBeNull();
    expect(parseRadioStation({ ...station, streamUrl: 42 })).toBeNull();
    expect(parseRadioStation({ ...station, source: { provider: 'radio-browser' } })).toBeNull();
  });
});
