import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { ROUTES } from "@/lib/index";
import { Card } from "@/components/Stats";

export function AuthFormLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl"
            style={{
              background:
                "linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 60%, #7c3aed) 100%)",
              boxShadow: "0 0 20px color-mix(in srgb, var(--primary) 35%, transparent)",
            }}
          >
            <Zap className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            {title}
          </h1>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
            {subtitle}
          </p>
        </div>
        <Card className="p-5">{children}</Card>
        <p className="mt-4 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
          <Link to={ROUTES.LOGIN} className="font-medium hover:underline" style={{ color: "var(--primary)" }}>
            ScrumRadar
          </Link>
        </p>
      </div>
    </div>
  );
}
