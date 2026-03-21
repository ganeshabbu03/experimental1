use portable_pty::{CommandBuilder, native_pty_system, PtySize, PtySystem};
use std::sync::mpsc::channel;
use std::thread;
use std::io::Read;
use anyhow::Result;

fn main() -> Result<()> {
    println!("Starting Rust PTY Backend...");

    // 1. Establish PTY Native System
    let pty_system = native_pty_system();

    // 2. Configure Dimensions
    let pair = pty_system.openpty(PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    })?;

    // 3. Configure Command (PowerShell)
    let mut cmd = CommandBuilder::new("pwsh");
    cmd.arg("-NoProfile");
    cmd.env("TERM", "xterm-256color");

    // 4. Spawn in a separate thread/process
    let mut child = pair.slave.spawn_command(cmd)?;
    println!("PowerShell spawned successfully.");

    // 5. Pipe output to our IPC handler (stdout for now)
    let mut reader = pair.master.try_clone_reader()?;
    
    thread::spawn(move || {
        let mut buf = [0u8; 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(n) if n > 0 => {
                    // In a real app, send to WebSocket/IPC
                    // For now, print to stdout as hex debug
                    println!("Received bytes: {:?}", &buf[..n]);
                },
                _ => break,
            }
        }
    });

    // Keep main thread alive
    child.wait()?;
    Ok(())
}
