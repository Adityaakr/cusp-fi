import Navbar from "./Navbar";
import Footer from "./Footer";

interface LayoutProps {
  children: React.ReactNode;
  showFooter?: boolean;
  /** Let content sit flush under the fixed navbar (e.g. a full-bleed plasma hero). */
  fullBleed?: boolean;
}

const Layout = ({ children, showFooter = true, fullBleed = false }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-bg-0 flex flex-col">
      <Navbar />
      <main className={`flex-1 ${fullBleed ? "" : "pt-20"}`}>{children}</main>
      {showFooter && <Footer />}
    </div>
  );
};

export default Layout;
