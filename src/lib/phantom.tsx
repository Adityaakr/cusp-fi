import { PhantomProvider, type PhantomTheme } from "@phantom/react-sdk";
import { AddressType } from "@phantom/browser-sdk";
import { useTheme } from "next-themes";

const PHANTOM_APP_ID = "f734e0e3-6d52-443b-a710-2b2d53225fe0";

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

const cuspThemeLight = {
  background: "#fbfdfc",
  text: "#121f1a",
  secondary: "#5a6b64",
  brand: "#1c8a5b",
  error: "#cc3b3b",
  success: "#1c8a5b",
  borderRadius: "6px",
  overlay: "#0a1410aa",
} as const satisfies Partial<PhantomTheme>;

export function PhantomProviderWrapper({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
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
      theme={resolvedTheme === "light" ? cuspThemeLight : cuspThemeDark}
      appName="Cusp"
    >
      {children}
    </PhantomProvider>
  );
}
