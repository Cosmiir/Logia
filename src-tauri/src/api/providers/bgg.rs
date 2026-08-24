use crate::api::types::{ApiCredit, ApiImage, ApiMediaDetail, ApiSearchResult};
use crate::api::rate_limiter::RateLimiter;
use crate::api::providers::{build_client, fetch_image_as_b64, retry};
use futures::future::join_all;
use quick_xml::events::Event;
use quick_xml::Reader;

const BASE_URL: &str = "https://boardgamegeek.com/xmlapi2";
const MAX_RESULTS: usize = 5;
const MAX_IMAGES: usize = 8;
const MAX_CREDITS: usize = 10;

/// Parsed entry from a BGG search response.
struct SearchEntry {
    id: String,
    name: String,
    year: Option<String>,
}

/// Parse the `/search` XML response into a list of (id, name, year).
fn parse_search_xml(xml: &str) -> Vec<SearchEntry> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    let mut entries = Vec::new();
    let mut current_id: Option<String> = None;
    let mut current_name: Option<String> = None;
    let mut current_year: Option<String> = None;
    let mut in_item = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                if e.name().as_ref() == b"item" {
                    in_item = true;
                    current_id = None;
                    current_name = None;
                    current_year = None;
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"id" {
                            current_id = Some(String::from_utf8_lossy(attr.value.as_ref()).to_string());
                        }
                    }
                } else if in_item && e.name().as_ref() == b"name" {
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"value" {
                            current_name = Some(String::from_utf8_lossy(attr.value.as_ref()).to_string());
                        }
                    }
                } else if in_item && e.name().as_ref() == b"yearpublished" {
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"value" {
                            let v = String::from_utf8_lossy(attr.value.as_ref()).to_string();
                            if v != "0" {
                                current_year = Some(v);
                            }
                        }
                    }
                }
            }
            Ok(Event::Empty(e)) => {
                // Self-closing tags (name and yearpublished can be empty elements)
                if in_item && e.name().as_ref() == b"name" {
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"value" {
                            current_name = Some(String::from_utf8_lossy(attr.value.as_ref()).to_string());
                        }
                    }
                } else if in_item && e.name().as_ref() == b"yearpublished" {
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"value" {
                            let v = String::from_utf8_lossy(attr.value.as_ref()).to_string();
                            if v != "0" {
                                current_year = Some(v);
                            }
                        }
                    }
                }
            }
            Ok(Event::End(e)) => {
                if e.name().as_ref() == b"item" {
                    if let (Some(id), Some(name)) = (current_id.take(), current_name.take()) {
                        if !name.is_empty() {
                            entries.push(SearchEntry {
                                id,
                                name,
                                year: current_year.take(),
                            });
                        }
                    }
                    in_item = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    entries
}

/// Parsed thumbnail from a batch `/thing` response: maps item id → thumbnail URL.
fn parse_thing_thumbnails_xml(xml: &str) -> std::collections::HashMap<String, String> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    let mut map = std::collections::HashMap::new();
    let mut current_id: Option<String> = None;
    let mut in_thumbnail = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                if e.name().as_ref() == b"item" {
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"id" {
                            current_id = Some(String::from_utf8_lossy(attr.value.as_ref()).to_string());
                        }
                    }
                } else if e.name().as_ref() == b"thumbnail" {
                    in_thumbnail = true;
                }
            }
            Ok(Event::Text(e)) => {
                if in_thumbnail {
                    if let Some(id) = &current_id {
                        map.insert(id.clone(), String::from_utf8_lossy(e.as_ref()).to_string());
                    }
                }
            }
            Ok(Event::End(e)) => {
                if e.name().as_ref() == b"thumbnail" {
                    in_thumbnail = false;
                } else if e.name().as_ref() == b"item" {
                    current_id = None;
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    map
}

/// Parsed detail from a `/thing?id={id}&stats=1` response.
struct ThingDetail {
    title: String,
    year: Option<String>,
    description: Option<String>,
    playingtime: Option<f64>,
    image: Option<String>,
    thumbnail: Option<String>,
    designers: Vec<String>,
    artists: Vec<String>,
    publishers: Vec<String>,
    categories: Vec<String>,
    mechanics: Vec<String>,
}

fn parse_thing_detail_xml(xml: &str) -> Option<ThingDetail> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    let mut in_item = false;
    let mut in_description = false;
    let mut in_image = false;
    let mut in_thumbnail = false;
    let mut detail = ThingDetail {
        title: String::new(),
        year: None,
        description: None,
        playingtime: None,
        image: None,
        thumbnail: None,
        designers: Vec::new(),
        artists: Vec::new(),
        publishers: Vec::new(),
        categories: Vec::new(),
        mechanics: Vec::new(),
    };
    let mut found_item = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                if e.name().as_ref() == b"item" {
                    in_item = true;
                    found_item = true;
                } else if in_item {
                    match e.name().as_ref() {
                        b"description" => in_description = true,
                        b"image" => in_image = true,
                        b"thumbnail" => in_thumbnail = true,
                        b"playingtime" => {
                            for attr in e.attributes().flatten() {
                                if attr.key.as_ref() == b"value" {
                                    if let Ok(v) = String::from_utf8_lossy(attr.value.as_ref()).parse::<f64>() {
                                        detail.playingtime = Some(v);
                                    }
                                }
                            }
                        }
                        b"yearpublished" => {
                            for attr in e.attributes().flatten() {
                                if attr.key.as_ref() == b"value" {
                                    let v = String::from_utf8_lossy(attr.value.as_ref()).to_string();
                                    if v != "0" {
                                        detail.year = Some(v);
                                    }
                                }
                            }
                        }
                        b"name" => {
                            for attr in e.attributes().flatten() {
                                if attr.key.as_ref() == b"type" && attr.value.as_ref() == b"primary" {
                                    // primary name — will be captured via value attr below
                                }
                                if attr.key.as_ref() == b"value" && detail.title.is_empty() {
                                    // Take the first name we encounter with type=primary.
                                    // We check type via a second pass on attributes.
                                }
                            }
                            // Re-iterate to find type=primary and its value
                            let mut is_primary = false;
                            let mut val = None;
                            for attr in e.attributes().flatten() {
                                match attr.key.as_ref() {
                                    b"type" if attr.value.as_ref() == b"primary" => is_primary = true,
                                    b"value" => val = Some(String::from_utf8_lossy(attr.value.as_ref()).to_string()),
                                    _ => {}
                                }
                            }
                            if is_primary {
                                if let Some(v) = val {
                                    detail.title = v;
                                }
                            }
                        }
                        b"link" => {
                            let mut link_type: Option<String> = None;
                            let mut link_value: Option<String> = None;
                            for attr in e.attributes().flatten() {
                                match attr.key.as_ref() {
                                    b"type" => link_type = Some(String::from_utf8_lossy(attr.value.as_ref()).to_string()),
                                    b"value" => link_value = Some(String::from_utf8_lossy(attr.value.as_ref()).to_string()),
                                    _ => {}
                                }
                            }
                            if let (Some(t), Some(v)) = (link_type, link_value) {
                                if v.is_empty() {
                                    continue;
                                }
                                match t.as_str() {
                                    "boardgamedesigner" => detail.designers.push(v),
                                    "boardgameartist" => detail.artists.push(v),
                                    "boardgamepublisher" => detail.publishers.push(v),
                                    "boardgamecategory" => detail.categories.push(v),
                                    "boardgamemechanic" => detail.mechanics.push(v),
                                    _ => {}
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
            Ok(Event::Empty(e)) => {
                // Self-closing tags (name, yearpublished, playingtime, link can be empty)
                if in_item {
                    match e.name().as_ref() {
                        b"yearpublished" => {
                            for attr in e.attributes().flatten() {
                                if attr.key.as_ref() == b"value" {
                                    let v = String::from_utf8_lossy(attr.value.as_ref()).to_string();
                                    if v != "0" {
                                        detail.year = Some(v);
                                    }
                                }
                            }
                        }
                        b"playingtime" => {
                            for attr in e.attributes().flatten() {
                                if attr.key.as_ref() == b"value" {
                                    if let Ok(v) = String::from_utf8_lossy(attr.value.as_ref()).parse::<f64>() {
                                        detail.playingtime = Some(v);
                                    }
                                }
                            }
                        }
                        b"name" => {
                            let mut is_primary = false;
                            let mut val = None;
                            for attr in e.attributes().flatten() {
                                match attr.key.as_ref() {
                                    b"type" if attr.value.as_ref() == b"primary" => is_primary = true,
                                    b"value" => val = Some(String::from_utf8_lossy(attr.value.as_ref()).to_string()),
                                    _ => {}
                                }
                            }
                            if is_primary {
                                if let Some(v) = val {
                                    detail.title = v;
                                }
                            }
                        }
                        b"link" => {
                            let mut link_type: Option<String> = None;
                            let mut link_value: Option<String> = None;
                            for attr in e.attributes().flatten() {
                                match attr.key.as_ref() {
                                    b"type" => link_type = Some(String::from_utf8_lossy(attr.value.as_ref()).to_string()),
                                    b"value" => link_value = Some(String::from_utf8_lossy(attr.value.as_ref()).to_string()),
                                    _ => {}
                                }
                            }
                            if let (Some(t), Some(v)) = (link_type, link_value) {
                                if v.is_empty() {
                                    continue;
                                }
                                match t.as_str() {
                                    "boardgamedesigner" => detail.designers.push(v),
                                    "boardgameartist" => detail.artists.push(v),
                                    "boardgamepublisher" => detail.publishers.push(v),
                                    "boardgamecategory" => detail.categories.push(v),
                                    "boardgamemechanic" => detail.mechanics.push(v),
                                    _ => {}
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
            Ok(Event::Text(e)) => {
                let text = String::from_utf8_lossy(e.as_ref()).to_string();
                if in_description {
                    detail.description = Some(text);
                } else if in_image {
                    detail.image = Some(text);
                } else if in_thumbnail {
                    detail.thumbnail = Some(text);
                }
            }
            Ok(Event::End(e)) => {
                match e.name().as_ref() {
                    b"description" => in_description = false,
                    b"image" => in_image = false,
                    b"thumbnail" => in_thumbnail = false,
                    b"item" => in_item = false,
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    if found_item {
        Some(detail)
    } else {
        None
    }
}

fn strip_html_tags(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut in_tag = false;
    for ch in s.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(ch),
            _ => {}
        }
    }
    // Decode common HTML entities
    result
        .replace("&#10;", "\n")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .trim()
        .to_string()
}

pub async fn search(
    query: &str,
    api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<Vec<ApiSearchResult>, String> {
    let token = api_key.ok_or("BoardGameGeek API token required")?;
    rate_limiter.acquire("bgg").await;
    let client = build_client();
    let resp = retry(3, || {
        let client = &client;
        async move {
            client
                .get(format!("{}/search", BASE_URL))
                .query(&[("query", query), ("type", "boardgame")])
                .header("Authorization", format!("Bearer {}", token))
                .send()
                .await
        }
    })
    .await?;
    if !resp.status().is_success() {
        return Err(format!("BGG search failed: {}", resp.status()));
    }
    let xml = resp.text().await.map_err(|e| e.to_string())?;
    let entries = parse_search_xml(&xml);

    // BGG search doesn't return thumbnails. Fetch them via a batched /thing call.
    let mut thumb_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    if !entries.is_empty() {
        let ids_param = entries
            .iter()
            .take(MAX_RESULTS)
            .map(|e| e.id.as_str())
            .collect::<Vec<_>>()
            .join(",");
        rate_limiter.acquire("bgg").await;
        let tresp = retry(3, || {
            let client = &client;
            let ids = ids_param.clone();
            async move {
                client
                    .get(format!("{}/thing", BASE_URL))
                    .query(&[("id", ids.as_str()), ("type", "boardgame")])
                    .header("Authorization", format!("Bearer {}", token))
                    .send()
                    .await
            }
        })
        .await;
        if let Ok(tresp) = tresp {
            if tresp.status().is_success() {
                if let Ok(txml) = tresp.text().await {
                    thumb_map = parse_thing_thumbnails_xml(&txml);
                }
            }
        }
    }

    let taken: Vec<SearchEntry> = entries.into_iter().take(MAX_RESULTS).collect();
    let thumb_urls: Vec<Option<String>> = taken
        .iter()
        .map(|e| thumb_map.get(&e.id).cloned())
        .collect();

    let thumbnails = join_all(thumb_urls.iter().map(|thumb_url| async move {
        match thumb_url {
            Some(u) => fetch_image_as_b64(u).await,
            None => None,
        }
    }))
    .await;

    let out = taken
        .into_iter()
        .zip(thumbnails)
        .map(|(entry, thumbnail_b64)| ApiSearchResult {
            provider: "bgg".to_string(),
            provider_id: entry.id,
            title: entry.name,
            year: entry.year,
            creator: None,
            thumbnail_b64,
        })
        .collect();

    Ok(out)
}

pub async fn get_detail(
    id: &str,
    api_key: Option<&str>,
    rate_limiter: &RateLimiter,
) -> Result<ApiMediaDetail, String> {
    let token = api_key.ok_or("BoardGameGeek API token required")?;
    rate_limiter.acquire("bgg").await;
    let client = build_client();
    let resp = retry(3, || {
        let client = &client;
        async move {
            client
                .get(format!("{}/thing", BASE_URL))
                .query(&[("id", id), ("stats", "1")])
                .header("Authorization", format!("Bearer {}", token))
                .send()
                .await
        }
    })
    .await?;
    if !resp.status().is_success() {
        return Err(format!("BGG detail failed: {}", resp.status()));
    }
    let xml = resp.text().await.map_err(|e| e.to_string())?;
    let d = parse_thing_detail_xml(&xml)
        .ok_or_else(|| "BGG: thing not found".to_string())?;

    let title = d.title;
    let release_date = d.year;
    let creator = d.designers.first().cloned();
    let synopsis = d.description.map(|s| strip_html_tags(&s));
    let duration = d.playingtime;

    let mut genres: Vec<String> = d.categories;
    genres.extend(d.mechanics);

    // Credits: designers, artists, publishers (max 10 total)
    let mut credits: Vec<ApiCredit> = Vec::new();
    for name in d.designers {
        if credits.len() >= MAX_CREDITS {
            break;
        }
        credits.push(ApiCredit {
            name,
            role: Some("Designer".to_string()),
            photo_url: None,
        });
    }
    for name in d.artists {
        if credits.len() >= MAX_CREDITS {
            break;
        }
        credits.push(ApiCredit {
            name,
            role: Some("Artist".to_string()),
            photo_url: None,
        });
    }
    for name in d.publishers {
        if credits.len() >= MAX_CREDITS {
            break;
        }
        credits.push(ApiCredit {
            name,
            role: Some("Publisher".to_string()),
            photo_url: None,
        });
    }

    // Images: image (large) + thumbnail (small), deduped (max 8)
    let mut images: Vec<ApiImage> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    if let Some(url) = d.image {
        if !url.is_empty() && !seen.contains(&url) {
            seen.insert(url.clone());
            images.push(ApiImage {
                url,
                thumbnail_b64: None,
                kind: None,
            });
        }
    }
    if images.len() < MAX_IMAGES {
        if let Some(url) = d.thumbnail {
            if !url.is_empty() && !seen.contains(&url) {
                seen.insert(url.clone());
                images.push(ApiImage {
                    url,
                    thumbnail_b64: None,
                    kind: None,
                });
            }
        }
    }

    Ok(ApiMediaDetail {
        provider: "bgg".to_string(),
        provider_id: id.to_string(),
        title,
        release_date,
        creator,
        media_status: None,
        synopsis,
        duration,
        genres,
        credits,
        images,
    })
}
