import { TeaType } from "@/generated/prisma/client";

export const DEFAULT_IMAGE_PROFILE = "advientea/2025-Caoslendario/avatars/kmz6ttle9ihjuosyqyns";
export interface SignUpFormData {
  username: string;
  email: string;
  password: string;
  passwordConfirmation?: string;
  image: File;
}

export interface SignUpActionResponse {
  success: boolean;
  message: string;
  errors?: {
    errors: Array<string>;
    properties?: {
      [K in keyof SignUpFormData]?: {
        errors: Array<string>;
      }
    }
  };
  inputs?: SignUpFormData
}

export const initialSignUpActionResponse: SignUpActionResponse = {  
  success: false,
  message: "",
}

export type SignInFormData = Pick<SignUpFormData, "email" | "password">
export interface SignInActionResponse {
  success: boolean;
  message: string;
  errors?: {
    [K in keyof SignInFormData]?: Array<string>;
  };
}

export const initialSignInActionResponse: SignInActionResponse = {  
  success: false,
  message: "",
}

export interface TeaInfoFormData {
  personName: string;
  dayNumber: number;
  
  teaName: string;
  temperature: number;
  infusionTime: number;
  hasTheine: boolean;
  addMilk: boolean;
  canReinfuse: boolean;
  reinfuseNumber?: number;
  moreIndications?: string;
  storeName?: string;
  urlStore?: string;
  teaId?: string;
  
  storyPart1: string;
  storyPart2: string;
  storyPart3: string;
  youtubeURL?: string;
  onlyMusic: boolean;
  
  images?: Array<File>;
  imagesOrder?: Array<string>;
  keptImages?: Array<string>;
  keptImagesOrder?: Array<string>;
  deleteImages?: Array<string>;
}

export interface TeaInfoActionResponse {
  success: boolean;
  message: string;
  errors?: {
    errors: Array<string>;
    properties?: {
      [K in keyof TeaInfoFormData]?: {
        errors: Array<string>;
      }
    }
  };
  inputs?: TeaInfoFormData;
}

export const initialTeaInfoActionResponse: TeaInfoActionResponse = {
  success: false,
  message: "",
}

type ImageStoryFormOld = {
  id: string,
  order: number,
  isNew: false,
  publicId: string
  previewURL?: never,
  file?: never,
}

type ImageStoryFormNew = {
  id: string,
  order: number,
  isNew: true,
  previewURL: string
  file: File,
  publicId?: never
}

export type ImageStoryForm = ImageStoryFormOld | ImageStoryFormNew;

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"];
export interface UpdateProfileFormData {
  username: string;
  // email: string;
  currentPassword?: string,
  newPassword?: string;
  newPasswordConfirmation?: string;
  image?: File;
}

export interface UpdateProfileActionResponse {
  success: boolean;
  message: string;
  errors?: {
    errors: Array<string>;
    properties?: {
      [K in keyof UpdateProfileFormData]?: {
        errors: Array<string>;
      }
    }
  };
  inputs?: UpdateProfileFormData
}

export const initialUpdateProfileActionResponse: UpdateProfileActionResponse = {
  success: false,
  message: "",
}

export interface TeaGuessFormData {
  teaName?: string;
  teaType?: TeaType;
  ingredients?: Array<string>;
  personName?: string;
  personType?: "userId" | "guestName";
}

export interface TeaGuessActionResponse {
  success: boolean;
  message: string;
  errors?: {
    errors: Array<string>;
    properties?: {
      [K in keyof TeaGuessFormData]?: {
        errors: Array<string>;
      }
    }
  };
  inputs?: Omit<TeaGuessFormData, "teaType" | "personType"> & { teaType?: string, personType?: string };
}