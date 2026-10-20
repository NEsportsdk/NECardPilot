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

export const tradeTeamInvitationSubject =
  "Velkommen som Vallective Junior Trade Manager";

export type TradeTeamInvitationEmailProps = {
  inviteUrl: string;
  name: string;
  logoUrl?: string;
};

export default function TradeTeamInvitationEmail({
  inviteUrl,
  name,
  logoUrl = brandAssets.logo.src,
}: TradeTeamInvitationEmailProps) {
  return (
    <Html dir="ltr" lang="da">
      <Tailwind config={tailwindConfig}>
        <Head>
          <title>{tradeTeamInvitationSubject}</title>
        </Head>
        <Body className="m-0 bg-brand-background py-10 font-sans">
          <Preview dir="ltr" lang="da">
            {name}, dit Vallective Trade Desk er klar til dig.
          </Preview>
          <Container
            className="mx-auto max-w-xl rounded-2xl border border-solid border-brand-border bg-brand-surface p-8"
            dir="ltr"
            lang="da"
          >
            <Img
              alt={brandAssets.logo.alt}
              className="mb-6 block"
              height={brandAssets.logo.height}
              src={logoUrl}
              width={brandAssets.logo.width}
            />

            <Text className="m-0 mb-6 text-xs font-bold uppercase tracking-widest text-brand-champagne">
              VALLECTIVE · TEAMINVITATION
            </Text>

            <Heading
              as="h1"
              className="m-0 mb-5 text-3xl font-bold leading-tight text-brand-text"
            >
              Velkommen på holdet, {name}
            </Heading>

            <Text className="my-4 text-base leading-7 text-brand-muted">
              Du er inviteret som Vallective Junior Trade Manager. Din rolle er
              at være med til at drive lager, værdisætning, salg, grading,
              cardshows og indkøb inden for den aftalte budgetramme.
            </Text>

            <Section className="my-6 rounded-xl border border-solid border-brand-border bg-brand-background p-5">
              <Text className="m-0 mb-3 text-sm font-bold text-brand-text">
                To arbejdsrum — ét sikkert login
              </Text>
              <Text className="m-0 mb-2 text-sm leading-6 text-brand-muted">
                <strong>Vallective Business:</strong> virksomhedens lager og
                daglige handelsdrift.
              </Text>
              <Text className="m-0 text-sm leading-6 text-brand-muted">
                <strong>Din PC:</strong> din egen private samling, som du selv
                ejer og styrer uden kortgrænse.
              </Text>
            </Section>

            <Button
              className="box-border block rounded-xl bg-brand-button px-6 py-4 text-center text-base font-bold text-white no-underline"
              href={inviteUrl}
            >
              Opret din Vallective-konto
            </Button>

            <Text className="my-5 text-sm leading-6 text-brand-muted">
              Opret kontoen med den emailadresse, invitationen er sendt til.
              Når du har bekræftet emailen, bliver din teamrolle aktiveret
              automatisk, og Trade Desk åbner.
            </Text>

            <Hr className="my-6 border-solid border-brand-border" />

            <Text className="m-0 text-xs leading-5 text-brand-muted">
              Dette er en personlig invitation til Vallectives interne team.
              Hvis du ikke forventede den, kan du ignorere mailen eller svare
              direkte til os.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

TradeTeamInvitationEmail.PreviewProps = {
  inviteUrl: "https://vallective.com/signup?next=%2Ftrade",
  logoUrl: "http://localhost:3000/icons/vallective-email-mark.png",
  name: "Noah",
} satisfies TradeTeamInvitationEmailProps;
