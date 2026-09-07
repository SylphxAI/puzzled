//! Edition proto3 -> 2024 cutover proof: binaries produced under the old
//! (proto3) schema decode identically under the new (Edition 2024) schema,
//! re-encode byte-identically, and project the same ProtoJSON.
//!
//! The update-request golden pins migrated-optional presence: set fields stay
//! present, unset optionals stay absent across the cutover.

use buffa::message::Message;
use puzzled_server::proto::puzzled::v1::{Announcement, UpdateAnnouncementRequest};
use std::path::PathBuf;

fn fixture(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/edition2024")
        .join(name)
}

#[test]
fn announcement_cross_reads_proto3_golden() -> Result<(), Box<dyn std::error::Error>> {
    let golden = std::fs::read(fixture("announcement.2023.binpb"))?;
    let msg = Announcement::decode_from_slice(&golden)?;
    assert_eq!(msg.id, "a-1");
    assert_eq!(msg.try_encode_to_vec()?, golden);
    let expected: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(fixture("announcement.json"))?)?;
    assert_eq!(serde_json::to_value(&msg)?, expected);
    Ok(())
}

#[test]
fn update_request_optional_presence_pins() -> Result<(), Box<dyn std::error::Error>> {
    let golden = std::fs::read(fixture("update-announcement-request.2023.binpb"))?;
    let msg = UpdateAnnouncementRequest::decode_from_slice(&golden)?;
    assert_eq!(msg.id, "a-1");
    assert_eq!(msg.title, Some("T2".to_string()));
    assert_eq!(msg.body, None);
    assert_eq!(msg.try_encode_to_vec()?, golden);
    let expected: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(fixture(
        "update-announcement-request.json",
    ))?)?;
    assert_eq!(serde_json::to_value(&msg)?, expected);
    Ok(())
}
