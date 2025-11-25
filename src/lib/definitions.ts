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
    errors: string[];
    properties?: {
      [K in keyof SignUpFormData]?: {
        errors: string[];
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
    [K in keyof SignInFormData]?: string[];
  };
}

export const initialSignInActionResponse: SignInActionResponse = {  
  success: false,
  message: "",
}