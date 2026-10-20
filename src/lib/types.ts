import { TeaType } from "@/generated/prisma/client";

export const DEFAULT_IMAGE_PROFILE = "advientea/2025-Caoslendario/avatars/kmz6ttle9ihjuosyqyns";
export interface SignUpFormData {
  email: string;
  image: File;
  password: string;
  passwordConfirmation?: string;
  username: string;
}

export interface ActionResponse {
  message: string;
  success: boolean;
}

export interface SignUpActionResponse {
  errors?: {
    errors: Array<string>;
    properties?: {
      [K in keyof SignUpFormData]?: {
        errors: Array<string>;
      };
    };
  };
  inputs?: SignUpFormData;
  message: string;
  success: boolean;
}

export const initialSignUpActionResponse: SignUpActionResponse = {
  message: "",
  success: false,
};

export type SignInFormData = Pick<SignUpFormData, "email" | "password">;
export interface SignInActionResponse {
  errors?: {
    [K in keyof SignInFormData]?: Array<string>;
  };
  message: string;
  success: boolean;
}

export const initialSignInActionResponse: SignInActionResponse = {
  message: "",
  success: false,
};

export interface TeaInfoFormData {
  dayNumber: number;
  personName: string;

  addMilk: boolean;
  canReinfuse: boolean;
  hasTheine: boolean;
  infusionTime: number;
  moreIndications?: string;
  reinfuseNumber?: number;
  storeName?: string;
  teaId?: string;
  teaName: string;
  temperature: number;
  urlStore?: string;

  onlyMusic: boolean;
  storyPart1: string;
  storyPart2: string;
  storyPart3: string;
  youtubeURL?: string;

  images?: Array<File>;
  imagesOrder?: Array<string>;
  keptImages?: Array<string>;
  keptImagesOrder?: Array<string>;
}

export interface TeaInfoActionResponse {
  errors?: {
    errors: Array<string>;
    properties?: {
      [K in keyof TeaInfoFormData]?: {
        errors: Array<string>;
      };
    };
  };
  inputs?: TeaInfoFormData;
  message: string;
  success: boolean;
}

export const initialTeaInfoActionResponse: TeaInfoActionResponse = {
  message: "",
  success: false,
};

type ImageStoryFormOld = {
  file?: never;
  id: string;
  isNew: false;
  order: number;
  previewURL?: never;
  publicId: string;
};

type ImageStoryFormNew = {
  file: File;
  id: string;
  isNew: true;
  order: number;
  previewURL: string;
  publicId?: never;
};

export type ImageStoryForm = ImageStoryFormNew | ImageStoryFormOld;

// SVG is excluded on purpose: it can embed scripts (stored XSS when served inline).
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
export interface UpdateProfileFormData {
  username: string;
  // email: string;
  currentPassword?: string;
  image?: File;
  newPassword?: string;
  newPasswordConfirmation?: string;
}

export interface UpdateProfileActionResponse {
  errors?: {
    errors: Array<string>;
    properties?: {
      [K in keyof UpdateProfileFormData]?: {
        errors: Array<string>;
      };
    };
  };
  inputs?: UpdateProfileFormData;
  message: string;
  success: boolean;
}

export const initialUpdateProfileActionResponse: UpdateProfileActionResponse = {
  message: "",
  success: false,
};

export interface TeaGuessFormData {
  ingredients?: Array<string>;
  personName?: string;
  teaName?: string;
  teaType?: TeaType;
}

export interface TeaGuessActionResponse {
  errors?: {
    errors: Array<string>;
    properties?: {
      [K in keyof TeaGuessFormData]?: {
        errors: Array<string>;
      };
    };
  };
  inputs?: Omit<TeaGuessFormData, "teaType"> & { teaType?: string };
  message: string;
  success: boolean;
}

export const initialTeaGuessActionResponse: TeaGuessActionResponse = {
  message: "",
  success: false,
};

export type SelectOption = {
  id: string;
  name: string;
};

export interface RankingEntry {
  avatar: string;
  points: number;
  rank: number;
  userId: string;
  username: string;
}
