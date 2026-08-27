"use client";

import { useFormStatus } from "react-dom";

import styles from "./AuthCard.module.css";

type AuthSubmitButtonProps = {
  label: string;
  pendingLabel: string;
};

export default function AuthSubmitButton({
  label,
  pendingLabel,
}: AuthSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className={styles.submitButton} type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}
