# HUMAN: stand up the security@uwmd.org alias

**Why you, why now.** [`SECURITY.md`](../../SECURITY.md) promises
acknowledgement of vulnerability reports sent to **security@uwmd.org**
within 5 business days. The launch-readiness review flagged that this
routes to a personal address (or nowhere) — only the owner of the
`uwmd.org` domain can create the alias and its forwarding. No agent can
do DNS or mailbox configuration.

## The step (~10 minutes, at your domain/email provider)

1. At the registrar or email provider for `uwmd.org`, create a
   forwarding alias **security@uwmd.org** → an inbox you actually read.
   (Vercel hosts the site but not email; forwarding lives wherever the
   domain's MX records point. If no MX exists yet, most registrars offer
   free email forwarding — enabling it adds the MX records for you.)
2. Send a test email to security@uwmd.org with subject
   `[uwmd-security] test` and confirm it arrives.
3. Optional hardening, recommended: add an SPF record if the forwarder
   asks for one, and set a calendar reminder or filter so
   `[uwmd-security]` mail is never missed — the 5-business-day
   acknowledgement in SECURITY.md is a published commitment.

## When done

- Reply-test passed and the alias is monitored.
- Delete this file in a PR that notes the alias is live (the status
  doc's "personal security email" flag comes off in the same PR).
