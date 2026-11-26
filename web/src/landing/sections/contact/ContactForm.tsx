"use client";
import { ScrollLift } from "../../components/ScrollLift";
import { SubmitButton, useFakeSubmit } from "./SubmitButton";
import s from "./ContactMain.module.css";

const roles = ["Team", "Buyer", "Launchpad", "Agent builder"];

/** Contact Form Card (D7UHLL426) + Contact Form (edrBpjcZA). No backend: Pending, then Success. */
export function ContactForm() {
  const { state, onSubmit } = useFakeSubmit();
  return (
    <ScrollLift className={s.card}>
      <form className={s.form} onSubmit={onSubmit} data-framer-name="Contact Form">
        <div className={s.row}>
          <label className={s.field}>
            <span className="t-label">Name</span>
            <input className={s.input} type="text" name="name" required placeholder="Your name" autoComplete="name" />
          </label>
          <label className={s.field}>
            <span className="t-label">Email</span>
            <input className={s.input} type="email" name="email" required placeholder="you@example.com" autoComplete="email" />
          </label>
        </div>
        <div className={s.row}>
          <label className={s.field}>
            <span className="t-label">Project</span>
            <input className={s.input} type="text" name="project" required placeholder="Project or token name" />
          </label>
          <label className={s.field}>
            <span className="t-label">You are</span>
            <span className={s.selectWrap}>
              <select className={[s.input, s.select].join(" ")} name="role" defaultValue={roles[0]}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {/* Framer's select chevron: a 16px mask, path M3.5 6 L8 10.5 L12.5 6, stroke 1.5, Text Secondary. */}
              <svg className={s.caret} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.5 6L8 10.5L12.5 6" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </label>
        </div>
        <label className={[s.field, s.fieldFull].join(" ")}>
          <span className="t-label">What are you raising for?</span>
          <textarea
            className={[s.input, s.textarea].join(" ")}
            name="message"
            required
            placeholder="An agent that pays for its own compute, a game, a launchpad…"
          />
        </label>
        <SubmitButton label="Send message" state={state} className={s.submit} />
        <p className={["t-small c-text-2", s.fieldFull].join(" ")}>
          This testnet build has no backend. Nothing you type leaves your browser.
        </p>
      </form>
    </ScrollLift>
  );
}
