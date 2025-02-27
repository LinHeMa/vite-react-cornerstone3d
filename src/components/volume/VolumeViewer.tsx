import React, { useEffect, useRef } from 'react'
import { cornerstoneStreamingImageVolumeLoader, init as csRenderInit, Enums, RenderingEngine, Types, volumeLoader } from "@cornerstonejs/core"
import { init as csToolsInit } from "@cornerstonejs/tools"
import cornerstoneDICOMImageLoader, { init as dicomImageLoaderInit } from "@cornerstonejs/dicom-image-loader"
import { convertMultiframeImageIds, prefetchMetadataInformation } from '../../utils/prefetchMetadataInformation'

type FileDataRefType = {
    fileList: File[];
    imageIdList: string[]
}

volumeLoader.registerUnknownVolumeLoader(
    cornerstoneStreamingImageVolumeLoader
)

const VolumeViewer = () => {
    const fileDataRef = useRef<FileDataRefType>({ fileList: [], imageIdList: [] })
    const running = useRef(false)
    const viewerRef = useRef<HTMLDivElement>(null)

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

            running.current = true;

            await csRenderInit();
            await csToolsInit();
            dicomImageLoaderInit({ maxWebWorkers: 1 });

            const stack = await loadUploadedFiles();

            // Instantiate a rendering engine
            const renderingEngineId = "volumeRenderingEngine"
            const renderingEngine = new RenderingEngine(renderingEngineId)
            // TODO: Make this dynamic
            // TODO: find out what this means
            const viewportId = "sponge"

            const viewportInput = {
                viewportId,
                element: viewerRef.current,
                type: Enums.ViewportType.ORTHOGRAPHIC,
                defaultOptions: {
                    orientation: Enums.OrientationAxis.AXIAL,
                },
            }

            renderingEngine.enableElement(viewportInput)

            // Get the stack viewport that was created
            const viewport = renderingEngine.getViewport(viewportId) as Types.IVolumeViewport

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
            viewport.setVolumes([{ volumeId }])

            // Render the image
            viewport.render()
        }

        setup()
    }, [viewerRef, running])

    return (
        <div>
            <input
                type="file"
                multiple
                accept=".dcm"
                onChange={handleFileChange}
            />
            <div
                ref={viewerRef}
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