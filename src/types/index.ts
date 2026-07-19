// Core types for Logia

export interface Collection {
  id: number;
  name: string;
  icon: string | null;
  color: string;
  creator_label: string;
  date_label: string;
  progression_unit: string;
  progression_label: string;
  progression_short_label: string | null;
  replay_date_label: string | null;
  duration_label: string | null;
  plural_with_s: boolean;
  consumption_verb: string | null;
  monthly_capacity: number | null;
  position: number;
  created_at: string;
}

export interface Media {
  id: number;
  collection_id: number | null;
  title: string;
  creator: string | null;
  release_date: string | null;
  synopsis: string | null;
  user_rating: number | null;
  user_review: string | null;
  progress_current: number | null;
  progress_total: number | null;
  progress_status: ProgressStatus | null;
  replay_count: number | null;
  experience_date: string | null;
  experience_dates: string | null;
  positive_points: string | null;
  negative_points: string | null;
  media_status: string | null;
  created_at: string;
  updated_at: string;
  cover_image?: string;
  cover_source_index?: number;
  genres?: Genre[];
}

export interface MediaDetail extends Media {
  images: MediaImage[];
  attachments: MediaAttachment[];
  genres: Genre[];
  credits: MediaCredit[];
}

export interface Person {
  id: number;
  name: string;
  photo_path: string | null;
  created_at: string;
}

export interface MediaCredit {
  person_id: number;
  name: string;
  photo_path: string | null;
  role: string | null;
  position: number;
}

export interface MediaCreditInput {
  person_id: number;
  role: string | null;
  position: number;
}

export interface MediaImage {
  id: number;
  media_id: number;
  full_path: string;
  thumb_path: string;
  position: number;
  created_at: string;
}

export interface Genre {
  id: number;
  name: string;
  color: string;
  created_at: string;
  position?: number;
}

export type ProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'ABANDONED';

export type MediaStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'ABANDONED';

export interface DashboardStats {
  total_media: number;
  total_collections: number;
  average_rating: number;
  media_this_month: number;
  completed_count: number;
  abandoned_count: number;
  in_progress_count: number;
  not_started_count: number;
  rated_count: number;
  rating_median: number;
  rating_std_dev: number;
  trend_this_month: number;
  trend_last_month: number;
}

export interface CollectionStats {
  total_media: number;
  average_rating: number;
  completed_count: number;
  in_progress_count: number;
  not_started_count: number;
  abandoned_count: number;
  rating_distribution: {
    rating: number;
    count: number;
  }[];
  media_by_month: {
    month: string;
    count: number;
  }[];
  top_genres: {
    genre_id: number;
    genre_name: string;
    count: number;
  }[];
}

export interface Profile {
  id: string;
  name: string;
  avatar_id: string;
  custom_avatar_data_url: string | null;
  custom_avatars: string[];
  password_hash: string | null;
  created_at: string;
}

export interface CreateProfileDto {
  name: string;
  avatar_id?: string;
  password?: string;
}

export interface UpdateProfileDto {
  id: string;
  name?: string;
  avatar_id?: string;
  custom_avatar_data_url?: string;
  remove_custom_avatar?: string;
  password?: string;
  remove_password?: boolean;
}

export interface CreateCollectionDto {
  name: string;
  icon?: string;
  color?: string;
  creator_label?: string;
  date_label?: string;
  progression_unit?: string;
  progression_label?: string;
  progression_short_label?: string;
  replay_date_label?: string;
  duration_label?: string;
  plural_with_s?: boolean;
  consumption_verb?: string;
  monthly_capacity?: number;
}

export interface UpdateCollectionDto {
  collection_id: number;
  name?: string;
  icon?: string;
  color?: string;
  creator_label?: string;
  date_label?: string;
  progression_unit?: string;
  progression_label?: string;
  progression_short_label?: string;
  replay_date_label?: string;
  duration_label?: string;
  plural_with_s?: boolean;
  consumption_verb?: string;
  monthly_capacity?: number;
}

