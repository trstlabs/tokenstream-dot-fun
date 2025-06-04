import React from "react";
import styled from "styled-components";

const RadioGroupContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
`;

const RadioOption = styled.div<{ isSelected: boolean }>`
  display: flex;
  flex-direction: column;
  padding: 12px;
  border: 1px solid
    ${({ theme, isSelected }) =>
      isSelected
        ? theme.primary.text.normal
        : theme.primary.text.ultraLowContrast};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${({ theme, isSelected }) =>
    isSelected ? `${theme.primary.text.normal}10` : "transparent"};

  &:hover {
    border-color: ${({ theme }) => theme.primary.text.normal};
  }
`;

const OptionLabel = styled.span`
  font-weight: 500;
  color: ${({ theme }) => theme.primary.text.normal};
  font-size: 14px;
`;

const OptionDescription = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.primary.text.ultraLowContrast};
  margin-top: 4px;
  line-height: 1.4;
`;

export interface RadioOptionType {
  value: string;
  label: string;
  description?: string;
}

export interface RadioGroupProps {
  options: RadioOptionType[];
  value: string;
  onChange: (value: string) => void;
}

const RadioGroup: React.FC<RadioGroupProps> = ({
  options,
  value,
  onChange,
}) => {
  return (
    <RadioGroupContainer>
      {options.map((option) => (
        <RadioOption
          key={option.value}
          isSelected={value === option.value}
          onClick={() => onChange(option.value)}
        >
          <OptionLabel>{option.label}</OptionLabel>
          {option.description && (
            <OptionDescription>{option.description}</OptionDescription>
          )}
        </RadioOption>
      ))}
    </RadioGroupContainer>
  );
};

export default RadioGroup;
