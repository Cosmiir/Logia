use std::fs;
use std::path::Path;
use rusqlite::Connection;
use chrono::{Utc, NaiveDate, Datelike};

pub fn create_backup(conn: &Connection, profile_dir: &Path) {
    let backup_dir = profile_dir.join("backups");
    if fs::create_dir_all(&backup_dir).is_err() {
        return;
    }

    let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");

    let db_path = profile_dir.join("logia.db");
    let today = Utc::now().date_naive();
    let backup_name = format!("logia_{}.db", today.format("%Y-%m-%d"));
    let backup_path = backup_dir.join(&backup_name);

    if !backup_path.exists() {
        let _ = fs::copy(&db_path, &backup_path);
    }

    prune_backups(&backup_dir, today);
}

fn prune_backups(backup_dir: &Path, today: NaiveDate) {
    let entries = match fs::read_dir(backup_dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let mut backups: Vec<(NaiveDate, String)> = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if let Some(date) = parse_backup_date(&name) {
            backups.push((date, name));
        }
    }

    backups.sort_by(|a, b| b.0.cmp(&a.0));

    let mut kept_daily = 0;
    let mut last_week_kept: Option<(i32, u32)> = None;
    let mut last_month_kept: Option<(i32, u32)> = None;
    let twelve_months_ago = today - chrono::Duration::days(365);

    for (date, name) in &backups {
        let age_days = (today - *date).num_days();

        if age_days < 0 {
            continue;
        }

        if age_days <= 7 {
            if kept_daily < 7 {
                kept_daily += 1;
                continue;
            }
        }

        if age_days <= 28 {
            let week = (date.year(), date.iso_week().week());
            if last_week_kept != Some(week) {
                last_week_kept = Some(week);
                continue;
            }
        }

        if *date > twelve_months_ago {
            let month = (date.year(), date.month());
            if last_month_kept != Some(month) {
                last_month_kept = Some(month);
                continue;
            }
        }

        let _ = fs::remove_file(backup_dir.join(name));
    }
}

fn parse_backup_date(name: &str) -> Option<NaiveDate> {
    let name = name.strip_suffix(".db")?;
    let date_str = name.strip_prefix("logia_")?;
    NaiveDate::parse_from_str(date_str, "%Y-%m-%d").ok()
}
