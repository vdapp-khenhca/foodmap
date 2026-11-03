export interface Category {
  key: string;
  label: string;
  emoji: string;
  tint: string;
}

export const CATEGORIES: Category[] = [
  { key: 'pho', label: 'Phở', emoji: '🍜', tint: '#FFE9D2' },
  { key: 'bun_mi', label: 'Bún / Mì', emoji: '🍲', tint: '#E3ECFF' },
  { key: 'com', label: 'Cơm', emoji: '🍚', tint: '#FFF1BF' },
  { key: 'lau_nuong', label: 'Lẩu / Nướng', emoji: '🔥', tint: '#FFDDD6' },
  { key: 'an_vat', label: 'Ăn vặt', emoji: '🥟', tint: '#EFE3FF' },
  { key: 'ca_phe', label: 'Cà phê', emoji: '☕', tint: '#EADFD3' },
  { key: 'tra_sua', label: 'Trà sữa', emoji: '🧋', tint: '#FFE1EE' },
  { key: 'quan_nhau', label: 'Quán nhậu', emoji: '🍻', tint: '#FFEDB8' },
  { key: 'khac', label: 'Khác', emoji: '🍽️', tint: '#E6EAF4' },
];

export function categoryOf(key: string): Category {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];
}

export const REVIEW_TAGS = [
  'Đáng quay lại',
  'Giá hợp lý',
  'Phục vụ nhanh',
  'Sạch sẽ',
  'Không gian đẹp',
  'Đông, phải chờ',
  'Hơi đắt',
  'Không đúng như quảng cáo',
];

export function scoreTier(score: number | null): 't-none' | 't-low' | 't-good' | 't-great' {
  if (score == null) return 't-none';
  if (score >= 4.2) return 't-great';
  if (score >= 3.6) return 't-good';
  return 't-low';
}
