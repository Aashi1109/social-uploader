export interface IPublishRequest {
  type: "video" | "image";
  mediaUrl?: string;
  title?: string;
  description?: string;
  fileData?: string;
}
