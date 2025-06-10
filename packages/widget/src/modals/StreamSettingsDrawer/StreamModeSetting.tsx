import { Column } from "@/components/Layout";
import { useAtom } from "jotai";
import { streamSettingsAtom, StreamMode } from "@/state/streamSettings";
import RadioGroup from "@/components/RadioGroup/RadioGroup";

export const StreamModeSetting = () => {
  const [streamSettings, setStreamSettings] = useAtom(streamSettingsAtom);

  const handleModeChange = (mode: string) => {
    setStreamSettings((prev) => ({
      ...prev,
      streamMode: mode as StreamMode,
    }));
  };

  return (
    <Column gap={8}>
      <RadioGroup
        options={[
          {
            value: "EQUAL_PARTS",
            label: "Stream input amount in equal parts",
            description:
              "Splits the total amount into equal parts over the duration",
          },
          {
            value: "RECURRING",
            label: "Stream input amount recurringly",
            description: "Uses the full amount for each stream interval",
          },
        ]}
        value={streamSettings.streamMode}
        onChange={handleModeChange}
      />
    </Column>
  );
};
