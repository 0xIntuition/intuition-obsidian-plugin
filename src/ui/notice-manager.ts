import { Notice } from 'obsidian';

export class NoticeManager {
	info(message: string, duration = 5000): void {
		new Notice(message, duration);
	}

	success(message: string, duration = 5000): void {
		new Notice(`✓ ${message}`, duration);
	}

	error(message: string, duration = 8000): void {
		new Notice(`✗ ${message}`, duration);
	}

	warning(message: string, duration = 6000): void {
		new Notice(`⚠ ${message}`, duration);
	}
}
