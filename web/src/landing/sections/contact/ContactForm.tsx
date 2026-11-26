"use client";
import { ScrollLift } from "../../components/ScrollLift";
import { SubmitButton, useFakeSubmit } from "../changelog/SubmitButton";
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
              <svg className={s.caret} width="12" height="12" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
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
