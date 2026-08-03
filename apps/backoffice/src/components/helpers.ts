// A User has an email and no name column, so the header's name line is derived
// until one exists — record 048.
const localPart = (email: string) => email.split("@")[0] ?? email;

export const displayNameFromEmail = (email: string | undefined): string =>
  email
    ? localPart(email)
        .split(/[._+-]+/)
        .filter(Boolean)
        .map((part) => part[0]!.toUpperCase() + part.slice(1))
        .join(" ")
    : "Account";

export const initialsFromEmail = (email: string | undefined): string =>
  email
    ? displayNameFromEmail(email)
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0]!.toUpperCase())
        .join("")
    : "—";
