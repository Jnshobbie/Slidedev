"use client";

import { Navbar } from "@/modules/home/ui/components/navbar";

interface Props {
  children: React.ReactNode;
}

const Layout = ({ children }: Props) => {
  return (
    <main className="flex flex-col min-h-screen relative overflow-x-hidden">
      <Navbar />

      {/* Grainy blue background */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: `
            linear-gradient(180deg, #191919 0%, #2C4365 40%, #4466A7 100%),
            url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=")
          `,
          backgroundRepeat: "repeat",
          opacity: 1.50, // subtle grain
        }}
      />

      <div className="flex-1 flex flex-col px-4 pb-4 z-0">{children}</div>
    </main>
  );
};

export default Layout;
