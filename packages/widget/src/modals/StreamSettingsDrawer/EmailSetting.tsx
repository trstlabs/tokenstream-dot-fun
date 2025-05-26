// components/StreamSettings/EmailSetting.tsx
import { useAtom } from "jotai";
import { Column, Row } from "@/components/Layout";
import { SmallText } from "@/components/Typography";
import { streamSettingsAtom } from "@/state/streamSettings";
import { styled, css } from "styled-components";
import { useState } from "react";

export const EmailSetting = () => {
  const [settings, setSettings] = useAtom(streamSettingsAtom);
  const [touched, setTouched] = useState(false);
  const email = settings.emailAddress || "";

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+.[^\s@]+$/.test(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({
      ...prev,
      emailAddress: e.target.value,
    }));
    setTouched(true);
  };

  const valid = email === "" || isValidEmail(email);

  return (
    <Column gap={10}>
      <SmallText>Email for flow alerts (optional)</SmallText>
      <Row>
        <StyledInput
          type="email-address"
          placeholder="you@example.com"
          value={email}
          onChange={handleChange}
          validEmail={touched ? valid : true}
        />
      </Row>
    </Column>
  );
};

const StyledInput = styled.input<{ validEmail?: boolean }>`
  font-size: 12px;
  font-family: "ABCDiatype", sans-serif;
  height: 40px;
  width: 100%;
  box-sizing: border-box;
  outline: none;
  padding: 8px 12px;
  border: 1px solid ${({ theme }) => theme.primary.text.ultraLowContrast};
  background: ${({ theme }) => theme.secondary.background.normal};
  color: ${({ theme }) => theme.primary.text.normal};
  border-radius: 6px;

  ${({ validEmail, theme }) =>
    validEmail === false &&
    css`
      border-color: ${theme.error.text};
      background: ${theme.error.background};
    `}
`;
