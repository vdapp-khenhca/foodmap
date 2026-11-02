export interface Place {
  id: string;
  name: string;
  address: string | null;
  district: string | null;
  city: string | null;
  province: string | null;
  category: string;
  lat: number;
  lng: number;
  score: number | null;
  review_count: number;
  verified_count: number;
  hot_score: number;
  suspicious: boolean;
  is_hot: boolean;
}

export interface Review {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_foodie: boolean;
  rating_taste: number;
  rating_price: number;
  rating_service: number;
  rating_overall: number;
  body: string | null;
  tags: string[];
  photo_urls: string[];
  verified: boolean;
  sponsored: boolean;
  created_at: string;
  accurate_count: number;
  inaccurate_count: number;
  my_vote: boolean | null;
  is_mine: boolean;
}

export interface ReviewerStats {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  review_count: number;
  verified_count: number;
  distinct_places: number;
  accurate_votes: number;
  inaccurate_votes: number;
  reputation: number;
  weight: number;
}

export type AreaLevel = 'district' | 'city' | 'province';

export interface Area {
  level: AreaLevel;
  area: string;
  place_count: number;
}

export interface Badge {
  level: AreaLevel;
  area: string;
  rank: number;
}

export interface LeaderReviewer {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  verified_count: number;
  pts: number;
  is_foodie: boolean;
}

export const LEVEL_LABEL: Record<AreaLevel, string> = {
  district: 'Quận/Huyện',
  city: 'Thành phố',
  province: 'Tỉnh/TP',
};
