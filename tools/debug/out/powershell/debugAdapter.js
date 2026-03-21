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
exports.PowerShellDebugAdapterFactory = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Factory to create the Debug Adapter for PowerShell.
 * Hooks into PowerShell Editor Services (PSES).
 */
class PowerShellDebugAdapterFactory {
    constructor(psesPath) {
        this.psesPath = psesPath;
    }
    createDebugAdapterDescriptor(session, executable) {
        // Launch PSES in "Debug Server" mode
        // This talks DAP over stdin/stdout
        const command = 'pwsh';
        const args = [
            '-NoProfile',
            '-File', this.psesPath,
            '-BundledModulesPath', './modules',
            '-LogPath', './logs/pses.log',
            '-SessionDetailsPath', './logs/session.json',
            '-FeatureFlags', 'PSReadLine'
        ];
        console.log(`Launching Debug Adapter: ${command} ${args.join(' ')}`);
        return new vscode.DebugAdapterExecutable(command, args);
    }
}
exports.PowerShellDebugAdapterFactory = PowerShellDebugAdapterFactory;
//# sourceMappingURL=debugAdapter.js.map