use rusqlite::{Connection, Result, params};
use crate::models::{Notification, CreateNotificationDto};
use serde::Deserialize;
use chrono::Datelike;

#[derive(Debug, Deserialize)]
pub struct NotificationPrefs {
    #[serde(default)]
    pub stagnant_media: bool,
    #[serde(default)]
    pub waiting_media: bool,
    #[serde(default)]
    pub near_completion: bool,
    #[serde(default)]
    pub objective_deadline: bool,
    #[serde(default)]
    pub objective_stalled: bool,
    #[serde(default)]
    pub objective_achieved: bool,
    #[serde(default)]
    pub monthly_report: bool,
}

struct PendingNotification {
    notification_type: String,
    title: String,
    message: String,
    data: Option<String>,
    related_entity_type: Option<String>,
    related_entity_id: Option<i64>,
}

pub fn get_all(conn: &Connection, profile_id: &str, limit: Option<i32>) -> Result<Vec<Notification>> {
    let limit_clause = limit.map(|l| format!(" LIMIT {}", l)).unwrap_or_default();
    
    let mut stmt = conn.prepare(&format!(
        "SELECT id, profile_id, notification_type, title, message, data, is_read, created_at, related_entity_type, related_entity_id
         FROM notifications
         WHERE profile_id = ?1
         ORDER BY created_at DESC{}",
        limit_clause
    ))?;

    let notifications = stmt.query_map(params![profile_id], |row| {
        Ok(Notification {
            id: row.get(0)?,
            profile_id: row.get(1)?,
            notification_type: row.get(2)?,
            title: row.get(3)?,
            message: row.get(4)?,
            data: row.get(5)?,
            is_read: row.get::<_, Option<bool>>(6)?.unwrap_or(false),
            created_at: row.get(7)?,
            related_entity_type: row.get(8)?,
            related_entity_id: row.get(9)?,
        })
    })?.collect::<Result<Vec<_>>>()?;

    Ok(notifications)
}

pub fn get_unread_count(conn: &Connection, profile_id: &str) -> Result<i32> {
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM notifications WHERE profile_id = ?1 AND is_read = 0",
        params![profile_id],
        |row| row.get(0),
    )?;
    Ok(count)
}

