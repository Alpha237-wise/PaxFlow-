"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { requestPasswordReset, signIn, signUp } from "./actions";

type Mode = "signin" | "signup" | "forgot";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const message = searchParams.get("message");

  const heading =
    mode === "signin"
      ? "Sign in"
      : mode === "signup"
        ? "Create an account"
        : "Reset your password";

  const action =
    mode === "signin" ? signIn : mode === "signup" ? signUp : requestPasswordReset;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            PaxFlow
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{heading}</p>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {message}
          </p>
        )}

        <form key={mode} action={action} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Full name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          )}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          {mode !== "forgot" && (
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={6}
                required
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          )}
          <button
            type="submit"
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            {mode === "signin"
              ? "Sign in"
              : mode === "signup"
                ? "Create my account"
                : "Send reset link"}
          </button>
        </form>

        {mode === "signin" && (
          <button
            type="button"
            onClick={() => setMode("forgot")}
            className="w-full text-center text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            Forgot password?
          </button>
        )}

        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "signin" : mode === "forgot" ? "signin" : "signup")}
          className="w-full text-center text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : mode === "forgot"
              ? "Back to sign in"
              : "No account yet? Create one"}
        </button>
      </div>
    </div>
  );
}
