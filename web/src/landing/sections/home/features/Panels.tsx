import { ScrollLift } from "../../../components/ScrollLift";
import { Icon } from "../hero/icons";
import s from "./HomeFeatures.module.css";
import { bnb } from "../../../components/Bnb";

/* The four product panels of the Home "Features" section. Each panel carries the template's
   styleTransformEffect: in view (viewport end), spring stiffness 500 damping 60 mass 1, from y 40px scale 0.98.
   Every number is from docs/DESIGN.md; sources in docs/landing/content/home-a.md. */

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");
type Tone = "accent" | "text" | "text2" | "border" | "danger";

function Dot({ tone, size = 7 }: { tone: Tone; size?: 6 | 7 }) {
  return <span className={cx(size === 7 ? s.dot7 : s.dot6, s[`bg_${tone}`])} />;
}

/* 1. Raise with refunds: "Requests" inbox -> commitments (DESIGN.md "Where the money goes: a worked example") */
const commitments: {
  amount: string;
  up: boolean;
  iconTone: "accent" | "text2";
  title: string;
  detail: string;
  where: string;
  status: string;
  tone: Tone;
}[] = [
  { amount: "1,400", up: true, iconTone: "accent", title: "Committed by buyers", detail: "2.8x oversubscribed against a 500 BNB cap", where: "Buyers", status: "Committed", tone: "text" },
  { amount: "500", up: true, iconTone: "text2", title: "Accepted into the sale", detail: "The cap, filled pro rata", where: "Sale", status: "Accepted", tone: "accent" },
  { amount: "900", up: false, iconTone: "text2", title: "Refunded pro rata", detail: "Each buyer keeps 35.7% of their commitment", where: "Buyers", status: "Refunded", tone: "border" },
  { amount: "125", up: true, iconTone: "accent", title: "Seeds the PancakeSwap pool", detail: "With 150M tokens, so it opens at the sale price", where: "Pool", status: "Seeded", tone: "accent" },
  { amount: "375", up: true, iconTone: "text2", title: "Forwarded to the vault", detail: "The treasury, held under the five rules", where: "Vault", status: "Held", tone: "text" },
];

export function RaisePanel() {
  return (
    <ScrollLift y={40} scale={0.98} className={s.panelRaise}>
      <div className={s.inbox}>
        <div className={s.inboxHeader}>
          <Icon name="tray" size={16} className={s.iconText} />
          <p className="t-label">Commitments</p>
          <span className={s.spacer} />
          <span className={cx(s.filter, s.filterOn)}>
            <span className="t-small c-bg">Committed {" "}1,400</span>
          </span>
          <span className={s.filter}>
            <span className="t-small c-text-2">Accepted {" "}500</span>
          </span>
          <span className={s.filter}>
            <span className="t-small c-text-2">Refunded {" "}900</span>
          </span>
        </div>
        {commitments.map((r) => (
          <div key={r.title} className={s.request}>
            <div className={s.votes}>
              <Icon name={r.up ? "caretUp" : "caretDown"} size={12} className={r.iconTone === "accent" ? s.iconAccent : s.iconMuted} />
              <span className="t-small">{bnb(r.amount)}</span>
            </div>
            <div className={s.requestText}>
              <p className={cx("t-label", s.trunc)}>{bnb(r.title)}</p>
              <p className={cx("t-small", "c-text-2", s.trunc)}>{bnb(r.detail)}</p>
            </div>
            <span className={s.source}>
              <span className="t-small c-text-2">{bnb(r.where)}</span>
            </span>
            <div className={s.status110}>
              <Dot tone={r.tone} />
              <span className="t-small">{bnb(r.status)}</span>
            </div>
          </div>
        ))}
      </div>
    </ScrollLift>
  );
}

/* 2. Read the sheet: roadmap board -> rule cards (DESIGN.md "The covenant sheet", "Rule card" table) */
type RuleCard = { title: string; mark: string; owner: string; due: string; fill: number };
const board: { title: string; cards: RuleCard[]; phoneHidden?: boolean }[] = [
  {
    title: "Team",
    cards: [
      /* 4.1 BNB claimable of the 15 BNB month-one cap = 27.3% */
      { title: "Tap", mark: "1", owner: "Accrued", due: "4.1 BNB", fill: 27.3 },
      /* 2x tranche, 11 of 30 trusted days = 36.7% */
      { title: "Performance unlock", mark: "2", owner: "2x", due: "11 of 30", fill: 36.7 },
    ],
  },
  {
    title: "Holders",
    cards: [
      /* streak of 3 days, opens in 1 day 4 hours: 44 of 72 hours = 61.1% */
      { title: "Book-value exit", mark: "3", owner: "Opens in", due: "1d 4h", fill: 61.1 },
      /* last heartbeat 6 of 45 days = 13.3% */
      { title: "Abandonment switch", mark: "4", owner: "Silent for", due: "6 days", fill: 13.3 },
    ],
  },
  {
    title: "Checks",
    phoneHidden: true,
    cards: [
      { title: "Disclosure", mark: "5", owner: "Report in", due: "12 days", fill: 0 },
      { title: "Trust panel", mark: "T", owner: "Atlas", due: "Fresh", fill: 0 },
    ],
  },
];

