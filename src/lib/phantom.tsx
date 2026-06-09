import { PhantomProvider, type PhantomTheme } from "@phantom/react-sdk";
import { AddressType } from "@phantom/browser-sdk";

const PHANTOM_APP_ID = "f734e0e3-6d52-443b-a710-2b2d53225fe0";

// Site is dark-only — keep the wallet modal deterministically dark. Reading
// next-themes' resolvedTheme here was unreliable: forcedTheme="dark" forces the
// page dark but resolvedTheme still reflects a returning user's stored "light"
// preference, which made the popup render light.
const cuspThemeDark = {
  background: "#0f1512",
  text: "#e8efec",
  secondary: "#96a79f",
  brand: "#1fd184",
  error: "#e13939",
  success: "#1fd184",
  borderRadius: "6px",
  overlay: "#000000cc",
} as const satisfies Partial<PhantomTheme>;

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
      theme={cuspThemeDark}
      appName="Cusp"
    >
      {children}
    </PhantomProvider>
  );
}
