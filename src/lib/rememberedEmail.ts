// The last email signed in with on this device, so the sign-in form can fill
// it in. Kept in the browser only; nothing is sent anywhere.
const KEY = "flixtally:last-email";

export function readRememberedEmail(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberEmail(email: string): void {
  try {
    localStorage.setItem(KEY, email.trim());
  } catch {
    // Private mode or storage blocked: the form just starts empty next time.
  }
}
