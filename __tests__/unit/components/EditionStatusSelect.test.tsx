import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { changeEditionStatusAction } from "@/app/actions/editionActions";
import EditionStatusSelect from "@/components/editions/EditionStatusSelect";
import { EditionStatus } from "@/generated/prisma/enums";
import { showActionToast } from "@/lib/action-toast";
import { ActionResponse } from "@/lib/types";

vi.mock("@/app/actions/editionActions", () => ({
  changeEditionStatusAction: vi.fn(),
  placeParticipantAction: vi.fn(),
  swapParticipantsAction: vi.fn(),
}));
vi.mock("@/lib/action-toast", () => ({ showActionToast: vi.fn() }));

const YEAR = 2026;
const RESPONSE: ActionResponse = { message: "La edición 2026 está activa.", success: true };

/** The labels as specified, written out so the test does not lean on `EDITION_STATUS_LABELS`. */
const LABELS: Record<EditionStatus, string> = {
  [EditionStatus.ACTIVE]: "Activa",
  [EditionStatus.ARCHIVED]: "Archivada",
  [EditionStatus.PREPARING]: "En preparación",
};

function renderSelect(status: EditionStatus = EditionStatus.PREPARING) {
  render(<EditionStatusSelect status={status} year={YEAR} />);
  return screen.getByRole("combobox", { name: `Estado de la edición ${YEAR}` });
}

async function openSelect(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
  await user.click(trigger);
  return screen.findByRole("listbox");
}

async function choose(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, label: string) {
  const listbox = await openSelect(user, trigger);
  await user.click(within(listbox).getByRole("option", { name: label }));
}

/** Opens the select from the keyboard, walks the highlight to the option and commits it with Enter. */
async function chooseWithKeyboard(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, label: string) {
  act(() => {
    trigger.focus();
  });
  await user.keyboard("{ArrowDown}");
  const listbox = await screen.findByRole("listbox");
  const target = within(listbox).getByRole("option", { name: label });
  const steps = within(listbox).getAllByRole("option").length;
  for (const key of ["{ArrowDown}", "{ArrowUp}"]) {
    for (let step = 0; step < steps && document.activeElement !== target; step++) {
      await user.keyboard(key);
    }
  }
  expect(target).toHaveFocus();
  await user.keyboard("{Enter}");
}

