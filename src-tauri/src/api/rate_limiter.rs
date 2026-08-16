use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{Duration, Instant};

struct TokenBucket {
    capacity: f64,
    refill_rate: f64,
    tokens: f64,
    last_refill: Instant,
}

impl TokenBucket {
    fn new(capacity: f64, refill_rate: f64) -> Self {
        Self {
            capacity,
            refill_rate,
            tokens: capacity,
            last_refill: Instant::now(),
        }
    }

    fn try_refill(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();
        self.tokens = (self.tokens + elapsed * self.refill_rate).min(self.capacity);
        self.last_refill = now;
    }
}

pub struct RateLimiter {
    buckets: Arc<Mutex<HashMap<String, TokenBucket>>>,
}

impl Clone for RateLimiter {
    fn clone(&self) -> Self {
        Self {
            buckets: Arc::clone(&self.buckets),
        }
    }
}

impl RateLimiter {
    pub fn new() -> Self {
        let mut buckets = HashMap::new();
        // Jikan: 3 req/s
        buckets.insert("jikan_anime".to_string(), TokenBucket::new(3.0, 3.0));
        buckets.insert("jikan_manga".to_string(), TokenBucket::new(3.0, 3.0));
        // MusicBrainz: 1 req/s
        buckets.insert("musicbrainz".to_string(), TokenBucket::new(1.0, 1.0));
        // TMDB: 5 req/s
        buckets.insert("tmdb".to_string(), TokenBucket::new(5.0, 5.0));
        // RAWG: 5 req/s
        buckets.insert("rawg".to_string(), TokenBucket::new(5.0, 5.0));
        // Others: 2 req/s
        buckets.insert("omdb".to_string(), TokenBucket::new(2.0, 2.0));
        buckets.insert("tvmaze".to_string(), TokenBucket::new(2.0, 2.0));
        buckets.insert("anilist_anime".to_string(), TokenBucket::new(2.0, 2.0));
        buckets.insert("anilist_manga".to_string(), TokenBucket::new(2.0, 2.0));
        buckets.insert("igdb".to_string(), TokenBucket::new(4.0, 4.0));
        buckets.insert("itunes".to_string(), TokenBucket::new(2.0, 2.0));

        Self {
            buckets: Arc::new(Mutex::new(buckets)),
        }
    }

    pub async fn acquire(&self, provider: &str) {
        loop {
            let wait_duration = {
                let mut buckets = self.buckets.lock().await;
                let bucket = buckets.entry(provider.to_string()).or_insert_with(|| TokenBucket::new(2.0, 2.0));
                bucket.try_refill();
                if bucket.tokens >= 1.0 {
                    bucket.tokens -= 1.0;
                    return;
                }
                // Calculate how long until we have 1 token
                let needed = 1.0 - bucket.tokens;
                let secs = needed / bucket.refill_rate;
                Duration::from_secs_f64(secs)
            };
            tokio::time::sleep(wait_duration).await;
        }
    }
}

impl Default for RateLimiter {
    fn default() -> Self {
        Self::new()
    }
}

/// User-Agent string sent with every API request (required by MusicBrainz,
/// good practice elsewhere). Version is pulled at compile time from Cargo.toml
/// so it stays in sync across releases.
pub fn user_agent() -> String {
    format!(
        "Logia/{} (https://github.com/Cosmiir/Logia)",
        env!("CARGO_PKG_VERSION")
    )
}

/// Execute an async request with 429 retry + exponential backoff.
/// `make_request` is called up to `max_retries + 1` times. A result is
/// considered retryable when it returns `Ok(response)` with status 429,
/// or when it returns `Err` (network error). Backoff: 1s, 2s, 4s.
pub async fn execute_with_retry<F, Fut>(
    max_retries: u32,
    make_request: F,
) -> Result<reqwest::Response, String>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = reqwest::Result<reqwest::Response>>,
{
    let mut attempt = 0u32;
    loop {
        let result = make_request().await;
        match result {
            Ok(resp) if resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS => {
                if attempt >= max_retries {
                    return Ok(resp);
                }
                let delay = Duration::from_secs(1u64 << attempt); // 1s, 2s, 4s
                tokio::time::sleep(delay).await;
                attempt += 1;
            }
            Ok(resp) => return Ok(resp),
            Err(e) => {
                if attempt >= max_retries {
                    return Err(format!("Network error after {} retries: {}", attempt, e));
                }
                let delay = Duration::from_secs(1u64 << attempt);
                tokio::time::sleep(delay).await;
                attempt += 1;
            }
        }
    }
}
