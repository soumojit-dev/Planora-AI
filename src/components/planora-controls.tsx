
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FileDown, Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "planora-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export default function PlanoraControls() {
  const pathname = usePathname();

  const [theme, setTheme] = useState<Theme>("light");
  const [hasPlan, setHasPlan] = useState(false);

  // Restore the saved theme on every application route.
  useEffect(() => {
    let initialTheme: Theme = "light";

    try {
      initialTheme =
        window.localStorage.getItem(THEME_STORAGE_KEY) === "dark"
          ? "dark"
          : "light";
    } catch {
      // If storage is unavailable, use light mode for this session.
    }

    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  // Show PDF export only when a generated plan is present on the AI page.
  useEffect(() => {
    if (pathname !== "/ai-planner") {
      setHasPlan(false);
      return;
    }

    const updatePlanAvailability = () => {
      setHasPlan(Boolean(document.getElementById("ai-plan-print-area")));
    };

    updatePlanAvailability();

    const observer = new MutationObserver(updatePlanAvailability);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [pathname]);

  function toggleTheme() {
    const nextTheme: Theme = theme === "light" ? "dark" : "light";

    setTheme(nextTheme);
    applyTheme(nextTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The current page still changes theme if storage is unavailable.
    }
  }

  function savePlanAsPDF() {
    if (!document.getElementById("ai-plan-print-area")) {
      return;
    }

    window.print();
  }

  return (
    <div className="planora-floating-controls fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-2xl border border-[#DDE3D8] bg-white/95 p-2 shadow-lg backdrop-blur-md">
      {pathname === "/ai-planner" && hasPlan && (
        <button
          type="button"
          onClick={savePlanAsPDF}
          className="inline-flex items-center gap-2 rounded-xl bg-[#172922] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#294438]"
          title="Print the generated AI plan or save it as a PDF"
        >
          <FileDown size={17} />
          <span>Save as PDF</span>
        </button>
      )}

      <button
        type="button"
        onClick={toggleTheme}
        aria-label={
          theme === "light" ? "Switch to dark mode" : "Switch to light mode"
        }
        title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        className="inline-flex items-center gap-2 rounded-xl border border-[#DDE3D8] bg-white px-3 py-2.5 text-sm font-semibold text-[#26392B] transition hover:bg-[#F0F4E8]"
      >
        {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
        <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
      </button>
    </div>
  );
}
