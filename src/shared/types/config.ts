import type { PlatformName } from './publish';

export interface PlatformConfig {
	name: PlatformName;
	enabled: boolean;
	mediaProfile: {
		maxDurationSeconds?: number;
		minAspectRatio?: number;
		maxAspectRatio?: number;
		maxFileSizeMB?: number;
	};
}

export interface ProjectConfig {
	projectId: string;
	platforms: PlatformConfig[];
}


