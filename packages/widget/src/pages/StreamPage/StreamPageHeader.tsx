import { Row } from "@/components/Layout";
import { GhostButton } from "@/components/Button";
import { iconMap, ICONS } from "@/icons";
import { styled } from "styled-components";

export type StreamPageHeaderItemButton = {
  label: React.ReactNode;
  icon?: ICONS;
  onClick?: () => void;
};

type StreamPageHeaderProps = {
  leftButton?: StreamPageHeaderItemButton;
  middleButton?: StreamPageHeaderItemButton;
  rightButton?: StreamPageHeaderItemButton;
  rightContent?: React.ReactNode;
};

export const StreamPageHeader = ({ leftButton }: StreamPageHeaderProps) => {
  const LeftIcon = iconMap[leftButton?.icon || ICONS.none];

  return (
    <StyledStreamPageHeaderContainer justify="space-between">
      <Row align="center" gap={10}>
        {leftButton && (
          <GhostButton gap={5} align="center" onClick={leftButton.onClick}>
            <LeftIcon />
            {leftButton.label}
          </GhostButton>
        )}
      </Row>
    </StyledStreamPageHeaderContainer>
  );
};

const StyledStreamPageHeaderContainer = styled(Row)`
  height: 30px;
  justify-content: space-between;
`;
