import React, { useEffect, useRef } from 'react'
import { init as csRenderInit, Enums, RenderingEngine, setVolumesForViewports, Types, volumeLoader, utilities as csUtilities, imageLoader, cache } from "@cornerstonejs/core"
import { init as csToolsInit } from "@cornerstonejs/tools"
import cornerstoneDICOMImageLoader, { init as dicomImageLoaderInit } from "@cornerstonejs/dicom-image-loader"
import { convertMultiframeImageIds, prefetchMetadataInformation } from '../../utils/prefetchMetadataInformation'

type FileDataRefType = {
    renderingEngine: RenderingEngine | null;
    renderingEngineId: string;
    toolGroup: null;
    toolGroupId: string;
    viewportIds: string[];
    volumeId: string;
    fileList: File[];
    imageIdList: string[]
}

// volumeLoader.registerUnknownVolumeLoader(
//     cornerstoneStreamingImageVolumeLoader
// )

const VolumeViewer = () => {
    const fileDataRef = useRef<FileDataRefType>({
        renderingEngine: null,
        renderingEngineId: 'MY_RENDERING_ENGINE_ID',
        toolGroup: null,
        toolGroupId: 'MY_TOOL_GROUP_ID',
        viewportIds: ['CT_AXIAL', 'CT_SAGITTAL', 'CT_CORONAL', 'CT_VOLUME'],
        volumeId: '',
        fileList: [],
        imageIdList: []
    });
    const running = useRef(false);
    const viewerRefAxial = useRef<HTMLDivElement>(null);
    const viewerRefCoronal = useRef<HTMLDivElement>(null);
    const viewerRefSagittal = useRef<HTMLDivElement>(null);
    const viewerRefVolume = useRef<HTMLDivElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = Array.from(event.target.files);
        if (fileList && fileDataRef) {
            fileDataRef.current.fileList = fileList;
        }
        console.log(fileDataRef.current.fileList)
    }
    const restart = () => {
        console.debug('Restarting some ui state about multiple file upload');
        const { volumeId } = fileDataRef.current;

        if (!volumeId) {
            return;
        }

        cache.removeVolumeLoadObject(volumeId);
    };

    const readUploadedFiles = async (files: File[]) => {
        for (const file of files) {
            // NOTE: 這個是新增的測試
            const imageId = await cornerstoneDICOMImageLoader.wadouri.fileManager.add(file)
            await imageLoader.loadAndCacheImage(imageId);
            fileDataRef.current.imageIdList.push(imageId)
        }
    }

    const loadUploadedFiles = async () => {
        restart()
        const volumeLoaderScheme = 'cornerstoneStreamingImageVolume';
        const {
            volumeId,
            toolGroup,
            imageIdList,
            viewportIds,
            renderingEngineId,
            renderingEngine,
        } = fileDataRef.current;
        fileDataRef.current.volumeId = volumeLoaderScheme + ':' + csUtilities.uuidv4();

        const volume = await volumeLoader.createAndCacheVolume(fileDataRef.current.volumeId, {
            imageIds: imageIdList,
        });

        await volume.load();

        // viewportIds[3] 是 volume viewport
        const viewport = renderingEngine.getViewport(viewportIds[3]);
        await setVolumesForViewports(
            renderingEngine,
            [{ volumeId: fileDataRef.current.volumeId }],
            viewportIds,
        );

        renderingEngine.render();
        viewport.render();
    }

    const handleMultipleFileUpload = async (event: React.ChangeEvent<HTMLInputElement> | Event): Promise<void> => {
        const files = Array.from((event.target as HTMLInputElement).files || []);
        await readUploadedFiles(files);
        await loadUploadedFiles();
    }

    useEffect(() => {
        if (
            !viewerRefAxial.current ||
            !viewerRefCoronal.current ||
            !viewerRefSagittal.current ||
            !viewerRefVolume.current
        ) {
            console.log('Rendering engine not initializing');
            return;
        }

        console.log('Rendering engine initializing');

        const setupMultpleViewports = async () => {
            console.log('setupMultpleViewports')
            const renderingEngine = new RenderingEngine(fileDataRef.current.renderingEngineId);

            const viewportInputArray = [
                {
                    viewportId: fileDataRef.current.viewportIds[0],
                    type: Enums.ViewportType.ORTHOGRAPHIC,
                    element: viewerRefAxial.current,
                    defaultOptions: {
                        orientation: Enums.OrientationAxis.AXIAL,
                        background: [0.2, 0, 0.2] as Types.RGB,
                    },
                },
                {
                    viewportId: fileDataRef.current.viewportIds[1],
                    type: Enums.ViewportType.ORTHOGRAPHIC,
                    element: viewerRefCoronal.current,
                    defaultOptions: {
                        orientation: Enums.OrientationAxis.CORONAL,
                        background: [0.2, 0, 0.2] as Types.RGB,
                    },
                },
                {
                    viewportId: fileDataRef.current.viewportIds[2],
                    type: Enums.ViewportType.ORTHOGRAPHIC,
                    element: viewerRefSagittal.current,
                    defaultOptions: {
                        orientation: Enums.OrientationAxis.SAGITTAL,
                        background: [0.2, 0, 0.2] as Types.RGB,
                    },
                },
                {
                    viewportId: fileDataRef.current.viewportIds[3],
                    type: Enums.ViewportType.VOLUME_3D,
                    element: viewerRefVolume.current,
                    defaultOptions: {
                        orientation: Enums.OrientationAxis.AXIAL,
                        background: [0.2, 0, 0.2] as Types.RGB,
                    },
                }
            ]

            renderingEngine.setViewports(viewportInputArray);
            console.log('renderingEngine', renderingEngine)
            fileDataRef.current.renderingEngine = renderingEngine;
        }
        const setup = async () => {
            if (running.current) {
                console.log("Not running or no files uploaded")
                return;
            }

            running.current = true;

            // cornerstoneDICOMImageLoader.init({ maxWebWorkers: 1 });
            dicomImageLoaderInit({ maxWebWorkers: 1 });
            await csRenderInit();
            await csToolsInit();
            setupMultpleViewports();
            console.debug('Rendering engine initialized');
        }

        setup()
    }, [viewerRefAxial, viewerRefCoronal, viewerRefSagittal, viewerRefVolume, running])

    useEffect(() => {
        console.log('fileDataRef.current', fileDataRef.current)
    })

    return (
        <div>
            <input
                type="file"
                multiple
                accept=".dcm"
                onChange={handleMultipleFileUpload}
            />
            <div
                ref={viewerRefAxial}
                style={{
                    width: "512px",
                    height: "512px",
                    backgroundColor: "#000",
                }}
            />
            <div
                ref={viewerRefCoronal}
                style={{
                    width: "512px",
                    height: "512px",
                    backgroundColor: "#000",
                }}
            />
            <div
                ref={viewerRefSagittal}
                style={{
                    width: "512px",
                    height: "512px",
                    backgroundColor: "#000",
                }}
            />
            <div
                ref={viewerRefVolume}
                style={{
                    width: "512px",
                    height: "512px",
                    backgroundColor: "#000",
                }}
            />
        </div>
    )
}

export default VolumeViewer