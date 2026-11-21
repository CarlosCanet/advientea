import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { placeParticipantAction, swapParticipantsAction } from "@/app/actions/editionActions";
import ParticipantDaySelect from "@/components/editions/ParticipantDaySelect";
import { showActionToast } from "@/lib/action-toast";
import { ActionResponse } from "@/lib/types";

vi.mock("@/app/actions/editionActions", () => ({
  changeEditionStatusAction: vi.fn(),
  placeParticipantAction: vi.fn(),
  swapParticipantsAction: vi.fn(),
}));
vi.mock("@/lib/action-toast", () => ({ showActionToast: vi.fn() }));

/** The props as specified, kept here so the test does not lean on the component's own types. */
interface DayOption {
  dayNumber: number;
  holder: null | { name: string; participationId: string };
  isLocked: boolean;
}
interface ParticipantDaySelectProps {
  dayNumber: null | number;
  days: Array<DayOption>;
  isOwnDayLocked: boolean;
  name: string;
  participationId: string;
}

const NAME = "Ana";
const PARTICIPATION_ID = "participation-ana";
const OWN_DAY = 4;
const HOLDER = { name: "Bea", participationId: "participation-bea" };
const HELD_DAY = 2;
const LOCKED_DAY = 1;
const LOCKED_HOLDER = { name: "Carla", participationId: "participation-carla" };
const RESPONSE: ActionResponse = { message: "Ana pasa al día 3.", success: true };

/** Six days: 1 locked and held by Carla, 2 held by Bea, 4 held by Ana, the rest free. */
function buildDays(ownDay: null | number = OWN_DAY): Array<DayOption> {
  return [1, 2, 3, 4, 5, 6].map((dayNumber) => {
    if (dayNumber === LOCKED_DAY) {
      return { dayNumber, holder: LOCKED_HOLDER, isLocked: true };
    }
    if (dayNumber === HELD_DAY) {
      return { dayNumber, holder: HOLDER, isLocked: false };
    }
    if (dayNumber === ownDay) {
      return { dayNumber, holder: { name: NAME, participationId: PARTICIPATION_ID }, isLocked: false };
    }
    return { dayNumber, holder: null, isLocked: false };
  });
}

function renderSelect(overrides: Partial<ParticipantDaySelectProps> = {}) {
  const props: ParticipantDaySelectProps = {
    dayNumber: OWN_DAY,
    days: buildDays(overrides.dayNumber === undefined ? OWN_DAY : overrides.dayNumber),
    isOwnDayLocked: false,
    name: NAME,
    participationId: PARTICIPATION_ID,
    ...overrides,
  };
  render(<ParticipantDaySelect {...props} />);
  return screen.getByRole("combobox", { name: `Día de ${NAME}` });
}

async function openSelect(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
  await user.click(trigger);
  return screen.findByRole("listbox");
}

async function choose(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, optionName: string) {
  const listbox = await openSelect(user, trigger);
  await user.click(within(listbox).getByRole("option", { name: optionName }));
}

/** Opens the select from the keyboard, walks the highlight to the option and commits it with Enter. */
async function chooseWithKeyboard(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, optionName: string) {
  act(() => {
    trigger.focus();
  });
  await user.keyboard("{ArrowDown}");
  const listbox = await screen.findByRole("listbox");
  const target = within(listbox).getByRole("option", { name: optionName });
  const steps = within(listbox).getAllByRole("option").length;
  for (const key of ["{ArrowDown}", "{ArrowUp}"]) {
    for (let step = 0; step < steps && document.activeElement !== target; step++) {
      await user.keyboard(key);
    }
  }
  expect(target).toHaveFocus();
  await user.keyboard("{Enter}");
}

function optionNames(listbox: HTMLElement) {
  return within(listbox)
    .getAllByRole("option")
    .map((option) => option.textContent?.replace(/\s+/g, " ").trim());
}

