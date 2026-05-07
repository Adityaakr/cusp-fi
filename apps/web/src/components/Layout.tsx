import Navbar from "./Navbar";
import Footer from "./Footer";
import { QvacProvider } from "@/components/qvac/QvacProvider";
import QvacPanel from "@/components/qvac/QvacPanel";

interface LayoutProps {
  children: React.ReactNode;
  showFooter?: boolean;
}

const Layout = ({ children, showFooter = true }: LayoutProps) => {
  return (
    <QvacProvider>
      <div className="min-h-screen bg-bg-0 flex flex-col">
        <Navbar />
        <main className="flex-1 pt-14">{children}</main>
        {showFooter && <Footer />}
      </div>
      <QvacPanel />
    </QvacProvider>
  );
};

export default Layout;