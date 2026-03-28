import { ConnectBox } from "@phantom/react-sdk";

/**
 * OAuth callback page for Phantom Connect.
 * Phantom redirects here after Google/Apple sign-in. ConnectBox handles the auth handshake.
 */
const AuthCallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <ConnectBox />
  </div>
);

export default AuthCallback;
