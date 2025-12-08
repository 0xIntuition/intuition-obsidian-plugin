import type IntuitionPlugin from '../main';

export abstract class BaseService {
	protected plugin: IntuitionPlugin;

	constructor(plugin: IntuitionPlugin) {
		this.plugin = plugin;
	}

	abstract initialize(): Promise<void>;
	abstract cleanup(): void;
}
