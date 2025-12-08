export interface IntuitionPluginSettings {
	version: string;
	initialized: boolean;
}

export const DEFAULT_SETTINGS: IntuitionPluginSettings = {
	version: '1.0.0',
	initialized: false,
};
