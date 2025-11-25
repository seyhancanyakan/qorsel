"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MobileFooter() {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", icon: "🏠", label: "Home" },
    { href: "/profile", icon: "👤", label: "Profile" },
    { href: "/canvas-edit", icon: "🎨", label: "Canvas" },
    { href: "/settings", icon: "⚙️", label: "Settings" },
  ];

  return (
    <>
      {/* Mobile Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 px-4 py-3 flex justify-around items-center z-50">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-orange-500" : "text-gray-400 hover:text-white"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className={`text-[10px] ${isActive ? "font-semibold" : ""}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Spacer for footer */}
      <div className="h-20"></div>
    </>
  );
}
