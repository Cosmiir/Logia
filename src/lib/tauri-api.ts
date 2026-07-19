import { invoke, Channel } from '@tauri-apps/api/core';
import type {
  Collection,
  CreateCollectionDto,
  UpdateCollectionDto,
  Media,
  MediaDetail,
  CreateMediaDto,
  UpdateMediaDto,
  Genre,
  Person,
  MediaCredit,
  Profile,
  CreateProfileDto,
  UpdateProfileDto,
  StorageInfo,
  CleanupReport,
  ExportResult,
  CsvExportRequest,
  CsvExportResult,
  ImportResult,
  CsvImportPreview,
  CsvImportRequest,
  CsvImportResult,
  MdImportRequest,
  MdImportResult,
  Objective,
  CreateObjectiveDto,
  UpdateObjectiveDto,
  AppStatus,
  Notification,
  CreateNotificationDto,
  NotificationPreferences,
} from '@/types';
import type {
  ReviewTemplate,
  CreateReviewTemplateDto,
  UpdateReviewTemplateDto,
} from '@/types/review-template';

// Collections
export const collectionsApi = {
  async getAll(): Promise<Collection[]> {
    return invoke('get_all_collections');
  },

  async getById(collectionId: number): Promise<Collection | null> {
    return invoke('get_collection_by_id', { collectionId });
  },

  async create(data: CreateCollectionDto): Promise<number> {
    return invoke('create_collection', { dto: data });
  },

  async update(data: UpdateCollectionDto): Promise<void> {
    return invoke('update_collection', { dto: data });
  },

  async delete(collectionId: number): Promise<void> {
    return invoke('delete_collection', { collectionId });
  },

  async deleteWithOptions(collectionId: number, mode: 'delete_media' | 'unlink' | 'transfer', targetCollectionId?: number): Promise<void> {
    return invoke('delete_collection_with_options', { collectionId, mode, targetCollectionId });
  },

  async reorder(collectionIds: number[]): Promise<void> {
    return invoke('reorder_collections', { collectionIds });
  },
};

