import styled, { useTheme } from "styled-components";
import { Link, Button, PillButton, PillButtonLink } from "@/components/Button";
import { Column, Row } from "@/components/Layout";
import { SmallText, Text } from "@/components/Typography";
import { ICONS } from "@/icons";
import { useMemo } from "react";
import { ChainTransaction } from "@skip-go/client";
import { StyledAnimatedBorder } from "./SwapExecutionPageRouteDetailedRow";
import { ChainIcon } from "@/icons/ChainIcon";
import { PenIcon } from "@/icons/PenIcon";
import { useGetAssetDetails } from "@/hooks/useGetAssetDetails";
import { ClientOperation, SimpleStatus } from "@/utils/clientType";
import { chainAddressesAtom } from "@/state/swapExecutionPage";
import { useAtomValue } from "jotai";
import { getTruncatedAddress } from "@/utils/crypto";
import { formatUSD } from "@/utils/intl";
import { formatDisplayAmount } from "@/utils/number";
import { useIsMobileScreenSize } from "@/hooks/useIsMobileScreenSize";
import { useCopyAddress } from "@/hooks/useCopyAddress";
import { fromBech32, toBech32 } from "@cosmjs/encoding";

export type SwapExecutionPageRouteSimpleRowIntentoProps = {
  denom: ClientOperation["denomIn"] | ClientOperation["denomOut"];
  tokenAmount: ClientOperation["amountIn"] | ClientOperation["amountOut"];
  usdValue?: string;
  chainId: ClientOperation["fromChainId"] | ClientOperation["chainId"];
  onClickEditDestinationWallet?: () => void;
  explorerLink?: ChainTransaction["explorerLink"];
  status?: SimpleStatus;
  icon?: ICONS;
  recurrences?: number;
};

export const SwapExecutionPageRouteSimpleRowIntento = ({
  denom,
  tokenAmount,
  usdValue,
  chainId,
  status,
  onClickEditDestinationWallet,
  explorerLink,
  recurrences,
}: SwapExecutionPageRouteSimpleRowIntentoProps) => {
  const theme = useTheme();
  const isMobileScreenSize = useIsMobileScreenSize();
  const { copyAddress, isShowingCopyAddressFeedback } = useCopyAddress();

  const assetDetails = useGetAssetDetails({
    assetDenom: denom,
    chainId,
    tokenAmount,
  });

  const chainAddresses = useAtomValue(chainAddressesAtom);
  const intentoImgUrl = "https://intento.zone/assets/images/icon.png";
  const source = useMemo(() => {
    const chainAddressArray = Object.values(chainAddresses);
    const address = chainAddressArray[0]?.address;

    let intoAddress = "";
    try {
      if (address) {
        intoAddress = toBech32("into", fromBech32(address).data);
      }
    } catch (e) {
      console.warn("Invalid address format", e);
    }

    return {
      address: intoAddress,
      image: intentoImgUrl,
    };
  }, [chainAddresses]);

  const renderExplorerLink = useMemo(() => {
    if (!explorerLink) return;
    if (isMobileScreenSize) {
      return (
        <PillButtonLink href={explorerLink} target="_blank">
          <ChainIcon />
        </PillButtonLink>
      );
    }
    return (
      <Link href={explorerLink} target="_blank">
        <ChainIcon />
      </Link>
    );
  }, [explorerLink, isMobileScreenSize]);

  return (
    <Row gap={25} align="center">
      <StyledAnimatedBorder
        width={50}
        height={50}
        backgroundColor={theme.success.text}
        status={status}
      >
        {intentoImgUrl ? (
          <img
            height={50}
            width={50}
            style={{ borderRadius: 50 }}
            src={intentoImgUrl}
            title={"Intento"}
          />
        ) : (
          <PlaceholderIcon>?</PlaceholderIcon>
        )}
      </StyledAnimatedBorder>
      <Column gap={5}>
        <StyledSymbolAndAmount>
          {formatDisplayAmount(assetDetails.amount)} {assetDetails?.symbol}
        </StyledSymbolAndAmount>
        {usdValue && <SmallText>{formatUSD(usdValue)}</SmallText>}

        <Row align="center" height={18} gap={5}>
          <StyledChainName normalTextColor fontWeight="bold" textWrap="nowrap">
            Streaming {recurrences}x with Intento
          </StyledChainName>

          <Button
            align="center"
            gap={3}
            onClick={() => copyAddress(source.address)}
          >
            {source.image && <img height={10} width={10} src={source.image} />}
            {source.address && (
              <SmallText monospace title={source.address} textWrap="nowrap">
                {isShowingCopyAddressFeedback
                  ? "Address copied!"
                  : getTruncatedAddress(source.address, isMobileScreenSize)}
              </SmallText>
            )}
          </Button>

          {explorerLink ? (
            renderExplorerLink
          ) : onClickEditDestinationWallet ? (
            <Button
              as={isMobileScreenSize ? PillButton : undefined}
              align="center"
              onClick={onClickEditDestinationWallet}
            >
              <PenIcon color={theme.primary.text.lowContrast} />
            </Button>
          ) : null}
        </Row>
      </Column>
    </Row>
  );
};

const StyledSymbolAndAmount = styled(Text)`
  font-size: 24px;
  max-width: 325px;
  height: 27px;
  overflow: hidden;
  text-overflow: ellipsis;
  @media (max-width: 767px) {
    font-size: 22px;
  }
`;

const PlaceholderIcon = styled.div`
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: ${(props) => props.theme.secondary.background.normal};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: ${(props) => props.theme.primary.text.normal};
  border: 1px solid ${(props) => props.theme.primary.text.normal};
`;

const StyledChainName = styled(SmallText)`
  max-width: 200px;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;
