import type { ReactNode } from "react";
import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { ScrollLift } from "../../components/ScrollLift";
import s from "./HomeAgentLayer.module.css";
import { bnb } from "../../components/Bnb";

/* Phosphor regular (Framer icon set "Phosphor", width 1.5 = stroke 16 on the 256 grid). */
function Svg({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" stroke="currentColor" strokeWidth={16}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const IconSparkle = () => (
  <Svg>
    <path d="M84.27,171.73l-55.09-20.3a7.92,7.92,0,0,1,0-14.86l55.09-20.3,20.3-55.09a7.92,7.92,0,0,1,14.86,0l20.3,55.09,55.09,20.3a7.92,7.92,0,0,1,0,14.86l-55.09,20.3-20.3,55.09a7.92,7.92,0,0,1-14.86,0Z" />
    <line x1="176" y1="16" x2="176" y2="64" />
    <line x1="224" y1="72" x2="224" y2="104" />
    <line x1="152" y1="40" x2="200" y2="40" />
    <line x1="208" y1="88" x2="240" y2="88" />
  </Svg>
);
const IconChatCircleText = () => (
  <Svg>
    <line x1="96" y1="112" x2="160" y2="112" />
    <line x1="96" y1="144" x2="160" y2="144" />
    <path d="M79.93,211.11a96,96,0,1,0-35-35h0L32.42,213.46a8,8,0,0,0,10.12,10.12l37.39-12.47Z" />
  </Svg>
);
const IconUsers = () => (
  <Svg>
    <circle cx="84" cy="108" r="52" />
    <path d="M10.23,200a88,88,0,0,1,147.54,0" />
    <path d="M172,160a87.93,87.93,0,0,1,73.77,40" />
    <path d="M152.69,59.7A52,52,0,1,1,172,160" />
  </Svg>
);

/** Copy: docs/DESIGN.md "Agent layer" ("Three agent roles", "Issuer agent loop", "Covenant MCP server"). */
const points = [
  { icon: <IconSparkle />, title: "Claims a tap, not the treasury", body: "The agent’s key reaches its accrued budget and nothing else." },
  { icon: <IconChatCircleText />, title: "Reports every period", body: "An LLM writes the report. The rules stay in the vault." },
  { icon: <IconUsers />, title: "Read by other agents", body: "An MCP server lets investor agents price the downside and exit." },
];

const lines = [
  { tag: "Tap", dot: s.dotAccent, text: "Claimed the accrued tap at the Atlas rate, capped at 4% per 30 days." },
  { tag: "Heartbeat", dot: s.dotText, text: "The claim counts as a heartbeat, so the abandonment switch stays shut." },
  { tag: "Revenue", dot: s.dotDanger, text: "Earned revenue goes to the vault and raises book value for every holder." },
];

const calls = ["claimTap()", "heartbeat()", "postReport()"];

/** Framer section "Weekly Update" (b_FQIsQ8W), rebuilt as the agent layer. */
export function HomeAgentLayer() {
  return (
    <Section name="Weekly Update" id="agent-layer" contentClassName={s.content}>
      <div className={s.columns}>
        <div className={s.text}>
          <Eyebrow className={s.fill}>Agent layer</Eyebrow>
          <SplitHeading
            as="h3"
            className={s.fill}
            first="Raise a budget your agent can be held to."
            second="The vault binds an AI issuer the way it binds a human team."
          />
          <div className={s.points}>
            {points.map((p) => (
              <div key={p.title} className={s.point}>
                <div className={s.iconBox}>{p.icon}</div>
                <div className={s.pointText}>
                  <p className="t-label">{bnb(p.title)}</p>
                  <p className="t-body">{bnb(p.body)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={s.visual} role="img" aria-label="Soft iridescent gradient">
          <ScrollLift y={40} scale={0.98} className={s.card}>
            <div className={s.header}>
              <div className={s.avatar}>
                <div className={s.avatarDot} />
              </div>
              <div className={s.meta}>
                <p className={["t-label", s.pre].join(" ")}>Issuer agent  ·  ERC-8004</p>
                <p className="t-small c-text-2">Every few minutes</p>
              </div>
            </div>
            <h4 className={["t-h4", s.fill].join(" ")}>Period report: tap claimed, heartbeat sent</h4>
            {lines.map((l) => (
              <div key={l.tag} className={s.line}>
                <div className={s.tag}>
                  <span className={[s.dot, l.dot].join(" ")} />
                  <p className="t-small">{bnb(l.tag)}</p>
                </div>
                <p className={["t-small c-text-2", s.lineText].join(" ")}>{bnb(l.text)}</p>
              </div>
            ))}
            <div className={s.reactions}>
              {calls.map((c) => (
                <div key={c} className={s.reaction}>
                  <p className="t-small">{bnb(c)}</p>
                </div>
              ))}
            </div>
          </ScrollLift>
        </div>
      </div>
    </Section>
  );
}
