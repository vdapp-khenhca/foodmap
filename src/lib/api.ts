import { supabase, PHOTO_BUCKET } from './supabase';
import type { Area, AreaLevel, Badge, LeaderReviewer, Place, Review, ReviewerStats } from './types';

function fail(error: { message: string } | null): never {
  throw new Error(friendlyError(error?.message ?? 'Có lỗi xảy ra'));
}

/** Lỗi do máy chủ đã viết bằng tiếng Việt thì giữ nguyên; lỗi kỹ thuật thì đổi sang câu dễ hiểu. */
export function friendlyError(msg: string): string {
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Mất kết nối mạng, thử lại nhé';
  if (/permission denied|row-level security|JWT/i.test(msg)) return 'Bạn cần đăng nhập lại để thực hiện thao tác này';
  return msg;
}

export interface Bounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export async function placesInBounds(b: Bounds, category: string | null, onlyHot: boolean): Promise<Place[]> {
  const { data, error } = await supabase.rpc('places_in_bounds', {
    p_min_lat: b.minLat,
    p_min_lng: b.minLng,
    p_max_lat: b.maxLat,
    p_max_lng: b.maxLng,
    p_category: category,
    p_only_hot: onlyHot,
    p_limit: 300,
  });
  if (error) fail(error);
  return (data ?? []) as Place[];
}

export async function searchPlaces(q: string): Promise<Place[]> {
  const { data, error } = await supabase.rpc('search_places', { p_q: q, p_limit: 8 });
  if (error) fail(error);
  return (data ?? []) as Place[];
}

export async function getPlace(id: string): Promise<Place | null> {
  const { data, error } = await supabase.rpc('get_place', { p_id: id });
  if (error) fail(error);
  const rows = (data ?? []) as Place[];
  return rows[0] ?? null;
}

export async function getReviews(placeId: string): Promise<Review[]> {
  const { data, error } = await supabase.rpc('place_reviews', { p_place_id: placeId });
  if (error) fail(error);
  return (data ?? []) as Review[];
}

export interface NewReview {
  placeId: string;
  taste: number;
  price: number;
  service: number;
  body: string;
  tags: string[];
  photoUrls: string[];
  sponsored: boolean;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
}

export async function createReview(r: NewReview): Promise<string> {
  const { data, error } = await supabase.rpc('create_review', {
    p_place_id: r.placeId,
    p_taste: r.taste,
    p_price: r.price,
    p_service: r.service,
    p_body: r.body,
    p_tags: r.tags,
    p_photo_urls: r.photoUrls,
    p_sponsored: r.sponsored,
    p_lat: r.lat,
    p_lng: r.lng,
    p_accuracy: r.accuracy,
  });
  if (error) fail(error);
  return data as string;
}

export async function voteReview(reviewId: string, accurate: boolean | null): Promise<void> {
  const { error } = await supabase.rpc('vote_review', { p_review_id: reviewId, p_accurate: accurate });
  if (error) fail(error);
}

export async function reportReview(reviewId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('report_review', { p_review_id: reviewId, p_reason: reason });
  if (error) fail(error);
}

export async function deleteReview(reviewId: string): Promise<void> {
  const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
  if (error) fail(error);
}

export async function uploadPhoto(userId: string, placeId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${placeId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
  });
  if (error) fail(error);
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

export interface NewPlace {
  name: string;
  address: string;
  district: string | null;
  city: string | null;
  province: string | null;
  category: string;
  lat: number;
  lng: number;
}

export async function createPlace(p: NewPlace): Promise<string> {
  const { data, error } = await supabase.from('places').insert(p).select('id').single();
  if (error) fail(error);
  return (data as { id: string }).id;
}

export async function isSaved(userId: string, placeId: string): Promise<boolean> {
  const { data } = await supabase.from('saves').select('place_id').eq('user_id', userId).eq('place_id', placeId).maybeSingle();
  return !!data;
}

export async function setSaved(userId: string, placeId: string, saved: boolean): Promise<void> {
  const q = saved
    ? supabase.from('saves').insert({ user_id: userId, place_id: placeId })
    : supabase.from('saves').delete().eq('user_id', userId).eq('place_id', placeId);
  const { error } = await q;
  if (error) fail(error);
}

export async function listSaved(userId: string): Promise<Place[]> {
  const { data, error } = await supabase
    .from('saves')
    .select('place_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) fail(error);
  const ids = ((data ?? []) as { place_id: string }[]).map((r) => r.place_id);
  const places = await Promise.all(ids.map((id) => getPlace(id)));
  return places.filter((p): p is Place => !!p);
}

export async function listAreas(): Promise<Area[]> {
  const { data, error } = await supabase.rpc('list_areas');
  if (error) fail(error);
  return (data ?? []) as Area[];
}

export async function leaderboardPlaces(level: AreaLevel, area: string): Promise<Place[]> {
  const { data, error } = await supabase.rpc('leaderboard_places', { p_level: level, p_area: area, p_limit: 30 });
  if (error) fail(error);
  return (data ?? []) as Place[];
}

export async function leaderboardReviewers(level: AreaLevel, area: string): Promise<LeaderReviewer[]> {
  const { data, error } = await supabase.rpc('leaderboard_reviewers', { p_level: level, p_area: area, p_limit: 30 });
  if (error) fail(error);
  return (data ?? []) as LeaderReviewer[];
}

export async function userBadges(userId: string): Promise<Badge[]> {
  const { data, error } = await supabase.rpc('user_badges', { p_user: userId });
  if (error) fail(error);
  return (data ?? []) as Badge[];
}

export async function myStats(userId: string): Promise<ReviewerStats | null> {
  const { data, error } = await supabase.from('reviewer_stats').select('*').eq('user_id', userId).maybeSingle();
  if (error) fail(error);
  return (data as ReviewerStats | null) ?? null;
}

export async function getConfig(): Promise<Record<string, number>> {
  const { data } = await supabase.from('app_config').select('key,value');
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { key: string; value: number }[]) out[r.key] = Number(r.value);
  return out;
}

export async function updateDisplayName(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', userId);
  if (error) fail(error);
}
