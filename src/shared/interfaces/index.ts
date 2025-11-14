import { JsonObject } from "../types/json";

export interface BasePlatformService {
  verify(data: JsonObject): Promise<VendorVerifyResult>;
  publish(data: JsonObject): Promise<VendorPublishResult>;
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
