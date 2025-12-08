import { vi } from 'vitest';

// Mock Notice class
export class Notice {
	message: string;
	duration?: number;

	constructor(message: string, duration?: number) {
		this.message = message;
		this.duration = duration;
	}

	hide() {
		// Mock implementation
	}
}

// Mock Component class
export class Component {
	_loaded = false;

	load() {
		this._loaded = true;
	}

	onload() {
		// Override in tests
	}

	unload() {
		this._loaded = false;
	}

	onunload() {
		// Override in tests
	}

	addChild<T extends Component>(component: T): T {
		return component;
	}

	removeChild<T extends Component>(component: T): T {
		return component;
	}

	register(cb: () => void) {
		// Mock implementation
	}

	registerEvent(eventRef: any) {
		// Mock implementation
	}

	registerDomEvent<K extends keyof WindowEventMap>(
		el: Window | Document | HTMLElement,
		type: K,
		callback: (this: HTMLElement, ev: WindowEventMap[K]) => any,
		options?: boolean | AddEventListenerOptions
	) {
		// Mock implementation
	}

	registerInterval(id: number): number {
		return id;
	}
}

// Mock Plugin class
export class Plugin extends Component {
	app: any;
	manifest: any;

	constructor(app: any, manifest: any) {
		super();
		this.app = app;
		this.manifest = manifest;
	}

	async loadData(): Promise<any> {
		return {};
	}

	async saveData(data: any): Promise<void> {
		// Mock implementation
	}

	addRibbonIcon(icon: string, title: string, callback: (evt: MouseEvent) => any): HTMLElement {
		const el = document.createElement('div');
		el.className = 'ribbon-icon';
		return el;
	}

	addStatusBarItem(): HTMLElement {
		const el = document.createElement('div');
		el.className = 'status-bar-item';
		return el;
	}

	addCommand(command: {
		id: string;
		name: string;
		callback?: () => void;
		checkCallback?: (checking: boolean) => boolean | void;
		hotkeys?: Array<{ modifiers: string[]; key: string }>;
	}): void {
		// Mock implementation
	}

	addSettingTab(tab: PluginSettingTab): void {
		// Mock implementation
	}

	registerView(type: string, viewCreator: (leaf: any) => any): void {
		// Mock implementation
	}

	registerExtensions(extensions: string[], viewType: string): void {
		// Mock implementation
	}
}

// Mock PluginSettingTab class
export class PluginSettingTab {
	app: any;
	plugin: Plugin;
	containerEl: HTMLElement;

	constructor(app: any, plugin: Plugin) {
		this.app = app;
		this.plugin = plugin;
		this.containerEl = document.createElement('div');
	}

	display(): void {
		// Override in implementation
	}

	hide(): void {
		this.containerEl.empty();
	}
}

// Mock Setting class
export class Setting {
	settingEl: HTMLElement;
	nameEl: HTMLElement;
	descEl: HTMLElement;
	controlEl: HTMLElement;
	components: any[] = [];

	constructor(containerEl: HTMLElement) {
		this.settingEl = document.createElement('div');
		this.settingEl.className = 'setting-item';

		this.nameEl = document.createElement('div');
		this.nameEl.className = 'setting-item-name';

		this.descEl = document.createElement('div');
		this.descEl.className = 'setting-item-description';

		this.controlEl = document.createElement('div');
		this.controlEl.className = 'setting-item-control';

		this.settingEl.appendChild(this.nameEl);
		this.settingEl.appendChild(this.descEl);
		this.settingEl.appendChild(this.controlEl);

		containerEl.appendChild(this.settingEl);
	}

	setName(name: string): this {
		this.nameEl.textContent = name;
		return this;
	}

	setDesc(desc: string | DocumentFragment): this {
		if (typeof desc === 'string') {
			this.descEl.textContent = desc;
		} else {
			this.descEl.appendChild(desc);
		}
		return this;
	}

	setClass(cls: string): this {
		this.settingEl.addClass(cls);
		return this;
	}

	setHeading(): this {
		this.settingEl.addClass('setting-item-heading');
		return this;
	}

	setDisabled(disabled: boolean): this {
		if (disabled) {
			this.settingEl.addClass('is-disabled');
		} else {
			this.settingEl.removeClass('is-disabled');
		}
		return this;
	}

