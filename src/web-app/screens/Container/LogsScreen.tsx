import { IconNames } from "@blueprintjs/icons";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "wouter";

import type { Container } from "@/env/Types";
import type { AppScreen, AppScreenProps } from "@/web-app/Types";
import { ScreenLoader } from "@/web-app/components/ScreenLoader";
import { Terminal } from "@/web-app/components/Terminal";
import { useStoreActions } from "@/web-app/domain/types";
import { ScreenHeader } from ".";
import "./LogsScreen.css";

interface ScreenProps extends AppScreenProps {}

export const ID = "container.logs";

export const Screen: AppScreen<ScreenProps> = () => {
  const [pending, setPending] = useState(true);
  const [container, setContainer] = useState<Container>();
  const { id } = useParams<{ id: string }>();
  const containerFetch = useStoreActions((actions) => actions.container.containerFetch);
  const onScreenReload = useCallback(async () => {
    try {
      setPending(true);
      const container = await containerFetch({
        Id: decodeURIComponent(id as any),
        withLogs: true,
      });
      setContainer(container);
    } catch (error: any) {
      console.error("Unable to fetch at this moment", error);
    } finally {
      setPending(false);
    }
  }, [containerFetch, id]);

  useEffect(() => {
    onScreenReload();
  }, [onScreenReload]);

  if (!container) {
    return <ScreenLoader screen={ID} pending={pending} />;
  }

  return (
    <div className="AppScreen" data-screen={ID}>
      <ScreenHeader container={container} currentScreen={ID} onReload={onScreenReload} />
      <div className="AppScreenContent">
        <Terminal value={container.Logs} />
      </div>
    </div>
  );
};

Screen.ID = ID;
Screen.Title = "Container Logs";
Screen.Route = {
  Path: "/screens/container/:id/logs",
};
Screen.Metadata = {
  LeftIcon: IconNames.CUBE,
  ExcludeFromSidebar: true,
};
