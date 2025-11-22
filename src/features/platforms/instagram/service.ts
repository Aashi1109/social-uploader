import type { JsonSchema } from "@/shared/types/json";
import type { InstagramSecret } from "@/shared/secrets/schemas";
import config from "@/config";
import { createSearchParams, snakeCase } from "@/shared/utils";
import axios, { AxiosInstance } from "axios";
import CustomError from "@/shared/exceptions/CustomError";
import { BadRequestError } from "@/shared/exceptions";
import { Readable } from "stream";
import { stat } from "fs/promises";
import { createReadStream } from "node:fs";
import { validateInstagramPublishArgs } from "./validation";
import { VendorVerifyResult } from "@/shared/interfaces";

export enum MediaType {
  Carousel = "CAROUSEL",
  // Stories = "STORIES", // not yet supported
  Reels = "REELS",
}

export enum CarouselChildType {
  Image = "IMAGE",
  Video = "VIDEO",
}

type VideoInput = {
  coverUrl?: string;
  audioName: string;
  thumbOffset?: number;
  collaborators?: string[];
  resumable?: boolean;

  url?: string;
  filePath?: string;
  data?: ArrayBuffer | Uint8Array;
};

type BaseCommonProps = {
  caption?: string;
  locationId?: string;
  userTags?: string[];
  mediaType: MediaType;
};

/**
 * CreateContainerArgs mirrors IG Graph API constraints:
 * - Carousel: accepts child media inputs (image/video). Service creates child containers
 *   with is_carousel_item=true, collects creation IDs, then creates the parent.
 * - Reels: media_type=REELS, either provide video_url or use resumable upload (upload_type).
 *   Optional: cover_url, audio_name, thumb_offset, collaborators, etc.
 */

type CarouselChildInput =
  | ({ type: CarouselChildType.Image } & {
      mediaUrl: string; // maps to image_url
      altText?: string;
    })
  | ({ type: CarouselChildType.Video } & VideoInput);

type CarouselParentArgs = BaseCommonProps & {
  children: CarouselChildInput[]; // raw child media inputs
};
type ReelsArgs = BaseCommonProps & VideoInput;

type CreateContainerArgs =
  | ({ mediaType: MediaType.Carousel } & CarouselParentArgs)
  | ({ mediaType: MediaType.Reels } & ReelsArgs);

type VideoContainerArgs = BaseCommonProps &
  VideoInput & {
    video: VideoInput;
    isCarouselItem?: boolean;
    isReels?: boolean;
  };

class InstagramService {
  #instagramUserId: string;
  #accessToken: string;
  #axiosClient: AxiosInstance;

