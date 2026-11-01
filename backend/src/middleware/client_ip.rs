use axum::http::HeaderMap;
use std::net::IpAddr;

/// Who sent a request, for rate limits and the access log.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Client {
    pub ip: IpAddr,
    /// A direct call from a service on the private network (another container on the
    /// `proxy` network, using the internal URL), not a request relayed by Traefik.
    pub internal: bool,
}

/// Addresses a proxy may legitimately sit at: loopback, private and link-local ranges.
/// Only requests from these may tell us the client's address in a header; anyone else
/// is the client.
pub fn is_trusted_proxy(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => v4.is_loopback() || v4.is_private() || v4.is_link_local(),
        IpAddr::V6(v6) => {
            if let Some(v4) = v6.to_ipv4_mapped() {
                return is_trusted_proxy(IpAddr::V4(v4));
            }
            let first = v6.segments()[0];
            v6.is_loopback()
                || (first & 0xfe00) == 0xfc00 // unique local, fc00::/7
                || (first & 0xffc0) == 0xfe80 // link-local, fe80::/10
        }
    }
}

/// The client behind a request that arrived from `peer`.
///
/// A peer outside the trusted ranges is the client, whatever headers it sends: that is
/// what makes the headers unspoofable. From a trusted proxy, the right-most
/// `X-Forwarded-For` entry that is not itself a proxy is the client, since Traefik appends
/// the address it saw and anything to its left came from the client. A trusted peer that
/// forwards nothing is a service calling directly.
pub fn client(peer: IpAddr, headers: &HeaderMap) -> Client {
    if !is_trusted_proxy(peer) {
        return Client {
            ip: peer,
            internal: false,
        };
    }

    let forwarded: Vec<IpAddr> = headers
        .get_all("x-forwarded-for")
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(','))
        .filter_map(|v| v.trim().parse().ok())
        .collect();
    if let Some(ip) = forwarded.iter().rev().find(|ip| !is_trusted_proxy(**ip)) {
        return Client {
            ip: *ip,
            internal: false,
        };
    }
    if let Some(ip) = forwarded.last() {
        return Client {
            ip: *ip,
            internal: false,
        };
    }

    let real_ip = headers
        .get("x-real-ip")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.trim().parse().ok());
    match real_ip {
        Some(ip) => Client {
            ip,
            internal: false,
        },
        None => Client {
            ip: peer,
            internal: true,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers(pairs: &[(&str, &str)]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for (name, value) in pairs {
            map.append(
                axum::http::HeaderName::from_bytes(name.as_bytes()).unwrap(),
                value.parse().unwrap(),
            );
        }
        map
    }

    fn ip(s: &str) -> IpAddr {
        s.parse().unwrap()
    }

    #[test]
    fn a_public_peer_is_the_client_whatever_it_claims() {
        let c = client(
            ip("203.0.113.9"),
            &headers(&[("x-forwarded-for", "1.2.3.4")]),
        );
        assert_eq!(
            c,
            Client {
                ip: ip("203.0.113.9"),
                internal: false
            }
        );
    }

    #[test]
    fn behind_traefik_the_rightmost_public_entry_wins() {
        // The client sent a fake first entry; Traefik appended the real address.
        let c = client(
            ip("172.18.0.5"),
            &headers(&[("x-forwarded-for", "6.6.6.6, 198.51.100.7")]),
        );
        assert_eq!(
            c,
            Client {
                ip: ip("198.51.100.7"),
                internal: false
            }
        );
    }

    #[test]
    fn proxy_hops_on_the_right_are_skipped() {
        let c = client(
            ip("10.0.0.2"),
            &headers(&[("x-forwarded-for", "198.51.100.7, 10.0.0.3")]),
        );
        assert_eq!(c.ip, ip("198.51.100.7"));
    }

    #[test]
    fn x_real_ip_is_used_when_there_is_no_forwarded_for() {
        let c = client(ip("172.18.0.5"), &headers(&[("x-real-ip", "198.51.100.8")]));
        assert_eq!(
            c,
            Client {
                ip: ip("198.51.100.8"),
                internal: false
            }
        );
    }

    #[test]
    fn a_container_calling_directly_is_internal() {
        let c = client(ip("172.18.0.7"), &headers(&[]));
        assert_eq!(
            c,
            Client {
                ip: ip("172.18.0.7"),
                internal: true
            }
        );
    }

    #[test]
    fn trusted_ranges() {
        for t in [
            "127.0.0.1",
            "10.1.2.3",
            "172.16.0.1",
            "192.168.1.1",
            "169.254.1.1",
            "::1",
            "fd00::1",
            "fe80::1",
            "::ffff:10.0.0.1",
        ] {
            assert!(is_trusted_proxy(ip(t)), "{t} should be trusted");
        }
        for u in ["8.8.8.8", "172.32.0.1", "2001:db8::1", "::ffff:8.8.8.8"] {
            assert!(!is_trusted_proxy(ip(u)), "{u} should not be trusted");
        }
    }
}
