import { useLocation } from "react-router-dom";
import { useMemo } from "react";
import { QVAC_FLOWS, type QvacFlow } from "@/components/qvac/qvacFlows";

interface QvacContextResult {
  suggestions: QvacFlow[];
  contextLabel: string;
}

export function useQvacContext(): QvacContextResult {
  const location = useLocation();

  return useMemo(() => {
    const path = location.pathname;

    if (path.startsWith("/vault")) {
      return {
        suggestions: [
          QVAC_FLOWS.find((f) => f.id === "vault-deposit")!,
          QVAC_FLOWS.find((f) => f.id === "vault-withdraw")!,
          QVAC_FLOWS.find((f) => f.id === "lend-deposit")!,
        ],
        contextLabel: "Vault",
      };
    }

    if (path.startsWith("/lend")) {
      return {
        suggestions: [
          QVAC_FLOWS.find((f) => f.id === "lend-deposit")!,
          QVAC_FLOWS.find((f) => f.id === "borrow-open")!,
          QVAC_FLOWS.find((f) => f.id === "lend-withdraw")!,
        ],
        contextLabel: "Lend",
      };
    }

    if (path.startsWith("/markets")) {
      return {
        suggestions: [
          QVAC_FLOWS.find((f) => f.id === "direct-trade")!,
          QVAC_FLOWS.find((f) => f.id === "leverage-trade-open")!,
          QVAC_FLOWS.find((f) => f.id === "vault-deposit")!,
        ],
        contextLabel: "Markets",
      };
    }

    if (path.startsWith("/portfolio")) {
      return {
        suggestions: [
          QVAC_FLOWS.find((f) => f.id === "vault-withdraw")!,
          QVAC_FLOWS.find((f) => f.id === "borrow-close")!,
          QVAC_FLOWS.find((f) => f.id === "lend-withdraw")!,
        ],
        contextLabel: "Portfolio",
      };
    }

    return {
      suggestions: [
        QVAC_FLOWS.find((f) => f.id === "vault-deposit")!,
        QVAC_FLOWS.find((f) => f.id === "direct-trade")!,
        QVAC_FLOWS.find((f) => f.id === "borrow-open")!,
      ],
      contextLabel: "Home",
    };
  }, [location.pathname]);
}