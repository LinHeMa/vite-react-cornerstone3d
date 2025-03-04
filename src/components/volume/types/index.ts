import { type RenderingEngine } from "@cornerstonejs/core";
import { type IToolGroup } from "@cornerstonejs/tools/types";

export type FileDataRefType = {
    renderingEngine: RenderingEngine | null;
    renderingEngineId: string;
    toolGroup2D: null | IToolGroup;
    toolGroupId2D: string;
    toolGroup3D: null | IToolGroup;
    toolGroupId3D: string;
    viewportIds: string[];
    volumeId: string;
    fileList: File[];
    imageIdList: string[]
    segmentationId: string
}