/** Lets pending promises and transitions settle, so a call that should not happen has had its chance. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  vi.mocked(placeParticipantAction).mockReset().mockResolvedValue(RESPONSE);
  vi.mocked(swapParticipantsAction).mockReset().mockResolvedValue(RESPONSE);
  vi.mocked(showActionToast).mockReset();
});

describe("ParticipantDaySelect", () => {
  it("renders a combobox named after the participant that shows their day", () => {
    const trigger = renderSelect();

    expect(trigger).toHaveTextContent(/^4$/);
  });

  it("shows Sin día when the participant has no day", () => {
    const trigger = renderSelect({ dayNumber: null });

    expect(trigger).toHaveTextContent(/^Sin día$/);
  });

  it("lists Sin día first, then every day in order, naming the days held by someone else", async () => {
    const user = userEvent.setup();
    const trigger = renderSelect();

    const listbox = await openSelect(user, trigger);

    expect(optionNames(listbox)).toEqual(["Sin día", "1 · Carla", "2 · Bea", "3", "4", "5", "6"]);
  });

  it("disables the locked days and only those", async () => {
    const user = userEvent.setup();
    const trigger = renderSelect();

    const listbox = await openSelect(user, trigger);

    expect(within(listbox).getByRole("option", { name: "1 · Carla" })).toHaveAttribute("aria-disabled", "true");
    for (const name of ["Sin día", "2 · Bea", "3", "4", "5", "6"]) {
      expect(within(listbox).getByRole("option", { name })).not.toHaveAttribute("aria-disabled", "true");
    }
  });

  it("adds an option for the participant's own day when it lies outside the calendar", async () => {
    const user = userEvent.setup();
    const trigger = renderSelect({ dayNumber: 9, days: buildDays(null) });

    const listbox = await openSelect(user, trigger);

    expect(within(listbox).getByRole("option", { name: "9 (fuera del calendario)" })).toBeInTheDocument();
    expect(optionNames(listbox).slice(0, 7)).toEqual(["Sin día", "1 · Carla", "2 · Bea", "3", "4", "5", "6"]);
  });

  it("calls no action and opens no confirmation when arrow keys are pressed on the closed trigger", async () => {
    const user = userEvent.setup();
    const trigger = renderSelect();

    act(() => {
      trigger.focus();
    });
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowUp}");
    await flush();

    expect(placeParticipantAction).not.toHaveBeenCalled();
    expect(swapParticipantsAction).not.toHaveBeenCalled();
    expect(showActionToast).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it.each([
    { case: "S, the first letter of Sin día", key: "S" },
    { case: "a digit that matches a free day", key: "3" },
    { case: "a digit that matches a held day", key: "2" },
  ])("calls nothing and opens no confirmation when $case is typed on the closed trigger", async ({ key }) => {
    const user = userEvent.setup();
    const trigger = renderSelect();

    act(() => {
      trigger.focus();
    });
    await user.keyboard(key);
    await flush();

    expect(placeParticipantAction).not.toHaveBeenCalled();
    expect(swapParticipantsAction).not.toHaveBeenCalled();
    expect(showActionToast).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("places the participant on a free day chosen with the keyboard", async () => {
    const user = userEvent.setup();
    const trigger = renderSelect();

    await chooseWithKeyboard(user, trigger, "5");

    await waitFor(() => {
      expect(placeParticipantAction).toHaveBeenCalledTimes(1);
    });
    expect(placeParticipantAction).toHaveBeenCalledWith(PARTICIPATION_ID, 5);
    await flush();
    expect(placeParticipantAction).toHaveBeenCalledTimes(1);
    expect(swapParticipantsAction).not.toHaveBeenCalled();
  });

  it.each([
    { current: /^4$/, dayNumber: OWN_DAY, option: "3" },
    { current: /^Sin día$/, dayNumber: null, option: "5" },
  ])("keeps showing $current when the change to $option is refused", async ({ current, dayNumber, option }) => {
    const user = userEvent.setup();
    const refusal: ActionResponse = { message: "El día está bloqueado.", success: false };
    vi.mocked(placeParticipantAction).mockResolvedValue(refusal);
    const trigger = renderSelect({ dayNumber });

    await choose(user, trigger, option);

    await waitFor(() => {
      expect(showActionToast).toHaveBeenCalledWith(refusal);
    });
    await flush();
    expect(screen.getByRole("combobox", { name: `Día de ${NAME}` })).toHaveTextContent(current);
  });

  it("places the participant on a free day once and shows the result", async () => {
    const user = userEvent.setup();
    const failure: ActionResponse = { message: "No se pudo cambiar el día.", success: false };
    vi.mocked(placeParticipantAction).mockResolvedValue(failure);
    const trigger = renderSelect();

    await choose(user, trigger, "3");

    await waitFor(() => {
      expect(showActionToast).toHaveBeenCalledWith(failure);
    });
    expect(placeParticipantAction).toHaveBeenCalledTimes(1);
    expect(placeParticipantAction).toHaveBeenCalledWith(PARTICIPATION_ID, 3);
    expect(showActionToast).toHaveBeenCalledTimes(1);
    expect(swapParticipantsAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("places a participant without a day on a free day", async () => {
    const user = userEvent.setup();
    const trigger = renderSelect({ dayNumber: null });

    await choose(user, trigger, "5");

    await waitFor(() => {
      expect(showActionToast).toHaveBeenCalledWith(RESPONSE);
    });
    expect(placeParticipantAction).toHaveBeenCalledTimes(1);
    expect(placeParticipantAction).toHaveBeenCalledWith(PARTICIPATION_ID, 5);
  });

  it("takes the participant's day away when Sin día is chosen", async () => {
    const user = userEvent.setup();
    const trigger = renderSelect();

    await choose(user, trigger, "Sin día");

    await waitFor(() => {
      expect(showActionToast).toHaveBeenCalledWith(RESPONSE);
    });
    expect(placeParticipantAction).toHaveBeenCalledTimes(1);
    expect(placeParticipantAction).toHaveBeenCalledWith(PARTICIPATION_ID, null);
    expect(showActionToast).toHaveBeenCalledTimes(1);
  });

  it.each([
    { case: "their own day", dayNumber: OWN_DAY, option: "4" },
    { case: "Sin día while they have no day", dayNumber: null, option: "Sin día" },
  ])("calls nothing when $case is chosen again", async ({ dayNumber, option }) => {
    const user = userEvent.setup();
    const trigger = renderSelect({ dayNumber });

    await choose(user, trigger, option);
    await flush();

    expect(placeParticipantAction).not.toHaveBeenCalled();
    expect(swapParticipantsAction).not.toHaveBeenCalled();
    expect(showActionToast).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("asks before swapping with the participant who holds the chosen day", async () => {
    const user = userEvent.setup();
    const trigger = renderSelect();

    await choose(user, trigger, "2 · Bea");

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveAccessibleName("¿Intercambiar con Bea?");
    expect(dialog).toHaveAccessibleDescription("Ana pasará al día 2 y Bea al día 4.");
    expect(placeParticipantAction).not.toHaveBeenCalled();
    expect(swapParticipantsAction).not.toHaveBeenCalled();
  });

  it("says the holder will be left without a day when the participant has none", async () => {
    const user = userEvent.setup();
    const trigger = renderSelect({ dayNumber: null });

    await choose(user, trigger, "2 · Bea");

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveAccessibleName("¿Intercambiar con Bea?");
    expect(dialog).toHaveAccessibleDescription("Ana pasará al día 2 y Bea se quedará sin día.");
  });

  it("swaps the two participants once when Intercambiar is confirmed", async () => {
    const user = userEvent.setup();
    const trigger = renderSelect();

    await choose(user, trigger, "2 · Bea");
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Intercambiar" }));

    await waitFor(() => {
      expect(swapParticipantsAction).toHaveBeenCalledTimes(1);
    });
    expect(swapParticipantsAction).toHaveBeenCalledWith(PARTICIPATION_ID, HOLDER.participationId);
    await flush();
    expect(swapParticipantsAction).toHaveBeenCalledTimes(1);
    expect(placeParticipantAction).not.toHaveBeenCalled();
  });

  it("swaps nothing and keeps the current day when Cancelar is clicked", async () => {
    const user = userEvent.setup();
    const trigger = renderSelect();

    await choose(user, trigger, "2 · Bea");
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    await flush();
    expect(swapParticipantsAction).not.toHaveBeenCalled();
    expect(placeParticipantAction).not.toHaveBeenCalled();
    expect(showActionToast).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox", { name: `Día de ${NAME}` })).toHaveTextContent(/^4$/);
  });

  it("disables the trigger when the participant's own day is locked", () => {
    const trigger = renderSelect({ isOwnDayLocked: true });

    expect(trigger).toBeDisabled();
  });
});