	addText(cb: (component: TextComponent) => void): this {
		const component = new TextComponent(this.controlEl);
		cb(component);
		this.components.push(component);
		return this;
	}

	addTextArea(cb: (component: TextAreaComponent) => void): this {
		const component = new TextAreaComponent(this.controlEl);
		cb(component);
		this.components.push(component);
		return this;
	}

	addToggle(cb: (component: ToggleComponent) => void): this {
		const component = new ToggleComponent(this.controlEl);
		cb(component);
		this.components.push(component);
		return this;
	}

	addDropdown(cb: (component: DropdownComponent) => void): this {
		const component = new DropdownComponent(this.controlEl);
		cb(component);
		this.components.push(component);
		return this;
	}

	addButton(cb: (component: ButtonComponent) => void): this {
		const component = new ButtonComponent(this.controlEl);
		cb(component);
		this.components.push(component);
		return this;
	}

	addSlider(cb: (component: SliderComponent) => void): this {
		const component = new SliderComponent(this.controlEl);
		cb(component);
		this.components.push(component);
		return this;
	}

	addMomentFormat(cb: (component: MomentFormatComponent) => void): this {
		const component = new MomentFormatComponent(this.controlEl);
		cb(component);
		this.components.push(component);
		return this;
	}
}

// Mock TextComponent
export class TextComponent {
	inputEl: HTMLInputElement;
	onChange: (value: string) => void = () => {};

	constructor(containerEl: HTMLElement) {
		this.inputEl = document.createElement('input');
		this.inputEl.type = 'text';
		this.inputEl.addEventListener('input', () => {
			this.onChange(this.inputEl.value);
		});
		containerEl.appendChild(this.inputEl);
	}

	setPlaceholder(placeholder: string): this {
		this.inputEl.placeholder = placeholder;
		return this;
	}

	setValue(value: string): this {
		this.inputEl.value = value;
		return this;
	}

	getValue(): string {
		return this.inputEl.value;
	}

	setDisabled(disabled: boolean): this {
		this.inputEl.disabled = disabled;
		return this;
	}

	onChange(callback: (value: string) => void): this {
		this.onChange = callback;
		return this;
	}
}

// Mock TextAreaComponent
export class TextAreaComponent {
	inputEl: HTMLTextAreaElement;
	onChange: (value: string) => void = () => {};

	constructor(containerEl: HTMLElement) {
		this.inputEl = document.createElement('textarea');
		this.inputEl.addEventListener('input', () => {
			this.onChange(this.inputEl.value);
		});
		containerEl.appendChild(this.inputEl);
	}

	setPlaceholder(placeholder: string): this {
		this.inputEl.placeholder = placeholder;
		return this;
	}

	setValue(value: string): this {
		this.inputEl.value = value;
		return this;
	}

	getValue(): string {
		return this.inputEl.value;
	}

	setDisabled(disabled: boolean): this {
		this.inputEl.disabled = disabled;
		return this;
	}

	onChange(callback: (value: string) => void): this {
		this.onChange = callback;
		return this;
	}
}

// Mock ToggleComponent
export class ToggleComponent {
	toggleEl: HTMLInputElement;
	onChange: (value: boolean) => void = () => {};

	constructor(containerEl: HTMLElement) {
		this.toggleEl = document.createElement('input');
		this.toggleEl.type = 'checkbox';
		this.toggleEl.className = 'checkbox';
		this.toggleEl.addEventListener('change', () => {
			this.onChange(this.toggleEl.checked);
		});
		containerEl.appendChild(this.toggleEl);
	}

	setValue(value: boolean): this {
		this.toggleEl.checked = value;
		return this;
	}

	getValue(): boolean {
		return this.toggleEl.checked;
	}

	setDisabled(disabled: boolean): this {
		this.toggleEl.disabled = disabled;
		return this;
	}

	setTooltip(tooltip: string): this {
		this.toggleEl.title = tooltip;
		return this;
	}

	onChange(callback: (value: boolean) => void): this {
		this.onChange = callback;
		return this;
	}
}

// Mock DropdownComponent
export class DropdownComponent {
	selectEl: HTMLSelectElement;
	onChange: (value: string) => void = () => {};

