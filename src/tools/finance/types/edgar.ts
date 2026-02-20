/**
 * SEC EDGAR response types.
 * Regulatory filings, company facts, and submissions.
 */

export interface EdgarFiling {
  dateRange: string;
  category: string;
  form: string;
  description: string;
  fileUrl: string;
  filedAt: string;
}

export interface EdgarSearchResponse {
  query: string;
  total: { value: number };
  hits: Array<{
    _id: string;
    _source: {
      file_date: string;
      form_type: string;
      entity_name: string;
      file_num: string;
      period_of_report: string;
      file_url?: string;
    };
  }>;
}

export interface EdgarCompanyFact {
  taxonomy: string;
  tag: string;
  label: string;
  description: string;
  units: Record<
    string,
    Array<{
      val: number;
      end: string;
      start?: string;
      accn: string;
      fy: number;
      fp: string;
      form: string;
      filed: string;
    }>
  >;
}

export interface EdgarCompanyFacts {
  cik: number;
  entityName: string;
  facts: Record<string, Record<string, EdgarCompanyFact>>;
}

export interface EdgarSubmissions {
  cik: string;
  entityType: string;
  name: string;
  tickers: string[];
  exchanges: string[];
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      form: string[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
  };
}
