use rusqlite::{Connection, Result};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub total_media: i32,
    pub total_collections: i32,
    pub average_rating: f64,
    pub media_this_month: i32,
    // Status counts for stats card
    pub completed_count: i32,
    pub abandoned_count: i32,
    pub in_progress_count: i32,
    pub not_started_count: i32,
    pub rated_count: i32,
    pub rating_median: i32,
    pub rating_std_dev: i32,
    pub trend_this_month: i32,
    pub trend_last_month: i32,
}

pub fn get_dashboard_stats(conn: &Connection) -> Result<DashboardStats> {
    // Single aggregated query instead of 9+ separate queries
    let (total_media, total_collections, average_rating, media_this_month,
         completed_count, abandoned_count, in_progress_count, not_started_count,
         rated_count, trend_this_month, trend_last_month) = conn.query_row(
        "SELECT
           (SELECT COUNT(*) FROM media) as total_media,
           (SELECT COUNT(*) FROM collections) as total_collections,
           COALESCE((SELECT AVG(user_rating) FROM media WHERE user_rating IS NOT NULL), 0.0) as avg_rating,
           SUM(CASE WHEN experience_date IS NOT NULL
                     AND experience_date >= strftime('%Y-%m-01', 'now')
                THEN 1 ELSE 0 END) as media_this_month,
           SUM(CASE WHEN progress_status = 'COMPLETED'
                THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN progress_status = 'ABANDONED'
                THEN 1 ELSE 0 END) as abandoned,
           SUM(CASE WHEN progress_status = 'IN_PROGRESS'
                THEN 1 ELSE 0 END) as in_progress,
           SUM(CASE WHEN progress_status = 'NOT_STARTED'
                THEN 1 ELSE 0 END) as not_started,
           SUM(CASE WHEN user_rating IS NOT NULL AND user_rating > 0
                THEN 1 ELSE 0 END) as rated_count,
           SUM(CASE WHEN experience_date IS NOT NULL
                     AND experience_date >= strftime('%Y-%m-01', 'now')
                THEN 1 ELSE 0 END) as trend_this_month,
           SUM(CASE WHEN experience_date IS NOT NULL
                     AND experience_date >= strftime('%Y-%m-01', 'now', '-1 month')
                     AND experience_date < strftime('%Y-%m-01', 'now')
                THEN 1 ELSE 0 END) as trend_last_month
         FROM media",
        [],
        |row| {
            Ok((
                row.get::<_, i32>(0)?,
                row.get::<_, i32>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, Option<i32>>(3)?.unwrap_or(0),
                row.get::<_, Option<i32>>(4)?.unwrap_or(0),
                row.get::<_, Option<i32>>(5)?.unwrap_or(0),
                row.get::<_, Option<i32>>(6)?.unwrap_or(0),
                row.get::<_, Option<i32>>(7)?.unwrap_or(0),
                row.get::<_, Option<i32>>(8)?.unwrap_or(0),
                row.get::<_, Option<i32>>(9)?.unwrap_or(0),
                row.get::<_, Option<i32>>(10)?.unwrap_or(0),
            ))
        },
    )?;

    // Get all ratings for median and std dev calculation
    // (still need to load ratings for std dev — no simple SQL-only way)
    let mut stmt = conn.prepare("SELECT user_rating FROM media WHERE user_rating IS NOT NULL AND user_rating > 0")?;
    let ratings: Vec<i32> = stmt.query_map([], |row| row.get::<_, i32>(0))?
        .filter_map(|r| r.ok())
        .map(|r: i32| ((r as f64 / 10.0) * 100.0).round() as i32) // Convert to 0-100 scale
        .collect();

    let rating_median = calculate_median(&ratings);
    let rating_std_dev = calculate_std_dev(&ratings);

    Ok(DashboardStats {
        total_media,
        total_collections,
        average_rating,
        media_this_month,
        completed_count,
        abandoned_count,
        in_progress_count,
        not_started_count,
        rated_count,
        rating_median,
        rating_std_dev,
        trend_this_month,
        trend_last_month,
    })
}

fn calculate_median(values: &[i32]) -> i32 {
    if values.is_empty() {
        return 0;
    }
    let mut sorted = values.to_vec();
    sorted.sort_unstable();
    let mid = sorted.len() / 2;
    if sorted.len() % 2 == 0 {
        ((sorted[mid - 1] + sorted[mid]) as f64 / 2.0).round() as i32
    } else {
        sorted[mid]
    }
}

fn calculate_std_dev(values: &[i32]) -> i32 {
    if values.is_empty() {
        return 0;
    }
    let mean = values.iter().sum::<i32>() as f64 / values.len() as f64;
    let variance = values.iter().map(|&v| {
        let diff = v as f64 - mean;
        diff * diff
    }).sum::<f64>() / values.len() as f64;
    variance.sqrt().round() as i32
}
