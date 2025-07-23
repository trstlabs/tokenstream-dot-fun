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
            value: "SPLIT_INPUT",
            label: "Split input amount in equal parts",
            description:
              "Splits the total amount into equal parts and streams them over the duration",
          },
          {
            value: "RECUR_INPUT",
            label: "Full input amount per flow execution",
            description:
              "Uses the full input amount for each stream flow execution",
          },
        ]}
        value={streamSettings.streamMode}
        onChange={handleModeChange}
      />
    </Column>
  );
};
