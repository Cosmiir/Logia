// Validation constants (matching frontend)
pub const COLLECTION_NAME_MAX: usize = 50;
pub const MEDIA_TITLE_MAX: usize = 200;
pub const GENRE_NAME_MAX: usize = 30;
pub const MIN_RATING: f64 = 0.0;
pub const MAX_RATING: f64 = 100.0;
pub const MAX_GENRES_PER_MEDIA: usize = 15;

pub fn validate_collection_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("Collection name cannot be empty".to_string());
    }
    if name.len() > COLLECTION_NAME_MAX {
        return Err(format!("Collection name too long (max {} characters)", COLLECTION_NAME_MAX));
    }
    Ok(())
}

pub fn validate_media_title(title: &str) -> Result<(), String> {
    if title.is_empty() {
        return Err("Media title cannot be empty".to_string());
    }
    if title.len() > MEDIA_TITLE_MAX {
        return Err(format!("Media title too long (max {} characters)", MEDIA_TITLE_MAX));
    }
    Ok(())
}

pub fn validate_rating(rating: f64) -> Result<(), String> {
    if rating < MIN_RATING || rating > MAX_RATING {
        return Err(format!("Rating must be between {} and {}", MIN_RATING, MAX_RATING));
    }
    Ok(())
}

pub fn validate_genre_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("Genre name cannot be empty".to_string());
    }
    if name.len() > GENRE_NAME_MAX {
        return Err(format!("Genre name too long (max {} characters)", GENRE_NAME_MAX));
    }
    Ok(())
}

pub fn validate_media_genres(genre_ids: &[i64]) -> Result<(), String> {
    if genre_ids.len() > MAX_GENRES_PER_MEDIA {
        return Err(format!("Too many genres (max {})", MAX_GENRES_PER_MEDIA));
    }
    Ok(())
}

pub fn validate_person_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("Person name cannot be empty".to_string());
    }
    if name.len() > 100 {
        return Err("Person name too long (max 100 characters)".to_string());
    }
    Ok(())
}
