export const MIN_PASSWORD_LENGTH = 12;

type ValidationSuccess<T> = {
  ok: true;
  data: T;
};

type ValidationFailure = {
  ok: false;
  message: string;
};

export type ValidationResult<T> =
  | ValidationSuccess<T>
  | ValidationFailure;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function validateEmail(value: unknown): ValidationResult<string> {
  const email = normalizeEmail(value);

  if (!email || !EMAIL_PATTERN.test(email) || email.length > 254) {
    return {
      ok: false,
      message: "Indtast en gyldig e-mailadresse.",
    };
  }

  return {
    ok: true,
    data: email,
  };
}

export function validatePassword(password: unknown): ValidationResult<string> {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `Vælg en adgangskode på mindst ${MIN_PASSWORD_LENGTH} tegn.`,
    };
  }

  if (
    !/[a-zæøå]/.test(password) ||
    !/[A-ZÆØÅ]/.test(password) ||
    !/\d/.test(password)
  ) {
    return {
      ok: false,
      message:
        "Adgangskoden skal indeholde små og store bogstaver samt mindst ét tal.",
    };
  }

  return {
    ok: true,
    data: password,
  };
}

export function validateSignupInput(input: {
  displayName: unknown;
  email: unknown;
  password: unknown;
  confirmPassword: unknown;
}): ValidationResult<{
  displayName: string;
  email: string;
  password: string;
}> {
  const displayName =
    typeof input.displayName === "string" ? input.displayName.trim() : "";

  if (displayName.length < 2 || displayName.length > 80) {
    return {
      ok: false,
      message: "Skriv dit navn med mellem 2 og 80 tegn.",
    };
  }

  const emailResult = validateEmail(input.email);

  if (!emailResult.ok) {
    return emailResult;
  }

  const passwordResult = validatePassword(input.password);

  if (!passwordResult.ok) {
    return passwordResult;
  }

  if (
    typeof input.confirmPassword !== "string" ||
    input.confirmPassword !== passwordResult.data
  ) {
    return {
      ok: false,
      message: "De to adgangskoder er ikke ens.",
    };
  }

  return {
    ok: true,
    data: {
      displayName,
      email: emailResult.data,
      password: passwordResult.data,
    },
  };
}
