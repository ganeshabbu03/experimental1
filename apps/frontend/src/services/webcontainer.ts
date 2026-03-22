import { WebContainer, type FileSystemTree } from '@webcontainer/api';

// Use globalThis to persist the promise across HMR reloads in development
const GLOBAL_KEY = '__webcontainer_promise__';

/**
 * Initializes and returns the WebContainer instance.
 * Ensures only one instance is booted even if called concurrently or after HMR reloads.
 */
export async function getWebContainer() {
    if (!(globalThis as any)[GLOBAL_KEY]) {
        (globalThis as any)[GLOBAL_KEY] = WebContainer.boot();
    }

    return (globalThis as any)[GLOBAL_KEY] as Promise<WebContainer>;
}

/**
 * Transforms the project's FileNode structure into WebContainer's FileSystemTree format.
 */
export function transformFileNodesToTree(nodes: any[]): FileSystemTree {
    const tree: FileSystemTree = {};

    for (const node of nodes) {
        if (node.type === 'folder') {
            tree[node.name] = {
                directory: transformFileNodesToTree(node.children || []),
            };
        } else {
            tree[node.name] = {
                file: {
                    contents: node.content || '',
                },
            };
        }
    }

    return tree;
}
