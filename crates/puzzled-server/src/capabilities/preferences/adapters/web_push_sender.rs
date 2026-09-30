//! Delivery boundary: daily targeting and subscription lifecycle do not depend
//! on the transport. A future Notify implementation replaces the direct sender
//! here without changing the reminder job.
use std::future::Future;
use web_push::{ContentEncoding, SubscriptionInfo, VapidSignatureBuilder, WebPushMessageBuilder};

#[derive(Debug, PartialEq, Eq)]
pub enum PushDelivery {
    Delivered,
    Expired,
}

pub trait PushSender: Sync {
    fn send<'a>(
        &'a self,
        subscription: &'a SubscriptionInfo,
        payload: &'a str,
    ) -> impl Future<Output = Result<PushDelivery, String>> + Send + 'a;
}

/// The platform does not yet have Web Push. Keep its current implementation
/// behind this adapter so Notify can take over when that capability exists.
pub struct DirectVapidSender {
    client: reqwest::Client,
    private_key: String,
    subject: String,
}

impl DirectVapidSender {
    pub fn from_env() -> Result<Self, String> {
        let private_key = std::env::var("VAPID_PRIVATE_KEY")
            .map_err(|_| "VAPID_PRIVATE_KEY unconfigured".to_string())?;
        let subject =
            std::env::var("VAPID_SUBJECT").map_err(|_| "VAPID_SUBJECT unconfigured".to_string())?;
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|_| "push client failed".to_string())?;
        Ok(Self {
            client,
            private_key,
            subject,
        })
    }
}

impl PushSender for DirectVapidSender {
    async fn send<'a>(
        &'a self,
        subscription: &'a SubscriptionInfo,
        payload: &'a str,
    ) -> Result<PushDelivery, String> {
        // Enforce the endpoint policy at the transport boundary too: another
        // caller cannot accidentally turn this adapter into an arbitrary fetch.
        if !super::web_push::valid_endpoint(&subscription.endpoint) {
            return Err("invalid push endpoint".to_string());
        }
        let mut signature = VapidSignatureBuilder::from_base64(&self.private_key, subscription)
            .map_err(|_| "invalid VAPID key".to_string())?;
        signature.add_claim("sub", self.subject.clone());
        let signature = signature
            .build()
            .map_err(|_| "VAPID signing failed".to_string())?;
        let mut builder = WebPushMessageBuilder::new(subscription);
        builder.set_vapid_signature(signature);
        builder.set_payload(ContentEncoding::Aes128Gcm, payload.as_bytes());
        builder.set_ttl(3600);
        let message = builder
            .build()
            .map_err(|_| "push encryption failed".to_string())?;
        let encrypted = message.payload.ok_or("push payload missing")?;
        let mut request = self
            .client
            .post(&subscription.endpoint)
            .header("TTL", "3600")
            .header("Content-Type", "application/octet-stream")
            .header("Content-Encoding", "aes128gcm");
        for (name, value) in encrypted.crypto_headers {
            request = request.header(name, value);
        }
        match request.body(encrypted.content).send().await {
            Ok(response) if response.status().is_success() => Ok(PushDelivery::Delivered),
            Ok(response) if matches!(response.status().as_u16(), 404 | 410) => {
                Ok(PushDelivery::Expired)
            }
            _ => Err("web push delivery failed".to_string()),
        }
    }
}
