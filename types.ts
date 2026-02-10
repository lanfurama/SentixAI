
export interface SentimentPoint {
  text: string;
  type: 'positive' | 'negative';
}

export interface CategoryAnalysis {
  points: SentimentPoint[];
  /** Short AI-generated summary in Vietnamese (one sentence). */
  summary?: string;
}

export interface ComparisonRow {
  id: string;
  location: string;
  /** Optional one-sentence overall strength or weakness for this location (max ~20 words). */
  keyTakeaway?: string;
  service: CategoryAnalysis;
  food: CategoryAnalysis;
  value: CategoryAnalysis;
  atmosphere: CategoryAnalysis;
  overallRating: number;
}

export interface RawReviewData {
  id: string;
  name: string;
  csvContent: string;
}

export interface Review {
  author: string;
  date: string;
  content: string;
  rating: number;
  source: string;
}

export type TimeFilter = 'all' | '0.25' | '1' | '3' | '6';
