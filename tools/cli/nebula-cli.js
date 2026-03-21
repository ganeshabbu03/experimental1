#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TOKEN = process.env.AUTH_TOKEN;

// ─── Helpers ─────────────────────────────────────────────────────────

function headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', 'x-user-id': 'test-user-id' };
    if (TOKEN) h['Authorization'] = `Bearer ${TOKEN}`;
    return { ...h, ...extra };
}

async function apiGet(endpoint, timeout = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            headers: headers(),
            signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
    } finally {
        clearTimeout(timer);
    }
}

async function apiDelete(endpoint) {
    const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'DELETE',
        headers: headers(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
}

function printTable(rows, columns) {
    if (rows.length === 0) {
        console.log('  (none)');
        return;
    }
    const widths = columns.map(c => Math.max(c.label.length, ...rows.map(r => String(r[c.key] ?? '').length)));
    const header = columns.map((c, i) => c.label.padEnd(widths[i])).join('  ');
    const sep = columns.map((_, i) => '─'.repeat(widths[i])).join('──');
    console.log(`  ${header}`);
    console.log(`  ${sep}`);
    for (const row of rows) {
        const line = columns.map((c, i) => String(row[c.key] ?? '').padEnd(widths[i])).join('  ');
        console.log(`  ${line}`);
    }
}

// ─── Repository Commands ─────────────────────────────────────────────

async function listRepos() {
    try {
        const repos = await apiGet('/github/repos');
        console.table(repos.map(r => ({ id: r.id, name: r.full_name, private: r.private })));
    } catch (e) {
        console.error('Failed to list repos:', e.message);
    }
}

async function importRepo(repoId, cloneUrl, name) {
    try {
        const res = await fetch(`${API_URL}/workspaces/import`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ repoId, cloneUrl, repoName: name }),
        });
        const result = await res.json();
        console.log('Import started:', result);
    } catch (e) {
        console.error('Failed to import:', e.message);
    }
}

// ─── Extension Commands ──────────────────────────────────────────────

