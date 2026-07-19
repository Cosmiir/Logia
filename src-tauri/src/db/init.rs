use rusqlite::{Connection, Result};

pub fn initialize_database(conn: &Connection) -> Result<()> {
    // Check if schema already exists
    let table_exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='collections'",
        [],
        |row| row.get(0),
    )?;

    if !table_exists {
        create_schema(conn)?;
    }

    // Set performance pragmas
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA cache_size = -64000;
         PRAGMA temp_store = MEMORY;
         PRAGMA foreign_keys = ON;
         PRAGMA mmap_size = 268435456;"
    )?;

    Ok(())
}

fn create_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        -- Collections table
        CREATE TABLE collections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE COLLATE NOCASE,
            icon TEXT,
            color TEXT DEFAULT '#8B5CF6',
            creator_label TEXT DEFAULT 'Creator',
            date_label TEXT DEFAULT 'Experience date',
            progression_unit TEXT DEFAULT 'percent',
            progression_label TEXT DEFAULT 'Episode',
            progression_short_label TEXT,
            replay_date_label TEXT,
            duration_label TEXT,
            plural_with_s INTEGER DEFAULT 0,
            consumption_verb TEXT,
            monthly_capacity INTEGER,
            position INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Media table
        CREATE TABLE IF NOT EXISTS media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collection_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            creator TEXT,
            release_date DATE,
            synopsis TEXT,
            user_rating REAL CHECK(user_rating >= 0 AND user_rating <= 100),
            user_review TEXT,
            progress_current REAL CHECK(progress_current IS NULL OR progress_current >= 0),
            progress_total REAL CHECK(progress_total IS NULL OR progress_total >= 0),
            progress_status TEXT,
            replay_count INTEGER DEFAULT 0 CHECK(replay_count >= 0),
            experience_date DATE,
            experience_dates TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            cover_path TEXT,
            cover_source_index INTEGER DEFAULT 0,
            positive_points TEXT,
            negative_points TEXT,
            media_status TEXT,
            FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
        );

        -- Genres table
        CREATE TABLE genres (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#8B5CF6',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Media-Genres junction table
        CREATE TABLE media_genres (
            media_id INTEGER NOT NULL,
            genre_id INTEGER NOT NULL,
            position INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (media_id, genre_id),
            FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
            FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
        );

        -- People table
        CREATE TABLE people (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE COLLATE NOCASE,
            photo_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Media-Credits junction table
        CREATE TABLE media_credits (
            media_id INTEGER NOT NULL,
            person_id INTEGER NOT NULL,
            role TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (media_id, person_id, role),
            FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
            FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
        );

        -- Objectives table
        CREATE TABLE objectives (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collection_id INTEGER NOT NULL,
            target_count INTEGER NOT NULL CHECK(target_count > 0),
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            count_abandoned INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
        );

        -- Media images table
        CREATE TABLE media_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            media_id INTEGER NOT NULL,
            full_path TEXT NOT NULL,
            thumb_path TEXT NOT NULL,
            position INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
            UNIQUE(media_id, position)
        );

        CREATE TABLE media_attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            media_id INTEGER NOT NULL,
            original_name TEXT NOT NULL,
            stored_path TEXT NOT NULL,
            size_bytes INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
        );

        -- Experience entries table (version + language per experience date)
        CREATE TABLE IF NOT EXISTS experience_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            media_id INTEGER NOT NULL,
            date TEXT,
            version TEXT,
            language TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_experience_entries_media ON experience_entries(media_id);

        -- Notifications table
        CREATE TABLE notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_id TEXT NOT NULL,
            notification_type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            data TEXT,
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            related_entity_type TEXT,
            related_entity_id INTEGER
        );

        -- Settings table (per-profile preferences)
        CREATE TABLE settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        -- Review templates table
        CREATE TABLE review_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            icon TEXT NOT NULL,
            color TEXT DEFAULT '#8B5CF6',
            content TEXT NOT NULL,
            is_default INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Review templates trigger for updated_at
        CREATE TRIGGER update_review_template_timestamp AFTER UPDATE ON review_templates BEGIN
            UPDATE review_templates SET updated_at = CURRENT_TIMESTAMP WHERE id = new.id;
        END;

        -- Performance indexes
        CREATE INDEX idx_media_collection ON media(collection_id);
        CREATE INDEX idx_media_title ON media(title);
        CREATE INDEX idx_media_experience_date ON media(collection_id, experience_date DESC);
        CREATE INDEX idx_media_created_at ON media(collection_id, created_at DESC);
        CREATE INDEX idx_media_rating ON media(collection_id, user_rating DESC);
        CREATE INDEX idx_media_release_date ON media(collection_id, release_date DESC);
        CREATE INDEX idx_genres_name ON genres(name);
        CREATE INDEX idx_media_genres_media ON media_genres(media_id);
        CREATE INDEX idx_people_name ON people(name);
        CREATE INDEX idx_media_credits_media ON media_credits(media_id);
        CREATE INDEX idx_images_media ON media_images(media_id);
        CREATE INDEX idx_media_attachments_media ON media_attachments(media_id);
        CREATE INDEX idx_objectives_collection ON objectives(collection_id);
        CREATE INDEX idx_objectives_active ON objectives(is_active);
        CREATE INDEX idx_media_progress_status ON media(progress_status);
        CREATE INDEX idx_media_updated_at ON media(collection_id, updated_at DESC);
        CREATE INDEX idx_media_creator ON media(collection_id, creator COLLATE NOCASE);
        CREATE INDEX idx_media_media_status ON media(collection_id, media_status);
        CREATE INDEX idx_media_progress_status_coll ON media(collection_id, progress_status);
        CREATE INDEX idx_media_progress_current ON media(collection_id, progress_current);
        CREATE INDEX idx_media_genres_genre ON media_genres(genre_id);

        -- Standalone indexes for dashboard queries (no collection_id filter)
        CREATE INDEX idx_media_created_at_standalone ON media(created_at DESC);
        CREATE INDEX idx_media_updated_at_standalone ON media(updated_at DESC);

        CREATE INDEX idx_notifications_profile_type_entity ON notifications(profile_id, notification_type, related_entity_type, related_entity_id);
        CREATE INDEX idx_notifications_created_at ON notifications(created_at);
        CREATE INDEX idx_notifications_is_read ON notifications(is_read);
        CREATE INDEX idx_review_templates_name ON review_templates(name);

        -- Full-text search
        CREATE VIRTUAL TABLE media_fts USING fts5(
            title, creator, synopsis,
            content='media',
            content_rowid='id',
            tokenize='porter unicode61 remove_diacritics 1'
        );

        -- FTS triggers
        CREATE TRIGGER media_fts_insert AFTER INSERT ON media BEGIN
            INSERT INTO media_fts(rowid, title, creator, synopsis)
            VALUES (new.id, new.title, new.creator, new.synopsis);
        END;

        CREATE TRIGGER media_fts_update AFTER UPDATE ON media BEGIN
            INSERT INTO media_fts(media_fts, rowid, title, creator, synopsis)
            VALUES('delete', old.id, old.title, old.creator, old.synopsis);
            INSERT INTO media_fts(rowid, title, creator, synopsis)
            VALUES (new.id, new.title, new.creator, new.synopsis);
        END;

        CREATE TRIGGER media_fts_delete AFTER DELETE ON media BEGIN
            DELETE FROM media_fts WHERE rowid=old.id;
        END;
        "
    )?;

    // Insert default settings
    let defaults = [
        ("theme_id", "nebula"),
        ("logo_variant", "classic"),
        ("card_density", "normal"),
        ("animations_enabled", "true"),
        ("window_controls_style", "windows"),
        ("show_profile_selector_on_startup", "true"),
        ("notification_prefs", r#"{"stagnantMedia":true,"waitingMedia":true,"nearCompletion":true,"objectiveDeadline":true,"objectiveStalled":true,"objectiveAchieved":true,"monthlyReport":true}"#),
        ("library_view_mode", "grid"),
    ];
    for (key, value) in &defaults {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)",
            [key, value],
        )?;
    }

    // Insert default review templates
    super::review_templates::insert_defaults(conn)?;

    Ok(())
}


