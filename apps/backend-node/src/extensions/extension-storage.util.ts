import * as fs from 'fs';
import * as path from 'path';

const candidateRoots = (): string[] => {
    const cwd = process.cwd();
    const candidates = [
        path.resolve(cwd, 'storage', 'plugins'),
        path.resolve(cwd, 'apps', 'backend-node', 'storage', 'plugins'),
        path.resolve(cwd, 'apps', 'backend', 'storage', 'plugins'),
        path.resolve(cwd, 'backend', 'storage', 'plugins'),
        path.resolve(cwd, '..', 'backend', 'storage', 'plugins'),
    ];

    return Array.from(new Set(candidates));
};

export function resolveExtensionStorageRoot(): string {
    const existing = candidateRoots().find((candidate) => fs.existsSync(candidate));
    return existing || path.resolve(process.cwd(), 'storage', 'plugins');
}

