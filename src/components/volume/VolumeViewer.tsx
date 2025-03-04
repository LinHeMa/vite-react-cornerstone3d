import React, { useEffect, useRef, useState } from 'react'
import { init as csRenderInit, Enums, RenderingEngine, setVolumesForViewports, Types, volumeLoader, utilities as csUtilities, imageLoader, cache } from "@cornerstonejs/core"
import { addTool, BrushTool, init as csToolsInit, ToolGroupManager, segmentation, Enums as ToolEnums } from "@cornerstonejs/tools"
import cornerstoneDICOMImageLoader, { init as dicomImageLoaderInit } from "@cornerstonejs/dicom-image-loader"
import { addManipulationBindings } from '../../lib/addManipulationBindings'
import labelmapTools from '../../lib/labelMapTools'
import { MouseBindings } from '@cornerstonejs/tools/enums'
import { type FileDataRefType } from './types'
import { BlendModes, Events } from '@cornerstonejs/core/enums'
import { handleJumpToSlice } from '../../utils/handleJumpToSlice'
import { EventTypes } from '@cornerstonejs/core/types'


const VolumeViewer = () => {
    const fileDataRef = useRef<FileDataRefType>({
        renderingEngine: null,
        renderingEngineId: 'MY_RENDERING_ENGINE_ID',
        toolGroup2D: null,
        toolGroupId2D: 'MY_2D_TOOL_GROUP_ID',
        toolGroup3D: null,
        toolGroupId3D: 'MY_3D_TOOL_GROUP_ID',
        viewportIds: ['CT_AXIAL', 'CT_SAGITTAL', 'CT_CORONAL', 'CT_VOLUME'],
        volumeId: '',
        fileList: [],
        imageIdList: [],
        segmentationId: 'LOAD_SEG_ID:' + csUtilities.uuidv4(),
    });
    const running = useRef(false);
    const [isLoading, setIsLoading] = useState(false);
    const viewerRefAxial = useRef<HTMLDivElement>(null);
    const viewerRefCoronal = useRef<HTMLDivElement>(null);
    const viewerRefSagittal = useRef<HTMLDivElement>(null);
    const viewerRefVolume = useRef<HTMLDivElement>(null);

    // 新增一個狀態來追蹤選中的切片索引 
    const [selectedSlice, setSelectedSlice] = useState<number>(0);
    const [totalSlices, setTotalSlices] = useState<number>(0);

    const restart = () => {
        setIsLoading(true)
        console.debug('Restarting some ui state about multiple file upload');
        const { volumeId } = fileDataRef.current;

        if (!volumeId) {
            console.error('volumeId is not set')
            return;
        }

        cache.removeVolumeLoadObject(volumeId);
        setIsLoading(false)
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
        const volumeLoaderScheme = 'cornerstoneStreamingImageVolume';
        const {
            imageIdList,
            viewportIds,
            renderingEngine,
        } = fileDataRef.current;

        if (!renderingEngine || imageIdList.length === 0) {
            console.error('渲染引擎未初始化或沒有圖像');
            return;
        }

        fileDataRef.current.volumeId = `${volumeLoaderScheme}:${csUtilities.uuidv4()}`
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

    // 新增一個函數來處理選擇變更
    const handleSliceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const index = parseInt(event.target.value);
        handleJumpToSlice(fileDataRef, index);
        setSelectedSlice(index);
    };

    // 在載入圖像後更新總切片數
    useEffect(() => {
        if (fileDataRef.current.renderingEngine && fileDataRef.current.viewportIds) {
            const viewport = fileDataRef.current.renderingEngine.getViewport(
                fileDataRef.current.viewportIds[0]
            );
            if (viewport) {
                const numberOfSlices = viewport.getNumberOfSlices();
                setTotalSlices(numberOfSlices || 0);
            }
        }
    }); // 當圖像列表改變時更新


    // 監聽viewport的scroll事件
    useEffect(() => {
        // 當viewport初始化完成後，添加事件監聽器
        if (fileDataRef.current.renderingEngine && fileDataRef.current.viewportIds) {
            const viewport = fileDataRef.current.renderingEngine.getViewport(
                fileDataRef.current.viewportIds[0]
            );

            // 監聽viewport的scroll事件
            viewport.element.addEventListener(Events.IMAGE_RENDERED, () => {
                const currentIndex = viewport.getCurrentImageIdIndex();
                setSelectedSlice(currentIndex);
            });

            // 清理函數
            return () => {
                viewport.element.removeEventListener(Events.IMAGE_RENDERED, () => {
                    const currentIndex = viewport.getCurrentImageIdIndex();
                    setSelectedSlice(currentIndex);
                });
            };
        }
    }, [fileDataRef.current.renderingEngine, fileDataRef.current.viewportIds, isLoading]);

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
            setIsLoading(true)

            // cornerstoneDICOMImageLoader.init({ maxWebWorkers: 1 });
            dicomImageLoaderInit({ maxWebWorkers: 1 });
            await csRenderInit();
            await csToolsInit();
            setupMultpleViewports();
            console.debug('Rendering engine initialized');
            setIsLoading(false)
        }

        setup()
    }, [viewerRefAxial, viewerRefCoronal, viewerRefSagittal, viewerRefVolume, running])

    return (
        <div className='container p-4 flex flex-col items-center justify-center'>
            <input
                className='cursor-pointer border border-gray-300 rounded-md p-2 mb-4'
                type="file"
                multiple
                accept=".dcm"
                onChange={handleMultipleFileUpload}
            />
            {totalSlices > 0 && <select
                value={selectedSlice}
                onChange={handleSliceChange}
                className='mb-4 p-2 border border-gray-300 rounded-md'
            >
                {Array.from({ length: totalSlices }, (_, i) => (
                    <option key={i} value={i}>
                        跳轉到切片 {i}
                    </option>
                ))}
            </select>}
            <div className="grid grid-cols-2 gap-4">
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
        </div>
    )
}

export default VolumeViewer