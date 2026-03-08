import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center space-y-6 px-4">
        <div className="flex items-center justify-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-2xl text-white font-bold">⬡</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            LeadRadar
          </h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          Sistema de captación inteligente de leads locales con análisis de
          oportunidades digitales.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            Iniciar Sesión
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Registrarse
          </Link>
        </div>
      </div>
    </div>
  );
}
