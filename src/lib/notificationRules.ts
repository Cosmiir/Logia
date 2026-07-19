import { tauriApi } from '@/lib/tauri-api';
import type { CreateNotificationDto, Media, Objective, NotificationPreferences } from '@/types';

// Helper: Calculate days between two dates
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.floor((date2.getTime() - date1.getTime()) / oneDay);
}

// Helper: Calculate progress percentage
function calculateProgress(current: number | null, total: number | null): number {
  if (!current || !total || total === 0) return 0;
  return (current / total) * 100;
}

// Helper: Check if date is at midpoint of a period
function isAtMidpoint(startDate: string, endDate: string): boolean {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  const totalDays = daysBetween(start, end);
  const elapsedDays = daysBetween(start, now);
  const midpoint = totalDays / 2;
  
  // Allow 2-day window around midpoint
  return Math.abs(elapsedDays - midpoint) <= 2;
}

// Rule: Stagnant media (IN_PROGRESS, updated_at > 30j)
async function checkStagnantMedia(
  profileId: string,
  mediaList: Media[],
  preferences: NotificationPreferences
): Promise<CreateNotificationDto[]> {
  if (!preferences.stagnantMedia) return [];

  const notifications: CreateNotificationDto[] = [];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const media of mediaList) {
    if (media.progress_status === 'IN_PROGRESS' && media.updated_at) {
      const updatedDate = new Date(media.updated_at);
      if (updatedDate < thirtyDaysAgo) {
        // Check duplicate (7 days)
        const duplicateExists = await tauriApi.notifications.checkDuplicateExists(
          profileId,
          'stagnant_media',
          'media',
          media.id,
          7
        );
        
        if (!duplicateExists) {
          notifications.push({
            profile_id: profileId,
            type: 'stagnant_media',
            title: `${media.title} stagne`,
            message: `Cette œuvre est en cours depuis plus de 30 jours sans progression.`,
            data: { media_id: media.id, media_title: media.title },
            related_entity_type: 'media',
            related_entity_id: media.id,
          });
        }
      }
    }
  }

  return notifications;
}

// Rule: Waiting media (NOT_STARTED, created_at > 90j)
async function checkWaitingMedia(
  profileId: string,
  mediaList: Media[],
  preferences: NotificationPreferences
): Promise<CreateNotificationDto[]> {
  if (!preferences.waitingMedia) return [];

  const notifications: CreateNotificationDto[] = [];
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  for (const media of mediaList) {
    if (media.progress_status === 'NOT_STARTED' && media.created_at) {
      const createdDate = new Date(media.created_at);
      if (createdDate < ninetyDaysAgo) {
        // Check duplicate (30 days)
        const duplicateExists = await tauriApi.notifications.checkDuplicateExists(
          profileId,
          'waiting_media',
          'media',
          media.id,
          30
        );
        
        if (!duplicateExists) {
          notifications.push({
            profile_id: profileId,
            type: 'waiting_media',
            title: `${media.title} attend`,
            message: `Cette œuvre est dans la liste "à commencer" depuis plus de 90 jours.`,
            data: { media_id: media.id, media_title: media.title },
            related_entity_type: 'media',
            related_entity_id: media.id,
          });
        }
      }
    }
  }

  return notifications;
}

// Rule: Near completion (progress >= 90%)
async function checkNearCompletion(
  profileId: string,
  mediaList: Media[],
  preferences: NotificationPreferences
): Promise<CreateNotificationDto[]> {
  if (!preferences.nearCompletion) return [];

  const notifications: CreateNotificationDto[] = [];

  for (const media of mediaList) {
    const progress = calculateProgress(media.progress_current, media.progress_total);
    if (progress >= 90 && progress < 100 && media.progress_status === 'IN_PROGRESS') {
      // Check duplicate (3 days)
      const duplicateExists = await tauriApi.notifications.checkDuplicateExists(
        profileId,
        'near_completion',
        'media',
        media.id,
        3
      );
      
      if (!duplicateExists) {
        notifications.push({
          profile_id: profileId,
          type: 'near_completion',
          title: `${media.title} bientôt terminée !`,
          message: `Tu es à ${Math.round(progress)}% de cette œuvre. Continue comme ça !`,
          data: { media_id: media.id, media_title: media.title, progress },
          related_entity_type: 'media',
          related_entity_id: media.id,
        });
      }
    }
  }

  return notifications;
}

// Rule: Objective deadline (< 7 days, low progress)
async function checkObjectiveDeadline(
  profileId: string,
  objectives: Objective[],
  preferences: NotificationPreferences
): Promise<CreateNotificationDto[]> {
  if (!preferences.objectiveDeadline) return [];

  const notifications: CreateNotificationDto[] = [];

  for (const objective of objectives) {
    if (!objective.is_active) continue;

    const endDate = new Date(objective.end_date);
    const now = new Date();
    const daysUntilEnd = daysBetween(now, endDate);

    if (daysUntilEnd <= 7 && daysUntilEnd >= 0) {
      const progress = (objective.current_count / objective.target_count) * 100;
      if (progress < 50) {
        // Check duplicate (1 day)
        const duplicateExists = await tauriApi.notifications.checkDuplicateExists(
          profileId,
          'objective_deadline',
          'objective',
          objective.id,
          1
        );
        
        if (!duplicateExists) {
          notifications.push({
            profile_id: profileId,
            type: 'objective_deadline',
            title: `Objectif en retard`,
            message: `Deadline dans ${daysUntilEnd} jours et seulement ${Math.round(progress)}% complété.`,
            data: { objective_id: objective.id, progress },
            related_entity_type: 'objective',
            related_entity_id: objective.id,
          });
        }
      }
    }
  }

  return notifications;
}

