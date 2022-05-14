const { setLevel, getLevel } = require("@podman-desktop-companion/logger");

function setGlobalUserSettings(userConfiguration, opts, defaultConnectorId) {
  Object.keys(opts).forEach((key) => {
    const value = opts[key];
    userConfiguration.setKey(key, value);
    if (key === "logging") {
      setLevel(value.level);
    }
  });
  return getGlobalUserSettings(userConfiguration, defaultConnectorId);
}

function getGlobalUserSettings(userConfiguration, defaultConnectorId) {
  return {
    startApi: userConfiguration.getKey("startApi", false),
    minimizeToSystemTray: userConfiguration.getKey("minimizeToSystemTray", false),
    path: userConfiguration.getStoragePath(),
    logging: {
      level: getLevel()
    },
    connector: {
      default: userConfiguration.getKey("connector.default", defaultConnectorId)
    }
  };
}

// configuration
function setEngineUserSettings(userConfiguration, id, settings) {
  userConfiguration.setKey(id, settings);
  return userConfiguration.getKey(id);
}

function getEngineUserSettings(userConfiguration, id) {
  return userConfiguration.getKey(id);
}

function createActions(context, options) {
  return {
    setGlobalUserSettings: (...rest) =>
      setGlobalUserSettings(context.userConfiguration, ...rest, context.defaultConnectorId),
    getGlobalUserSettings: (...rest) =>
      getGlobalUserSettings(context.userConfiguration, ...rest, context.defaultConnectorId),
    setEngineUserSettings: (...rest) => setEngineUserSettings(context.userConfiguration, ...rest),
    getEngineUserSettings: (...rest) => getEngineUserSettings(context.userConfiguration, ...rest)
  };
}

module.exports = {
  setGlobalUserSettings,
  getGlobalUserSettings,
  setEngineUserSettings,
  getEngineUserSettings,
  createActions
};