	constructor(containerEl: HTMLElement) {
		this.selectEl = document.createElement('select');
		this.selectEl.className = 'dropdown';
		this.selectEl.addEventListener('change', () => {
			this.onChange(this.selectEl.value);
		});
		containerEl.appendChild(this.selectEl);
	}

	addOption(value: string, display: string): this {
		const option = document.createElement('option');
		option.value = value;
		option.textContent = display;
		this.selectEl.appendChild(option);
		return this;
	}

	addOptions(options: Record<string, string>): this {
		for (const [value, display] of Object.entries(options)) {
			this.addOption(value, display);
		}
		return this;
	}

	setValue(value: string): this {
		this.selectEl.value = value;
		return this;
	}

	getValue(): string {
		return this.selectEl.value;
	}

	setDisabled(disabled: boolean): this {
		this.selectEl.disabled = disabled;
		return this;
	}

	onChange(callback: (value: string) => void): this {
		this.onChange = callback;
		return this;
	}
}

// Mock ButtonComponent
export class ButtonComponent {
	buttonEl: HTMLButtonElement;
	onClick: () => void = () => {};

	constructor(containerEl: HTMLElement) {
		this.buttonEl = document.createElement('button');
		this.buttonEl.addEventListener('click', () => {
			this.onClick();
		});
		containerEl.appendChild(this.buttonEl);
	}

	setButtonText(text: string): this {
		this.buttonEl.textContent = text;
		return this;
	}

	setIcon(icon: string): this {
		this.buttonEl.setAttribute('data-icon', icon);
		return this;
	}

	setClass(cls: string): this {
		this.buttonEl.addClass(cls);
		return this;
	}

	setCta(): this {
		this.buttonEl.addClass('mod-cta');
		return this;
	}

	setWarning(): this {
		this.buttonEl.addClass('mod-warning');
		return this;
	}

	setDisabled(disabled: boolean): this {
		this.buttonEl.disabled = disabled;
		return this;
	}

	setTooltip(tooltip: string): this {
		this.buttonEl.title = tooltip;
		return this;
	}

	onClick(callback: () => void): this {
		this.onClick = callback;
		return this;
	}
}

// Mock SliderComponent
export class SliderComponent {
	sliderEl: HTMLInputElement;
	onChange: (value: number) => void = () => {};

	constructor(containerEl: HTMLElement) {
		this.sliderEl = document.createElement('input');
		this.sliderEl.type = 'range';
		this.sliderEl.addEventListener('input', () => {
			this.onChange(parseFloat(this.sliderEl.value));
		});
		containerEl.appendChild(this.sliderEl);
	}

	setLimits(min: number, max: number, step: number): this {
		this.sliderEl.min = min.toString();
		this.sliderEl.max = max.toString();
		this.sliderEl.step = step.toString();
		return this;
	}

	setValue(value: number): this {
		this.sliderEl.value = value.toString();
		return this;
	}

	getValue(): number {
		return parseFloat(this.sliderEl.value);
	}

	setDisabled(disabled: boolean): this {
		this.sliderEl.disabled = disabled;
		return this;
	}

	setDynamicTooltip(): this {
		return this;
	}

	onChange(callback: (value: number) => void): this {
		this.onChange = callback;
		return this;
	}
}

// Mock MomentFormatComponent
export class MomentFormatComponent {
	inputEl: HTMLInputElement;
	onChange: (value: string) => void = () => {};

	constructor(containerEl: HTMLElement) {
		this.inputEl = document.createElement('input');
		this.inputEl.type = 'text';
		this.inputEl.addEventListener('input', () => {
			this.onChange(this.inputEl.value);
		});
		containerEl.appendChild(this.inputEl);
	}

	setPlaceholder(placeholder: string): this {
		this.inputEl.placeholder = placeholder;
		return this;
	}

	setValue(value: string): this {
		this.inputEl.value = value;
		return this;
	}

	getValue(): string {
		return this.inputEl.value;
	}

	setDefaultFormat(format: string): this {
		return this;
	}

	onChange(callback: (value: string) => void): this {
		this.onChange = callback;
		return this;
	}
}

// Mock Modal class
export class Modal extends Component {
	app: any;
	containerEl: HTMLElement;
	modalEl: HTMLElement;
	titleEl: HTMLElement;
	contentEl: HTMLElement;
	shouldRestoreSelection = true;

