import { renderAuthEmail, renderAuthEmailText } from "./template";

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}

export function passwordResetEmail(link: string): EmailMessage {
  const heading = "Reset your password";
  const paragraphs = [
    "We got a request to reset the password on your FounderOS account.",
    "Click the button below to choose a new one. This link expires in 1 hour.",
  ];
  return {
    subject: "Reset your FounderOS password",
    html: renderAuthEmail({
      preheader: "Reset your FounderOS password",
      heading,
      paragraphs,
      buttonLabel: "Reset password",
      buttonUrl: link,
    }),
    text: renderAuthEmailText({ heading, paragraphs, buttonUrl: link }),
  };
}

export function verifyEmailEmail(link: string): EmailMessage {
  const heading = "Confirm your email address";
  const paragraphs = [
    "Thanks for creating a FounderOS account - one more step.",
    "Click the button below to verify your email address and finish setting up your workspace.",
  ];
  return {
    subject: "Confirm your email for FounderOS",
    html: renderAuthEmail({
      preheader: "Confirm your email to finish setting up FounderOS",
      heading,
      paragraphs,
      buttonLabel: "Verify email",
      buttonUrl: link,
      footnote: "If you didn't create a FounderOS account, you can ignore this email.",
    }),
    text: renderAuthEmailText({ heading, paragraphs, buttonUrl: link }),
  };
}

export function emailChangedNotice(oldEmail: string, link: string): EmailMessage {
  const heading = "Your account email is changing";
  const paragraphs = [
    `Someone requested to change the email on your FounderOS account away from ${oldEmail}.`,
    "If this was you, no action is needed. If it wasn't, click below to undo the change and secure your account.",
  ];
  return {
    subject: "Your FounderOS account email is changing",
    html: renderAuthEmail({
      preheader: "Your FounderOS account email is changing",
      heading,
      paragraphs,
      buttonLabel: "Undo this change",
      buttonUrl: link,
      footnote: "If you made this change yourself, you can safely ignore this email.",
    }),
    text: renderAuthEmailText({ heading, paragraphs, buttonUrl: link }),
  };
}
