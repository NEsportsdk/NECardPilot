import { createElement } from "react";
import { render } from "react-email";
import { describe, expect, it } from "vitest";

import BetaPilotInvitationEmail from "@/emails/BetaPilotInvitationEmail";

describe("BetaPilotInvitationEmail", () => {
  it("renders an accessible action and a useful plain-text alternative", async () => {
    const inviteUrl = "https://vallective.com/signup?next=%2Fbeta";
    const component = createElement(BetaPilotInvitationEmail, { inviteUrl });
    const [html, text] = await Promise.all([
      render(component),
      render(component, { plainText: true }),
    ]);

    expect(html).toContain('lang="en"');
    expect(html).toContain("Your Vallective private beta invitation");
    expect(html).toContain("Start the Vallective pilot");
    expect(html).toContain(inviteUrl.replaceAll("&", "&amp;"));
    expect(text).toContain("Start the Vallective pilot");
    expect(text).toContain("one-to-one pilot invitation");
  });
});
