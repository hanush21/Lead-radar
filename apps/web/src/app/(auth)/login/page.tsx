"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRegistered(params.get("registered") === "true");
    setResetSuccess(params.get("reset") === "success");
    const authError = params.get("error");
    if (authError === "Configuration") {
      setError("La autenticacion no esta bien configurada en produccion. Revisa NEXTAUTH/AUTH URL y SECRET.");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const callbackFromQuery =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("callbackUrl")
        : null;
    const callbackUrl =
      callbackFromQuery && callbackFromQuery.startsWith("/") && !callbackFromQuery.startsWith("//")
        ? callbackFromQuery
        : "/search";

    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl,
      });

      setLoading(false);

      if (result?.error) {
        setError(
          result.error === "CredentialsSignin"
            ? "Email o contrasena incorrectos"
            : "No se pudo iniciar sesion. Intenta de nuevo en unos segundos."
        );
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setLoading(false);
      setError("No se pudo iniciar sesion. Intenta de nuevo en unos segundos.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 px-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Iniciar Sesion</CardTitle>
          <CardDescription>Accede a tu cuenta de LeadRadar</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {registered ? (
            <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
              Cuenta creada correctamente. Revisa tu correo para ver el mensaje de bienvenida.
            </div>
          ) : null}

          {resetSuccess ? (
            <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
              Contrasena actualizada. Ya puedes iniciar sesion.
            </div>
          ) : null}

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contrasena</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="********"
              />
            </div>

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                He olvidado mi contrasena
              </Link>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            No tienes cuenta?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Registrate
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
