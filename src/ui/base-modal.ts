import { App, Modal } from 'obsidian';

export abstract class BaseModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	abstract onOpen(): void;

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
