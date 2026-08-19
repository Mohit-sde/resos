"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {getPostLoginDestination} from "@/lib/routing/routing";

// Match the redirects to your actual route structure
const ROLE_REDIRECTS = {
  root_admin: "/root-admin",
  restaurant_admin: "/restaurant-admin",
  restaurant_manager: "/restaurant-manager",
  customer: "/menu",
  user: "/menu",
};

export default function LoginPage() {
  const {
    appUser,
    loading: authLoading,
    login,
    signup,
    loginWithGoogle,
    resetPassword,
  } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirect based on role once auth is settled
useEffect(() => {
  if (!authLoading && appUser) {
    const destination = getPostLoginDestination(appUser);
    router.push(destination);
  }
}, [authLoading, appUser, router]);

  const resetMessages = () => {
    setError(null);
    setInfoMessage(null);
  };

  const handleGoogleSignIn = async () => {
    resetMessages();
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(mapAuthError(err?.code));
    } finally {
      setSubmitting(false);
    }
  };

  const validateSignupFields = () => {
    if (password.length < 6) {
      setError("Password should be at least 6 characters.");
      return false;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }
    return true;
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    if (mode === "signup" && !validateSignupFields()) return;

    setSubmitting(true);
    try {
      if (mode === "signin") {
        await login(email, password);
      } else if (mode === "signup") {
        await signup(email, password, { name });
      } else if (mode === "reset") {
        await resetPassword(email);
        setInfoMessage("Password reset email sent — check your inbox.");
        setSubmitting(false);
        return;
      }
    } catch (err) {
      setError(mapAuthError(err?.code));
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    resetMessages();
    setPassword("");
    setConfirmPassword("");
  };

  const busy = submitting || authLoading;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-semibold">
          {mode === "signin" && "Sign in"}
          {mode === "signup" && "Create an account"}
          {mode === "reset" && "Reset your password"}
        </h1>

        {error && (
          <p className="mb-4 text-center text-sm text-red-500">{error}</p>
        )}
        {infoMessage && (
          <p className="mb-4 text-center text-sm text-green-600">{infoMessage}</p>
        )}

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />

          {mode !== "reset" && (
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 text-sm focus:border-gray-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          )}

          {mode === "signup" && (
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          )}

          {mode === "signin" && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => switchMode("reset")}
                className="text-xs font-medium text-gray-500 hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {busy
              ? "Please wait..."
              : mode === "signin"
              ? "Sign in"
              : mode === "signup"
              ? "Sign up"
              : "Send reset email"}
          </button>
        </form>

        {mode !== "reset" && (
          <>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">OR</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.6 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.5 18.9 12 24 12c3.1 0 5.9 1.1 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.4l-6.3-5.3C29.3 34.9 26.8 36 24 36c-5.4 0-9.9-3.4-11.5-8.2l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 3-3 5.4-5.6 6.9l6.3 5.3C39.9 37.5 44 31.5 44 24c0-1.3-.1-2.7-.4-3.5z"/>
              </svg>
              {busy ? "Please wait..." : "Continue with Google"}
            </button>
          </>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          {mode === "signin" && (
            <>
              Don&apos;t have an account?{" "}
              <button type="button" onClick={() => switchMode("signup")} className="font-medium text-gray-900 hover:underline">
                Sign up
              </button>
            </>
          )}
          {mode === "signup" && (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => switchMode("signin")} className="font-medium text-gray-900 hover:underline">
                Sign in
              </button>
            </>
          )}
          {mode === "reset" && (
            <>
              Remembered your password?{" "}
              <button type="button" onClick={() => switchMode("signin")} className="font-medium text-gray-900 hover:underline">
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function mapAuthError(code) {
  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-not-found":
      return "No account found with entered email. Try Signing up!";
    case "auth/wrong-password":
      return "Incorrect password. Try Again!";
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with that email already exists.";
    case "auth/weak-password":
      return "Password requires minimum 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/popup-closed-by-user":
      return "Google sign-in interrupted. Try again!";
    default:
      return "Something went wrong. Please try again.";
  }
}