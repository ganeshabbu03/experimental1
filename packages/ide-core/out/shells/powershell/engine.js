"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PowerShellEngine = void 0;
const pty = __importStar(require("node-pty"));
const os = __importStar(require("os"));
const events_1 = require("events");
/**
 * Manages a PowerShell PTY session.
 */
class PowerShellEngine extends events_1.EventEmitter {
    constructor(shellPath = 'pwsh.exe', cwd = os.homedir()) {
        super();
        this.shellPath = shellPath;
        this.cwd = cwd;
        this.ptyProcess = null;
    }
    /**
     * Spawns the PowerShell process with proper encoding and environment.
     */
    start() {
        const shellArgs = [
            '-NoLogo',
            '-NoProfile',
            '-ExecutionPolicy', 'RemoteSigned',
            '-Command', '-' // Run in stdin mode
        ];
        // Windows ConPTY interaction requires specific environment setup
        const env = {
            ...process.env,
            StartingDir: this.cwd,
            TERM: 'xterm-256color',
            LANG: 'en_US.UTF-8'
        };
        try {
            this.ptyProcess = pty.spawn(this.shellPath, shellArgs, {
                name: 'xterm-color',
                cols: 80,
                rows: 30,
                cwd: this.cwd,
                env: env,
                useConpty: os.platform() === 'win32'
            });
            this.ptyProcess.onData((data) => {
                this.emit('data', data);
            });
            this.ptyProcess.onExit((res) => {
                this.emit('exit', res.exitCode);
            });
            console.log(`PowerShell started with PID: ${this.ptyProcess.pid}`);
        }
        catch (error) {
            console.error('Failed to start PowerShell:', error);
            this.emit('error', error);
        }
    }
    resize(cols, rows) {
        this.ptyProcess?.resize(cols, rows);
    }
    write(data) {
        this.ptyProcess?.write(data);
    }
    kill() {
        this.ptyProcess?.kill();
    }
}
exports.PowerShellEngine = PowerShellEngine;
//# sourceMappingURL=engine.js.map