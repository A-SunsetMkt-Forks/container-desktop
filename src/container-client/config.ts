import type { GlobalUserSettings } from "@/env/Types";
import { deepMerge } from "@/utils";

async function getUserSettingsPath() {
  const dataPath = await Platform.getUserDataPath();
  const configPath = await Path.join(dataPath, "user-settings.json");
  return configPath;
}

async function read() {
  const configPath = await getUserSettingsPath();
  const contents = (await FS.isFilePresent(configPath)) ? await FS.readTextFile(configPath) : "{}";
  try {
    const config = JSON.parse(contents);
    // logger.debug("Loaded config is", config);
    return config;
  } catch (error: any) {
    console.error("Unable to read config", { error, contents });
  }
  return {} as any;
}

async function write(config?: GlobalUserSettings) {
  const configPath = await getUserSettingsPath();
  try {
    const baseDir = await Path.dirname(configPath);
    const baseDirExits = await FS.isFilePresent(baseDir);
    if (!baseDirExits) {
      await FS.mkdir(baseDir, { recursive: true });
    }
    await FS.writeTextFile(configPath, JSON.stringify(config, null, 2));
  } catch (error: any) {
    console.error("Unable to write config", { error, config });
  }
  return config;
}

export async function update(values: Partial<GlobalUserSettings>) {
  let config = await read();
  if (values) {
    config = deepMerge<GlobalUserSettings>({}, config, values);
    // console.debug("Updated configuration", config);
    return await write(config);
  }
  return config;
}

export class UserConfiguration {
  async getStoragePath() {
    const dataPath = await Platform.getUserDataPath();
    return dataPath;
  }
  async getSettings() {
    const settings = await read();
    return settings ?? {};
  }
  async getKey<T = unknown>(name: string, defaultValue: any | undefined = undefined) {
    const settings = await this.getSettings();
    const stored = settings[name] ?? defaultValue;
    return stored as T;
  }
  async setKey(name: string, value: any) {
    const settings = await this.getSettings();
    // console.debug("Setting key", { name, value });
    const updated = deepMerge<GlobalUserSettings>(
      {},
      settings,
      { [name]: value },
      { version: import.meta.env.PROJECT_VERSION || "latest" },
    );
    // console.debug("Setting key", updated);
    return await update(updated);
  }
  async setSettings(value: Partial<GlobalUserSettings>) {
    let settings = await read();
    if (!settings) {
      settings = {};
    }
    settings = deepMerge<GlobalUserSettings>(settings, value);
    return await update(settings);
  }
}

export const userConfiguration = new UserConfiguration();
