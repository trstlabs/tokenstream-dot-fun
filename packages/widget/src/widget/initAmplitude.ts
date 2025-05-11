import { init } from "@amplitude/analytics-browser";
import { version } from "../../package.json";

let isAmplitudeInitialized = false;

export const initAmplitude = () => {
  if (isAmplitudeInitialized) return;
  init("b7df7ffed56826090415b2f151f5578", {
    autocapture: true,
    appVersion: version,
  });
  isAmplitudeInitialized = true;
};
