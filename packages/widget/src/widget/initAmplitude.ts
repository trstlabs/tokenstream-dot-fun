import { init } from "@amplitude/analytics-browser";
import { version } from "../../package.json";

let isAmplitudeInitialized = false;

export const initAmplitude = () => {
  if (isAmplitudeInitialized) return;
  init("f98ae2d5732f9d57abb0a772df74ff95", {
    autocapture: true,
    appVersion: version,
  });
  isAmplitudeInitialized = true;
};
