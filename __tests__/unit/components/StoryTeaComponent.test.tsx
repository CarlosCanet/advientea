import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { StoryTeaWithImages } from "@/lib/dal";

import StoryTeaComponent from "@/components/StoryTeaComponent";

vi.mock("@/components/tea/CarouselComponent", () => ({
  default: ({ images }: { images: Array<{ publicId: string }> }) => (
    <div data-testid="carousel-mock">{images.map((image) => image.publicId).join(",")}</div>
  ),
}));
vi.mock("@/components/YoutubeComponent", () => ({
  default: ({ youtubeURL }: { youtubeURL: string }) => <div data-testid="youtube-mock">{youtubeURL}</div>,
}));

const PART_TEXTS = {
  1: "MARKER-PART-ONE-alpha",
  2: "MARKER-PART-TWO-bravo",
  3: "MARKER-PART-THREE-charlie",
} as const;
const PART_HOURS = { 1: "07:00", 2: "13:00", 3: "18:00" } as const;
const IMAGE_PUBLIC_ID = "advientea-local/2026/teaDay/MARKER-IMAGE-delta";
const YOUTUBE_URL = "https://www.youtube.com/watch?v=MARKERvideo";

type PartNumber = 1 | 2 | 3;
const PART_NUMBERS: PartNumber[] = [1, 2, 3];

interface Flags {
  isPart1Released: boolean;
  isPart2Released: boolean;
  isPart3Released: boolean;
}

function buildStory(overrides: Partial<StoryTeaWithImages> = {}): StoryTeaWithImages {
  const now = new Date("2026-12-03T10:00:00Z");
  return {
    createdAt: now,
    id: "story-1",
    images: [
      { createdAt: now, id: "image-1", order: 0, publicId: IMAGE_PUBLIC_ID, storyTeaId: "story-1", updatedAt: now },
    ],
    onlyMusic: null,
    storyPart1: PART_TEXTS[1],
    storyPart2: PART_TEXTS[2],
    storyPart3: PART_TEXTS[3],
    teaId: "tea-1",
    updatedAt: now,
    youtubeURL: YOUTUBE_URL,
    ...overrides,
  };
}

function renderStory(flags: Flags, story: StoryTeaWithImages = buildStory()) {
  const { container } = render(<StoryTeaComponent {...flags} story={story} />);
  return {
    container,
    html: container.innerHTML,
    text: (container.textContent ?? "").replace(/\s+/g, " "),
  };
}

function isReleased(flags: Flags, part: PartNumber): boolean {
  if (part === 1) {
    return flags.isPart1Released;
  }
  if (part === 2) {
    return flags.isPart2Released;
  }
  return flags.isPart3Released;
}

function lockedLabel(part: PartNumber): string {
  return `La parte ${part} se desvela a las ${PART_HOURS[part]}`;
}

const ALL_COMBINATIONS: Flags[] = [false, true].flatMap((isPart1Released) =>
  [false, true].flatMap((isPart2Released) =>
    [false, true].map((isPart3Released) => ({ isPart1Released, isPart2Released, isPart3Released })),
  ),
);

describe("StoryTeaComponent", () => {
  describe.each(ALL_COMBINATIONS)(
    "with part1=$isPart1Released, part2=$isPart2Released, part3=$isPart3Released",
    (flags) => {
      it("renders the text of every released part", () => {
        const { text } = renderStory(flags);

        for (const part of PART_NUMBERS) {
          if (isReleased(flags, part)) {
            expect(text).toContain(PART_TEXTS[part]);
          }
        }
      });

      it("leaves the text of every unreleased part out of the whole markup", () => {
        const { html } = renderStory(flags);

        for (const part of PART_NUMBERS) {
          if (!isReleased(flags, part)) {
            expect(html).not.toContain(PART_TEXTS[part]);
          }
        }
      });

      it("shows a locked row with the reveal hour for each unreleased part, and none for released ones", () => {
        const { text } = renderStory(flags);

        for (const part of PART_NUMBERS) {
          if (isReleased(flags, part)) {
            expect(text).not.toContain(`La parte ${part} se desvela`);
          } else {
            expect(text).toContain(lockedLabel(part));
          }
        }
      });
    },
  );

  describe.each(PART_NUMBERS)("when part %i has no text", (part) => {
    it.each([
      { label: "empty string", value: "" },
      { label: "null", value: null },
    ])("shows neither its text nor a locked row while unreleased ($label)", ({ value }) => {
      const story = buildStory({ [`storyPart${part}`]: value });
      const { text } = renderStory({ isPart1Released: false, isPart2Released: false, isPart3Released: false }, story);

      expect(text).not.toContain(PART_TEXTS[part]);
      expect(text).not.toContain(`La parte ${part} se desvela`);
    });

    it.each([
      { label: "empty string", value: "" },
      { label: "null", value: null },
    ])("shows neither its text nor a locked row once released ($label)", ({ value }) => {
      const story = buildStory({ [`storyPart${part}`]: value });
      const { text } = renderStory({ isPart1Released: true, isPart2Released: true, isPart3Released: true }, story);

      expect(text).not.toContain(PART_TEXTS[part]);
      expect(text).not.toContain(`La parte ${part} se desvela`);
    });
  });

  describe("media before part 1 is released", () => {
    it.each([
      { isPart1Released: false, isPart2Released: false, isPart3Released: false },
      { isPart1Released: false, isPart2Released: true, isPart3Released: true },
    ])(
      "renders no carousel, no image and no YouTube embed (part2=$isPart2Released, part3=$isPart3Released)",
      (flags) => {
        const { container, html } = renderStory(flags);

        expect(container.querySelector('[data-testid="carousel-mock"]')).toBeNull();
        expect(container.querySelector('[data-testid="youtube-mock"]')).toBeNull();
        expect(container.querySelector("img")).toBeNull();
        expect(container.querySelector("iframe")).toBeNull();
        expect(html).not.toContain(IMAGE_PUBLIC_ID);
        expect(html).not.toContain("MARKER-IMAGE-delta");
        expect(html).not.toContain(YOUTUBE_URL);
        expect(html).not.toContain("MARKERvideo");
      },
    );

    it("renders the carousel and the YouTube embed once every part is released", () => {
      const { container } = renderStory({ isPart1Released: true, isPart2Released: true, isPart3Released: true });

      expect(container.querySelector('[data-testid="carousel-mock"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="youtube-mock"]')).not.toBeNull();
    });
  });
});