/** Lets pending promises and transitions settle, so a call that should not happen has had its chance. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  vi.mocked(changeEditionStatusAction).mockReset().mockResolvedValue(RESPONSE);
  vi.mocked(showActionToast).mockReset();
});

describe("EditionStatusSelect", () => {
  it.each([EditionStatus.PREPARING, EditionStatus.ACTIVE, EditionStatus.ARCHIVED])(
    "renders a combobox named after the year that shows the %s label",
    (status) => {
      const trigger = renderSelect(status);

      expect(trigger).toHaveTextContent(LABELS[status]);
    },
  );

  it("lists the statuses in order: preparing, active, archived", async () => {
    const user = userEvent.setup();
    const trigger = renderSelect();

    const listbox = await openSelect(user, trigger);

    const names = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent?.replace(/\s+/g, " ").trim());
    expect(names).toEqual(["En preparación", "Activa", "Archivada"]);
  });

  it.each([EditionStatus.ACTIVE, EditionStatus.ARCHIVED])(
    "asks before moving the edition to %s and calls nothing yet",
    async (target) => {
      const user = userEvent.setup();
      const trigger = renderSelect(EditionStatus.PREPARING);

      await choose(user, trigger, LABELS[target]);

      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toHaveAccessibleName(`¿Pasar la edición ${YEAR} a «${LABELS[target]}»?`);
      expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Cambiar" })).toBeInTheDocument();
      await flush();
      expect(changeEditionStatusAction).not.toHaveBeenCalled();
      expect(showActionToast).not.toHaveBeenCalled();
    },
  );

  it.each([
    { current: EditionStatus.PREPARING, target: EditionStatus.ACTIVE },
    { current: EditionStatus.ACTIVE, target: EditionStatus.ARCHIVED },
    { current: EditionStatus.ARCHIVED, target: EditionStatus.PREPARING },
  ])("changes the status from $current to $target once when Cambiar is confirmed", async ({ current, target }) => {
    const user = userEvent.setup();
    const failure: ActionResponse = { message: "No se pudo cambiar el estado.", success: false };
    vi.mocked(changeEditionStatusAction).mockResolvedValue(failure);
    const trigger = renderSelect(current);

    await choose(user, trigger, LABELS[target]);
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cambiar" }));

    await waitFor(() => {
      expect(showActionToast).toHaveBeenCalledWith(failure);
    });
    expect(changeEditionStatusAction).toHaveBeenCalledTimes(1);
    expect(changeEditionStatusAction).toHaveBeenCalledWith(YEAR, target);
    expect(showActionToast).toHaveBeenCalledTimes(1);
  });

  it("asks for confirmation when a different status is chosen with the keyboard", async () => {
    const user = userEvent.setup();
    const trigger = renderSelect(EditionStatus.ACTIVE);

    await chooseWithKeyboard(user, trigger, LABELS[EditionStatus.ARCHIVED]);

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveAccessibleName(`¿Pasar la edición ${YEAR} a «${LABELS[EditionStatus.ARCHIVED]}»?`);
    await flush();
    expect(changeEditionStatusAction).not.toHaveBeenCalled();
  });

  it.each([
    { current: EditionStatus.PREPARING, key: "A" },
    { current: EditionStatus.ACTIVE, key: "A" },
    { current: EditionStatus.ACTIVE, key: "E" },
  ])(
    "opens no confirmation when $key is typed on the closed trigger of a $current edition",
    async ({ current, key }) => {
      const user = userEvent.setup();
      const trigger = renderSelect(current);

      act(() => {
        trigger.focus();
      });
      await user.keyboard(key);
      await flush();

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(changeEditionStatusAction).not.toHaveBeenCalled();
      expect(showActionToast).not.toHaveBeenCalled();
    },
  );

  it("focuses Cancelar when the confirmation is about archiving", async () => {
    const user = userEvent.setup();
    const trigger = renderSelect(EditionStatus.ACTIVE);

    await choose(user, trigger, LABELS[EditionStatus.ARCHIVED]);

    const dialog = await screen.findByRole("alertdialog");
    const cancel = within(dialog).getByRole("button", { name: "Cancelar" });
    await waitFor(() => {
      expect(cancel).toHaveFocus();
    });
  });

  it.each([
    { current: EditionStatus.PREPARING, target: EditionStatus.ACTIVE },
    { current: EditionStatus.ARCHIVED, target: EditionStatus.ACTIVE },
    { current: EditionStatus.ACTIVE, target: EditionStatus.PREPARING },
  ])("focuses Cambiar when the confirmation moves $current to $target", async ({ current, target }) => {
    const user = userEvent.setup();
    const trigger = renderSelect(current);

    await choose(user, trigger, LABELS[target]);

    const dialog = await screen.findByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "Cambiar" });
    await waitFor(() => {
      expect(confirm).toHaveFocus();
    });
  });

  it("changes nothing and keeps the current label when Cancelar is clicked", async () => {
    const user = userEvent.setup();
    const trigger = renderSelect(EditionStatus.PREPARING);

    await choose(user, trigger, LABELS[EditionStatus.ARCHIVED]);
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    await flush();
    expect(changeEditionStatusAction).not.toHaveBeenCalled();
    expect(showActionToast).not.toHaveBeenCalled();
    const current = screen.getByRole("combobox", { name: `Estado de la edición ${YEAR}` });
    expect(current).toHaveTextContent(LABELS[EditionStatus.PREPARING]);
    expect(current).not.toHaveTextContent(LABELS[EditionStatus.ARCHIVED]);
  });

  it("opens nothing and calls nothing when the current status is chosen", async () => {
    const user = userEvent.setup();
    const trigger = renderSelect(EditionStatus.ACTIVE);

    await choose(user, trigger, LABELS[EditionStatus.ACTIVE]);
    await flush();

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(changeEditionStatusAction).not.toHaveBeenCalled();
    expect(showActionToast).not.toHaveBeenCalled();
  });

  it("opens no confirmation and calls nothing when arrow keys are pressed on the closed trigger", async () => {
    const user = userEvent.setup();
    const trigger = renderSelect(EditionStatus.ACTIVE);

    act(() => {
      trigger.focus();
    });
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowUp}");
    await flush();

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(changeEditionStatusAction).not.toHaveBeenCalled();
    expect(showActionToast).not.toHaveBeenCalled();
  });
});
