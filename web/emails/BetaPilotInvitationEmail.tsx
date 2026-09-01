import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from "react-email";

import tailwindConfig, { brandAssets } from "@/emails/tailwind.config";

export const betaPilotInvitationSubject =
  "Your Vallective private beta invitation";

export type BetaPilotInvitationEmailProps = {
  inviteUrl: string;
  logoUrl?: string;
};

export default function BetaPilotInvitationEmail({
  inviteUrl,
  logoUrl = brandAssets.logo.src,
}: BetaPilotInvitationEmailProps) {
  return (
    <Html dir="ltr" lang="en">
      <Tailwind config={tailwindConfig}>
        <Head>
          <title>{betaPilotInvitationSubject}</title>
        </Head>
        <Body className="m-0 bg-brand-background py-10 font-sans">
          <Preview dir="ltr" lang="en">
            Join the guided Vallective pilot and help shape the collector
            experience.
          </Preview>
          <Container
            className="mx-auto max-w-xl rounded-2xl border border-solid border-brand-border bg-brand-surface p-8"
            dir="ltr"
            lang="en"
          >
            <Img
              alt={brandAssets.logo.alt}
              className="mb-6 block"
              height={brandAssets.logo.height}
              src={logoUrl}
              width={brandAssets.logo.width}
            />

            <Text className="m-0 mb-6 text-xs font-bold uppercase tracking-widest text-brand-champagne">
              VALLECTIVE · PRIVATE BETA
            </Text>

            <Heading
              as="h1"
              className="m-0 mb-5 text-3xl font-bold leading-tight text-brand-text"
            >
              Build the collector app with us
            </Heading>

            <Text className="my-4 text-base leading-7 text-brand-muted">
              You are invited to a small, guided Vallective pilot. You will test
              the real collector journey—from account setup and scanning to
              collection intelligence, sales and the installed app experience.
            </Text>

            <Section className="my-6 rounded-xl border border-solid border-brand-border bg-brand-background p-5">
              <Text className="m-0 mb-2 text-sm font-bold text-brand-text">
                What we ask from you
              </Text>
              <Text className="m-0 text-sm leading-6 text-brand-muted">
                Complete the 10-step pilot on your own device and send one clear
                report wherever something feels slow, unclear or broken.
              </Text>
            </Section>

            <Button
              className="box-border block rounded-xl bg-brand-button px-6 py-4 text-center text-base font-bold text-white no-underline"
              href={inviteUrl}
            >
              Start the Vallective pilot
            </Button>

            <Text className="my-5 text-sm leading-6 text-brand-muted">
              The button opens secure account creation. After confirming your
              email, sign in and open the Beta pilot from Vallective navigation.
            </Text>

            <Hr className="my-6 border-solid border-brand-border" />

            <Text className="m-0 text-xs leading-5 text-brand-muted">
              This is a one-to-one pilot invitation you were expected to
              receive. If that does not sound right, you can ignore this email
              or reply and let us know.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

BetaPilotInvitationEmail.PreviewProps = {
  inviteUrl: "https://vallective.com/signup?next=%2Fbeta",
  logoUrl: "http://localhost:3000/icons/vallective-email-mark.png",
} satisfies BetaPilotInvitationEmailProps;
