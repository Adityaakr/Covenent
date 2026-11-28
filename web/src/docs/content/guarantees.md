## Fees

Covenant itself charges nothing. Its contracts have no owner, no pause and no fee switch. These are every cost a covenant involves:

| Cost | Who pays it, and where it goes | Default and bounds |
|---|---|---|
| Flap's salt lock fee | The creator, once, at creation; to Flap (the Portal's `SALT_LOCK_FEE`) | Set by Flap; it was 0.005 test BNB when CVD was created on BNB testnet on 27 November 2026 |
| Trading tax | Whoever buys or sells the token on the pool; to the vault treasury, after Flap's protocol fee at Flap's tax processor | 1% on buys and 1% on sells for 100 years; each side at most 10%, the higher at least 1%, for 30 days to 100 years |
| Exit fee | A holder redeeming during an exit round; it stays in the treasury, for the holders who remain | 1%; at most 3% |
| Gas | Whoever sends a transaction; to the network | `finalize()` is sent with a 15,000,000 limit and used about 5.6M on testnet; you pay only what is used |

No fee is taken on commitments, refunds, token claims, the team's budget, or redemption after a covenant has ended.

## What nobody can do

Not the team, not an agent that holds the team wallet, not the deployer, and not Covenant's authors:

- **Raise the budget.** There is no function for it. The only change to any term is `lowerTap`, downwards.
- **Change a term.** The split, the timers, the fee, the team wallet and the agent id are fixed at creation.
- **Move the treasury** anywhere except the team wallet's accrued budget and holders who redeem.
- **Take more than one period's budget.** Unclaimed budget stops growing at the cap share of the treasury, so a stolen team key reaches at most that.
- **Unlock team tokens early.** Only a price held at the multiple, in dollars and in BNB, after the cliff.
- **Block an exit.** Once a round opens, every holder can redeem until it ends. After wind-down, redemption never closes.
- **Keep a silent covenant alive.** Heartbeats count only from the team wallet; nobody else can send one for it.
- **Stop anyone poking, finalizing or declaring abandonment.** Those are open to every wallet.

## The one exception: Flap's Guardian

Flap's Pool Launch spec makes Flap's Guardian the only upgrade authority for every launcher and vault built on it. That is the trust Covenant still needs:

- The Guardian **can** upgrade the vault and launcher logic, which replaces the code that guards the money: the treasury is only as safe as the Guardian. It can also call the team functions (`windDown`, `claimTap` to the fixed team wallet, `lowerTap`, `heartbeat`, `postReport`), as Flap's spec requires.
- Short of an upgrade, it **cannot** count as a heartbeat, raise the budget, change the team wallet or a term, unlock tranches, or send treasury funds anywhere but the team wallet and redeeming holders.

[Security](/docs/security#trust-assumptions) lists the other parties the rules rely on (Atlas, the pool, keepers) and what each can and cannot do.

## Who can do what

| Action | Who |
|---|---|
| Commit, claim tokens, claim a refund | Each buyer, for their own wallet |
| Finalize a raise, poke the oracle, declare abandonment, release unlocked team tokens, deposit revenue, sync revenue | Anyone |
| Redeem at book value | Any holder, during an exit round or after the covenant ends |
| Claim the budget, lower it, heartbeat, post a report, wind down | The team wallet (Flap's Guardian too, but its calls never count as a heartbeat) |
| Record a report verdict | The report relayer named at creation, if any |
| Upgrade the contracts | Flap's Guardian only |