// Media
export const mediaApi = {
  async getByCollection(params: {
    collectionId: number;
    searchQuery?: string;
    genreIds?: number[];
    personIds?: number[];
    minRating?: number;
    maxRating?: number;
    sortCriteria?: { field: string; order: 'asc' | 'desc' }[];
    limit?: number;
    offset?: number;
    // Additional filters
    mediaStatuses?: string[];
    progressStatuses?: string[];
    creators?: string[];
    releaseDateFrom?: string;
    releaseDateTo?: string;
    experienceDateFrom?: string;
    experienceDateTo?: string;
    createdAtFrom?: string;
    createdAtTo?: string;
    progressMin?: number;
    progressMax?: number;
    progressTotalMin?: number;
    progressTotalMax?: number;
    progressCurrentMin?: number;
    progressCurrentMax?: number;
  }): Promise<Media[]> {
    const { sortCriteria, ...rest } = params;
    return invoke('get_media_by_collection', {
      ...rest,
      sortCriteriaJson: sortCriteria ? JSON.stringify(sortCriteria) : null,
    });
  },

  async getAll(params?: {
    searchQuery?: string;
    genreIds?: number[];
    personIds?: number[];
    minRating?: number;
    maxRating?: number;
    sortCriteria?: { field: string; order: 'asc' | 'desc' }[];
    limit?: number;
    offset?: number;
    // Additional filters
    mediaStatuses?: string[];
    progressStatuses?: string[];
    creators?: string[];
    releaseDateFrom?: string;
    releaseDateTo?: string;
    experienceDateFrom?: string;
    experienceDateTo?: string;
    createdAtFrom?: string;
    createdAtTo?: string;
    progressMin?: number;
    progressMax?: number;
    progressTotalMin?: number;
    progressTotalMax?: number;
    progressCurrentMin?: number;
    progressCurrentMax?: number;
  }): Promise<Media[]> {
    const { sortCriteria, ...rest } = params ?? {};
    return invoke('get_all_media', {
      ...rest,
      sortCriteriaJson: sortCriteria ? JSON.stringify(sortCriteria) : null,
    });
  },

  async countByCollection(params: {
    collectionId: number;
    searchQuery?: string;
    genreIds?: number[];
    personIds?: number[];
    minRating?: number;
    maxRating?: number;
    mediaStatuses?: string[];
    progressStatuses?: string[];
    creators?: string[];
    releaseDateFrom?: string;
    releaseDateTo?: string;
    experienceDateFrom?: string;
    experienceDateTo?: string;
    createdAtFrom?: string;
    createdAtTo?: string;
    progressMin?: number;
    progressMax?: number;
    progressTotalMin?: number;
    progressTotalMax?: number;
    progressCurrentMin?: number;
    progressCurrentMax?: number;
  }): Promise<number> {
    return invoke('count_media_by_collection', params);
  },

  async countAll(params?: {
    searchQuery?: string;
    genreIds?: number[];
    personIds?: number[];
    minRating?: number;
    maxRating?: number;
    mediaStatuses?: string[];
    progressStatuses?: string[];
    creators?: string[];
    releaseDateFrom?: string;
    releaseDateTo?: string;
    experienceDateFrom?: string;
    experienceDateTo?: string;
    createdAtFrom?: string;
    createdAtTo?: string;
    progressMin?: number;
    progressMax?: number;
    progressTotalMin?: number;
    progressTotalMax?: number;
    progressCurrentMin?: number;
    progressCurrentMax?: number;
  }): Promise<number> {
    return invoke('count_all_media', params ?? {});
  },

  async getAllIds(params?: {
    searchQuery?: string;
    genreIds?: number[];
    personIds?: number[];
    minRating?: number;
    maxRating?: number;
    sortCriteria?: { field: string; order: 'asc' | 'desc' }[];
    mediaStatuses?: string[];
    progressStatuses?: string[];
    creators?: string[];
    releaseDateFrom?: string;
    releaseDateTo?: string;
    experienceDateFrom?: string;
    experienceDateTo?: string;
    createdAtFrom?: string;
    createdAtTo?: string;
    progressTotalMin?: number;
    progressTotalMax?: number;
    progressCurrentMin?: number;
    progressCurrentMax?: number;
  }): Promise<number[]> {
    const { sortCriteria, ...rest } = params ?? {};
    return invoke('get_all_media_ids', {
      ...rest,
      sortCriteriaJson: sortCriteria ? JSON.stringify(sortCriteria) : null,
    });
  },

  async getIdsByCollection(params: {
    collectionId: number;
    searchQuery?: string;
    genreIds?: number[];
    personIds?: number[];
    minRating?: number;
    maxRating?: number;
    sortCriteria?: { field: string; order: 'asc' | 'desc' }[];
    mediaStatuses?: string[];
    progressStatuses?: string[];
    creators?: string[];
    releaseDateFrom?: string;
    releaseDateTo?: string;
    experienceDateFrom?: string;
    experienceDateTo?: string;
    createdAtFrom?: string;
    createdAtTo?: string;
    progressTotalMin?: number;
    progressTotalMax?: number;
    progressCurrentMin?: number;
    progressCurrentMax?: number;
  }): Promise<number[]> {
    const { sortCriteria, ...rest } = params;
    return invoke('get_media_ids_by_collection', {
      ...rest,
      sortCriteriaJson: sortCriteria ? JSON.stringify(sortCriteria) : null,
    });
  },

  async getDistinctCreators(params?: {
    collectionId?: number;
    searchQuery?: string;
    genreIds?: number[];
    personIds?: number[];
    minRating?: number;
    maxRating?: number;
    mediaStatuses?: string[];
    progressStatuses?: string[];
    releaseDateFrom?: string;
    releaseDateTo?: string;
    experienceDateFrom?: string;
    experienceDateTo?: string;
    createdAtFrom?: string;
    createdAtTo?: string;
    progressTotalMin?: number;
    progressTotalMax?: number;
    progressCurrentMin?: number;
    progressCurrentMax?: number;
  }): Promise<string[]> {
    return invoke('get_distinct_creators', params ?? {});
  },

  async getProgressCurrentRange(collectionId: number): Promise<[number, number]> {
    return invoke('get_progress_current_range', { collectionId });
  },

  async getById(mediaId: number): Promise<MediaDetail | null> {
    return invoke('get_media_by_id', { mediaId });
  },

  async create(data: CreateMediaDto): Promise<number> {
    return invoke('create_media', { dto: data });
  },

  async update(data: UpdateMediaDto): Promise<void> {
    return invoke('update_media', { dto: data });
  },

  async delete(mediaId: number): Promise<void> {
    return invoke('delete_media', { mediaId });
  },

  async uploadImage(mediaId: number, imageDataBase64: string, fileName: string, position: number): Promise<number> {
    return invoke('upload_media_image', { mediaId, imageDataBase64, fileName, position });
  },

  async uploadImagesFromPaths(
    mediaId: number,
    filePaths: string[],
    onProgress: (progress: {
      file_index: number;
      total_files: number;
      file_name: string;
      stage: string;
      percent: number;
    }) => void,
    startPosition?: number
  ): Promise<Array<{ imageId: number; path: string }>> {
    const channel = new Channel<{
      file_index: number;
      total_files: number;
      file_name: string;
      stage: string;
      percent: number;
    }>();
    channel.onmessage = onProgress;

    const results = await invoke<Array<[number, string]>>('upload_media_images_from_paths', {
      mediaId,
      filePaths,
      onProgress: channel,
      startPosition: startPosition ?? 0,
    });

    return results.map(([imageId, path]) => ({ imageId, path }));
  },

  async deleteImage(imageId: number): Promise<void> {
    return invoke('delete_media_image', { imageId });
  },

  async uploadAttachmentsFromPaths(mediaId: number, filePaths: string[]): Promise<Array<{ attachmentId: number; path: string }>> {
    const results = await invoke<Array<{ attachment_id: number; path: string }>>('upload_media_attachments_from_paths', {
      mediaId,
      filePaths,
    });

    return results.map((result) => ({ attachmentId: result.attachment_id, path: result.path }));
  },

  async deleteAttachment(attachmentId: number): Promise<void> {
    return invoke('delete_media_attachment', { attachmentId });
  },

  async getCbzPages(relativePath: string): Promise<string[]> {
    return invoke('get_cbz_pages', { relativePath });
  },

  async readCbzPage(relativePath: string, pageName: string): Promise<string> {
    return invoke('read_cbz_page', { relativePath, pageName });
  },

  async setCover(mediaId: number, panX: number, panY: number, zoom: number, sourceImageIndex?: number): Promise<string> {
    return invoke('set_media_cover', { mediaId, panX, panY, zoom, sourceImageIndex: sourceImageIndex ?? null });
  },

  async clearCover(mediaId: number): Promise<void> {
    return invoke('clear_media_cover', { mediaId });
  },

  async updateImagePositions(updates: Array<[number, number]>): Promise<void> {
    return invoke('update_image_positions', { updates });
  },

  async readFileBase64(filePath: string): Promise<string> {
    return invoke('read_file_base64', { filePath });
  },

  async getSimilar(mediaId: number, collectionId: number, limit?: number): Promise<Media[]> {
    return invoke('get_similar_media', { mediaId, collectionId, limit: limit ?? 4 });
  },
};

