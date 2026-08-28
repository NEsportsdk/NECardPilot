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
      message: "Enter a valid email address.",
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
      message: `Choose a password with at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  if (
    !/\p{Ll}/u.test(password) ||
    !/\p{Lu}/u.test(password) ||
    !/\d/.test(password)
  ) {
    return {
      ok: false,
      message:
        "The password must include uppercase and lowercase letters plus at least one number.",
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
      message: "Enter a name between 2 and 80 characters.",
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
      message: "The passwords don't match.",
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
