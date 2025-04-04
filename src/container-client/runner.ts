import { systemNotifier } from "@/container-client/notifier";
import type { AbstractContainerEngineHostClient } from "@/container-client/runtimes/abstract/base";
import type {
  ApiStartOptions,
  EngineConnectorSettings,
  ILogger,
  RunnerStarterOptions,
  RunnerStopperOptions,
  ServiceOpts,
} from "@/env/Types";
import { createLogger } from "@/logger";

export class Runner {
  protected client: AbstractContainerEngineHostClient;
  protected nativeApiStarterProcess: any;
  protected nativeApiStarterProcessChild: any;
  protected logger!: ILogger;
  protected started = false;

  constructor(client: AbstractContainerEngineHostClient) {
    this.client = client;
    this.nativeApiStarterProcess = undefined;
    this.nativeApiStarterProcessChild = undefined;
    this.logger = createLogger("container-client.api.Runner");
  }

  setApiStarted(flag: boolean) {
    this.started = flag;
  }

  // API connectivity and startup
  async startApi(opts?: ApiStartOptions, starter?: RunnerStarterOptions) {
    this.logger.warn(">> Starting API - begin");
    if (this.started) {
      this.logger.debug("<< Starting API - already started");
      systemNotifier.transmit("startup.phase", {
        trace: "Api started",
      });
      return true;
    }
    this.started = true;
    systemNotifier.transmit("startup.phase", {
      trace: "Staring the api",
    });
    this.logger.debug(">> Starting API - guard configuration", { starter });
    if (!starter || !starter?.path) {
      this.logger.error("<< Starting API - Starter program not configured");
      return false;
    }
    const clientOpts: ServiceOpts = {
      retry: { count: 10, wait: 5000 },
      onStatusCheck: ({ retries, maxRetries }) => {
        this.logger.debug(">> Starting API - Checking API status", retries, maxRetries);
      },
      onSpawn: ({ process, child }) => {
        this.nativeApiStarterProcess = process;
        this.nativeApiStarterProcessChild = child;
      },
      checkStatus: async () => {
        this.logger.debug(">> Starting API - Checking API status - checking if running");
        const result = await this.client.isApiRunning();
        return result.success;
      },
    };
    try {
      this.logger.debug(">> Starting API - System service start requested", clientOpts);
      let rejected = false;
      const started = await new Promise<boolean>((resolve, reject) => {
        return Command.ExecuteAsBackgroundService(starter.path!, starter.args || [], clientOpts)
          .then(async (client) => {
            client.on("ready", async ({ process, child }) => {
              try {
                this.logger.debug(">> Starting API - System service start ready", { process, child });
                resolve(true);
              } catch (error: any) {
                if (rejected) {
                  this.logger.warn(">> Starting API - System service start - already rejected");
                } else {
                  rejected = true;
                  reject(error);
                }
              }
            });
            client.on("error", (info) => {
              this.logger.error(">> Starting API - System service start - process error", info);
              if (rejected) {
                this.logger.warn(">> Starting API - System service start - already rejected");
              } else {
                rejected = true;
                reject(new Error("Unable to start service"));
              }
            });
          })
          .catch(reject);
      });
      this.logger.debug("<< Starting API - System service start completed", started);
      return started;
    } catch (error: any) {
      this.logger.error("<< Starting API - System service start failed", error.message);
    } finally {
      this.logger.debug("<< Starting API - System service start request completed");
    }
    return false;
  }

  async stopApi(customSettings?: EngineConnectorSettings, stopper?: RunnerStopperOptions): Promise<boolean> {
    if (!this.started) {
      this.logger.debug("Stopping API - skip (not started here)");
      return true;
    }
    this.logger.debug(">> Stopping API - begin");
    let flag = false;
    if (stopper?.path) {
      const result: any = await Command.Execute(stopper.path, stopper.args || []);
      flag = result.success;
    } else {
      this.logger.warn("Stopping API - no stopper specified");
    }
    if (this.nativeApiStarterProcessChild) {
      const child = this.nativeApiStarterProcessChild;
      await Command.Kill(child);
      this.nativeApiStarterProcessChild = null;
      flag = true;
    } else {
      this.logger.debug("No native starter process child found - nothing to stop");
      flag = true;
    }
    this.logger.debug("<< Stopping API - complete", { stopped: flag });
    return flag;
  }
}
