use axum::{
    extract::{ConnectInfo, Request},
    middleware::Next,
    response::Response,
};
use std::net::SocketAddr;
use std::time::Instant;

/// Health checks run every few seconds; logging them would bury everything else
const QUIET_PATHS: &[&str] = &["/health"];

/// The client's address as Traefik reports it, falling back to the direct peer
fn client_ip(request: &Request) -> String {
    let headers = request.headers();
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .map(|v| v.trim().to_string())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|v| v.to_str().ok())
                .map(|v| v.trim().to_string())
        })
        .or_else(|| {
            request
                .extensions()
                .get::<ConnectInfo<SocketAddr>>()
                .map(|ConnectInfo(addr)| addr.ip().to_string())
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

    fn request_with(headers: &[(&str, &str)]) -> Request {
        let mut builder = Request::builder().uri("/x");
        for (name, value) in headers {
            builder = builder.header(*name, *value);
        }
        builder.body(Body::empty()).unwrap()
    }

    #[test]
    fn prefers_first_forwarded_address() {
        let req = request_with(&[
            ("x-forwarded-for", "203.0.113.5, 10.0.0.2"),
            ("x-real-ip", "10.0.0.9"),
        ]);
        assert_eq!(client_ip(&req), "203.0.113.5");
    }

    #[test]
    fn falls_back_to_real_ip_then_dash() {
        assert_eq!(
            client_ip(&request_with(&[("x-real-ip", "198.51.100.7")])),
            "198.51.100.7"
        );
        assert_eq!(client_ip(&request_with(&[])), "-");
    }
}
