import { init, add } from "@amplitude/analytics-browser";
import { version } from "../../package.json";
import { sessionReplayPlugin } from "@amplitude/plugin-session-replay-browser";

let isAmplitudeInitialized = false;

const serverUrl = "https://go.skip.build/api/amplitude";

export const initAmplitude = () => {
  if (isAmplitudeInitialized) return;
  init("f98ae2d5732f9d57abb0a772df74ff95", {
    autocapture: true,
    appVersion: version,
    serverUrl: `${serverUrl}/httpapi`,
  });
  isAmplitudeInitialized = true;
};

export const startAmplitudeSessionReplay = () => {
  if (isAmplitudeInitialized) {
    const plugin = sessionReplayPlugin({
      sampleRate: 1,
    });
    add(plugin);
  }
};