// Genres
export const genresApi = {
  async search(query: string): Promise<Genre[]> {
    return invoke('search_genres', { query });
  },

  async create(name: string, color?: string): Promise<number> {
    return invoke('create_genre', { name, color });
  },

  async updateColor(genreId: number, color: string): Promise<void> {
    return invoke('update_genre_color', { genreId, color });
  },

  async getAll(): Promise<Genre[]> {
    return invoke('get_all_genres');
  },

  async delete(genreId: number): Promise<void> {
    return invoke('delete_genre', { genreId });
  },
};

// People
export const peopleApi = {
  async getAll(): Promise<Person[]> {
    return invoke('get_all_people');
  },

  async search(query: string): Promise<Person[]> {
    return invoke('search_people', { query });
  },

  async create(name: string, photoDataBase64?: string | null): Promise<number> {
    return invoke('create_person', { name, photoDataBase64 });
  },

  async update(id: number, name: string, photoDataBase64?: string | null, removePhoto?: boolean): Promise<void> {
    return invoke('update_person', { id, name, photoDataBase64, removePhoto });
  },

  async delete(id: number): Promise<void> {
    return invoke('delete_person', { id });
  },

  async getMediaCredits(mediaId: number): Promise<MediaCredit[]> {
    return invoke('get_media_credits', { mediaId });
  },

  async getUniqueRoles(): Promise<string[]> {
    return invoke('get_unique_roles');
  },
};

