import { PhantomProvider } from "@phantom/react-sdk";
import { AddressType } from "@phantom/browser-sdk";

const PHANTOM_APP_ID = "f734e0e3-6d52-443b-a710-2b2d53225fe0";

const cuspTheme = {
  background: "#0d0f12",
  text: "#f3f4f6",
  secondary: "#6b7280",
  brand: "#00d4aa",
  error: "#ef4444",
  success: "#22c55e",
  borderRadius: "6px",
  overlay: "rgba(0, 0, 0, 0.8)",
};

export function PhantomProviderWrapper({ children }: { children: React.ReactNode }) {
  const redirectUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : "http://localhost:8080/auth/callback";

  return (
    <PhantomProvider
      config={{
        providers: ["injected", "deeplink"],
        appId: PHANTOM_APP_ID,
        addressTypes: [AddressType.solana],
        authOptions: {
          redirectUrl,
        },
      }}
      theme={cuspTheme}
      appName="Cusp"
    >
      {children}
    </PhantomProvider>
  );
}
