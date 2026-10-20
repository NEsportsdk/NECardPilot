import "server-only";

import { render } from "react-email";
import { Resend } from "resend";

import TradeTeamInvitationEmail, {
  tradeTeamInvitationSubject,
} from "@/emails/TradeTeamInvitationEmail";

type SendTradeTeamInvitationInput = {
  email: string;
  idempotencyKey: string;
  inviteUrl: string;
  name: string;
};

export type SendTradeTeamInvitationResult =
  | { emailId: string; ok: true }
  | { errorCode: string; ok: false };

const retryableErrorNames = new Set([
  "api_error",
  "concurrent_idempotent_requests",
  "rate_limit_exceeded",
]);

function configuredValue(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

function configuredSender() {
  const explicitSender = configuredValue("RESEND_FROM_EMAIL");

  if (explicitSender && !/[\r\n]/.test(explicitSender)) {
    return explicitSender;
  }

  const domain = configuredValue("RESEND_EMAIL_DOMAIN")?.toLowerCase();

  if (
    domain &&
    domain.length <= 253 &&
    /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain) &&
    domain.includes(".")
  ) {
    return `Vallective <team@${domain}>`;
  }

  return null;
}

async function pause(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function sendTradeTeamInvitation({
  email,
  idempotencyKey,
  inviteUrl,
  name,
}: SendTradeTeamInvitationInput): Promise<SendTradeTeamInvitationResult> {
  const apiKey = configuredValue("RESEND_API_KEY");
  const from = configuredSender();
  const replyTo = configuredValue("RESEND_REPLY_TO_EMAIL");

  if (!apiKey) {
    return { errorCode: "missing_api_key", ok: false };
  }

  if (!from) {
    return { errorCode: "missing_from_email", ok: false };
  }

  if (!replyTo || /[\r\n]/.test(replyTo)) {
    return { errorCode: "missing_reply_to_email", ok: false };
  }

  const emailComponent = (
    <TradeTeamInvitationEmail inviteUrl={inviteUrl} name={name} />
  );
  const [html, text] = await Promise.all([
    render(emailComponent),
    render(emailComponent, { plainText: true }),
  ]);
  const resend = new Resend(apiKey);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await resend.emails.send(
      {
        from,
        html,
        replyTo,
        subject: tradeTeamInvitationSubject,
        text,
        to: [email],
      },
      { idempotencyKey }
    );

    if (!error && data?.id) {
      return { emailId: data.id, ok: true };
    }

    const errorCode = error?.name ?? "unknown_email_error";

    if (!retryableErrorNames.has(errorCode) || attempt === 2) {
      return { errorCode, ok: false };
    }

    await pause(500 * 2 ** attempt);
  }

  return { errorCode: "unknown_email_error", ok: false };
}