// Rule: Objective stalled (0% at midpoint)
async function checkObjectiveStalled(
  profileId: string,
  objectives: Objective[],
  preferences: NotificationPreferences
): Promise<CreateNotificationDto[]> {
  if (!preferences.objectiveStalled) return [];

  const notifications: CreateNotificationDto[] = [];

  for (const objective of objectives) {
    if (!objective.is_active) continue;

    if (isAtMidpoint(objective.start_date, objective.end_date) && objective.current_count === 0) {
      // Check duplicate (7 days)
      const duplicateExists = await tauriApi.notifications.checkDuplicateExists(
        profileId,
        'objective_stalled',
        'objective',
        objective.id,
        7
      );
      
      if (!duplicateExists) {
        notifications.push({
          profile_id: profileId,
          type: 'objective_stalled',
          title: `Objectif au point mort`,
          message: `Tu es à mi-chemin de la période et n'as pas encore commencé cet objectif.`,
          data: { objective_id: objective.id },
          related_entity_type: 'objective',
          related_entity_id: objective.id,
        });
      }
    }
  }

  return notifications;
}

// Rule: Objective achieved
async function checkObjectiveAchieved(
  profileId: string,
  objectives: Objective[],
  preferences: NotificationPreferences
): Promise<CreateNotificationDto[]> {
  if (!preferences.objectiveAchieved) return [];

  const notifications: CreateNotificationDto[] = [];

  for (const objective of objectives) {
    if (objective.current_count >= objective.target_count && objective.is_active) {
      // Check duplicate (7 days)
      const duplicateExists = await tauriApi.notifications.checkDuplicateExists(
        profileId,
        'objective_achieved',
        'objective',
        objective.id,
        7
      );
      
      if (!duplicateExists) {
        notifications.push({
          profile_id: profileId,
          type: 'objective_achieved',
          title: `🎉 Objectif atteint !`,
          message: `Félicitations ! Tu as atteint ton objectif de ${objective.target_count} œuvres.`,
          data: { objective_id: objective.id, target_count: objective.target_count },
          related_entity_type: 'objective',
          related_entity_id: objective.id,
        });
      }
    }
  }

  return notifications;
}

// Rule: Monthly report
async function checkMonthlyReport(
  profileId: string,
  stats: { completed_count: number; abandoned_count: number; average_rating: number },
  preferences: NotificationPreferences
): Promise<CreateNotificationDto[]> {
  if (!preferences.monthlyReport) return [];

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Check if report already exists for this month
  const reportExists = await tauriApi.notifications.checkMonthlyReportExists(
    profileId,
    currentYear,
    currentMonth
  );

  if (reportExists) return [];

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  return [{
    profile_id: profileId,
    type: 'monthly_report',
    title: `Bilan ${monthNames[currentMonth - 1]} ${currentYear}`,
    message: `${stats.completed_count} œuvres terminées, ${stats.abandoned_count} abandonnées. Note moyenne: ${stats.average_rating.toFixed(1)}/100`,
    data: {
      year: currentYear,
      month: currentMonth,
      completed_count: stats.completed_count,
      abandoned_count: stats.abandoned_count,
      average_rating: stats.average_rating,
    },
  }];
}

// Main function to generate all notifications
export async function generateNotifications(
  profileId: string,
  mediaList: Media[],
  objectives: Objective[],
  stats: { completed_count: number; abandoned_count: number; average_rating: number },
  preferences: NotificationPreferences
): Promise<number> {

  // 1. Cleanup old notifications (> 30 days)
  try {
    await tauriApi.notifications.cleanupOld(profileId, 30);
  } catch (error) {
    console.error('Failed to cleanup old notifications:', error);
  }

  const allDtos: CreateNotificationDto[] = [];

  // 2. Run all rules
  allDtos.push(...await checkStagnantMedia(profileId, mediaList, preferences));
  allDtos.push(...await checkWaitingMedia(profileId, mediaList, preferences));
  allDtos.push(...await checkNearCompletion(profileId, mediaList, preferences));
  allDtos.push(...await checkObjectiveDeadline(profileId, objectives, preferences));
  allDtos.push(...await checkObjectiveStalled(profileId, objectives, preferences));
  allDtos.push(...await checkObjectiveAchieved(profileId, objectives, preferences));
  allDtos.push(...await checkMonthlyReport(profileId, stats, preferences));

  // 3. Create notifications
  let createdCount = 0;
  for (const dto of allDtos) {
    try {
      await tauriApi.notifications.create(dto);
      createdCount++;
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }

  return createdCount;
}
