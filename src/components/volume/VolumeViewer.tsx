import React, { useEffect, useRef } from 'react'
import { init as csRenderInit, Enums, RenderingEngine, setVolumesForViewports, Types, volumeLoader, utilities as csUtilities, imageLoader, cache, } from "@cornerstonejs/core"
import { addTool, BrushTool, init as csToolsInit, ToolGroupManager, segmentation, Enums as ToolEnums } from "@cornerstonejs/tools"
import cornerstoneDICOMImageLoader, { init as dicomImageLoaderInit } from "@cornerstonejs/dicom-image-loader"
import { addManipulationBindings } from '../../lib/addManipulationBindings'
import labelmapTools from '../../lib/labelMapTools'
import { MouseBindings } from '@cornerstonejs/tools/enums'
import { type FileDataRefType } from './types'
import { BlendModes } from '@cornerstonejs/core/enums'


const VolumeViewer = () => {
    const fileDataRef = useRef<FileDataRefType>({
        renderingEngine: null,
        renderingEngineId: 'MY_RENDERING_ENGINE_ID',
        toolGroup2D: null,
        toolGroupId2D: 'MY_2D_TOOL_GROUP_ID',
        toolGroup3D: null,
        toolGroupId3D: 'MY_3D_TOOL_GROUP_ID',
        viewportIds: ['CT_AXIAL', 'CT_SAGITTAL', 'CT_CORONAL', 'CT_VOLUME'],
        volumeId: 'cornerstoneStreamingImageVolume' + ':' + csUtilities.uuidv4(),
        fileList: [],
        imageIdList: [],
        segmentationId: 'LOAD_SEG_ID:' + csUtilities.uuidv4(),
    });
    const running = useRef(false);
    const viewerRefAxial = useRef<HTMLDivElement>(null);
    const viewerRefCoronal = useRef<HTMLDivElement>(null);
    const viewerRefSagittal = useRef<HTMLDivElement>(null);
    const viewerRefVolume = useRef<HTMLDivElement>(null);


    const restart = () => {
        console.debug('Restarting some ui state about multiple file upload');
        const { volumeId } = fileDataRef.current;

        if (!volumeId) {
            console.error('volumeId is not set')
            return;
        }

        cache.removeVolumeLoadObject(volumeId);
    };

    /**
     * 載入 File 
     * @param {File} file - 要加載的 DICOM 文件。
     * @returns {Promise<string>} 返回加載的圖像 ID。
     */
    const loadImageIntoFileManager = async (file: File): Promise<string> => {
        const imageId = await cornerstoneDICOMImageLoader.wadouri.fileManager.add(file);
        await imageLoader.loadAndCacheImage(imageId);
        return imageId;
    };

    const readUploadedFiles = async (files: File[]) => {
        fileDataRef.current.imageIdList = [];
        for (const file of files) {
            const imageId = await loadImageIntoFileManager(file);
            fileDataRef.current.imageIdList.push(imageId)
        }
    }

    const loadUploadedFiles = async () => {
        restart()
        const {
            imageIdList,
            viewportIds,
            renderingEngine,
        } = fileDataRef.current;

        if (!renderingEngine || imageIdList.length === 0) {
            console.error('渲染引擎未初始化或沒有圖像');
            return;
        }


        try {
            const volume = await volumeLoader.createAndCacheVolume(fileDataRef.current.volumeId, {
                imageIds: imageIdList,
            });


            await volumeLoader.createAndCacheDerivedLabelmapVolume(fileDataRef.current.volumeId, {
                volumeId: fileDataRef.current.segmentationId
            })

            segmentation.addSegmentations([{
                segmentationId: fileDataRef.current.segmentationId,
                representation: {
                    type: ToolEnums.SegmentationRepresentations.Labelmap,
                    data: {
                        volumeId: fileDataRef.current.segmentationId
                    }
                },
            }]);

            await volume.load();

            segmentation.activeSegmentation.setActiveSegmentation(
                fileDataRef.current.segmentationId,
                ToolEnums.SegmentationRepresentations.Labelmap
            )

            // viewportIds[3] 是 3d volume viewport
            const viewport = renderingEngine.getViewport(viewportIds[3]);
            await setVolumesForViewports(
                renderingEngine,
                [{
                    volumeId: fileDataRef.current.volumeId,
                    callback: ({ volumeActor }) => {
                        // set the windowLevel after the volumeActor is created
                        volumeActor
                            .getProperty()
                            .getRGBTransferFunction(0)
                            .setMappingRange(-180, 220);
                    },
                    blendMode: BlendModes.MAXIMUM_INTENSITY_BLEND,
                    slabThickness: 10,
                }],
                viewportIds,
            );
            //TODO: fix ts problem
            // this is necessary to setup the 3D viewport
            (viewport as any).setProperties({
                // preset candidates
                // https://github.com/cornerstonejs/cornerstone3D/blob/main/packages/core/src/constants/viewportPresets.ts
                // preset: 'MR-MIP', 
                preset: 'CT-Bone',
            });
            /**
             * set for brush tool
             */
            await segmentation.addLabelmapRepresentationToViewportMap({
                [viewportIds[0]]: [
                    {
                        segmentationId: fileDataRef.current.segmentationId,
                        type: ToolEnums.SegmentationRepresentations.Labelmap,
                    },
                ],
                [viewportIds[1]]: [
                    {
                        segmentationId: fileDataRef.current.segmentationId,
                        type: ToolEnums.SegmentationRepresentations.Labelmap,
                    },
                ],
                [viewportIds[2]]: [
                    {
                        segmentationId: fileDataRef.current.segmentationId,
                        type: ToolEnums.SegmentationRepresentations.Labelmap,
                    },
                ]
            })

            renderingEngine.render();
        } catch (error) {
            console.error('加載volume時出錯:', error);
        }
    }

    const handleMultipleFileUpload = async (event: React.ChangeEvent<HTMLInputElement> | Event): Promise<void> => {
        const files = Array.from((event.target as HTMLInputElement).files || []);

        if (files.length === 0) {
            console.warn('沒有選擇文件');
            return;
        }

        // 確保渲染引擎已初始化
        if (!fileDataRef.current.renderingEngine) {
            console.error('渲染引擎尚未初始化');
            return;
        }

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
            // 2d tool
            fileDataRef.current.toolGroup2D = ToolGroupManager.createToolGroup(
                fileDataRef.current.toolGroupId2D,
            );
            addManipulationBindings(fileDataRef.current.toolGroup2D, {
                toolMap: labelmapTools.toolMap,
            });
            addTool(BrushTool);
            fileDataRef.current.toolGroup2D.addToolInstance('CircularBrush', BrushTool.toolName, {
                activeStrategy: 'FILL_INSIDE_CIRCLE',
            });
            fileDataRef.current.toolGroup2D.setToolActive('CircularBrush', {
                bindings: [{ mouseButton: MouseBindings.Primary }],
            });
            /** 3d tool 
             NOTE: needs 2 ids because we use different tool group for 2d and 3d
             for example, if we use the same tool group id for the case,
             the 3d will have brush tool and 2d will not
             */
            fileDataRef.current.toolGroup3D = ToolGroupManager.createToolGroup(fileDataRef.current.toolGroupId3D);
            // Add the tools to the tool group and specify which volume they are pointing at
            addManipulationBindings(fileDataRef.current.toolGroup3D, {
                is3DViewport: true,
            });

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
            console.log('viewportInputArray', viewportInputArray, fileDataRef.current);

            renderingEngine.setViewports(viewportInputArray);
            fileDataRef.current.renderingEngine = renderingEngine;

            // 2d tool
            fileDataRef.current.toolGroup2D.addViewport(fileDataRef.current.viewportIds[0], fileDataRef.current.renderingEngineId);
            fileDataRef.current.toolGroup2D.addViewport(fileDataRef.current.viewportIds[1], fileDataRef.current.renderingEngineId);
            fileDataRef.current.toolGroup2D.addViewport(fileDataRef.current.viewportIds[2], fileDataRef.current.renderingEngineId);
            // 3d tool
            fileDataRef.current.toolGroup3D.addViewport(fileDataRef.current.viewportIds[3], fileDataRef.current.renderingEngineId);

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

    return (
        <>
            <input
                className='cursor-pointer'
                type="file"
                multiple
                accept=".dcm"
                onChange={handleMultipleFileUpload}
            />
            <div className="flex items-center justify-center">
                <div
                    className='w-[512px] h-[512px] bg-black'
                    ref={viewerRefAxial}
                />
                <div
                    className='w-[512px] h-[512px] bg-black'
                    ref={viewerRefCoronal}
                />
                <div
                    className='w-[512px] h-[512px] bg-black'
                    ref={viewerRefSagittal}
                />
                <div
                    className='w-[512px] h-[512px] bg-black'
                    ref={viewerRefVolume}
                />
            </div>
        </>
    )
}

export default VolumeViewer