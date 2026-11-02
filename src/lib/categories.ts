export interface Category {
  key: string;
  label: string;
  emoji: string;
}

export const CATEGORIES: Category[] = [
  { key: 'pho', label: 'Phở', emoji: '🍜' },
  { key: 'bun_mi', label: 'Bún / Mì', emoji: '🍲' },
  { key: 'com', label: 'Cơm', emoji: '🍚' },
  { key: 'lau_nuong', label: 'Lẩu / Nướng', emoji: '🔥' },
  { key: 'an_vat', label: 'Ăn vặt', emoji: '🥟' },
  { key: 'ca_phe', label: 'Cà phê', emoji: '☕' },
  { key: 'tra_sua', label: 'Trà sữa', emoji: '🧋' },
  { key: 'quan_nhau', label: 'Quán nhậu', emoji: '🍻' },
  { key: 'khac', label: 'Khác', emoji: '🍽️' },
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
