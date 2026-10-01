//! A configured but unreachable database must stop the process (non-zero exit)
//! instead of serving a non-durable stub for the life of the pod.

use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

#[test]
fn unreachable_database_url_exits_non_zero() {
    let mut child = Command::new(env!("CARGO_BIN_EXE_puzzled-server"))
        .env("PUZZLED_HTTP_PORT", "0")
        .env("PORT", "0")
        .env("RUST_LOG", "error")
        .env("DATABASE_URL", "postgres://u:p@127.0.0.1:1/db")
        .env_remove("POSTGRES_URL")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .expect("spawn server");
    let deadline = Instant::now() + Duration::from_secs(40);
    loop {
        if let Some(status) = child.try_wait().expect("try_wait") {
            assert!(!status.success(), "server must exit non-zero, got {status}");
            return;
        }
        if Instant::now() > deadline {
            let _ = child.kill();
            let _ = child.wait();
            panic!("server kept running with an unreachable DATABASE_URL");
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}
