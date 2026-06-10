import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOGO_URL, STORE } from "@/lib/brand";
import { formatApiError, isBackendConfigured } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) nav("/", { replace: true });
  }, [user, nav]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      nav("/", { replace: true });
    } catch (e) {
      if (!isBackendConfigured) {
        setError(
          "App is not connected to the API. Set REACT_APP_BACKEND_URL to your Railway URL and redeploy."
        );
      } else if (e.response?.status === 405) {
        setError(
          "Login reached the frontend host instead of the API. Set REACT_APP_BACKEND_URL to your Railway backend URL (not this Vercel URL) and redeploy."
        );
      } else {
        setError(formatApiError(e.response?.data?.detail) || e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-[var(--ee-bg)]">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm"
        data-testid="login-form"
      >
        <img
          src={LOGO_URL}
          alt={STORE.name}
          className="w-56 h-20 mx-auto object-cover object-center mb-6"
        />

        <div className="space-y-4">
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
              Email
            </Label>
            <Input
              data-testid="login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@elegantexchange.co"
              type="email"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
              Password
            </Label>
            <Input
              data-testid="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              className="mt-1"
            />
          </div>
          {error ? (
            <div
              data-testid="login-error"
              className="text-sm rounded-md px-3 py-2"
              style={{
                background: "var(--ee-error-bg)",
                color: "#8a1f1f",
              }}
            >
              {error}
            </div>
          ) : null}
          <Button
            data-testid="login-submit"
            type="submit"
            disabled={loading}
            className="w-full ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white py-5"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              "Sign In"
            )}
          </Button>
        </div>
        <div className="text-center mt-10 text-[10px] tracking-[0.28em] uppercase text-[var(--ee-magenta)] font-semibold">
          For Internal Use Only
        </div>
      </form>
    </div>
  );
}
