import { ErrorWarningPage } from "@/pages/ErrorWarningPage/ErrorWarningPage";
import { SwapExecutionPage } from "@/pages/SwapExecutionPage/SwapExecutionPage";
import { SwapPage } from "@/pages/SwapPage/SwapPage";
import { TransactionHistoryPage } from "@/pages/TransactionHistoryPage/TransactionHistoryPage";
import { errorWarningAtom, ErrorWarningType } from "@/state/errorWarning";
import { Routes, currentPageAtom } from "@/state/router";
import { useAtom } from "jotai";
import { ErrorBoundary } from "react-error-boundary";
import { useKeepWalletStateSynced } from "@/hooks/useKeepWalletStateSynced";
import { track } from "@amplitude/analytics-browser";
import { StreamPage } from "@/pages/StreamPage/StreamPage";
import { Suspense } from "react";
import { StrategyPage } from "@/pages/StrategyPage/StrategyPage";

export const Router = () => {
  useKeepWalletStateSynced();
  const [currentPage] = useAtom(currentPageAtom);
  const [errorWarning, setErrorWarning] = useAtom(errorWarningAtom);

  if (errorWarning) {
    return <ErrorWarningPage />;
  }

  switch (currentPage) {
    case Routes.SwapPage:
      return (
        <Suspense fallback={null}>
          <ErrorBoundary
            fallback={null}
            onError={(error) => {
              track("unexpected error page: unexpected error from swap page", {
                error,
              });
              setErrorWarning({
                errorWarningType: ErrorWarningType.Unexpected,
                error,
              });
            }}
          >
            <SwapPage />
          </ErrorBoundary>
        </Suspense>
      );
    case Routes.SwapExecutionPage:
      return (
        <Suspense fallback={null}>
          <ErrorBoundary
            fallback={null}
            onError={(error) => {
              track(
                "unexpected error page: unexpected error from execution page",
                { error }
              );
              setErrorWarning({
                errorWarningType: ErrorWarningType.Unexpected,
                error,
              });
            }}
          >
            <SwapExecutionPage />
          </ErrorBoundary>
        </Suspense>
      );
    case Routes.TransactionHistoryPage:
      return (
        <Suspense fallback={null}>
          <ErrorBoundary
            fallback={null}
            onError={(error) => {
              track(
                "unexpected error page: unexpected error from transaction history page",
                {
                  error,
                }
              );
              setErrorWarning({
                errorWarningType: ErrorWarningType.Unexpected,
                error,
              });
            }}
          >
            <TransactionHistoryPage />
          </ErrorBoundary>
        </Suspense>
      );
    case Routes.StreamPage:
      return (
        <ErrorBoundary
          fallback={null}
          onError={(error) => {
            track("error page: unexpected error from stream page", { error });
            console.error(error);
            setErrorWarning({
              errorWarningType: ErrorWarningType.Unexpected,
              error,
            });
          }}
        >
          <StreamPage />
        </ErrorBoundary>
      );
    case Routes.StrategyPage:
      return (
        <Suspense fallback={null}>
          <ErrorBoundary
            fallback={null}
            onError={(error) => {
              track("unexpected error page: unexpected error from strategy page", {
                error,
              });
              setErrorWarning({
                errorWarningType: ErrorWarningType.Unexpected,
                error,
              });
            }}
          >
            <StrategyPage />
          </ErrorBoundary>
        </Suspense>
      );
  }
};
