/**
 * Reads a required server-side env var, failing loudly instead of sending
 * `undefined` to Meta/OpenRouter and debugging a confusing 400 later.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`
    );
  }
  return value;
}

export function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}
