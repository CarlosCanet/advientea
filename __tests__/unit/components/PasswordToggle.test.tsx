import type { ComponentProps, ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import SignInForm from "@/components/SignInForm";
import SignUpForm from "@/components/SignUpForm";

vi.mock("@/app/actions/authActions", async () => {
  const types = await vi.importActual<typeof import("@/lib/types")>("@/lib/types");
  return {
    signin: vi.fn(async () => types.initialSignInActionResponse),
    signout: vi.fn(async () => undefined),
    signup: vi.fn(async () => types.initialSignUpActionResponse),
  };
});

// next/form prefetches through the app router, which jsdom does not provide; a plain form keeps the action.
vi.mock("next/form", () => ({
  default: ({
    children,
    ...props
  }: ComponentProps<"form"> & { children?: ReactNode; prefetch?: boolean; replace?: boolean; scroll?: boolean }) => {
    const formProps = Object.fromEntries(
      Object.entries(props).filter(([key]) => !["prefetch", "replace", "scroll"].includes(key)),
    );
    return <form {...formProps}>{children}</form>;
  },
}));

// In case the forms redirect or read the query string after submitting: there is no app router in jsdom.
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  usePathname: () => "/",
  useRouter: () => ({ back: vi.fn(), prefetch: vi.fn(), push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const SHOW_PASSWORD = "Mostrar contraseña";

/** The password input, by its label when it reads exactly "Contraseña", otherwise by its field name. */
function passwordInput(container: HTMLElement): HTMLInputElement {
  const byLabel = screen.queryAllByLabelText("Contraseña", { selector: "input" });
  const labelled = byLabel.find((input) => input.getAttribute("name") === "password") ?? byLabel[0];
  if (labelled) {
    return labelled as HTMLInputElement;
  }
  const byName = container.querySelector<HTMLInputElement>('input[name="password"]');
  if (!byName) {
    throw new Error('No password input (label "Contraseña" or name="password")');
  }
  return byName;
}

function confirmationInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[name="passwordConfirmation"]');
  if (!input) {
    throw new Error('No input with name="passwordConfirmation"');
  }
  return input;
}

function linkHrefs(): Array<null | string> {
  return screen.queryAllByRole("link").map((link) => link.getAttribute("href"));
}

const VALID_VALUES: Record<string, string> = {
  email: "ana@example.com",
  password: "Te-verde-2026!",
  passwordConfirmation: "Te-verde-2026!",
  username: "ana",
};

/**
 * Fills the known fields, then any other required input left empty, so native validation
 * cannot cancel a submit and hide a toggle that wrongly submits.
 */
async function fillValidForm(user: ReturnType<typeof userEvent.setup>, container: HTMLElement) {
  for (const [name, value] of Object.entries(VALID_VALUES)) {
    const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (input) {
      await user.clear(input);
      await user.type(input, value);
    }
  }
  for (const input of container.querySelectorAll<HTMLInputElement>("input[required]")) {
    if (input.value === "" && input.type !== "checkbox" && input.type !== "radio") {
      await user.type(input, input.type === "email" ? "ana@example.com" : "valor-valido");
    }
  }
  for (const input of container.querySelectorAll<HTMLInputElement>('input[required][type="checkbox"]')) {
    if (!input.checked) {
      await user.click(input);
    }
  }
}

/** The elements a toggle names in `aria-controls`, failing when the attribute is empty or an id is missing. */
function controlledElements(toggle: HTMLElement): Array<HTMLElement> {
  const ids = (toggle.getAttribute("aria-controls") ?? "").split(/\s+/).filter(Boolean);
  expect(ids.length).toBeGreaterThan(0);
  return ids.map((id) => {
    const element = document.getElementById(id);
    expect(element, `aria-controls names "${id}", which is not in the document`).not.toBeNull();
    return element as HTMLElement;
  });
}

describe("SignInForm", () => {
  it("starts with the password hidden and the toggle not pressed", () => {
    const { container } = render(<SignInForm />);

    expect(passwordInput(container)).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: SHOW_PASSWORD })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows the password when the toggle is pressed and hides it again on a second press", async () => {
    const user = userEvent.setup();
    const { container } = render(<SignInForm />);
    const toggle = screen.getByRole("button", { name: SHOW_PASSWORD });

    await user.click(toggle);

    expect(passwordInput(container)).toHaveAttribute("type", "text");
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await user.click(toggle);

    expect(passwordInput(container)).toHaveAttribute("type", "password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("labels the email and password inputs", () => {
    render(<SignInForm />);

    const emails = screen.getAllByLabelText(/email|correo/i, { selector: "input" });
    expect(emails.some((input) => input.getAttribute("name") === "email")).toBe(true);
    const passwords = screen.getAllByLabelText(/^contraseña/i, { selector: "input" });
    expect(passwords.some((input) => input.getAttribute("name") === "password")).toBe(true);
  });

  it("links to the sign-up page", () => {
    render(<SignInForm />);

    expect(linkHrefs()).toContain("/sign-up");
  });

  it("does not submit a valid form when the toggle is pressed", async () => {
    const { signin } = await import("@/app/actions/authActions");
    vi.mocked(signin).mockClear();
    const user = userEvent.setup();
    const { container } = render(<SignInForm />);
    await fillValidForm(user, container);
    const toggle = screen.getByRole("button", { name: SHOW_PASSWORD });

    await user.click(toggle);

    expect(toggle).toHaveAttribute("type", "button");
    expect(signin).not.toHaveBeenCalled();
  });

  it("points the toggle at the password input through aria-controls", () => {
    const { container } = render(<SignInForm />);

    const controlled = controlledElements(screen.getByRole("button", { name: SHOW_PASSWORD }));

    expect(controlled).toEqual([passwordInput(container)]);
  });
});

describe("SignUpForm", () => {
  it("starts with both password fields hidden and every toggle not pressed", () => {
    const { container } = render(<SignUpForm />);

    expect(passwordInput(container)).toHaveAttribute("type", "password");
    expect(confirmationInput(container)).toHaveAttribute("type", "password");
    const toggles = screen.getAllByRole("button", { name: SHOW_PASSWORD });
    expect(toggles.length).toBeGreaterThanOrEqual(1);
    for (const toggle of toggles) {
      expect(toggle).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("shows the password with its toggle and hides it again on a second press", async () => {
    const user = userEvent.setup();
    const { container } = render(<SignUpForm />);
    const [toggle] = screen.getAllByRole("button", { name: SHOW_PASSWORD });

    await user.click(toggle);

    expect(passwordInput(container)).toHaveAttribute("type", "text");
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await user.click(toggle);

    expect(passwordInput(container)).toHaveAttribute("type", "password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("shows both the password and its confirmation once every toggle is pressed", async () => {
    const user = userEvent.setup();
    const { container } = render(<SignUpForm />);
    const toggles = screen.getAllByRole("button", { name: SHOW_PASSWORD });

    for (const toggle of toggles) {
      await user.click(toggle);
    }

    expect(passwordInput(container)).toHaveAttribute("type", "text");
    expect(confirmationInput(container)).toHaveAttribute("type", "text");
    for (const toggle of toggles) {
      expect(toggle).toHaveAttribute("aria-pressed", "true");
    }
  });

  it("labels the email and password inputs", () => {
    render(<SignUpForm />);

    const emails = screen.getAllByLabelText(/email|correo/i, { selector: "input" });
    expect(emails.some((input) => input.getAttribute("name") === "email")).toBe(true);
    const passwords = screen.getAllByLabelText(/^contraseña/i, { selector: "input" });
    expect(passwords.some((input) => input.getAttribute("name") === "password")).toBe(true);
  });

  it("links to the sign-in page", () => {
    render(<SignUpForm />);

    expect(linkHrefs()).toContain("/sign-in");
  });

  it("does not submit a valid form when a toggle is pressed", async () => {
    const { signup } = await import("@/app/actions/authActions");
    vi.mocked(signup).mockClear();
    const user = userEvent.setup();
    const { container } = render(<SignUpForm />);
    await fillValidForm(user, container);
    const toggles = screen.getAllByRole("button", { name: SHOW_PASSWORD });

    for (const toggle of toggles) {
      await user.click(toggle);
      expect(toggle).toHaveAttribute("type", "button");
    }

    expect(signup).not.toHaveBeenCalled();
  });

  it("points the toggles at the password and its confirmation through aria-controls", () => {
    const { container } = render(<SignUpForm />);
    const password = passwordInput(container);
    const confirmation = confirmationInput(container);
    const toggles = screen.getAllByRole("button", { name: SHOW_PASSWORD });

    const controlledByToggle = toggles.map((toggle) => controlledElements(toggle));

    for (const controlled of controlledByToggle) {
      for (const element of controlled) {
        expect([password, confirmation]).toContain(element);
      }
    }
    if (toggles.length === 1) {
      expect(new Set(controlledByToggle[0])).toEqual(new Set([confirmation, password]));
    } else {
      // One toggle per field: each reveals only its own field, and together they cover both.
      for (const controlled of controlledByToggle) {
        expect(controlled).toHaveLength(1);
      }
      expect(new Set(controlledByToggle.flat())).toEqual(new Set([confirmation, password]));
    }
  });
});