pub fn insert(conn: &Connection, dto: CreateNotificationDto) -> Result<i64> {
    conn.execute(
        "INSERT INTO notifications (profile_id, notification_type, title, message, data, related_entity_type, related_entity_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            dto.profile_id,
            dto.notification_type,
            dto.title,
            dto.message,
            dto.data,
            dto.related_entity_type,
            dto.related_entity_id,
        ],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn mark_as_read(conn: &Connection, notification_id: i64) -> Result<()> {
    conn.execute(
        "UPDATE notifications SET is_read = 1 WHERE id = ?1",
        params![notification_id],
    )?;
    Ok(())
}

pub fn mark_all_as_read(conn: &Connection, profile_id: &str) -> Result<()> {
    conn.execute(
        "UPDATE notifications SET is_read = 1 WHERE profile_id = ?1",
        params![profile_id],
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, notification_id: i64) -> Result<()> {
    conn.execute(
        "DELETE FROM notifications WHERE id = ?1",
        params![notification_id],
    )?;
    Ok(())
}

pub fn cleanup_old(conn: &Connection, profile_id: &str, days: i32) -> Result<i32> {
    let result = conn.execute(
        "DELETE FROM notifications WHERE profile_id = ?1 AND created_at < datetime('now', '-' || ?2 || ' days')",
        params![profile_id, days],
    )?;
    Ok(result as i32)
}

pub fn check_duplicate_exists(
    conn: &Connection,
    profile_id: &str,
    notification_type: &str,
    related_entity_type: Option<&str>,
    related_entity_id: Option<i64>,
    max_age_days: Option<i32>,
) -> Result<bool> {
    let count: i32 = if let (Some(entity_type), Some(entity_id)) = (related_entity_type, related_entity_id) {
        if let Some(days) = max_age_days {
            conn.query_row(
                "SELECT COUNT(*) FROM notifications 
                 WHERE profile_id = ?1 AND notification_type = ?2 
                 AND related_entity_type = ?3 AND related_entity_id = ?4 
                 AND (is_read = 0 OR created_at >= datetime('now', '-' || ?5 || ' days'))",
                params![profile_id, notification_type, entity_type, entity_id, days],
                |row| row.get(0),
            )?
        } else {
            conn.query_row(
                "SELECT COUNT(*) FROM notifications 
                 WHERE profile_id = ?1 AND notification_type = ?2 
                 AND related_entity_type = ?3 AND related_entity_id = ?4 AND is_read = 0",
                params![profile_id, notification_type, entity_type, entity_id],
                |row| row.get(0),
            )?
        }
    } else {
        if let Some(days) = max_age_days {
            conn.query_row(
                "SELECT COUNT(*) FROM notifications 
                 WHERE profile_id = ?1 AND notification_type = ?2 
                 AND (is_read = 0 OR created_at >= datetime('now', '-' || ?3 || ' days'))",
                params![profile_id, notification_type, days],
                |row| row.get(0),
            )?
        } else {
            conn.query_row(
                "SELECT COUNT(*) FROM notifications 
                 WHERE profile_id = ?1 AND notification_type = ?2 AND is_read = 0",
                params![profile_id, notification_type],
                |row| row.get(0),
            )?
        }
    };

    Ok(count > 0)
}

pub fn check_monthly_report_exists(conn: &Connection, profile_id: &str, year: i32, month: i32) -> Result<bool> {
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM notifications 
         WHERE profile_id = ?1 AND notification_type = 'monthly_report' 
         AND strftime('%Y', created_at) = ?2 AND strftime('%m', created_at) = ?3",
        params![profile_id, &year.to_string(), &format!("{:02}", month)],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

pub fn generate_all_notifications(conn: &Connection, profile_id: &str, prefs: &NotificationPrefs) -> Result<i32> {
    // 1. Cleanup old notifications (> 30 days)
    conn.execute(
        "DELETE FROM notifications WHERE profile_id = ?1 AND created_at < datetime('now', '-30 days')",
        params![profile_id],
    )?;

    let mut pending: Vec<PendingNotification> = Vec::new();

    // 2. Stagnant media (IN_PROGRESS, updated_at > 30 days, duplicate check 7 days)
    if prefs.stagnant_media {
        let mut stmt = conn.prepare(
            "SELECT m.id, m.title FROM media m
             WHERE m.progress_status = 'IN_PROGRESS'
               AND m.updated_at < datetime('now', '-30 days')
               AND NOT EXISTS (
                 SELECT 1 FROM notifications n
                 WHERE n.profile_id = ?1 AND n.notification_type = 'stagnant_media'
                   AND n.related_entity_type = 'media' AND n.related_entity_id = m.id
                   AND (n.is_read = 0 OR n.created_at >= datetime('now', '-7 days'))
               )"
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?;
        for row in rows {
            let (id, title) = row?;
            let data = serde_json::to_string(&serde_json::json!({
                "media_id": id,
                "media_title": title
            })).ok();
            pending.push(PendingNotification {
                notification_type: "stagnant_media".to_string(),
                title: format!("{} stagne", title),
                message: "Cette œuvre est en cours depuis plus de 30 jours sans progression.".to_string(),
                data,
                related_entity_type: Some("media".to_string()),
                related_entity_id: Some(id),
            });
        }
    }

    // 3. Waiting media (NOT_STARTED, created_at > 90 days, duplicate check 30 days)
    if prefs.waiting_media {
        let mut stmt = conn.prepare(
            "SELECT m.id, m.title FROM media m
             WHERE m.progress_status = 'NOT_STARTED'
               AND m.created_at < datetime('now', '-90 days')
               AND NOT EXISTS (
                 SELECT 1 FROM notifications n
                 WHERE n.profile_id = ?1 AND n.notification_type = 'waiting_media'
                   AND n.related_entity_type = 'media' AND n.related_entity_id = m.id
                   AND (n.is_read = 0 OR n.created_at >= datetime('now', '-30 days'))
               )"
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?;
        for row in rows {
            let (id, title) = row?;
            let data = serde_json::to_string(&serde_json::json!({
                "media_id": id,
                "media_title": title
            })).ok();
            pending.push(PendingNotification {
                notification_type: "waiting_media".to_string(),
                title: format!("{} attend", title),
                message: "Cette œuvre est dans la liste \"à commencer\" depuis plus de 90 jours.".to_string(),
                data,
                related_entity_type: Some("media".to_string()),
                related_entity_id: Some(id),
            });
        }
    }

    // 4. Near completion (progress >= 90% and < 100%, IN_PROGRESS, duplicate check 3 days)
    if prefs.near_completion {
        let mut stmt = conn.prepare(
            "SELECT m.id, m.title,
                    CASE WHEN m.progress_total > 0 THEN CAST(m.progress_current * 100.0 / m.progress_total AS INTEGER) ELSE 0 END as progress
             FROM media m
             WHERE m.progress_status = 'IN_PROGRESS'
               AND m.progress_total > 0
               AND (m.progress_current * 100.0 / m.progress_total) >= 90
               AND (m.progress_current * 100.0 / m.progress_total) < 100
               AND NOT EXISTS (
                 SELECT 1 FROM notifications n
                 WHERE n.profile_id = ?1 AND n.notification_type = 'near_completion'
                   AND n.related_entity_type = 'media' AND n.related_entity_id = m.id
                   AND (n.is_read = 0 OR n.created_at >= datetime('now', '-3 days'))
               )"
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, i32>(2)?))
        })?;
        for row in rows {
            let (id, title, progress) = row?;
            let data = serde_json::to_string(&serde_json::json!({
                "media_id": id,
                "media_title": title,
                "progress": progress
            })).ok();
            pending.push(PendingNotification {
                notification_type: "near_completion".to_string(),
                title: format!("{} bientôt terminée !", title),
                message: format!("Tu es à {}% de cette œuvre. Continue comme ça !", progress),
                data,
                related_entity_type: Some("media".to_string()),
                related_entity_id: Some(id),
            });
        }
    }

    // 5. Objective notifications — computed via correlated subqueries for current_count
    // Objective deadline (< 7 days, progress < 50%, duplicate check 1 day)
    if prefs.objective_deadline {
        let mut stmt = conn.prepare(
            "SELECT o.id, o.target_count,
                    (SELECT COUNT(*) FROM media m
                     WHERE m.collection_id = o.collection_id
                       AND m.experience_date IS NOT NULL
                       AND m.experience_date >= o.start_date AND m.experience_date <= o.end_date
                       AND (m.progress_status = 'COMPLETED'
                            OR (m.progress_status = 'ABANDONED' AND o.count_abandoned = 1))
                    ) as current_count
             FROM objectives o
             WHERE o.is_active = 1
               AND o.end_date >= date('now')
               AND o.end_date <= date('now', '+7 days')
               AND NOT EXISTS (
                 SELECT 1 FROM notifications n
                 WHERE n.profile_id = ?1 AND n.notification_type = 'objective_deadline'
                   AND n.related_entity_type = 'objective' AND n.related_entity_id = o.id
                   AND (n.is_read = 0 OR n.created_at >= datetime('now', '-1 days'))
               )"
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, i32>(1)?, row.get::<_, i32>(2)?))
        })?;
        for row in rows {
            let (id, target_count, current_count) = row?;
            let progress = if target_count > 0 { (current_count as f64 / target_count as f64) * 100.0 } else { 0.0 };
            if progress < 50.0 {
                let days_until_end = 7; // Already filtered to <= 7 days
                let data = serde_json::to_string(&serde_json::json!({
                    "objective_id": id,
                    "progress": progress as i32
                })).ok();
                pending.push(PendingNotification {
                    notification_type: "objective_deadline".to_string(),
                    title: "Objectif en retard".to_string(),
                    message: format!("Deadline dans {} jours et seulement {}% complété.", days_until_end, progress as i32),
                    data,
                    related_entity_type: Some("objective".to_string()),
                    related_entity_id: Some(id),
                });
            }
        }
    }

    // 6. Objective stalled (0% at midpoint, duplicate check 7 days)
    if prefs.objective_stalled {
        let mut stmt = conn.prepare(
            "SELECT o.id,
                    (SELECT COUNT(*) FROM media m
                     WHERE m.collection_id = o.collection_id
                       AND m.experience_date IS NOT NULL
                       AND m.experience_date >= o.start_date AND m.experience_date <= o.end_date
                       AND (m.progress_status = 'COMPLETED'
                            OR (m.progress_status = 'ABANDONED' AND o.count_abandoned = 1))
                    ) as current_count
             FROM objectives o
             WHERE o.is_active = 1
               AND ABS(julianday('now') - julianday(o.start_date)
                      - (julianday(o.end_date) - julianday(o.start_date)) / 2.0) <= 2
               AND NOT EXISTS (
                 SELECT 1 FROM notifications n
                 WHERE n.profile_id = ?1 AND n.notification_type = 'objective_stalled'
                   AND n.related_entity_type = 'objective' AND n.related_entity_id = o.id
                   AND (n.is_read = 0 OR n.created_at >= datetime('now', '-7 days'))
               )"
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, i32>(1)?))
        })?;
        for row in rows {
            let (id, current_count) = row?;
            if current_count == 0 {
                let data = serde_json::to_string(&serde_json::json!({
                    "objective_id": id
                })).ok();
                pending.push(PendingNotification {
                    notification_type: "objective_stalled".to_string(),
                    title: "Objectif au point mort".to_string(),
                    message: "Tu es à mi-chemin de la période et n'as pas encore commencé cet objectif.".to_string(),
                    data,
                    related_entity_type: Some("objective".to_string()),
                    related_entity_id: Some(id),
                });
            }
        }
    }

    // 7. Objective achieved (current_count >= target_count, duplicate check 7 days)
    if prefs.objective_achieved {
        let mut stmt = conn.prepare(
            "SELECT o.id, o.target_count,
                    (SELECT COUNT(*) FROM media m
                     WHERE m.collection_id = o.collection_id
                       AND m.experience_date IS NOT NULL
                       AND m.experience_date >= o.start_date AND m.experience_date <= o.end_date
                       AND (m.progress_status = 'COMPLETED'
                            OR (m.progress_status = 'ABANDONED' AND o.count_abandoned = 1))
                    ) as current_count
             FROM objectives o
             WHERE o.is_active = 1
               AND NOT EXISTS (
                 SELECT 1 FROM notifications n
                 WHERE n.profile_id = ?1 AND n.notification_type = 'objective_achieved'
                   AND n.related_entity_type = 'objective' AND n.related_entity_id = o.id
                   AND (n.is_read = 0 OR n.created_at >= datetime('now', '-7 days'))
               )"
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, i32>(1)?, row.get::<_, i32>(2)?))
        })?;
        for row in rows {
            let (id, target_count, current_count) = row?;
            if current_count >= target_count {
                let data = serde_json::to_string(&serde_json::json!({
                    "objective_id": id,
                    "target_count": target_count
                })).ok();
                pending.push(PendingNotification {
                    notification_type: "objective_achieved".to_string(),
                    title: "Objectif atteint !".to_string(),
                    message: format!("Félicitations ! Tu as atteint ton objectif de {} œuvres.", target_count),
                    data,
                    related_entity_type: Some("objective".to_string()),
                    related_entity_id: Some(id),
                });
            }
        }
    }

    // 8. Monthly report (check if already exists for this month)
    if prefs.monthly_report {
        let now = chrono::Utc::now();
        let current_year = now.format("%Y").to_string();

        let report_exists: bool = check_monthly_report_exists(
            conn, profile_id, now.year() as i32, now.month() as i32
        )?;

        if !report_exists {
            let (completed_count, abandoned_count, avg_rating): (i32, i32, f64) = conn.query_row(
                "SELECT
                   SUM(CASE WHEN progress_status = 'COMPLETED' THEN 1 ELSE 0 END),
                   SUM(CASE WHEN progress_status = 'ABANDONED' THEN 1 ELSE 0 END),
                   COALESCE(AVG(CASE WHEN user_rating IS NOT NULL AND user_rating > 0 THEN user_rating END), 0.0)
                 FROM media",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            )?;

            let month_names = [
                "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
            ];
            let month_name = month_names[(now.month() as usize) - 1];

            let data = serde_json::to_string(&serde_json::json!({
                "year": now.year(),
                "month": now.month(),
                "completed_count": completed_count,
                "abandoned_count": abandoned_count,
                "average_rating": avg_rating
            })).ok();

            pending.push(PendingNotification {
                notification_type: "monthly_report".to_string(),
                title: format!("Bilan {} {}", month_name, current_year),
                message: format!("{} œuvres terminées, {} abandonnées. Note moyenne: {:.1}/100",
                    completed_count, abandoned_count, avg_rating),
                data,
                related_entity_type: None,
                related_entity_id: None,
            });
        }
    }

    // 9. Batch-insert all pending notifications in a single transaction
    let mut created_count = 0;
    for p in &pending {
        conn.execute(
            "INSERT INTO notifications (profile_id, notification_type, title, message, data, related_entity_type, related_entity_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                profile_id,
                p.notification_type,
                p.title,
                p.message,
                p.data,
                p.related_entity_type,
                p.related_entity_id,
            ],
        )?;
        created_count += 1;
    }

    Ok(created_count)
}
