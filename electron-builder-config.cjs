const path = require("node:path");
const os = require("node:os");
// vendors
const dayjs = require("dayjs");
const dotenv = require("dotenv");
const semver = require("semver");
// pkg
const pkg = require("./package.json");
// module
const version = pkg.version;
const semverVersion = semver.parse(version);
// MAJOR.MIN.REV.BUILD for Windows Store compatibility
const buildNumber = Number(process.env.BUILD_NUMBER || semverVersion.build?.[0] || semverVersion.prerelease?.[0]?.[0] || 0);
const buildVersion = `${semverVersion.major}.${semverVersion.minor}.${semverVersion.patch}.${buildNumber}`;
const artifactName = [pkg.name, "${arch}", version].join("-");
const ENVIRONMENT = process.env.ENVIRONMENT || "development";
const PROJECT_HOME = path.resolve(__dirname);

// template
dotenv.config({ path: path.join(PROJECT_HOME, ".env") });
dotenv.config({ path: path.join(PROJECT_HOME, ".env.local"), override: true });
// target env
dotenv.config({ path: path.join(PROJECT_HOME, `.env.${ENVIRONMENT}`), override: true });
dotenv.config({ path: path.join(PROJECT_HOME, `.env.${ENVIRONMENT}.local`), override: true });

// injected
const year = dayjs().format("YYYY");
const identityName = "IonutStoica.ContainerDesktop";
const applicationId = identityName;
const displayName = pkg.title;
const releaseName = `${displayName} ${version}`;
const config = {
  appId: "container-desktop.iongion.github.io",
  productName: process.platform === "linux" ? pkg.name : displayName,
  buildNumber,
  buildVersion,
  artifactName: artifactName + ".${ext}",
  copyright: `Copyright (c) ${year} ${pkg.author}`,
  releaseInfo: {
    releaseName,
    releaseDate: dayjs().format("MMM DD, YYYY")
  },
  asar: true,
  files: [
    // Exclude all
    "!**/*",
    // What to copy
    "build",
    "LICENSE"
  ],
  electronLanguages: ["en-US"],
  // includeSubNodeModule: false,
  extraMetadata: {
    version: buildVersion,
    buildVersion,
    buildNumber,
    main: pkg.main
  },
  directories: {
    app: ".",
    output: "release",
    buildResources: "src/resources"
  },
  publish: null,
  flatpak: {
    // Debug using: flatpak run --command=sh --devel --filesystem=$(pwd) container_desktop.iongion.github.io
    // flatpak run -v container_desktop.iongion.github.io
    // flatpak info container_desktop.iongion.github.io
    base: "org.electronjs.Electron2.BaseApp",
    branch: "main",
    category: "Development",
    runtime: "org.freedesktop.Platform",
    runtimeVersion: "24.08",
    license: "LICENSE",
    // collection: "org.flathub.Stable",
    sdk: "org.freedesktop.Sdk",
    useWaylandFlags: true,
    finishArgs: [
      "--share=network",
      "--share=ipc",
      "--socket=wayland",
      // "--socket=x11",
      "--socket=fallback-x11",
      "--socket=pulseaudio", // Is this really needed ?
      "--socket=session-bus",
      "--socket=system-bus",
      "--socket=ssh-auth",
      "--device=dri",
      "--device=kvm",
      "--device=shm",
      "--filesystem=host",
      "--filesystem=host-os",
      "--filesystem=host-etc",
      "--filesystem=home",
      "--filesystem=/run/user",
      "--filesystem=xdg-config",
      "--filesystem=xdg-run/podman",
      "--filesystem=xdg-run/docker",
      "--talk-name=org.freedesktop.Notifications"
    ]
  },
  mac: {
    category: "public.app-category.developer-tools",
    icon: "icons/appIcon.icns",
    target: "dmg",
    type: "development",
    entitlements: "entitlements.mac.plist",
    entitlementsInherit: "entitlements.mac.inherit.plist",
    darkModeSupport: true,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    extendInfo: {
      NSCameraUsageDescription: "~",
      NSMicrophoneUsageDescription: "~"
    }
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    shortcutName: displayName
  },
  win: {
    target: ["appx"],
    // certificateFile: "ContainerDesktop.pfx",
    // See https://stackoverflow.com/questions/61736021/icon-sizes-for-uwp-apps-universal-windows-platform-appx
    icon: "icons/icon.ico"
  },
  appx: {
    identityName,
    publisher: process.env.PUBLISHER || pkg.author,
    publisherDisplayName: process.env.PUBLISHER_DISPLAY_NAME || pkg.author,
    applicationId,
    setBuildNumber: false, // Always false otherwise rejected by Windows Store
    displayName
  },
  linux: {
    executableName: "container-desktop",
    maintainer: process.env.PUBLISHER || pkg.author,
    icon: "icons/appIcon.icns",
    target: ["deb", "pacman", "rpm", "flatpak", "AppImage"],
    category: "Development;System;Utility",
    extraResources: ["support/templates"],
    desktop: {
      Name: displayName
    },
    executableArgs: ["--no-sandbox"]
  },
  deb: {
    afterInstall: "support/templates/after-install.sh",
    afterRemove: "support/templates/after-remove.sh"
  }
};

module.exports = config;
