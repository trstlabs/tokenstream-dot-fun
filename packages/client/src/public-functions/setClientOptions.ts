import { AminoTypes } from "@cosmjs/stargate";
import { defaultRegistryTypes } from "@cosmjs/stargate";
import { createWasmAminoConverters } from "@cosmjs/cosmwasm-stargate";
import {
  circleAminoConverters,
  circleProtoRegistry,
} from "src/codegen/circle/client";
import {
  evmosAminoConverters,
  evmosProtoRegistry,
} from "src/codegen/evmos/client";
import { Registry } from "@cosmjs/proto-signing";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx.js";
import { MsgExecute } from "src/codegen/initia/move/v1/tx";
import { MsgInitiateTokenDeposit } from "src/codegen/opinit/ophost/v1/tx";
import { ClientState } from "../state/clientState";
import type { SkipClientOptions } from "../state/clientState";
import { ApiState } from "src/state/apiState";
import { setApiOptions } from "./setApiOptions";

export const setClientOptions = (options: SkipClientOptions = {}) => {
  ClientState.endpointOptions = options.endpointOptions ?? {};

  ClientState.aminoTypes = new AminoTypes({
    ...circleAminoConverters,
    ...evmosAminoConverters,
    ...(options.aminoTypes ?? {}),
  });

  ClientState.registry = new Registry([
    ...defaultRegistryTypes,
    ["/cosmwasm.wasm.v1.MsgExecuteContract", MsgExecuteContract],
    ["/initia.move.v1.MsgExecute", MsgExecute],
    ["/opinit.ophost.v1.MsgInitiateTokenDeposit", MsgInitiateTokenDeposit],
    ...circleProtoRegistry,
    ...evmosProtoRegistry,
    ...(options.registryTypes ?? []),
  ]);

  if (
    !options.allowOptionsUpdateAfterApiCall &&
    ApiState.apiCalled &&
    !ApiState.initialized
  ) {
    throw new Error(
      "setClientOptions must be called before an api request is made"
    );
  }
  setApiOptions(options);
};
