export type GeolocationAPIResponseType = {
  city: {
    geoname_id: number;
    names: {
      en: string;
    };
  };
  continent: {
    code: string;
    geoname_id: number;
    names: {
      de: string;
      en: string;
      es: string;
      fa: string;
      fr: string;
      ja: string;
      ko: string;
      "pt-BR": string;
      ru: string;
      "zh-CN": string;
    };
  };
  country: {
    geoname_id: number;
    is_in_european_union: boolean;
    iso_code: string;
    names: {
      de: string;
      en: string;
      es: string;
      fa: string;
      fr: string;
      ja: string;
      ko: string;
      "pt-BR": string;
      ru: string;
      "zh-CN": string;
    };
  };
  location: {
    latitude: number;
    longitude: number;
    time_zone: string;
    weather_code: string;
  };
  subdivisions: Array<{
    geoname_id: number;
    iso_code?: string;
    names: {
      en: string;
      ko?: string;
    };
  }>;
  traits: {
    autonomous_system_number: number;
    autonomous_system_organization: string;
    connection_type: string;
    isp: string;
    organization: string;
    user_type: string;
  };
};
