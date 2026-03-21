export type ExtensionLifecycleEvent = 'install' | 'activate' | 'deactivate' | 'uninstall';

export interface TerminalProfileContribution {
    id: string;
    title: string;
    icon?: string;
}

export interface ExtensionContributes {
    commands?: Array<{ command: string; title: string; category?: string }>;
    menus?: Record<string, Array<{ command: string; when?: string; group?: string }>>;
    keybindings?: Array<{ key: string; command: string; when?: string }>;
    languages?: Array<{ id: string; extensions?: string[]; aliases?: string[] }>;
    snippets?: Array<{ language: string; path: string }>;
    terminal?: {
        profiles?: TerminalProfileContribution[];
    };
}

export interface ExtensionManifest {
    name: string;
    publisher: string;
    displayName?: string;
    description?: string;
    version: string;
    main?: string;
    engines?: Record<string, string>;
    activationEvents?: string[];
    contributes?: ExtensionContributes;
}

export interface ExtensionRecord {
    id: string;
    publisher: string;
    name: string;
    version: string;
    installPath: string;
    manifestPath: string;
    enabled: boolean;
    installedAt: string;
    updatedAt: string;
    source: 'openvsx' | 'local';
    manifest: ExtensionManifest;
}

export interface ExtensionRegistryFile {
    version: number;
    extensions: ExtensionRecord[];
    trustedPublishers?: string[];
}

export interface OpenVsxExtensionMeta {
    namespace: string;
    name: string;
    version: string;
    files?: {
        download?: string;
        [k: string]: string | undefined;
    };
}

export type HostRequestType =
    | 'loadExtensions'
    | 'activateEvent'
    | 'executeCommand'
    | 'deactivateAll'
    | 'getStatus';

export interface HostRequest {
    requestId: string;
    type: HostRequestType;
    payload?: any;
}

export interface HostResponse {
    requestId?: string;
    type: 'response' | 'event';
    name: string;
    payload?: any;
    ok?: boolean;
    error?: string;
}

export interface TerminalCreateEvent {
    extensionId: string;
    name?: string;
    shellPath?: string;
    shellArgs?: string[];
    cwd?: string;
    terminalId: string;
}

export interface OutputChannelEvent {
    extensionId: string;
    channelName: string;
    text: string;
}

export interface ExtensionStatusInfo {
    id: string;
    name: string;
    publisher: string;
    version: string;
    activated: boolean;
    activationTime?: number;
    commandCount: number;
}
