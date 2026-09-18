"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { login } from "@/services/auth.service";
import { ThemeToggle } from "@/components/ThemeToggle";

interface FormValues {
  username: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({ defaultValues: { username: "admin", password: "" } });

  const onSubmit = handleSubmit(async ({ username, password }) => {
    setError(false);
    try {
      await login(username, password);
      router.push("/monitoreo");
      router.refresh();
    } catch {
      setError(true);
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-5">
      <div className="fixed right-5 top-5">
        <ThemeToggle />
      </div>

      <div className="animate-shell-rise w-full max-w-[360px] rounded-3xl border border-border bg-bg2 p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          <div className="text-lg font-semibold tracking-[-0.02em]">Infraestructura</div>
        </div>
        <p className="mb-6 text-[13px] leading-relaxed tracking-[-0.01em] text-muted">
          Ingresa tus credenciales para continuar
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className="mb-1.5 block text-xs font-medium tracking-[-0.008em] text-muted">Usuario</label>
            <input
              type="text"
              autoComplete="username"
              autoFocus
              className="w-full rounded-xl border border-border bg-bg3 px-3 py-2.5 text-sm text-text outline-none transition-colors focus:border-accent"
              {...register("username", { required: true })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium tracking-[-0.008em] text-muted">Contraseña</label>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-border bg-bg3 px-3 py-2.5 text-sm text-text outline-none transition-colors focus:border-accent"
              {...register("password", { required: true })}
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1.5 h-[42px] rounded-full bg-nav-bg text-sm font-medium tracking-[-0.008em] text-nav-ink transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? "Entrando…" : "Entrar"}
          </button>
          {error && <div className="mt-1 text-[12.5px] text-red">Usuario o contraseña incorrectos.</div>}
        </form>
      </div>
    </div>
  );
}
