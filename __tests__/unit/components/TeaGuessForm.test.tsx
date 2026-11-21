import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { submitTeaGuess } from "@/app/actions/teaGuessActions";
import TeaGuessForm from "@/components/TeaGuessForm";
import { showActionToast } from "@/lib/action-toast";
import { SelectOption, TeaGuessActionResponse } from "@/lib/types";

vi.mock("@/app/actions/teaGuessActions", () => ({ submitTeaGuess: vi.fn() }));
vi.mock("@/lib/action-toast", () => ({ showActionToast: vi.fn() }));
// next/form expects the App Router context; a plain form keeps React's own action handling.
vi.mock("next/form", () => ({
  default: (props: ComponentProps<"form">) => <form {...props} />,
}));

/** The props as specified, kept here so the test does not lean on the component's own types. */
interface TeaGuessFormProps {
  canUserGuessPerson: boolean;
  canUserGuessTea: boolean;
  dayId: string;
  ingredients: SelectOption[];
  teaHasIngredients: boolean;
  teaTypeOptions: SelectOption[];
  users: SelectOption[];
}

const DAY_ID = "day-7";
const USERS: SelectOption[] = [
  { id: "user-1", name: "Ana" },
  { id: "user-2", name: "Bruno" },
];
const TEA_TYPES: SelectOption[] = [
  { id: "GREEN", name: "Verde" },
  { id: "BLACK", name: "Negro" },
];
const SUCCESS: TeaGuessActionResponse = { message: "Respuesta guardada", success: true };
const FAILURE: TeaGuessActionResponse = {
  errors: { errors: [], properties: { teaName: { errors: ["Escribe un nombre"] } } },
  message: "Hay errores en el formulario",
  success: false,
};

function renderForm(overrides: Partial<TeaGuessFormProps> = {}) {
  const props: TeaGuessFormProps = {
    canUserGuessPerson: true,
    canUserGuessTea: true,
    dayId: DAY_ID,
    ingredients: [],
    teaHasIngredients: false,
    teaTypeOptions: TEA_TYPES,
    users: USERS,
    ...overrides,
  };
  render(<TeaGuessForm {...props} />);
}

const personSelect = () => screen.getByRole("combobox", { name: "Persona proponenTé" });
const teaNameInput = () => screen.getByRole("textbox", { name: "Nombre del té" });
const teaTypeSelect = () => screen.getByRole("combobox", { name: "Tipo de Té" });
const submitButton = () => screen.getByRole("button", { name: "AdivinaTé" });

