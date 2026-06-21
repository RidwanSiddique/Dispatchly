import { Form, redirect, useActionData, useNavigation } from 'react-router-dom';

export async function loginAction({ request }) {
  const formData = await request.formData();
  const email = formData.get('email');
  const password = formData.get('password');
  const from = formData.get('from') || '/';

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Login failed' }));
    return { error };
  }

  return redirect(from);
}

export default function LoginPage() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  // Preserve the redirect destination through the form
  const from =
    new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('from') ||
    '/';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <svg className="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-2xl font-bold text-gray-900">Dispatchly</span>
          </div>
          <p className="text-sm text-gray-500">IT Help Desk — Sign in to your account</p>
        </div>

        <div className="card p-6">
          <Form method="post" noValidate>
            <input type="hidden" name="from" value={from} />

            {actionData?.error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {actionData.error}
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="email" className="label">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input"
                placeholder="you@example.com"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary w-full justify-center"
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </Form>
        </div>

        {/* Dev hint */}
        {import.meta.env.DEV && (
          <div className="mt-6 card p-4 text-xs text-gray-500">
            <p className="font-medium text-gray-600 mb-2">Demo accounts (password: password123)</p>
            <div className="grid grid-cols-2 gap-1">
              {[
                ['admin@dispatchly.com', 'Admin'],
                ['manager@dispatchly.com', 'Manager'],
                ['agent@dispatchly.com', 'Agent'],
                ['tech@dispatchly.com', 'Technician'],
                ['specialist@dispatchly.com', 'Specialist'],
                ['hr@dispatchly.com', 'HR'],
                ['client@dispatchly.com', 'Client'],
              ].map(([email, label]) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => {
                    document.getElementById('email').value = email;
                    document.getElementById('password').value = 'password123';
                  }}
                  className="text-left text-blue-600 hover:underline"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
