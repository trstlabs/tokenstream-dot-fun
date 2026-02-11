import { useAtom, useSetAtom } from "jotai";
import styled, { useTheme } from "styled-components";
import { Column, Row } from "@/components/Layout";
import { SmallText } from "@/components/Typography";
import { MainButton } from "@/components/MainButton";
import { currentPageAtom, Routes } from "@/state/router";
import { selectedStrategyAtom, strategies, Strategy } from "@/state/strategy";
import { ICONS } from "@/icons";
import spotStrategyUrl from "@/icons/spotStrategy.svg";
import spotVsTWAPStrategyUrl from "@/icons/spotVsTWAPStrategy.svg";
import trendStrategyUrl from "@/icons/trendStrategy.svg";
import twapDCAStrategyUrl from "@/icons/twapDCAStrategy.svg";

const Card = styled.button`
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  background: ${({ theme }) => theme.primary.background.normal};
  border: 1px solid ${({ theme }) => theme.primary.text.ultraLowContrast};
  border-radius: 25px;
  padding: 16px;
  cursor: pointer;
  text-align: left;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
`;

const ImageWrap = styled.div`
  width: 100%;
  height: 80px;
  border-radius: 16px;
  background: ${({ theme }) => theme.secondary.background.transparent};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Title = styled.div`
  font-weight: 700;
`;

const Description = styled(SmallText)`
  opacity: 0.8;
`;

const StrategyIcon = ({ strategyKey }: { strategyKey: Strategy["key"] }) => {
  const srcMap: Record<Strategy["key"], string> = {
    "spot-threshold": spotStrategyUrl,
    "twap-based": twapDCAStrategyUrl,
    "trend-detection": trendStrategyUrl,
    "spot-vs-twap-arb": spotVsTWAPStrategyUrl,
  };
  const src = srcMap[strategyKey];
  return <img src={src} width={64} height={64} alt={strategyKey} />;
};

export const StrategyPage = () => {
  const theme = useTheme();
  const [selected, setSelected] = useAtom(selectedStrategyAtom);
  const setPage = useSetAtom(currentPageAtom);

  const onPick = (s: Strategy) => setSelected(s);

  return (
    <Column gap={12}>
      <Row justify="space-between" align="center">
        <MainButton
          label="Back"
          icon={ICONS.thinArrow}
          onClick={() => setPage(Routes.StreamPage)}
        />
        <SmallText color={theme.primary.text.normal}>Strategy</SmallText>
        <div style={{ width: 84 }} />
      </Row>

      <Grid>
        {strategies.map((s) => (
          <Card key={s.key} onClick={() => onPick(s)}>
            <ImageWrap>
              <StrategyIcon strategyKey={s.key} />
            </ImageWrap>
            <Title>{s.title}</Title>
            <Description>{s.description}</Description>
          </Card>
        ))}
      </Grid>

      <MainButton
        label={selected ? `Use: ${selected.title}` : "Continue"}
        icon={ICONS.checkmark}
        onClick={() => setPage(Routes.StreamPage)}
        disabled={!selected}
      />
    </Column>
  );
};
