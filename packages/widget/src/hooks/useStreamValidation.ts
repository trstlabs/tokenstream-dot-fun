import { useAtomValue } from "jotai";
import { streamSettingsAtom } from "@/state/streamSettings";

export const useStreamValidation = () => {
  const settings = useAtomValue(streamSettingsAtom);
  
  const isDurationValid = settings.interval === 0 || settings.duration === 0 || settings.duration >= settings.interval;
  
  return {
    isDurationValid,
    errorMessage: isDurationValid ? null : 'Duration must be at least as long as the interval'
  };
};
