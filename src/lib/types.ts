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