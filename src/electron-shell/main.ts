// node
import path from "node:path";
import * as url from "node:url";
// vendors
import * as Electron from "electron";
import contextMenu from "electron-context-menu";
import { debounce } from "lodash-es";
import is_ip_private from "private-ip";
// project
import { userConfiguration } from "@/container-client/config";
import { OperatingSystem } from "@/env/Types";
import { createLogger } from "@/logger";
import { CURRENT_OS_TYPE, FS, Path, Platform } from "@/platform/node";
import { Command } from "@/platform/node-executor";
import { MessageBus } from "./shared";

// patch global like in preload
(global as any).Command = Command;
(global as any).Platform = Platform;
(global as any).Path = Path;
(global as any).FS = FS;
(global as any).CURRENT_OS_TYPE = CURRENT_OS_TYPE;
(global as any).MessageBus = MessageBus;
// locals
const { BrowserWindow, Menu, Tray, app, dialog, ipcMain, shell } = Electron;
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_HOME = path.dirname(__dirname);
const URLS_ALLOWED = [
  "https://stately.ai/inspect",
  "https://stately.ai/registry/inspect",
  "https://iongion.github.io/podman-desktop-companion/",
  "https://github.com/iongion/podman-desktop-companion/releases"
];
const DOMAINS_ALLOW_LIST = ["localhost", "podman.io", "docs.podman.io", "avd.aquasec.com", "aquasecurity.github.io"];
const logger = await createLogger("shell.main");
let applicationWindow: Electron.BrowserWindow;
let notified = false;
const ensureWindow = () => {
  applicationWindow.show();
};
const isHideToTrayOnClose = async () => {
  return await userConfiguration.getKey("minimizeToSystemTray", false);
};
const getWindowConfigOptions = async () => {
  return await userConfiguration.getKey<Electron.BrowserWindowConstructorOptions>("window", {});
};
const setWindowConfigOptions = debounce(async (opts: Electron.BrowserWindowConstructorOptions) => {
  return await userConfiguration.setKey("window", opts);
}, 500);
const isDebug = ["yes", "true", "1"].includes(`${process.env.PODMAN_DESKTOP_COMPANION_DEBUG || ""}`.toLowerCase());
const isDevelopment = () => {
  return !app.isPackaged || import.meta.env.ENVIRONMENT === "development";
};
const iconPath = isDevelopment() ? path.join(PROJECT_HOME, "src/resources/icons/appIcon-duotone.png") : path.join(__dirname, "appIcon-duotone.png");
const trayIconPath = isDevelopment() ? path.join(PROJECT_HOME, "src/resources/icons/trayIcon-duotone.png") : path.join(__dirname, "trayIcon-duotone.png");
const activateTools = () => {
  if (isDevelopment() || isDebug) {
    try {
      if (applicationWindow.webContents.isDevToolsOpened()) {
        logger.debug("Closing dev tools");
        applicationWindow.webContents.closeDevTools();
      } else {
        logger.debug("Opening dev tools");
        applicationWindow.webContents.openDevTools({ mode: "detach" });
      }
    } catch (error: any) {
      logger.error("Unable to open dev tools", error.message, error.stack);
    }
  }
};

// ipc global setup
ipcMain.on("window.minimize", () => {
  if (applicationWindow.isMinimizable()) {
    applicationWindow.minimize();
  }
});
ipcMain.on("window.maximize", () => {
  if (applicationWindow.isMaximized()) {
    applicationWindow.restore();
  } else {
    applicationWindow.maximize();
  }
});
ipcMain.on("window.restore", () => {
  applicationWindow.restore();
});
ipcMain.on("window.close", (event) => {
  applicationWindow.close();
});
ipcMain.on("application.exit", () => {
  app.exit();
});
ipcMain.on("application.relaunch", () => {
  app.relaunch();
});
ipcMain.on("register.process", (p) => {
  logger.debug("Must register", p);
});
ipcMain.on("openDevTools", () => {
  activateTools();
});
ipcMain.on("notify", (event, arg) => {
  if (arg && arg.message === "ready") {
    notified = true;
  }
  ensureWindow();
});
ipcMain.handle("openFileSelector", async function (event, options) {
  logger.debug("IPC - openFileSelector - start", options);
  const selection = await dialog.showOpenDialog(applicationWindow, {
    defaultPath: app.getPath("home"),
    properties: [options?.directory ? "openDirectory" : "openFile"],
    filters: options?.filters || []
  });
  logger.debug("IPC - openFileSelector - result", selection);
  return selection;
});
ipcMain.handle("openTerminal", async function (event, options) {
  logger.debug("IPC - openTerminal - start", options);
  const success = await Platform.launchTerminal(options);
  logger.debug("IPC - openTerminal - result", options, success);
  return success;
});

