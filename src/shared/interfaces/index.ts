import { JsonObject, JsonSchema } from "../types/json";

export interface BasePlatformService {
  verify(tokens: any): Promise<VendorVerifyResult>;
  publish(data: any): Promise<VendorPublishResult>;
}

export type VendorVerifyResult = {
  errors?: {
    message: string;
    [key: string]: any;
  };
  data?: {
    isIncomplete?: boolean;
    [key: string]: any;
  };
};

export interface VendorPublishResult extends VendorVerifyResult {
  creationId?: string;
  requestId: string;
}