	constructor(app: any) {
		super();
		this.app = app;
		this.containerEl = document.createElement('div');
		this.containerEl.className = 'modal-container';

		this.modalEl = document.createElement('div');
		this.modalEl.className = 'modal';

		this.titleEl = document.createElement('div');
		this.titleEl.className = 'modal-title';

		this.contentEl = document.createElement('div');
		this.contentEl.className = 'modal-content';

		this.modalEl.appendChild(this.titleEl);
		this.modalEl.appendChild(this.contentEl);
		this.containerEl.appendChild(this.modalEl);
	}

	open(): void {
		this.onOpen();
	}

	close(): void {
		this.onClose();
	}

	onOpen(): void {
		// Override in implementation
	}

	onClose(): void {
		// Override in implementation
	}
}

// Mock App interface
export const mockApp = {
	vault: {
		getAbstractFileByPath: vi.fn(),
		getMarkdownFiles: vi.fn(() => []),
		getFiles: vi.fn(() => []),
		create: vi.fn(),
		modify: vi.fn(),
		delete: vi.fn(),
	},
	workspace: {
		getActiveViewOfType: vi.fn(),
		getActiveFile: vi.fn(),
		getLeaf: vi.fn(),
		on: vi.fn(),
	},
	metadataCache: {
		getFileCache: vi.fn(),
		on: vi.fn(),
	},
	fileManager: {
		processFrontMatter: vi.fn(),
	},
};

// Helper to extend HTMLElement for Obsidian-specific methods
declare global {
	interface HTMLElement {
		empty(): void;
		addClass(cls: string): void;
		removeClass(cls: string): void;
		toggleClass(cls: string, state?: boolean): void;
		hasClass(cls: string): boolean;
		createEl<K extends keyof HTMLElementTagNameMap>(
			tag: K,
			o?: DomElementInfo | string,
			callback?: (el: HTMLElementTagNameMap[K]) => void
		): HTMLElementTagNameMap[K];
		createDiv(o?: DomElementInfo | string, callback?: (el: HTMLDivElement) => void): HTMLDivElement;
		createSpan(o?: DomElementInfo | string, callback?: (el: HTMLSpanElement) => void): HTMLSpanElement;
	}
}

// Extend HTMLElement prototype with Obsidian methods
if (typeof HTMLElement !== 'undefined') {
	HTMLElement.prototype.empty = function() {
		this.innerHTML = '';
	};

	HTMLElement.prototype.addClass = function(cls: string) {
		this.classList.add(cls);
	};

	HTMLElement.prototype.removeClass = function(cls: string) {
		this.classList.remove(cls);
	};

	HTMLElement.prototype.toggleClass = function(cls: string, state?: boolean) {
		if (state !== undefined) {
			this.classList.toggle(cls, state);
		} else {
			this.classList.toggle(cls);
		}
	};

	HTMLElement.prototype.hasClass = function(cls: string): boolean {
		return this.classList.contains(cls);
	};

	HTMLElement.prototype.createEl = function<K extends keyof HTMLElementTagNameMap>(
		tag: K,
		o?: any,
		callback?: (el: HTMLElementTagNameMap[K]) => void
	): HTMLElementTagNameMap[K] {
		const el = document.createElement(tag);
		if (typeof o === 'string') {
			el.className = o;
		} else if (o) {
			if (o.cls) el.className = o.cls;
			if (o.text) el.textContent = o.text;
			if (o.attr) {
				for (const [key, value] of Object.entries(o.attr)) {
					el.setAttribute(key, value as string);
				}
			}
		}
		if (callback) callback(el);
		this.appendChild(el);
		return el;
	};

	HTMLElement.prototype.createDiv = function(o?: any, callback?: (el: HTMLDivElement) => void): HTMLDivElement {
		return this.createEl('div', o, callback);
	};

	HTMLElement.prototype.createSpan = function(o?: any, callback?: (el: HTMLSpanElement) => void): HTMLSpanElement {
		return this.createEl('span', o, callback);
	};
}

interface DomElementInfo {
	cls?: string;
	text?: string;
	attr?: Record<string, string>;
}

// Export mock creator functions
export function createMockApp() {
	return { ...mockApp };
}

export function createMockPlugin(app: any = createMockApp(), manifest: any = {}) {
	return new Plugin(app, manifest);
}