// Stats
export const statsApi = {
  async getDashboard(): Promise<{
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
  }> {
    return invoke('get_dashboard_stats');
  },
};


// Profiles
export const profilesApi = {
  async getAll(): Promise<Profile[]> {
    return invoke('get_all_profiles');
  },

  async getActive(): Promise<Profile> {
    return invoke('get_active_profile');
  },

  async create(dto: CreateProfileDto): Promise<Profile> {
    return invoke('create_profile', { dto });
  },

  async update(dto: UpdateProfileDto): Promise<void> {
    return invoke('update_profile', { dto });
  },

  async delete(profileId: string): Promise<void> {
    return invoke('delete_profile', { profileId });
  },

  async switch(profileId: string): Promise<Profile> {
    return invoke('switch_profile', { profileId });
  },

  async verifyPassword(profileId: string, password: string): Promise<boolean> {
    return invoke('verify_profile_password', { profileId, password });
  },
};

// Data management
export const dataApi = {
  async getStorageInfo(): Promise<StorageInfo> {
    return invoke('get_storage_info');
  },

  async resetDatabase(): Promise<void> {
    return invoke('reset_database');
  },

  async cleanupOrphanedImages(): Promise<CleanupReport> {
    return invoke('cleanup_orphaned_images');
  },

  async exportDatabase(destinationPath: string, includeImages: boolean, includeAttachments: boolean): Promise<ExportResult> {
    return invoke('export_database', { destinationPath, includeImages, includeAttachments });
  },

  async exportToCsvOrMarkdown(request: CsvExportRequest): Promise<CsvExportResult> {
    return invoke('export_to_csv_or_markdown', { request });
  },

  async importDatabase(sourcePath: string, merge?: boolean, skipDuplicates?: boolean): Promise<ImportResult> {
    return invoke('import_database', { sourcePath, merge, skipDuplicates });
  },

  async mergeProfileData(sourceProfileId: string, skipDuplicates: boolean): Promise<ImportResult> {
    return invoke('merge_profile_data', { sourceProfileId, skipDuplicates });
  },

  async previewCsvImport(filePath: string, delimiter?: string): Promise<CsvImportPreview> {
    return invoke('preview_csv_import', { filePath, delimiter });
  },

  async importFromCsv(request: CsvImportRequest): Promise<CsvImportResult> {
    return invoke('import_from_csv', { request });
  },

  async importReviewsFromMd(request: MdImportRequest): Promise<MdImportResult> {
    return invoke('import_reviews_from_md', { request });
  },

  async getStoragePath(): Promise<string> {
    return invoke('get_storage_path');
  },

  async setStoragePath(newPath: string): Promise<string> {
    return invoke('set_storage_path', { newPath });
  },

  async initStoragePath(newPath: string): Promise<string> {
    return invoke('init_storage_path', { newPath });
  },

  async verifyStoragePath(path: string): Promise<boolean> {
    return invoke('verify_storage_path', { path });
  },

  async getAppStatus(): Promise<AppStatus> {
    return invoke('get_app_status');
  },

  async retryStorageConnection(): Promise<boolean> {
    return invoke('retry_storage_connection');
  },

  async resetToDefaultStorage(): Promise<string> {
    return invoke('reset_to_default_storage');
  },
};