  constructor(instagramUserId: string, accessToken: string) {
    if (
      !instagramUserId ||
      typeof instagramUserId !== "string" ||
      !accessToken ||
      typeof accessToken !== "string"
    ) {
      throw new Error("Instagram user ID and access token are required");
    }
    this.#instagramUserId = instagramUserId;
    this.#accessToken = accessToken;
    this.#axiosClient = axios.create({
      baseURL: this.#getBaseUrl(),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.#accessToken}`,
      },
    });
  }

  async verify(
    data: InstagramSecret & JsonSchema
  ): Promise<VendorVerifyResult> {
    try {
      const appId = String(data.appId || "");
      const appSecret = String(data.appSecret || "");
      const userAccessToken = String(data.tokens || "");
      const businessAccountId = String(data.businessAccountId || "");

      const appToken = `${appId}|${appSecret}`;
      const debugUrl = new URL("https://graph.facebook.com/v19.0/debug_token");
      debugUrl.searchParams.set("input_token", userAccessToken);
      debugUrl.searchParams.set("access_token", appToken);
      const debugRes = await axios.get(debugUrl.toString());
      const debugBody: any = await debugRes.data;
      const isValid = !!debugBody?.data?.is_valid;
      if (!isValid) {
        return {
          errors: { message: "Debug token is not valid" },
        };
      }
      const acctUrl = new URL(
        `https://graph.facebook.com/v19.0/${encodeURIComponent(businessAccountId)}`
      );
      acctUrl.searchParams.set("fields", "id,username");
      acctUrl.searchParams.set("access_token", userAccessToken);
      const acctRes = await axios.get(acctUrl.toString());

      const acctBody: any = await acctRes.data;
      if (!acctBody?.id) {
        return {
          errors: { message: "Business account is not valid" },
        };
      }
      return {
        data: { accountId: acctBody.id, username: acctBody.username },
      };
    } catch (e: any) {
      return {
        errors: { message: e.message },
      };
    }
  }

  #getBaseUrl() {
    return `${config.platforms.instagram.graphUrl}/v${config.platforms.instagram.graphVersion}/${encodeURIComponent(this.#instagramUserId)}`;
  }

  async #createMediaContainer(
    params: Record<string, string | number | boolean | undefined>
  ) {
    const mergedParams = createSearchParams(params, snakeCase);
    const res = await this.#axiosClient.post(`/media?${mergedParams}`);
    if (res.status !== 200) {
      throw new CustomError(`Failed to create container`, res.status, res.data);
    }
    return res.data;
  }

  async createContainers({ mediaType, ...args }: CreateContainerArgs) {
    let searchParams: Record<string, string | number | boolean | undefined>;
    if (mediaType === MediaType.Carousel) {
      const { caption, locationId, userTags, children } =
        args as CarouselParentArgs;
      // 1) Create child containers in parallel
      const containerPromises = children.map(async (child) => {
        let params: Record<string, any> = {
          accessToken: this.#accessToken,
          isCarouselItem: true,
        };

        if (child.type === CarouselChildType.Image) {
          params = {
            ...params,
            imageUrl: child.mediaUrl,
            altText: child.altText,
            mediaType: CarouselChildType.Image,
          };
        } else if (child.type === CarouselChildType.Video) {
          params = {
            ...params,
            uploadType: "resumable",
            mediaType: CarouselChildType.Video,
          };
        } else {
          throw new BadRequestError("Invalid child type");
        }
        const result = await this.#createMediaContainer(params);
        const metadata = { mediaType: child.type };
        return { ...result, ...metadata };
      });
      const childResults = await Promise.all(containerPromises);
      const childIds = childResults.map((r) => r.id);

      searchParams = {
        media_type: MediaType.Carousel,
        children: childIds.join(","), // IG expects comma-separated creation IDs
        caption,
        location_id: locationId,
        user_tags: userTags?.join(","),
        access_token: this.#accessToken,
      };
      const container = await this.#createMediaContainer(searchParams);
      return { carousel: container, children: childResults };
    } else if (mediaType === MediaType.Reels) {
      const params = {
        ...args,
        userTags: args.userTags?.join(","),
        uploadType: "resumable",
      } as Record<string, any>;

      const result = await this.#createMediaContainer(params);
      return result;
    } else {
      throw new BadRequestError(`Invalid media type: ${mediaType}`);
    }
  }

  async publishContainer(creationId: string) {
    const baseUrl = `${this.#getBaseUrl()}/media_publish`;

    const mergedParams = createSearchParams({
      creation_id: creationId,
      access_token: this.#accessToken,
    });
    const url = `${baseUrl}?${mergedParams}`;
    const res = await axios.post(url);
    if (res.status !== 200) {
      throw new Error(`Failed to publish container: ${res.statusText}`);
    }
    return res.data;
  }

  getVideoKind(args: VideoInput) {
    if (args.data && args.url && args.filePath)
      throw new BadRequestError(
        "Video input must provide only one of data, filePath, or url"
      );

    if (args.data) return { kind: "buffer", data: args.data };
    if (args.filePath) return { kind: "filepath", data: args.filePath };
    if (args.url) return { kind: "url", url: args.url };
    throw new BadRequestError(
      "Video input must provide data, filePath, or url"
    );
  }

  async publish(args: CreateContainerArgs) {
    const isValid = validateInstagramPublishArgs(args as any);
    if (!isValid) {
      const errorMessage = validateInstagramPublishArgs.errors
        ?.map((detail: any) => detail.message)
        .join(", ");
      throw new BadRequestError(`Validation error: ${errorMessage}`);
    }

    let filteredArgs = {};
    const videoData: Record<string, any> = {};

    if (args.mediaType === MediaType.Reels) {
      videoData[0] = this.getVideoKind(args as VideoInput);
      delete args.url;
      delete args.filePath;
      delete args.data;
      filteredArgs = { ...args };
    } else if (args.mediaType === MediaType.Carousel) {
      const { children, ...restArgs } = args as CarouselParentArgs;
      children.forEach((c, index) => {
        if (c.type === CarouselChildType.Video) {
          videoData[index] = this.getVideoKind(c as VideoInput);
          delete (c as VideoInput).url;
          delete (c as VideoInput).filePath;
          delete (c as VideoInput).data;
        }
      });
      filteredArgs = { ...restArgs, children };
    }

    const containers = await this.createContainers(
      filteredArgs as CreateContainerArgs
    );

    let videoContainers = [];
    if (args.mediaType === MediaType.Reels) {
      videoContainers = [{ ...containers, ...videoData[0] }];
    } else if (args.mediaType === MediaType.Carousel) {
      videoContainers = containers.children
        .map((c: any, index: number) =>
          c.mediaType === CarouselChildType.Video
            ? { ...c, ...videoData[index] }
            : undefined
        )
        .filter(Boolean);
    }
    const videoPromises = videoContainers.map(async (f: any) => {
      const streamData = await this.sourceToStreamAndSize(f);
      if (!streamData) {
        throw new Error("Failed to get stream and size");
      }
      const uploadResult = await this.uploadToRupload({
        uploadUrl: f.uploadUrl,
        accessToken: this.#accessToken,
        stream: streamData.stream,
        totalSize: streamData.size,
      });
      return uploadResult;
    });
    const uploadResults = await Promise.all(videoPromises);

    let containersToPublish: string[] = [];
    if (args.mediaType === MediaType.Reels) {
      containersToPublish = [containers.id];
    } else if (args.mediaType === MediaType.Carousel) {
      containersToPublish = [containers.carousel.id];
    }
    const publishPromises = containersToPublish.map((id) =>
      this.publishContainer(id)
    );
    const publishResults = await Promise.all(publishPromises);
    return { success: "true", data: publishResults };
  }

  async headContentLength(url: string): Promise<number | undefined> {
    const res = await fetch(url, { method: "HEAD" });
    const len = res.headers.get("content-length");
    return len ? Number(len) : undefined;
  }

  async sourceToStreamAndSize(
    src:
      | { kind: "filepath"; data: string }
      | { kind: "buffer"; data: Buffer | Uint8Array }
      | { kind: "stream"; stream: Readable; sizeBytes: number }
      | { kind: "url"; url: string }
  ) {
    if (src.kind === "filepath") {
      const size = await stat(src.data);
      return { stream: createReadStream(src.data), size: size.size };
    }
    if (src.kind === "buffer") {
      const data = Buffer.isBuffer(src.data) ? src.data : Buffer.from(src.data);
      return { stream: Readable.from(data), size: data.length };
    }
    if (src.kind === "stream") {
      if (typeof src.sizeBytes !== "number")
        throw new Error("For kind=stream you must provide sizeBytes.");
      return { stream: src.stream as Readable, size: src.sizeBytes };
    }
    if (src.kind === "url") {
      const size = await this.headContentLength(src.url);
      const stream = await this.getUrl(src.url, size);
      return stream;
    }
  }

  async getUrl(url: string, sizeHintBytes?: number) {
    // Try HEAD for size
    let size = await this.headContentLength(url);
    if (!size && sizeHintBytes) size = sizeHintBytes;
    if (!size)
      throw new Error(
        "content-length not available for URL and no sizeHintBytes provided."
      );
    const res = await axios.get(url, { responseType: "stream" });
    if (res.status !== 200)
      throw new Error(`Failed to GET remote URL: ${res.status}`);
    // Convert web ReadableStream -> Node Readable
    const nodeStream = Readable.fromWeb(res.data);
    return { stream: nodeStream, size };
  }

  async uploadToRupload({
    uploadUrl,
    stream,
    totalSize,
    chunkSize = 4 * 1024 * 1024, // 4MB
  }: {
    uploadUrl: string;
    accessToken: string;
    stream: Readable;
    totalSize: number;
    chunkSize?: number;
  }) {
    let offset = 0;
    let buffer = Buffer.alloc(0);

    for await (const chunk of stream) {
      buffer = Buffer.concat([
        buffer,
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
      ]);
      while (buffer.length >= chunkSize) {
        const slice = buffer.subarray(0, chunkSize);
        await this.sendChunk(uploadUrl, slice, offset, totalSize);
        offset += slice.length;
        buffer = buffer.subarray(chunkSize);
      }
    }
    if (buffer.length > 0) {
      await this.sendChunk(uploadUrl, buffer, offset, totalSize);
      offset += buffer.length;
    }
    if (offset !== totalSize) {
      throw new Error(
        `Upload size mismatch. Sent ${offset}, expected ${totalSize}`
      );
    }
  }

  async sendChunk(
    uploadUrl: string,
    chunk: Buffer,
    offset: number,
    totalSize: number
  ) {
    const res = await axios.post(uploadUrl, chunk, {
      headers: {
        Authorization: `OAuth ${this.#accessToken}`,
        offset: String(offset),
        file_size: String(totalSize),
      },
    });
    if (res.status !== 200) {
      throw new Error(
        `Chunk failed @offset ${offset}: ${res.status} ${res.statusText}`
      );
    }
  }
}

export default InstagramService;
