/**
 * themeService.ts
 * -----------------
 * Handles fetching, parsing, and applying VS Code themes downloaded via OpenVSX.
 * Maps VS Code color tokens to Deexen CSS variables.
 */

import { apiClient } from './apiClient';

interface VSCodeTheme {
    label: string;
    uiTheme: string; // 'vs', 'vs-dark', 'hc-black'
    path: string;
}

interface ExtensionPackageJson {
    contributes?: {
        themes?: VSCodeTheme[];
    };
}

interface ParsedThemeData {
    name?: string;
    type?: string;     // 'dark' | 'light'
    colors?: Record<string, string>;
    tokenColors?: any[];
}

// Map VS Code color keys to Deexen's global CSS variables
const COLOR_MAP: Record<string, string> = {
    'editor.background': '--bg-canvas',
    'sideBar.background': '--bg-surface',
    'list.hoverBackground': '--bg-surface-hover',
    'sideBarSectionHeader.border': '--border-default',
    'editorGroupHeader.tabsBorder': '--border-default',
    'editor.foreground': '--text-primary',
    'sideBar.foreground': '--text-secondary',
    'descriptionForeground': '--text-tertiary',
    'button.background': '--color-accent',
    'button.hoverBackground': '--color-accent-hover',
};

class ThemeService {
    /**
     * Fetch the package.json of an extension to see what themes it contributes.
     */
    async getExtensionPackageJson(
        publisher: string,
        extension: string,
        version: string
    ): Promise<ExtensionPackageJson> {
        return apiClient.get<ExtensionPackageJson>(
            `/plugins/package-json/${publisher}/${extension}/${version}`
        );
    }

    /**
     * Fetch and parse the raw theme JSON file from the extracted extension.
     */
    async getThemeJson(
        publisher: string,
        extension: string,
        version: string,
        themePath: string
    ): Promise<ParsedThemeData> {
        // themePath in package.json usually starts with "./", trim it to relative
        const cleanPath = themePath.startsWith('./') ? themePath.slice(2) : themePath;
        return apiClient.get<ParsedThemeData>(
            `/plugins/theme/${publisher}/${extension}/${version}/${cleanPath}`
        );
    }

    /**
     * Fetch the first theme in a plugin and apply its colors to the document body.
     */
    async applyPluginTheme(publisher: string, extension: string, version: string): Promise<void> {
        try {
            const pkg = await this.getExtensionPackageJson(publisher, extension, version);

            const themes = pkg.contributes?.themes;
            if (!themes || themes.length === 0) {
                console.log(`Plugin ${publisher}.${extension} has no themes.`);
                return;
            }

            // For Phase 2, we simply pick the first theme provided by the extension.
            const firstTheme = themes[0];
            console.log(`Applying theme: ${firstTheme.label}`);

            const themeData = await this.getThemeJson(publisher, extension, version, firstTheme.path);

            if (themeData.colors) {
                this.applyCssVariables(themeData.colors);
            }

            // In Phase 3, we would also register `themeData.tokenColors` and `themeData.colors` 
            // with monaco.editor.defineTheme() to fully style the text editor.

        } catch (error) {
            console.error(`Failed to apply theme for ${publisher}.${extension}:`, error);
        }
    }

    /**
     * Clears applied theme overrides and restores Deexen's default root variables.
     */
    resetTheme(): void {
        const root = document.documentElement;
        Object.values(COLOR_MAP).forEach(cssVar => {
            root.style.removeProperty(cssVar);
        });
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('dark'); // Restore default dark mode
    }

    /**
     * Apply mapping of VS code tokens -> Local CSS vars directly to the document root.
     */
    private applyCssVariables(colors: Record<string, string>) {
        const root = document.documentElement;

        for (const [vsCodeKey, deexenVar] of Object.entries(COLOR_MAP)) {
            // Check if the theme defines the specific vs code key
            const colorValue = colors[vsCodeKey];
            if (colorValue) {
                root.style.setProperty(deexenVar, colorValue);
            }
        }
    }
}

export const themeService = new ThemeService();