// Objectives
export const objectivesApi = {
  async getAll(): Promise<Objective[]> {
    return invoke('get_all_objectives');
  },

  async create(dto: CreateObjectiveDto): Promise<number> {
    return invoke('create_objective', { dto });
  },

  async update(dto: UpdateObjectiveDto): Promise<void> {
    return invoke('update_objective', { dto });
  },

  async delete(objectiveId: number): Promise<void> {
    return invoke('delete_objective', { objectiveId });
  },
};

// Notifications
export const notificationsApi = {
  async getAll(profileId: string, limit?: number): Promise<Notification[]> {
    return invoke('get_notifications', { profileId, limit });
  },

  async getUnreadCount(profileId: string): Promise<number> {
    return invoke('get_unread_count', { profileId });
  },

  async markAsRead(notificationId: number): Promise<void> {
    return invoke('mark_notification_read', { notificationId });
  },

  async markAllAsRead(profileId: string): Promise<void> {
    return invoke('mark_all_notifications_read', { profileId });
  },

  async delete(notificationId: number): Promise<void> {
    return invoke('delete_notification', { notificationId });
  },

  async cleanupOld(profileId: string, days: number): Promise<number> {
    return invoke('cleanup_old_notifications', { profileId, days });
  },

  async create(dto: CreateNotificationDto): Promise<number> {
    return invoke('create_notification', {
      dto: {
        profile_id: dto.profile_id,
        notification_type: dto.type,
        title: dto.title,
        message: dto.message,
        data: dto.data ? JSON.stringify(dto.data) : null,
        related_entity_type: dto.related_entity_type,
        related_entity_id: dto.related_entity_id,
      }
    });
  },

  async checkDuplicateExists(
    profileId: string,
    type: string,
    relatedEntityType?: string,
    relatedEntityId?: number,
    maxAgeDays?: number,
  ): Promise<boolean> {
    return invoke('check_duplicate_exists', {
      profileId,
      notificationType: type,
      relatedEntityType,
      relatedEntityId,
      maxAgeDays,
    });
  },

  async checkMonthlyReportExists(profileId: string, year: number, month: number): Promise<boolean> {
    return invoke('check_monthly_report_exists', { profileId, year, month });
  },

  async generateNotifications(profileId: string, preferences: NotificationPreferences): Promise<number> {
    return invoke('generate_notifications', {
      profileId,
      preferences: {
        stagnant_media: preferences.stagnantMedia,
        waiting_media: preferences.waitingMedia,
        near_completion: preferences.nearCompletion,
        objective_deadline: preferences.objectiveDeadline,
        objective_stalled: preferences.objectiveStalled,
        objective_achieved: preferences.objectiveAchieved,
        monthly_report: preferences.monthlyReport,
      },
    });
  },
};

// Settings
export const settingsApi = {
  async getAll(): Promise<Record<string, string>> {
    return invoke('get_settings');
  },

  async get(key: string): Promise<string | null> {
    return invoke('get_setting', { key });
  },

  async update(key: string, value: string): Promise<void> {
    return invoke('update_setting', { key, value });
  },

  async updateBatch(settings: Record<string, string>): Promise<void> {
    return invoke('update_settings_batch', { settings });
  },
};

// Review Templates
export const reviewTemplatesApi = {
  async getAll(): Promise<ReviewTemplate[]> {
    return invoke('get_all_review_templates');
  },

  async getById(templateId: number): Promise<ReviewTemplate | null> {
    return invoke('get_review_template_by_id', { templateId });
  },

  async create(dto: CreateReviewTemplateDto): Promise<number> {
    return invoke('create_review_template', { dto });
  },

  async update(dto: UpdateReviewTemplateDto): Promise<void> {
    return invoke('update_review_template', { dto });
  },

  async delete(templateId: number): Promise<void> {
    return invoke('delete_review_template', { templateId });
  },
};

// Export all APIs
export const tauriApi = {
  collections: collectionsApi,
  media: mediaApi,
  genres: genresApi,
  people: peopleApi,
  stats: statsApi,
    profiles: profilesApi,
  data: dataApi,
  objectives: objectivesApi,
  notifications: notificationsApi,
  settings: settingsApi,
  reviewTemplates: reviewTemplatesApi,
};