async function createWindow() {
  if (applicationWindow) {
    logger.debug("Creating window - already created");
    return applicationWindow;
  }
  const preloadURL = path.join(__dirname, `preload-${import.meta.env.PROJECT_VERSION}.mjs`);
  const appURL = isDevelopment()
    ? import.meta.env.VITE_DEV_SERVER_URL
    : url.format({
        pathname: path.join(__dirname, "index.html"),
        protocol: "file:",
        slashes: true
      });
  const windowConfigOptions: Partial<Electron.BrowserWindowConstructorOptions> = await getWindowConfigOptions();
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    show: false, // Use the 'ready-to-show' event to show the instantiated BrowserWindow.
    backgroundColor: "#1a051c",
    width: 1280,
    height: 800,
    ...(windowConfigOptions ?? {}),
    webPreferences: {
      devTools: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: true,
      sandbox: false, // Sandbox disabled because the demo of preload script depend on the Node.js api
      webviewTag: false, // The webview tag is not recommended. Consider alternatives like an iframe or Electron's BrowserView. @see https://www.electronjs.org/docs/latest/api/webview-tag#warning
      preload: preloadURL
    },
    icon: iconPath
  };
  if (CURRENT_OS_TYPE === OperatingSystem.Linux || CURRENT_OS_TYPE === OperatingSystem.Windows) {
    windowOptions.frame = false;
  } else {
    windowOptions.titleBarStyle = "hiddenInset";
  }
  let closed = false;
  const onMinimizeOrClose = async (event: any, source: any) => {
    if (closed) {
      logger.debug("Already closed - skipping event", source);
      return;
    }
    event.preventDefault();
    logger.debug("Checking if must hide to tray", source);
    if (await isHideToTrayOnClose()) {
      createSystemTray();
      applicationWindow.setSkipTaskbar(true);
      applicationWindow.hide();
      event.returnValue = false;
      if (CURRENT_OS_TYPE === OperatingSystem.MacOS) {
        app.dock.hide();
      }
    } else if (source === "close") {
      closed = true;
    } else if (source === "closed") {
      closed = true;
    }
    if (closed) {
      app.quit();
    }
  };
  // Application window
  applicationWindow = new BrowserWindow(windowOptions);
  applicationWindow.on("resize", async (event: any) => {
    const [width, height] = applicationWindow.getSize();
    const config = await getWindowConfigOptions();
    config.width = width;
    config.height = height;
    await setWindowConfigOptions(config);
  });
  applicationWindow.on("move", async (event: any) => {
    const [x, y] = applicationWindow.getPosition();
    const config = await getWindowConfigOptions();
    config.x = x;
    config.y = y;
    await setWindowConfigOptions(config);
  });
  applicationWindow.on("minimize", (event: any) => onMinimizeOrClose(event, "minimize"));
  applicationWindow.on("maximize", async (event: any) => {
    const isMaximized = applicationWindow.isMaximized();
    const config = await getWindowConfigOptions();
    (config as any).isMaximized = isMaximized;
  });
  applicationWindow.on("close", (event: any) => onMinimizeOrClose(event, "close"));
  applicationWindow.once("ready-to-show", () => {
    logger.debug("window is ready to show - waiting application ready-ness");
    ensureWindow();
    if (isDebug || isDevelopment()) {
      activateTools();
    }
    if ((windowConfigOptions as any).isMaximized) {
      applicationWindow.maximize();
    }
  });
  // Application URL handler
  applicationWindow.webContents.setWindowOpenHandler((event: any) => {
    const info = new URL(event.url);
    if (!URLS_ALLOWED.includes(event.url)) {
      if (!is_ip_private(info.hostname)) {
        if (!DOMAINS_ALLOW_LIST.includes(info.hostname)) {
          logger.error("Security issue - attempt to open a domain that is not allowed", info);
          return { action: "deny" };
        }
      }
    }
    // logger.debug("window open", info.hostname);
    // if (url.startsWith(config.fileProtocol)) {
    //   return { action: "allow" };
    // }

    if (isDevelopment()) {
      return { action: "allow" };
    }

    shell.openExternal(event.url, { activate: true });
    return { action: "deny" };
  });
  logger.debug("Application URL is", { appURL, preloadURL, windowOptions });
  try {
    await applicationWindow.loadURL(appURL);
  } catch (error: any) {
    console.error("Unable to load the application", error);
  }
  applicationWindow.webContents.openDevTools({ mode: "detach" });
  return applicationWindow;
}

function createSystemTray() {
  if (tray) {
    logger.debug("Creating system tray menu - already created");
    return;
  }
  logger.debug("Creating system tray menu");
  tray = new Tray(trayIconPath);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show main window",
      click: async () => {
        applicationWindow.excludedFromShownWindowsMenu = true;
        applicationWindow.show();
        applicationWindow.setSkipTaskbar(false);
        if (CURRENT_OS_TYPE === OperatingSystem.MacOS) {
          app.dock.show();
        }
      }
    },
    { label: "", type: "separator" },
    {
      label: "Quit",
      click: () => {
        applicationWindow.destroy();
        app.quit();
      }
    }
  ]);
  tray.setToolTip("Podman Desktop Companion");
  tray.setContextMenu(contextMenu);
}

// see https://mmazzarolo.com/blog/2021-08-12-building-an-electron-application-using-create-react-app/
//let mainWindow: any;
let tray: any = null;
(async () => {
  logger.debug("Starting main process - user configuration from", app.getPath("userData"));
  contextMenu({
    showInspectElement: true // Always show to help debugging
  });
  app.commandLine.appendSwitch("ignore-certificate-errors");
  // app.on("activate", async () => {
  //   if (!applicationWindow && BrowserWindow.getAllWindows().length === 0) {
  //     applicationWindow = await createWindow();
  //   }
  // });
  app.whenReady().then(async () => {
    // setup window
    await createWindow();
  });
  /*
  app.on("window-all-closed", async () => {
    if (await isHideToTrayOnClose()) {
      createSystemTray();
      if (isDevelopment()) {
        logger.debug("When Hide to tray is set - the application is not quitted");
      }
    } else {
      logger.debug("Quitting the application and killing all nested processes", notified);
      app.quit();
    }
  });
  */
})();
