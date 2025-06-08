import styled from "styled-components";

export const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.primary.text.normal};
  margin-bottom: 8px;
`;
