/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const srcPath = path.join(projectRoot, 'src', 'extensions', 'extension-host-process.ts');
const outDir = path.join(projectRoot, 'dist', 'extensions');
const outFile = path.join(outDir, 'extension-host-process.js');
const outMap = `${outFile}.map`;

if (!fs.existsSync(srcPath)) {
    console.error(`[build:extension-host] Missing source file: ${srcPath}`);
    process.exit(1);
}

const source = fs.readFileSync(srcPath, 'utf8');
const transpiled = ts.transpileModule(source, {
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2017,
        sourceMap: true,
        inlineSources: true,
        esModuleInterop: true,
    },
    fileName: path.basename(srcPath),
    reportDiagnostics: true,
});

if (transpiled.diagnostics && transpiled.diagnostics.length > 0) {
    const formatted = ts.formatDiagnosticsWithColorAndContext(transpiled.diagnostics, {
        getCanonicalFileName: (f) => f,
        getCurrentDirectory: () => projectRoot,
        getNewLine: () => '\n',
    });
    console.warn(`[build:extension-host] Diagnostics:\n${formatted}`);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, `${transpiled.outputText}\n//# sourceMappingURL=extension-host-process.js.map\n`, 'utf8');
fs.writeFileSync(outMap, transpiled.sourceMapText || '', 'utf8');

console.log(`[build:extension-host] Wrote ${path.relative(projectRoot, outFile)}`);
