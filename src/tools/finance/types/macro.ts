/**
 * FRED (Federal Reserve Economic Data) response types.
 * Macroeconomic indicators and time series.
 */

export interface FredObservation {
  date: string;
  value: string; // FRED returns values as strings
}

export interface FredSeriesInfo {
  id: string;
  title: string;
  observation_start: string;
  observation_end: string;
  frequency: string;
  frequency_short: string;
  units: string;
  units_short: string;
  seasonal_adjustment: string;
  seasonal_adjustment_short: string;
  notes: string;
}

export interface FredSearchResult {
  id: string;
  title: string;
  observation_start: string;
  observation_end: string;
  frequency: string;
  units: string;
  popularity: number;
}
