import { LogWindow } from "@ksync/log";
import KSyncPlugin from "@ksync/main";
import { 
	Logger,
	humanFileSize,
	possiblyHost
} from "@ksync/util";
import { LoginModal } from "@ksync/modals/login";
import { DevicesModal } from "@ksync/modals/devices";
import { VaultsModal } from "@ksync/modals/vaults";
import { Account } from "@ksync/services/account";
import { inspect } from "util";
import { 
	PluginSettingTab, 
	Setting,
	ButtonComponent, 
	App, 
	TextAreaComponent, 
	SearchComponent, 
	TextComponent, 
	SliderComponent,
	requestUrl
} from "obsidian";

export class SampleSettingTab extends PluginSettingTab {
	plugin: KSyncPlugin;
	logger: Logger;
	loggerWindow: LogWindow;
	user: Account;

	constructor(app: App, plugin: KSyncPlugin) {
		super(app, plugin);

		this.plugin = plugin;
		this.logger = plugin.logger;
		this.user = this.plugin.account;
	}

	async display(): Promise<void> {
		const { containerEl: container } = this;

		container.empty();

		if (!this.plugin.api.status) {
			new Setting(container)
				.setName("Сервер недоступен, пожалуйста, повторите попытку.")
				.addButton(button => button
					.setButtonText("Переподключиться")
					.onClick(async (_) => {
						this.plugin.api.CheckApi();
					})
				);
		}

		new Setting(container)
			.setHeading()
			.setName("Взаимодействие с аккаунтом и хранилищем");

		// Проверка есть ли аккаунт и доступно ли API
		if (this.plugin.settings.token === "" || !this.plugin.api.status) {
			new Setting(container)
				.setName(`Вы ещё не зашли в собственный аккаунт.`)
				.addButton(button => button
					.setButtonText("Войти")
					.onClick(async (_) => {
						new LoginModal(this.app, this.plugin).open()
						this.logger.info("Используем официальный сервер.")
					})
				);
		} else {
			new Setting(container)
				.setName(`Аккаунт: ${this.user.data.email}`)
				.setDesc(`Подписка: ${this.user.data.subscription}`)
				.addButton(button => button
					.setButtonText("Выйти")
					.onClick(async (_) => {
						this.plugin.settings.token = ""
						this.plugin.saveSettings()
						this.display()
					})
				);

			new Setting(container)
				.setName(`Хранилища (Выбрано: ${this.user.data.vaults.find(vault => vault.id === this.plugin.settings.vaultid)?.name})`)
				.setDesc("Создайте или выберите используемое хранилище для синхронизации")
				.addButton(button => button
					.setButtonText("Просмотреть")
					.onClick(async () => {
						new VaultsModal(this.app, this.plugin).open()
					})
				)
			
			/**
   			 * TODO: Добавить в бета-тестирование только после того как будет реализован API
			 *
	         *   new Setting(container)
			 *       .setName("Устройства")
			 *       .setDesc("Устройства привязанные к аккаунту")
			 *       .addButton(button => button
			 *  	     .setButtonText("Просмотреть")
			 *  	     .onClick(async () => {
			 *  		     new DevicesModal(this.app, this.plugin).open()
			 *  	     })
			 *       );
			*/

			const all = Number(this.user.data.space);
			const used = await this.plugin.manager.getSize();
			new Setting(container)
				.setHeading()
				.setName(`Использование: ${humanFileSize(used)}/${humanFileSize(all)}`);

			const progressBarContainer = container.createEl("div", { cls: "space-progress-bar" });
			progressBarContainer
				.createEl("div", { cls: "" })
				.setCssStyles({ width: `${used/all*100}%` });
		}
		
		new Setting(container)
			.setHeading()
			.setName("Взаимодействие с сервером");

		if (this.plugin.settings.vaultid !== 0) {
			new Setting(container)
			.setName("Запустить KSync")
			.setDesc("Запустить процесс синхронизации между клиентом и сервером")
			.addButton(button => button
				.setButtonText("Запуск")
				.setDisabled(true)
				.onClick(async (_) => {
					button.setDisabled(true);

				})
			);
		}
		
		new Setting(container)
			.setName("Адрес сервера KSync")
			.setDesc("Укажите необходимый адрес сервера для синхронизации")
			.addText(text => text
				.setPlaceholder("ksync.kurays.dev")
				.setValue(this.plugin.settings.server)
				.onChange(async (value) => {
					this.plugin.settings.server = value;

					await this.plugin.saveSettings();
				})
			).addButton(button => button
				.setButtonText("Сменить").setWarning()
			);

		new Setting(container)
			.setHeading()
			.setName("Debug-режим");

		this.loggerWindow = new LogWindow(container, this.logger);
		
		new Setting(container)
			.setHeading()
			.setName("© KSync 2024 | Разработчик: Абрамов Егор");
	}
}