export function SheetPanel() {
  return (
    <ScrollLift y={40} scale={0.98} className={s.panelSheet}>
      <img
        className={s.plate}
        src="/landing/home/features-roadmap-plate.jpg"
        width={1600}
        height={1066}
        alt="Wind-shaped ripples in pale sand"
        loading="lazy"
      />
      <div className={s.board}>
        {board.map((col) => (
          <div key={col.title} className={cx(s.column, col.phoneHidden && s.phoneHidden)}>
            <div className={s.columnHeader}>
              <p className="t-label">{bnb(col.title)}</p>
              <span className="t-small c-text-2">{bnb(col.cards.length)}</span>
            </div>
            {col.cards.map((c) => (
              <div key={c.title} className={s.ruleCard}>
                <p className="t-label">{bnb(c.title)}</p>
                <div className={s.cardMeta}>
                  <span className={s.avatar20}>
                    <span className="t-small c-bg">{c.mark}</span>
                  </span>
                  <span className={cx("t-small", "c-text-2", s.trunc)}>{bnb(c.owner)}</span>
                  <span className="t-small c-text-2">{bnb(c.due)}</span>
                </div>
                <span className={s.progress4}>
                  {c.fill > 0 ? <span className={s.progress4Fill} style={{ width: `${c.fill}%` }} /> : null}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </ScrollLift>
  );
}

/* 3. Pay the team: "My work" -> team console (DESIGN.md "Rule 1: tap", "Rule 4", "Rule 5", "Screens") */
const tasks: { title: string; area: string; status: string; tone: Tone; due: string; done?: boolean }[] = [
  { title: "Claim the accrued tap", area: "Tap", status: "Claimable", tone: "accent", due: "Now" },
  { title: "Post the period report", area: "Disclosure", status: "Drafting", tone: "text", due: "12 days" },
  { title: "Raise the tap", area: "Tap", status: "Blocked", tone: "danger", due: "Never" },
  { title: "Lower the tap if price nears book", area: "Tap", status: "Optional", tone: "border", due: "Any time" },
  { title: "Heartbeat sent", area: "Heartbeat", status: "Done", tone: "border", due: "Today", done: true },
];

export function TeamPanel() {
  return (
    <ScrollLift y={40} scale={0.98} className={s.panelTeam}>
      <div className={s.workCard}>
        <div className={s.workHeader}>
          <Icon name="checkSquare" size={16} className={s.iconText} />
          <p className={cx("t-label", s.grow)}>Team console</p>
          <span className="t-small c-text-2">Team wallet</span>
        </div>
        {tasks.map((t) => (
          <div key={t.title} className={s.task}>
            <Icon name={t.done ? "checkCircle" : "circle"} size={16} className={t.done ? s.iconAccent : s.iconMuted} />
            <p className={cx("t-label", t.done && "c-text-2", s.trunc)}>{bnb(t.title)}</p>
            <span className={cx(s.source, s.phoneHidden)}>
              <span className="t-small c-text-2">{bnb(t.area)}</span>
            </span>
            <div className={s.status96}>
              <Dot tone={t.tone} />
              <span className="t-small">{bnb(t.status)}</span>
            </div>
            <span className={cx("t-small", "c-text-2", s.phoneHidden)}>{bnb(t.due)}</span>
          </div>
        ))}
      </div>
      <div className={s.trackingSide}>
        <div className={s.blocker}>
          <div className={s.blockerHeader}>
            <Icon name="flag" size={15} className={s.iconText} />
            <p className={cx("t-label", s.grow)}>Blocked by rule</p>
          </div>
          <p className="t-small c-text-2">Nobody can raise the tap in v1. The team can only lower it.</p>
          <span className={s.blockerAction}>
            <span className="t-small c-bg">Lower the tap</span>
          </span>
        </div>
        <div className={s.progressCard}>
          <p className="t-label">Tap cap</p>
          <p className="t-h2">4%</p>
          <span className={s.progress6}>
            <span className={s.progress6Fill} style={{ width: "4%" }} />
          </span>
          <p className="t-small c-text-2">{bnb("of treasury per 30 days · 15 BNB in month one")}</p>
        </div>
      </div>
    </ScrollLift>
  );
}

/* 4. Exit at book: release notes -> exit round redemption (DESIGN.md "Rule 3: book-value exit", worked example) */
const groups: { tag: string; tone: Tone; items: string[] }[] = [
  { tag: "You get", tone: "accent", items: ["2.534 BNB after the 1% fee", "Selling on the pool pays about 2.1 BNB"] },
  { tag: "Your tokens", tone: "text", items: ["Sent to the burn address"] },
  { tag: "Book value", tone: "text2", items: ["Moves from 0.00000042667 to 0.00000042670"] },
];

export function ExitPanel() {
  return (
    <ScrollLift y={40} scale={0.98} className={s.panelExit}>
      <img
        className={s.plate}
        src="/landing/home/features-release-plate.jpg"
        width={1600}
        height={1071}
        alt="White clouds in a blue sky"
        loading="lazy"
      />
      <div className={s.release}>
        <div className={s.releaseHeader}>
          <span className={s.version}>
            <span className="t-small c-text-2">EXIT_ROUND</span>
          </span>
          <span className={cx("t-small", "c-text-2", s.grow)}>Exit round open {" · "}7 days</span>
        </div>
        <p className="t-h4">Redeem 6,000,000 tokens</p>
        {groups.map((g) => (
          <div key={g.tag} className={s.releaseGroup}>
            <div className={s.releaseTag}>
              <Dot tone={g.tone} size={6} />
              <span className="t-small">{bnb(g.tag)}</span>
            </div>
            {g.items.map((it) => (
              <p key={it} className="t-body">
                {"–  "}
                {bnb(it)}
              </p>
            ))}
          </div>
        ))}
      </div>
      <div className={s.toast}>
        <Icon name="checkCircle" size={16} className={s.iconBg} />
        <span className="t-small c-bg">{bnb("Redeemed · 2.534 BNB sent")}</span>
      </div>
    </ScrollLift>
  );
}

