use axum::{
    extract::{ConnectInfo, Request},
    middleware::Next,
    response::Response,
};
use std::net::SocketAddr;
use std::time::Instant;

/// Health checks run every few seconds; logging them would bury everything else
const QUIET_PATHS: &[&str] = &["/health"];

/// The client's address, worked out the same way as for rate limits (see `client_ip`)
fn client_ip(request: &Request) -> String {
    request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(addr)| {
            super::client_ip::client(addr.ip(), request.headers())
                .ip
                .to_string()
        })
        .unwrap_or_else(|| "-".to_string())
}

/// One line per request: method, path, status, duration, client.
/// Only the path is logged, never the query string: it can carry API keys and signed tokens.
pub async fn access_log(request: Request, next: Next) -> Response {
    let method = request.method().clone();
    let path = request.uri().path().to_string();
    let ip = client_ip(&request);
    let started = Instant::now();

    let response = next.run(request).await;

    if QUIET_PATHS.contains(&path.as_str()) {
        return response;
    }

    let status = response.status().as_u16();
    let ms = started.elapsed().as_millis();
    if status >= 500 {
        tracing::error!(target: "access", "{method} {path} {status} {ms}ms ip={ip}");
    } else {
        tracing::info!(target: "access", "{method} {path} {status} {ms}ms ip={ip}");
    }
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;

    fn request_from(peer: &str, headers: &[(&str, &str)]) -> Request {
        let mut builder = Request::builder().uri("/x");
        for (name, value) in headers {
            builder = builder.header(*name, *value);
        }
        let mut request = builder.body(Body::empty()).unwrap();
        let addr: SocketAddr = format!("{peer}:5000").parse().unwrap();
        request.extensions_mut().insert(ConnectInfo(addr));
        request
    }

    #[test]
    fn behind_traefik_logs_the_forwarded_client() {
        let req = request_from("172.18.0.2", &[("x-forwarded-for", "203.0.113.5")]);
        assert_eq!(client_ip(&req), "203.0.113.5");
    }

    #[test]
    fn a_public_peer_cannot_claim_another_address() {
        let req = request_from("198.51.100.7", &[("x-forwarded-for", "203.0.113.5")]);
        assert_eq!(client_ip(&req), "198.51.100.7");
    }

    #[test]
    fn no_connection_info_logs_a_dash() {
        let req = Request::builder().uri("/x").body(Body::empty()).unwrap();
        assert_eq!(client_ip(&req), "-");
    }
}
