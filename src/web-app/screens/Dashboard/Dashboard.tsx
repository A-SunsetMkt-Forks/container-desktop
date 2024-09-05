import { AnchorButton, Button, FormGroup, HTMLTable, Icon, InputGroup, Intent, NonIdealState } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ContainerEngine, OperatingSystem } from "@/env/Types";
import { useStoreActions, useStoreState } from "@/web-app/domain/types";
import { CONTAINER_DOCS_EXAMPLE_CODE, CONTAINER_DOCS_URL } from "@/web-app/Environment";
import { usePoller } from "@/web-app/Hooks";
import { Notification } from "@/web-app/Notification";
import { AppScreen, AppScreenProps } from "@/web-app/Types";

import { Application } from "@/container-client/Application";
import "./Dashboard.css";

export const ID = "dashboard";
export const Title = "Dashboard";

export interface ScreenProps extends AppScreenProps {}

export const Screen: AppScreen<ScreenProps> = () => {
  const { t } = useTranslation();
  const [osType, setOsType] = useState<string>("");
  const userSettings = useStoreState((state) => state.userSettings);
  const containersFetchStats = useStoreActions((actions) => actions.dashboard.containersFetchStats);
  const containerStats = useStoreState((state) => state.dashboard.containerStats);
  const currentConnector = useStoreState((state) => state.currentConnector);
  const engine = currentConnector?.engine;
  const program = currentConnector?.settings.program;
  const scope = currentConnector?.settings.controller?.scope || "";

  const { exampleCode, commandPrefix, commandTitle } = useMemo(() => {
    const programName = program?.name || "podman";
    const exampleCode = CONTAINER_DOCS_EXAMPLE_CODE.replace("{program}", programName);
    let commandPrefix;
    let commandTitle;
    if (osType === OperatingSystem.Windows) {
      if (engine === ContainerEngine.PODMAN_VIRTUALIZED_WSL || engine === ContainerEngine.DOCKER_VIRTUALIZED_WSL) {
        commandPrefix = `wsl.exe --distribution ${scope} --exec bash -i -l`;
        commandTitle = t("On WSL, to dissociated between commands targeting the native podman engine, a wsl prefix must be used.");
      }
    } else if (osType === OperatingSystem.MacOS) {
      if (engine === ContainerEngine.PODMAN_VIRTUALIZED_LIMA || engine === ContainerEngine.DOCKER_VIRTUALIZED_LIMA) {
        commandPrefix = `limactl shell ${scope}`;
        commandTitle = t("On MacOS, to dissociated between commands targeting the native podman engine, a limactl prefix must be used.");
      }
    }
    return {
      exampleCode,
      commandPrefix,
      commandTitle
    };
  }, [t, engine, osType, scope, program]);

  const onCopyToClipboardClick = useCallback(
    async (e) => {
      await navigator.clipboard.writeText(exampleCode);
      Notification.show({ message: t("The command was copied to clipboard"), intent: Intent.SUCCESS });
    },
    [t, exampleCode]
  );

  // Change hydration
  usePoller({ poller: containersFetchStats });

  useEffect(() => {
    (async () => {
      const instance = Application.getInstance();
      const osType = await instance.getOsType();
      setOsType(osType);
    })();
  }, [t]);

  return (
    <div className="AppScreen" data-screen={ID}>
      <div className="AppScreenContent">
        <NonIdealState
          icon={<Icon icon={IconNames.CUBE} size={120} />}
          title={t("containersRunning", { count: containerStats.running, context: `${containerStats.running}` })}
          description={
            <div className="AppScreenContentViewport">
              <HTMLTable className="DashboardContainersReportTable" striped compact bordered>
                <tbody>
                  <tr>
                    <td>{t("Paused")}</td>
                    <td>{containerStats.paused}</td>
                  </tr>
                  <tr>
                    <td>{t("Exited")}</td>
                    <td>{containerStats.exited}</td>
                  </tr>
                  <tr>
                    <td>{t("Created")}</td>
                    <td>{containerStats.created}</td>
                  </tr>
                </tbody>
              </HTMLTable>
              <p>{t("As an example, copy and paste this command into your terminal and then come back")}</p>
              <FormGroup helperText={commandPrefix ? commandPrefix : ""}>
                <InputGroup
                  title={commandTitle}
                  className="DashboardContainerExampleCode"
                  value={exampleCode}
                  readOnly
                  rightElement={<Button icon={IconNames.CLIPBOARD} onClick={onCopyToClipboardClick} />}
                />
              </FormGroup>
              <AnchorButton
                className="DashboardContainerDocsUrl"
                href={CONTAINER_DOCS_URL}
                target="_blank"
                minimal
                icon={IconNames.LINK}
                text={t("Explore more in the docs")}
                intent={Intent.PRIMARY}
              />
            </div>
          }
        />
      </div>
    </div>
  );
};

Screen.ID = ID;
Screen.Title = Title;
Screen.Route = {
  Path: "/"
};
Screen.Metadata = {
  LeftIcon: IconNames.DASHBOARD
};
