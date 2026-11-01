use axum::{
    Json,
    extract::{ConnectInfo, Request, State},
    http::{HeaderValue, StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
};
use governor::{
    Quota, RateLimiter,
    clock::{Clock, DefaultClock},
    state::keyed::DefaultKeyedStateStore,
};
use serde_json::json;
use std::net::{IpAddr, SocketAddr};
use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Duration;

use super::client_ip::client;

type KeyedLimiter = RateLimiter<IpAddr, DefaultKeyedStateStore<IpAddr>, DefaultClock>;

/// A per-client-IP rate limit (see `client_ip` for how the client is identified).
pub struct RateLimit {
    limiter: KeyedLimiter,
    /// Let services on the private network through unlimited. Every request from a
    /// server-side integration (e.g. Pinpoint's backend storing its users' files) comes
    /// from one address, so a per-IP budget would be shared by all of that app's users.
    exempt_internal: bool,
}

impl RateLimit {
    /// `burst` requests at once, then one more every `period`.
    pub fn new(period: Duration, burst: u32, exempt_internal: bool) -> Arc<Self> {
        let quota = Quota::with_period(period)
            .expect("rate limit period must be non-zero")
            .allow_burst(NonZeroU32::new(burst).expect("burst must be non-zero"));
        Arc::new(Self {
            limiter: RateLimiter::keyed(quota),
            exempt_internal,
        })
    }

    /// Forget clients that are back to a full budget, so the table does not grow forever.
    pub fn prune(&self) {
        self.limiter.retain_recent();
        self.limiter.shrink_to_fit();
    }

    /// Ok, or how long the client must wait.
    pub fn check(&self, ip: IpAddr, internal: bool) -> Result<(), Duration> {
        if internal && self.exempt_internal {
            return Ok(());
        }
        self.limiter
            .check_key(&ip)
            .map_err(|not_until| not_until.wait_time_from(DefaultClock::default().now()))
    }
}

/// 429 with `Retry-After` when the client is over its budget.
pub async fn rate_limit(
    State(limit): State<Arc<RateLimit>>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    request: Request,
    next: Next,
) -> Response {
    let who = client(peer.ip(), request.headers());
    match limit.check(who.ip, who.internal) {
        Ok(()) => next.run(request).await,
        Err(wait) => {
            let seconds = wait.as_secs() + u64::from(wait.subsec_nanos() > 0);
            let mut response = (
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({ "error": "Too many requests" })),
            )
                .into_response();
            response.headers_mut().insert(
                header::RETRY_AFTER,
                HeaderValue::from_str(&seconds.max(1).to_string()).unwrap(),
            );
            response
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ip(s: &str) -> IpAddr {
        s.parse().unwrap()
    }

    #[test]
    fn the_burst_is_allowed_then_the_client_waits() {
        let limit = RateLimit::new(Duration::from_secs(60), 3, false);
        for _ in 0..3 {
            assert!(limit.check(ip("198.51.100.1"), false).is_ok());
        }
        let wait = limit.check(ip("198.51.100.1"), false).unwrap_err();
        assert!(wait > Duration::from_secs(50));
        // Another client has its own budget.
        assert!(limit.check(ip("198.51.100.2"), false).is_ok());
    }

    #[test]
    fn internal_services_are_exempt_only_where_configured() {
        let uploads = RateLimit::new(Duration::from_secs(60), 1, true);
        for _ in 0..100 {
            assert!(uploads.check(ip("172.18.0.7"), true).is_ok());
        }
        let auth = RateLimit::new(Duration::from_secs(60), 1, false);
        assert!(auth.check(ip("172.18.0.7"), true).is_ok());
        assert!(auth.check(ip("172.18.0.7"), true).is_err());
    }

    #[test]
    fn requests_relayed_by_traefik_are_still_limited() {
        let uploads = RateLimit::new(Duration::from_secs(60), 1, true);
        assert!(uploads.check(ip("198.51.100.1"), false).is_ok());
        assert!(uploads.check(ip("198.51.100.1"), false).is_err());
    }
}
