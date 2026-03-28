import Navbar from "./Navbar";
import Footer from "./Footer";

interface LayoutProps {
  children: React.ReactNode;
  showFooter?: boolean;
}

const Layout = ({ children, showFooter = true }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-bg-0 flex flex-col">
      <Navbar />
      <main className="flex-1 pt-14">{children}</main>
      {showFooter && <Footer />}
    </div>
  );
};

export default Layout;
