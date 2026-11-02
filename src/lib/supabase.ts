import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** false khi chưa cấu hình biến môi trường -> app hiện trang hướng dẫn thay vì lỗi trắng màn hình */
export const isConfigured = Boolean(url && key);

export const supabase: SupabaseClient = isConfigured
  ? createClient(url as string, key as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : (null as unknown as SupabaseClient);

export const PHOTO_BUCKET = 'review-photos';