export interface CreateMediaDto {
  collection_id: number;
  title: string;
  creator?: string;
  release_date?: string;
  synopsis?: string;
  user_rating?: number;
  user_review?: string;
  progress_current?: number;
  progress_total?: number;
  progress_status?: ProgressStatus;
  replay_count?: number;
  experience_date?: string;
  experience_dates?: string;
  positive_points?: string;
  negative_points?: string;
  media_status?: string;
  genre_ids?: number[];
  credits?: MediaCreditInput[];
}

export interface UpdateMediaDto extends Partial<CreateMediaDto> {
  media_id: number;
}

export interface MediaFilters {
  collection_id: number | null;
  search_query: string;
  genre_ids: number[];
  min_rating: number | null;
  max_rating: number | null;
  sort_by: 'title' | 'created_at' | 'experience_date' | 'rating' | 'release_date';
  sort_order: 'asc' | 'desc';
}

export interface StorageInfo {
  db_size_bytes: number;
  images_size_bytes: number;
  attachments_size_bytes: number;
  total_size_bytes: number;
  total_media: number;
  total_images: number;
}

export interface DuplicateDetail {
  media_id: number;
  media_title: string;
  removed_count: number;
}

export interface CleanupReport {
  removed_dirs: number;
  freed_bytes: number;
  removed_duplicates: number;
  duplicate_details: DuplicateDetail[];
}

export interface ExportResult {
  path: string;
  size_bytes: number;
  exported_media?: number;
}

export interface CsvExportRequest {
  destination_path: string;
  columns: string[];
  collection_ids?: number[];
  format: 'csv' | 'tsv' | 'markdown';
  rating_scale: number;
  delimiter?: string;
}

export interface CsvExportResult {
  path: string;
  exported_media: number;
  size_bytes: number;
}

export interface ImportResult {
  imported_collections: number;
  imported_media: number;
  imported_images: number;
}

export interface CsvImportPreview {
  columns: string[];
  row_count: number;
  all_rows: string[][];
}

export interface CsvImportRequest {
  file_path: string;
  column_mapping: Record<string, string>;
  status_mapping?: Record<string, string>;
  rating_scale: number;
  auto_create_collections: boolean;
  auto_create_genres: boolean;
  date_format?: string;
  genre_separator?: string;
  round_ratings?: boolean;
  delimiter?: string;
}

export interface CsvImportResult {
  imported_media: number;
  created_collections: number;
  created_genres: number;
  errors: string[];
}

export interface MdImportRequest {
  folder_path: string;
}

export interface MdImportResult {
  updated_media: number;
  not_found: string[];
}

export interface AppStatus {
  storage_missing: boolean;
  storage_path: string;
  has_config: boolean;
}

export interface Objective {
  id: number;
  collection_id: number;
  target_count: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  count_abandoned: boolean;
  current_count: number;
  created_at: string;
}

export interface CreateObjectiveDto {
  collection_id: number;
  target_count: number;
  start_date: string;
  end_date: string;
  count_abandoned?: boolean;
}

export interface UpdateObjectiveDto {
  objective_id: number;
  target_count?: number;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  count_abandoned?: boolean;
}

export type NotificationType =
  | 'stagnant_media'
  | 'waiting_media'
  | 'near_completion'
  | 'objective_deadline'
  | 'objective_stalled'
  | 'objective_achieved'
  | 'monthly_report';

export interface Notification {
  id: number;
  profile_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  related_entity_type: 'media' | 'objective' | null;
  related_entity_id: number | null;
}

export interface CreateNotificationDto {
  profile_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  related_entity_type?: 'media' | 'objective';
  related_entity_id?: number;
}

export interface NotificationPreferences {
  stagnantMedia: boolean;
  waitingMedia: boolean;
  nearCompletion: boolean;
  objectiveDeadline: boolean;
  objectiveStalled: boolean;
  objectiveAchieved: boolean;
  monthlyReport: boolean;
}

export interface MediaAttachment {
  id: number;
  media_id: number;
  original_name: string;
  stored_path: string;
  size_bytes: number;
  created_at: string;
}