async function choose(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, optionName: string) {
  await user.click(trigger);
  await user.click(await screen.findByRole("option", { name: optionName }));
  await waitFor(() => {
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await choose(user, personSelect(), "Bruno");
  await user.type(teaNameInput(), "Sencha Kyoto");
  await choose(user, teaTypeSelect(), "Verde");
  await user.click(submitButton());
}

/** The FormData the action received, after the bound dayId and the previous state. */
function submittedFormData(call = 0) {
  const [dayId, , formData] = vi.mocked(submitTeaGuess).mock.calls[call];
  return { dayId, formData: formData as FormData };
}

/** The text of every element the control's `aria-describedby` points to. */
function describedByText(control: HTMLElement) {
  const ids = (control.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
  return ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
}

beforeEach(() => {
  vi.mocked(submitTeaGuess).mockReset().mockResolvedValue(SUCCESS);
  vi.mocked(showActionToast).mockReset();
});

describe("TeaGuessForm", () => {
  it("shows the person select, the tea name, the tea type and the submit button when both guesses are allowed", () => {
    renderForm();

    expect(personSelect()).toBeInTheDocument();
    expect(teaNameInput()).toBeInTheDocument();
    expect(teaTypeSelect()).toBeInTheDocument();
    expect(submitButton()).toBeInTheDocument();
  });

  it("hides the person select when the user cannot guess the person", () => {
    renderForm({ canUserGuessPerson: false });

    expect(screen.queryByRole("combobox", { name: "Persona proponenTé" })).not.toBeInTheDocument();
    expect(teaNameInput()).toBeInTheDocument();
    expect(teaTypeSelect()).toBeInTheDocument();
  });

  it("hides the tea name and the tea type when the user cannot guess the tea", () => {
    renderForm({ canUserGuessTea: false });

    expect(screen.queryByRole("textbox", { name: "Nombre del té" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Tipo de Té" })).not.toBeInTheDocument();
    expect(personSelect()).toBeInTheDocument();
  });

  it("submits the chosen person's name, the typed tea name and the chosen type's id for the day", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(submitTeaGuess).toHaveBeenCalledTimes(1);
    });
    const { dayId, formData } = submittedFormData();
    expect(dayId).toBe(DAY_ID);
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get("personName")).toBe("Bruno");
    expect(formData.get("teaName")).toBe("Sencha Kyoto");
    expect(formData.get("teaType")).toBe("GREEN");
  });

  it("shows a toast with the response once when the guess is saved", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(showActionToast).toHaveBeenCalledWith(SUCCESS);
    });
    expect(showActionToast).toHaveBeenCalledTimes(1);
  });

  it("shows a toast and the field error, and marks the tea name invalid, when the action rejects the form", async () => {
    const user = userEvent.setup();
    vi.mocked(submitTeaGuess).mockResolvedValue(FAILURE);
    renderForm();

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(showActionToast).toHaveBeenCalledWith(FAILURE);
    });
    expect(await screen.findByText("Escribe un nombre")).toBeVisible();
    expect(teaNameInput()).toHaveAttribute("aria-invalid", "true");
  });

  it("shows no toast when the form is first rendered", async () => {
    renderForm();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(showActionToast).not.toHaveBeenCalled();
  });

  it("shows a general error in the form as well as in a toast", async () => {
    const user = userEvent.setup();
    const generalFailure: TeaGuessActionResponse = {
      errors: { errors: ["Debes intentar adivinar al menos una opción"] },
      message: "Hay errores en el formulario",
      success: false,
    };
    vi.mocked(submitTeaGuess).mockResolvedValue(generalFailure);
    renderForm();

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(showActionToast).toHaveBeenCalledWith(generalFailure);
    });
    expect(await screen.findByText("Debes intentar adivinar al menos una opción")).toBeVisible();
  });

  it("shows every field error, marks each control invalid and describes it with its message", async () => {
    const user = userEvent.setup();
    const fieldsFailure: TeaGuessActionResponse = {
      errors: {
        errors: [],
        properties: {
          personName: { errors: ["Elige una persona"] },
          teaName: { errors: ["Escribe un nombre"] },
          teaType: { errors: ["Elige un tipo"] },
        },
      },
      message: "Hay errores en el formulario",
      success: false,
    };
    vi.mocked(submitTeaGuess).mockResolvedValue(fieldsFailure);
    renderForm();

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(showActionToast).toHaveBeenCalledWith(fieldsFailure);
    });
    for (const [control, message] of [
      [personSelect(), "Elige una persona"],
      [teaNameInput(), "Escribe un nombre"],
      [teaTypeSelect(), "Elige un tipo"],
    ] as const) {
      expect(await screen.findByText(message)).toBeVisible();
      expect(control).toHaveAttribute("aria-invalid", "true");
      expect(describedByText(control)).toContain(message);
    }
  });

  it("keeps the chosen values after an error and submits them again", async () => {
    const user = userEvent.setup();
    vi.mocked(submitTeaGuess).mockResolvedValue(FAILURE);
    renderForm();

    await fillAndSubmit(user);
    await waitFor(() => {
      expect(showActionToast).toHaveBeenCalledWith(FAILURE);
    });

    expect(personSelect()).toHaveTextContent("Bruno");
    expect(teaNameInput()).toHaveValue("Sencha Kyoto");
    expect(teaTypeSelect()).toHaveTextContent("Verde");

    await user.click(submitButton());
    await waitFor(() => {
      expect(submitTeaGuess).toHaveBeenCalledTimes(2);
    });
    const { dayId, formData } = submittedFormData(1);
    expect(dayId).toBe(DAY_ID);
    expect(formData.get("personName")).toBe("Bruno");
    expect(formData.get("teaName")).toBe("Sencha Kyoto");
    expect(formData.get("teaType")).toBe("GREEN");
  });

  it("does not submit the form when arrow keys are pressed on the focused, closed person select", async () => {
    const user = userEvent.setup();
    renderForm();

    personSelect().focus();
    expect(personSelect()).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowUp}{ArrowLeft}{ArrowRight}");

    // Give any stray submission the chance to reach the action before asserting.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(submitTeaGuess).not.toHaveBeenCalled();
  });
});
