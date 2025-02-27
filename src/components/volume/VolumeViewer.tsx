import React, { useEffect, useRef } from 'react'
import { cornerstoneStreamingDynamicImageVolumeLoader, cornerstoneStreamingImageVolumeLoader, init as csRenderInit, Enums, RenderingEngine, setVolumesForViewports, Types, volumeLoader } from "@cornerstonejs/core"
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

volumeLoader.registerUnknownVolumeLoader(
    cornerstoneStreamingImageVolumeLoader
)

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

    const loadUploadedFiles = async () => {
        const imageIds: string[] = []

        for (const file of fileDataRef.current.fileList) {
            // NOTE: 這個是新增的測試
            const imageId = await cornerstoneDICOMImageLoader.wadouri.fileManager.add(file)
            imageIds.push(imageId)
        }
        // NOTE: 這個是新增的測試
        fileDataRef.current.imageIdList = imageIds;
        console.log(fileDataRef.current.imageIdList)
        await prefetchMetadataInformation(fileDataRef.current.imageIdList);
        const stack = convertMultiframeImageIds(fileDataRef.current.imageIdList);
        return stack;
    }

    useEffect(() => {
        const setup = async () => {
            if (running.current || fileDataRef.current.fileList.length === 0) {
                console.log("Not running or no files uploaded")
                return;
            }
            if (!viewerRefAxial.current || !viewerRefCoronal.current || !viewerRefSagittal.current || !viewerRefVolume.current) {
                console.log('Rendering engine not initializing');
                return;
            }
            
            console.log('Rendering engine initializing');

            running.current = true;

            const setupMultpleViewports = async () => {

            }

            await csRenderInit();
            await csToolsInit();
            dicomImageLoaderInit({ maxWebWorkers: 1 });

            const stack = await loadUploadedFiles();

            // Instantiate a rendering engine
            const renderingEngineId = "volumeRenderingEngine"
            const renderingEngine = new RenderingEngine(renderingEngineId)
            // TODO: Make this dynamic
            // TODO: find out what this means
            const viewportIdAxial = "CT_AXIAL"
            const viewportIdCoronal = "CT_CORONAL"
            const viewportIdSagittal = "CT_SAGITTAL"

            const viewportInput = [
                {
                    viewportId: viewportIdAxial,
                    element: viewerRefAxial.current,
                    type: Enums.ViewportType.ORTHOGRAPHIC,
                    defaultOptions: {
                        orientation: Enums.OrientationAxis.AXIAL,
                    },
                },
                {
                    viewportId: viewportIdCoronal,
                    element: viewerRefCoronal.current,
                    type: Enums.ViewportType.ORTHOGRAPHIC,
                    defaultOptions: {
                        orientation: Enums.OrientationAxis.CORONAL,
                    },
                },
                {
                    viewportId: viewportIdSagittal,
                    element: viewerRefSagittal.current,
                    type: Enums.ViewportType.ORTHOGRAPHIC,
                    defaultOptions: {
                        orientation: Enums.OrientationAxis.SAGITTAL,
                    },
                }]

            renderingEngine.setViewports(viewportInput)

            // Get the stack viewport that was created
            // const viewport = renderingEngine.getViewports([viewportInput]) as Types.IVolumeViewport

            // Define a volume in memory, is not equal to load the volume
            // TODO: find out what this means
            const volumeId = "streamingImageVolume"
            console.log({ volumeId })
            const volume = await volumeLoader.createAndCacheVolume(volumeId, {
                imageIds: fileDataRef.current.imageIdList,
            })
            console.log(volume)

            // Set the volume to  load
            // @ts-ignore
            volume.load()

            // Set the volume on the viewport and it's default properties
            // viewport.setVolumes([{ volumeId }]) 
            setVolumesForViewports(
                renderingEngine,
                [{ volumeId }],
                [viewportIdAxial, viewportIdCoronal, viewportIdSagittal]
            )

            // Render the image
            // viewport.render()
            renderingEngine.renderViewports([viewportIdAxial, viewportIdCoronal, viewportIdSagittal])
        }

        setup()
    }, [viewerRefAxial, viewerRefCoronal, viewerRefSagittal, running])

    return (
        <div>
            <input
                type="file"
                multiple
                accept=".dcm"
                onChange={handleFileChange}
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
        </div>
    )
}

export default VolumeViewer