async function extList(showVersions) {
    try {
        const res = await apiGet('/plugins/installed');
        const extensions = res.extensions || [];

        if (extensions.length === 0) {
            console.log('\n  No extensions installed.\n');
            return;
        }

        console.log(`\n  Installed Extensions (${extensions.length}):\n`);

        const columns = [
            { key: 'id', label: 'IDENTIFIER' },
            { key: 'name', label: 'NAME' },
        ];
        if (showVersions) {
            columns.push({ key: 'version', label: 'VERSION' });
        }
        columns.push(
            { key: 'publisher', label: 'PUBLISHER' },
            { key: 'source', label: 'SOURCE' },
        );

        const rows = extensions.map(e => ({
            id: `${e.publisher || e.namespace}.${e.name}`,
            name: e.displayName || e.name,
            version: e.version || '-',
            publisher: e.publisher || e.namespace || 'unknown',
            source: e.source || 'local',
        }));

        printTable(rows, columns);
        console.log();
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

async function extInstall(identifier) {
    // identifier: publisher.name or publisher.name@version
    const atIdx = identifier.indexOf('@');
    let pubName, version;
    if (atIdx > -1) {
        pubName = identifier.substring(0, atIdx);
        version = identifier.substring(atIdx + 1);
    } else {
        pubName = identifier;
    }

    const dotIdx = pubName.indexOf('.');
    if (dotIdx === -1) {
        console.error('Error: Extension identifier must be in format: publisher.name[@version]');
        process.exit(1);
    }

    const publisher = pubName.substring(0, dotIdx);
    const name = pubName.substring(dotIdx + 1);

    console.log(`Installing ${publisher}.${name}${version ? `@${version}` : ' (latest)'}...`);

    try {
        const endpoint = version
            ? `/plugins/download/${encodeURIComponent(publisher)}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`
            : `/plugins/download/${encodeURIComponent(publisher)}/${encodeURIComponent(name)}/latest`;

        await apiGet(endpoint, 60000);
        console.log(`✓ Extension ${publisher}.${name} installed successfully.`);
    } catch (e) {
        console.error(`✗ Failed to install: ${e.message}`);
        process.exit(1);
    }
}

async function extUninstall(identifier) {
    const dotIdx = identifier.indexOf('.');
    if (dotIdx === -1) {
        console.error('Error: Extension identifier must be in format: publisher.name');
        process.exit(1);
    }

    const publisher = identifier.substring(0, dotIdx);
    const name = identifier.substring(dotIdx + 1);

    console.log(`Uninstalling ${publisher}.${name}...`);

    try {
        await apiDelete(`/plugins/uninstall/${encodeURIComponent(publisher)}/${encodeURIComponent(name)}`);
        console.log(`✓ Extension ${publisher}.${name} uninstalled successfully.`);
    } catch (e) {
        console.error(`✗ Failed to uninstall: ${e.message}`);
        process.exit(1);
    }
}

async function extUpdate(identifier) {
    if (!identifier) {
        // Update all installed extensions
        console.log('Updating all installed extensions...');
        try {
            const res = await apiGet('/plugins/installed');
            const extensions = res.extensions || [];
            if (extensions.length === 0) {
                console.log('No extensions installed.');
                return;
            }
            let updated = 0;
            for (const ext of extensions) {
                const pub = ext.publisher || ext.namespace;
                const name = ext.name;
                if (!pub || !name) continue;
                try {
                    const endpoint = `/plugins/download/${encodeURIComponent(pub)}/${encodeURIComponent(name)}/latest`;
                    await apiGet(endpoint, 60000);
                    console.log(`  ✓ Updated ${pub}.${name}`);
                    updated++;
                } catch {
                    console.log(`  - ${pub}.${name} already up to date (or update failed)`);
                }
            }
            console.log(`\nDone. ${updated} extension(s) updated.`);
        } catch (e) {
            console.error('Error:', e.message);
            process.exit(1);
        }
    } else {
        await extInstall(identifier); // Reinstall = update
    }
}

async function extSearch(query) {
    if (!query) {
        console.error('Error: Search query required.');
        process.exit(1);
    }

    console.log(`\n  Searching marketplace for "${query}"...\n`);

    try {
        const res = await apiGet(`/plugins/search?q=${encodeURIComponent(query)}&offset=0&size=20`);
        const extensions = res.extensions || [];

        if (extensions.length === 0) {
            console.log('  No extensions found.\n');
            return;
        }

        const columns = [
            { key: 'id', label: 'IDENTIFIER' },
            { key: 'name', label: 'NAME' },
            { key: 'version', label: 'VERSION' },
            { key: 'downloads', label: 'DOWNLOADS' },
        ];

        const rows = extensions.map(e => ({
            id: `${e.namespace || e.publisher || 'unknown'}.${e.name}`,
            name: e.displayName || e.name,
            version: e.version || '-',
            downloads: e.downloadCount != null ? new Intl.NumberFormat('en-US', { notation: 'compact' }).format(e.downloadCount) : '-',
        }));

        printTable(rows, columns);
        console.log(`\n  ${extensions.length} result(s) found.\n`);
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

async function showStatus() {
    console.log('\n  Deexen IDE Status\n');

    try {
        const res = await apiGet('/plugins/installed');
        const extensions = res.extensions || [];
        console.log(`  Extensions installed:  ${extensions.length}`);
        console.log(`  API endpoint:          ${API_URL}`);
        console.log(`  Platform:              ${process.platform} ${process.arch}`);
        console.log(`  Node.js:               ${process.version}`);
        console.log();

        if (extensions.length > 0) {
            console.log('  Installed extensions:');
            for (const ext of extensions) {
                const pub = ext.publisher || ext.namespace || 'unknown';
                console.log(`    • ${pub}.${ext.name} v${ext.version || '?'}`);
            }
            console.log();
        }
    } catch (e) {
        console.error(`  ✗ Cannot connect to backend at ${API_URL}`);
        console.error(`    ${e.message}\n`);
        process.exit(1);
    }
}

async function listCommands() {
    console.log('\n  Registered Extension Commands\n');

    try {
        const res = await apiGet('/plugins/installed');
        const extensions = res.extensions || [];
        let commandCount = 0;

        for (const ext of extensions) {
            const manifest = ext.manifest || ext;
            const commands = manifest?.contributes?.commands || [];
            if (commands.length === 0) continue;

            const pub = ext.publisher || ext.namespace || 'unknown';
            console.log(`  ${pub}.${ext.name}:`);
            for (const cmd of commands) {
                console.log(`    ${cmd.command}  →  ${cmd.title}`);
                commandCount++;
            }
        }

        if (commandCount === 0) {
            console.log('  No commands registered.');
        } else {
            console.log(`\n  ${commandCount} command(s) total.\n`);
        }
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

// ─── Usage ───────────────────────────────────────────────────────────

function showUsage() {
    console.log(`
  Deexen CLI (nebula-cli)

  USAGE:
    nebula-cli <command> [options]

  REPOSITORY COMMANDS:
    list                            List GitHub repositories
    import <repoId> <url> <name>    Import a repository

  EXTENSION COMMANDS:
    ext list [--show-versions]      List installed extensions
    ext install <pub.name[@ver]>    Install an extension from marketplace
    ext uninstall <pub.name>        Uninstall an extension
    ext update [<pub.name>]         Update one or all extensions
    ext search <query>              Search the marketplace

  DIAGNOSTICS:
    status                          Show IDE status and extension info
    list-commands                   List all registered extension commands

  FLAGS:
    --disable-extensions            Set DEEXEN_DISABLE_EXTENSIONS=1

  ENVIRONMENT:
    API_URL                         Backend URL (default: http://localhost:3000)
    AUTH_TOKEN                      Authentication token
`);
}

// ─── Main ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

// Handle global flags
if (args.includes('--disable-extensions')) {
    process.env.DEEXEN_DISABLE_EXTENSIONS = '1';
    console.log('[CLI] Extensions disabled via --disable-extensions flag.');
    const idx = args.indexOf('--disable-extensions');
    args.splice(idx, 1);
}

const extDirIdx = args.indexOf('--extensions-dir');
if (extDirIdx > -1 && args[extDirIdx + 1]) {
    process.env.DEEXEN_EXTENSIONS_DIR = args[extDirIdx + 1];
    console.log(`[CLI] Extensions directory set to: ${args[extDirIdx + 1]}`);
    args.splice(extDirIdx, 2);
}

const command = args[0];

if (!command || command === '--help' || command === '-h') {
    showUsage();
} else if (command === 'list') {
    listRepos();
} else if (command === 'import') {
    const [, repoId, cloneUrl, name] = args;
    if (!repoId || !cloneUrl || !name) {
        console.log('Usage: nebula-cli import <repoId> <cloneUrl> <name>');
        process.exit(1);
    }
    importRepo(repoId, cloneUrl, name);
} else if (command === 'ext') {
    const subCommand = args[1];
    if (subCommand === 'list') {
        extList(args.includes('--show-versions'));
    } else if (subCommand === 'install') {
        if (!args[2]) {
            console.error('Usage: nebula-cli ext install <publisher.name[@version]>');
            process.exit(1);
        }
        extInstall(args[2]);
    } else if (subCommand === 'uninstall') {
        if (!args[2]) {
            console.error('Usage: nebula-cli ext uninstall <publisher.name>');
            process.exit(1);
        }
        extUninstall(args[2]);
    } else if (subCommand === 'update') {
        extUpdate(args[2]); // optional identifier
    } else if (subCommand === 'search') {
        extSearch(args.slice(2).join(' '));
    } else {
        console.error(`Unknown ext command: ${subCommand}`);
        showUsage();
        process.exit(1);
    }
} else if (command === 'status') {
    showStatus();
} else if (command === 'list-commands') {
    listCommands();
} else {
    console.error(`Unknown command: ${command}`);
    showUsage();
    process.exit(1);
}
