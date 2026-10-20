import { createElement } from "react";
import { render } from "react-email";
import { describe, expect, it } from "vitest";

import TradeTeamInvitationEmail from "@/emails/TradeTeamInvitationEmail";

describe("TradeTeamInvitationEmail", () => {
  it("renders an accessible Danish invitation and plain-text alternative", async () => {
    const inviteUrl = "https://vallective.com/signup?next=%2Ftrade";
    const component = createElement(TradeTeamInvitationEmail, {
      inviteUrl,
      name: "Noah",
    });
    const [html, text] = await Promise.all([
      render(component),
      render(component, { plainText: true }),
    ]);

    expect(html).toContain('lang="da"');
    expect(html).toContain("Velkommen som Vallective Junior Trade Manager");
    expect(html).toContain('alt="Vallective"');
    expect(html).toContain("Opret din Vallective-konto");
    expect(html).toContain(inviteUrl.replaceAll("&", "&amp;"));
    expect(text).toContain("Vallective Business");
    expect(text).toContain("uden kortgrænse");
  });
});
