import subprocess
import time
import sys

def run_backend():
    return subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"], cwd="apps/backend/backend")

def run_frontend():
    return subprocess.Popen(["npm.cmd", "run", "dev"], cwd="apps/frontend")   
def run_terminal():
    return subprocess.Popen(["npm.cmd", "run", "start:dev"], cwd="apps/backend-node")

if __name__ == "__main__":
    backend = run_backend()
    terminal = run_terminal()
    frontend = run_frontend()
    try:
        backend.wait()
        terminal.wait()
        frontend.wait()
    except KeyboardInterrupt:
        backend.terminate()
        terminal.terminate()
        frontend.terminate()