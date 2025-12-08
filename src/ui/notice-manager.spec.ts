import { describe, it, expect, beforeEach } from 'vitest';
import { NoticeManager } from './notice-manager';

describe('NoticeManager', () => {
	let noticeManager: NoticeManager;

	beforeEach(() => {
		noticeManager = new NoticeManager();
	});

	describe('info', () => {
		it('should create info notice without throwing', () => {
			expect(() => noticeManager.info('Test info')).not.toThrow();
		});

		it('should accept custom duration', () => {
			expect(() => noticeManager.info('Test info', 3000)).not.toThrow();
		});
	});

	describe('success', () => {
		it('should create success notice without throwing', () => {
			expect(() => noticeManager.success('Operation completed')).not.toThrow();
		});

		it('should accept custom duration', () => {
			expect(() => noticeManager.success('Operation completed', 3000)).not.toThrow();
		});
	});

	describe('error', () => {
		it('should create error notice without throwing', () => {
			expect(() => noticeManager.error('Operation failed')).not.toThrow();
		});

		it('should accept custom duration', () => {
			expect(() => noticeManager.error('Operation failed', 10000)).not.toThrow();
		});
	});

	describe('warning', () => {
		it('should create warning notice without throwing', () => {
			expect(() => noticeManager.warning('Warning message')).not.toThrow();
		});

		it('should accept custom duration', () => {
			expect(() => noticeManager.warning('Warning message', 4000)).not.toThrow();
		});
	});
});
