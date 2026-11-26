"use client";
import { SubmitButton, useFakeSubmit } from "./SubmitButton";
import s from "./ChangelogHero.module.css";

/** Subscribe Form (mjKz6rV9p): form, no backend. Submit shows Pending, then Success. */
export function SubscribeForm() {
  const { state, onSubmit } = useFakeSubmit();
  return (
    <form className={s.form} onSubmit={onSubmit} data-framer-name="Subscribe Form">
      <input
        className={s.input}
        type="email"
        name="email"
        required
        placeholder="you@example.com"
        aria-label="Email"
        autoComplete="email"
      />
      <SubmitButton label="Subscribe" state={state} />
    </form>
  );
}
