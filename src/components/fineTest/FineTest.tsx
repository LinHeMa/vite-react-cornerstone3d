// example0 (1st):fixed demo online wado dicom image https://github.com/cornerstonejs/vite-react-cornerstone3d/blob/main/src/App.tsx
// example1 (2nd version): read local file
//  https://www.cornerstonejs.org/live-examples/local.html
//  https://github.com/cornerstonejs/cornerstone3D/blob/3062aecefb4115e44735550afbf9f33996cf8a02/packages/tools/examples/local/index.ts#L140
//  setupSingleFileView
// example2 (3rd version): read files to render 3 views
//  https://www.cornerstonejs.org/live-examples/segmentationvolume
//  https://github.com/cornerstonejs/cornerstone3D/blob/a283bbc44d8baddc69cdd6ce56720e9c3241654a/packages/adapters/examples/segmentationVolume
//  setupMultpleViewports
// example 3 (4th ver): VOLUME_3D view
//  https://www.cornerstonejs.org/live-examples/volumeviewport3d
//  https://github.com/cornerstonejs/cornerstone3D/blob/a283bbc44d8baddc69cdd6ce56720e9c3241654a/packages/core/examples/volumeViewport3D/index.ts#L40
import { useEffect, useRef, useState } from 'react';
// import createImageIdsAndCacheMetaData from "./lib/createImageIdsAndCacheMetaData"
import * as cornerstone from '@cornerstonejs/core';
import {
  init as csRenderInit,
  Enums,
  RenderingEngine,
  Types /*, volumeLoader, imageLoader, metaData */,
} from '@cornerstonejs/core';
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { init as csToolsInit } from '@cornerstonejs/tools';
// import * as csDicomImageLoader from "@cornerstonejs/dicom-image-loader";
// import {
//   addManipulationBindings,
//   convertMultiframeImageIds /* initProviders, initVolumeLoader */,
//   prefetchMetadataInformation,
// } from './helper';
// import labelmapTools from './labelmapTools';
// import uids from './uids';
import { BrushTool } from '@cornerstonejs/tools';
import { addManipulationBindings } from '../../lib/addManipulationBindings';
import labelmapTools from '../../lib/labelMapTools';
import { convertMultiframeImageIds, prefetchMetadataInformation } from '../../utils/prefetchMetadataInformation';
const { segmentation: csToolsSegmentation } = cornerstoneTools;

const {
  PanTool,
  WindowLevelTool,
  StackScrollTool,
  ZoomTool,
  ToolGroupManager,
  Enums: csToolsEnums,
} = cornerstoneTools;

const { MouseBindings } = csToolsEnums;
const { ViewportType } = Enums;

const toolGroupId = 'myToolGroup';

// 1st version
// volumeLoader.registerUnknownVolumeLoader(
//   cornerstoneStreamingImageVolumeLoader
// )
// this component is copy from grimmer's code

// https://github.com/cornerstonejs/cornerstone3D/blob/3062aecefb4115e44735550afbf9f33996cf8a02/packages/tools/examples/local/index.ts#L140
function FineTest() {
  console.debug('app rendering');

  const elementRef = useRef<HTMLDivElement>(null);
  const element2Ref = useRef<HTMLDivElement>(null);
  const element3Ref = useRef<HTMLDivElement>(null);
  const element4Ref = useRef<HTMLDivElement>(null);

  const running = useRef(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  const viewport = useRef(null);

  const state = useRef({
    renderingEngine: null,
    renderingEngineId: 'MY_RENDERING_ENGINE_ID',
    toolGroup: null,
    toolGroupId: 'MY_TOOL_GROUP_ID',
    viewportIds: ['CT_AXIAL', 'CT_SAGITTAL', 'CT_CORONAL', 'CT_VOLUME'],
    volumeId: '',
    segmentationId: 'LOAD_SEG_ID:' + cornerstone.utilities.uuidv4(),
    referenceImageIds: [],
    skipOverlapping: false,
    segImageIds: [],
    devConfig: { ...new Map().values().next().value },
  });

  useEffect(() => {
    if (
      !elementRef.current ||
      !element2Ref.current ||
      !element3Ref.current ||
      !element4Ref.current
    ) {
      console.log('Rendering engine not initializing');
      return;
    }

    console.log('Rendering engine initializing');

    const setupMultpleViewports = async () => {
      /** ISSUE: if we init 3d tool first, then 2d tool would throw exceptions at
       * addManipulationBindings' toolGroup.addToolInstance(toolName, config.baseTool, config.configuration);
       */
      // 2d tool
      state.current.toolGroup = cornerstoneTools.ToolGroupManager.createToolGroup(
        state.current.toolGroupId,
      );
      addManipulationBindings(state.current.toolGroup, {
        toolMap: labelmapTools.toolMap,
      });
      cornerstoneTools.addTool(BrushTool);
      state.current.toolGroup.addToolInstance('CircularBrush', BrushTool.toolName, {
        activeStrategy: 'FILL_INSIDE_CIRCLE',
      });
      state.current.toolGroup.setToolActive('CircularBrush', {
        bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Primary }],
      });

      // 3d tool
      const toolGroupId = 'TOOL_GROUP_ID';
      const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
      // Add the tools to the tool group and specify which volume they are pointing at
      addManipulationBindings(toolGroup, {
        is3DViewport: true,
      });

      const renderingEngine = new RenderingEngine(state.current.renderingEngineId);

      const viewportInputArray = [
        {
          viewportId: state.current.viewportIds[0],
          type: cornerstone.Enums.ViewportType.ORTHOGRAPHIC,
          element: elementRef.current,
          defaultOptions: {
            orientation: cornerstone.Enums.OrientationAxis.AXIAL,
            background: [0.2, 0, 0.2] as Types.RGB,
          },
        },
        {
          viewportId: state.current.viewportIds[1],
          type: cornerstone.Enums.ViewportType.ORTHOGRAPHIC,
          element: element2Ref.current,
          defaultOptions: {
            orientation: cornerstone.Enums.OrientationAxis.SAGITTAL,
            background: [0.2, 0, 0.2] as Types.RGB,
          },
        },
        {
          viewportId: state.current.viewportIds[2],
          type: cornerstone.Enums.ViewportType.ORTHOGRAPHIC,
          element: element3Ref.current,
          defaultOptions: {
            orientation: cornerstone.Enums.OrientationAxis.CORONAL,
            background: [0.2, 0, 0.2] as Types.RGB,
          },
        },
        {
          viewportId: state.current.viewportIds[3],
          type: cornerstone.Enums.ViewportType.VOLUME_3D,
          element: element4Ref.current,
          defaultOptions: {
            orientation: cornerstone.Enums.OrientationAxis.CORONAL,
            background: [160 / 255, 164 / 255, 217 / 255] as Types.RGB,
          },
        },
      ];
      console.log('viewportInputArray', viewportInputArray, state.current);

      renderingEngine.setViewports(viewportInputArray);
      state.current.renderingEngine = renderingEngine;

      // 3d tool
      toolGroup.addViewport(state.current.viewportIds[3], state.current.renderingEngineId);
    };

    const setupSingleFileView = async () => {
      cornerstoneTools.addTool(PanTool);
      cornerstoneTools.addTool(WindowLevelTool);
      cornerstoneTools.addTool(StackScrollTool);
      cornerstoneTools.addTool(ZoomTool);

      // Define a tool group, which defines how mouse events map to tool commands for
      // Any viewport using the group
      const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);

      // Add tools to the tool group
      toolGroup.addTool(WindowLevelTool.toolName); // left press move
      toolGroup.addTool(PanTool.toolName); // middle press move
      toolGroup.addTool(ZoomTool.toolName); // double right click press move
      toolGroup.addTool(StackScrollTool.toolName);

      // Set the initial state of the tools, here all tools are active and bound to
      // Different mouse inputs
      toolGroup.setToolActive(WindowLevelTool.toolName, {
        bindings: [
          {
            mouseButton: MouseBindings.Primary, // Left Click
          },
        ],
      });
      toolGroup.setToolActive(PanTool.toolName, {
        bindings: [
          {
            mouseButton: MouseBindings.Auxiliary, // Middle Click
          },
        ],
      });
      toolGroup.setToolActive(ZoomTool.toolName, {
        bindings: [
          {
            mouseButton: MouseBindings.Secondary, // Right Click
          },
        ],
      });
      // As the Stack Scroll mouse wheel is a tool using the `mouseWheelCallback`
      // hook instead of mouse buttons, it does not need to assign any mouse button.
      toolGroup.setToolActive(StackScrollTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Wheel }],
      });
      // Get Cornerstone imageIds and fetch metadata into RAM
      // Instantiate a rendering engine
      const renderingEngineId = 'myRenderingEngine';
      const renderingEngine = new RenderingEngine(renderingEngineId);
      // Create a stack viewport
      const viewportId = 'CT_STACK';
      const viewportInput = {
        viewportId,
        type: ViewportType.STACK,
        element: elementRef.current,
        defaultOptions: {
          background: [0.2, 0, 0.2] as Types.RGB,
        },
      };
      renderingEngine.enableElement(viewportInput);
      // Get the stack viewport that was created
      viewport.current = renderingEngine.getViewport(viewportId); // as unknown as <Types.IStackViewport>;
      toolGroup.addViewport(viewportId, renderingEngineId);
    };

    // 1st version
    const setup = async () => {
      if (running.current) {
        return;
      }
      running.current = true;

      // 2nd
      // initMetaDataProviders();
      cornerstoneDICOMImageLoader.init({ maxWebWorkers: 1 });
      // 2nd: https://github.com/cornerstonejs/cornerstone3D/blob/3062aecefb4115e44735550afbf9f33996cf8a02/packages/tools/examples/local/index.ts#L140,
      // but it is not need for single file and 3 views about multiple files. Commenting out does not matter
      // initVolumeLoader();

      // await csRenderInit({ // 2nd
      //   peerImport,
      //   ...(config?.core ? config.core : {}),
      // });
      await csRenderInit(); //1st
      await csToolsInit(); //1st/2nd

      setupMultpleViewports(); // 3rd

      // 2nd
      // setupSingleFileView();

      // 2nd: for testings, you don't need any of these
      // volumeLoader.registerVolumeLoader('fakeVolumeLoader', fakeVolumeLoader);
      // imageLoader.registerImageLoader('fakeImageLoader', fakeImageLoader);
      // metaData.addProvider(fakeMetaDataProvider, 10000);

      // 1st
      // dicomImageLoaderInit({ maxWebWorkers: 1 })
      // // Get Cornerstone imageIds and fetch metadata into RAM
      // const imageIds = await createImageIdsAndCacheMetaData({
      //   StudyInstanceUID:
      //     "1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463",
      //   SeriesInstanceUID:
      //     "1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561",
      //   wadoRsRoot: "https://d3t6nz73ql33tx.cloudfront.net/dicomweb",
      // })
      // // Instantiate a rendering engine
      // const renderingEngineId = "myRenderingEngine"
      // const renderingEngine = new RenderingEngine(renderingEngineId)
      // const viewportId = "CT"
      // const viewportInput = {
      //   viewportId,
      //   type: Enums.ViewportType.ORTHOGRAPHIC,
      //   element: elementRef.current,
      //   defaultOptions: {
      //     orientation: Enums.OrientationAxis.SAGITTAL,
      //   },
      // }
      // renderingEngine.enableElement(viewportInput)
      // // Get the stack viewport that was created
      // const viewport = renderingEngine.getViewport(viewportId) as Types.IVolumeViewport
      // // Define a volume in memory
      // const volumeId = "streamingImageVolume"
      // const volume = await volumeLoader.createAndCacheVolume(volumeId, {
      //   imageIds,
      // })
      // // Set the volume to load
      // // @ts-ignore
      // volume.load()
      // // Set the volume on the viewport and it's default properties
      // viewport.setVolumes([{ volumeId }])
      // // Render the image
      // viewport.render()

      console.debug('Rendering engine initialized');
      setIsInitialized(true);
    };
    setup();

    // Create a stack viewport
  }, [elementRef, element2Ref, element3Ref, element4Ref, running]);

  const getSegmentationIds = () => {
    return csToolsSegmentation.state.getSegmentations().map((x) => x.segmentationId);
  };

  const restart = () => {
    console.debug('Restarting some ui state about multiple file upload');
    const { volumeId } = state.current;

    if (!volumeId) {
      return;
    }

    cornerstone.cache.removeVolumeLoadObject(volumeId);

    csToolsSegmentation.removeAllSegmentationRepresentations();

    const segmentationIds = getSegmentationIds();
    segmentationIds.forEach((segmentationId) => {
      csToolsSegmentation.state.removeSegmentation(segmentationId);
      cornerstone.cache.removeVolumeLoadObject(segmentationId);
    });
  };
  const loadDicomFiles = async () => {
    restart();

    const volumeLoaderScheme = 'cornerstoneStreamingImageVolume';

    const {
      volumeId,
      toolGroup,
      referenceImageIds,
      viewportIds,
      renderingEngineId,
      renderingEngine,
    } = state.current;

    const { utilities: csUtilities } = cornerstone;

    state.current.volumeId = volumeLoaderScheme + ':' + csUtilities.uuidv4();
    const volume = await cornerstone.volumeLoader.createAndCacheVolume(state.current.volumeId, {
      imageIds: referenceImageIds,
    });

    // 2d tool
    toolGroup.addViewport(viewportIds[0], renderingEngineId);
    toolGroup.addViewport(viewportIds[1], renderingEngineId);
    toolGroup.addViewport(viewportIds[2], renderingEngineId);
    // toolGroup.addViewport(viewportIds[3], renderingEngineId);

    await volume.load();

    const viewport = renderingEngine.getViewport(viewportIds[3]);

    await cornerstone.setVolumesForViewports(
      renderingEngine,
      [{ volumeId: state.current.volumeId }],
      viewportIds,
    );

    viewport.setProperties({
      // preset candidates
      // https://github.com/cornerstonejs/cornerstone3D/blob/main/packages/core/src/constants/viewportPresets.ts
      preset: 'MR-MIP', //'CT-Bone',
    });

    renderingEngine.render();
    // viewport.render(); // also work to render 4 views and one is VOLUME_3D
  };
  const readDicomFiles = async (files: File[]) => {
    // read file
    // https://github.com/cornerstonejs/cornerstone3D/blob/a283bbc44d8baddc69cdd6ce56720e9c3241654a/packages/adapters/examples/segmentationVolume/utils.ts#L13
    for (const file of files) {
      const imageId = cornerstoneDICOMImageLoader.wadouri.fileManager.add(file);
      await cornerstone.imageLoader.loadAndCacheImage(imageId);
      // state.referenceImageIds.push(imageId);
      state.current.referenceImageIds.push(imageId);
    }
  };

  const handleMultipleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement> | Event,
  ): Promise<void> => {
    const files = Array.from((event.target as HTMLInputElement).files || []);
    await readDicomFiles(files);
    await loadDicomFiles();
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement> | Event,
  ): Promise<void> => {
    event.stopPropagation();
    event.preventDefault();

    const files = Array.from((event.target as HTMLInputElement).files || []);
    if (files.length === 0) return;

    try {
      console.log('Loading files:', files);

      const imageId = cornerstoneDICOMImageLoader.wadouri.fileManager.add(files[0]);

      console.log('Image ID:', imageId);

      loadAndViewImage(imageId);
    } catch (error) {
      console.error('Error loading DICOM files:', error);
    }
  };

  const loadAndViewImage = async function (imageId) {
    await prefetchMetadataInformation([imageId]);
    const stack = convertMultiframeImageIds([imageId]);
    // Set the stack on the viewport
    viewport.current.setStack(stack).then(() => {
      // Set the VOI of the stack
      // viewport.setProperties({ voiRange: ctVoiRange });
      // Render the image
      viewport.current.render();

      // const imageData = viewport.getImageData();
      // const {
      //   pixelRepresentation,
      //   bitsAllocated,
      //   bitsStored,
      //   highBit,
      //   photometricInterpretation,
      // } = metaData.get('imagePixelModule', imageId);

      // const voiLutModule = metaData.get('voiLutModule', imageId);
      // const sopCommonModule = metaData.get('sopCommonModule', imageId);
      // const transferSyntax = metaData.get('transferSyntax', imageId);

      // document.getElementById('transfersyntax').innerHTML =
      //   transferSyntax.transferSyntaxUID;
      // document.getElementById('sopclassuid').innerHTML = `${
      //   sopCommonModule.sopClassUID
      // } [${uids[sopCommonModule.sopClassUID]}]`;
      // document.getElementById('sopinstanceuid').innerHTML =
      //   sopCommonModule.sopInstanceUID;
      // document.getElementById('rows').innerHTML = imageData.dimensions[0];
      // document.getElementById('columns').innerHTML = imageData.dimensions[1];
      // document.getElementById('spacing').innerHTML = imageData.spacing.join('\\');
      // document.getElementById('direction').innerHTML = imageData.direction
      //   .map((x) => Math.round(x * 100) / 100)
      //   .join(',');

      // document.getElementById('origin').innerHTML = imageData.origin
      //   .map((x) => Math.round(x * 100) / 100)
      //   .join(',');
      // document.getElementById('modality').innerHTML = imageData.metadata.Modality;

      // document.getElementById('pixelrepresentation').innerHTML =
      //   pixelRepresentation;
      // document.getElementById('bitsallocated').innerHTML = bitsAllocated;
      // document.getElementById('bitsstored').innerHTML = bitsStored;
      // document.getElementById('highbit').innerHTML = highBit;
      // document.getElementById('photometricinterpretation').innerHTML =
      //   photometricInterpretation;
      // document.getElementById('windowcenter').innerHTML =
      //   voiLutModule.windowCenter;
      // document.getElementById('windowwidth').innerHTML = voiLutModule.windowWidth;
    });
  };

  return (
    <div>
      <h1 className='text-3xl font-bold underline'>Hello world!</h1>
      <button
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = '.dcm';
          input.addEventListener('change', handleFileUpload);
          input.click();
        }}
        className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'
        disabled={!isInitialized}
      >
        Select single DICOM file
      </button>

      <button
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = '.dcm';
          input.addEventListener('change', handleMultipleFileUpload);
          input.click();
        }}
        className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'
        disabled={!isInitialized}
      >
        Select multiple DICOM files
      </button>

      <div className='flex flex-row'>
        <div
          ref={elementRef}
          style={{
            width: '512px',
            height: '512px',
            backgroundColor: '#000',
          }}
        ></div>
        <div
          ref={element2Ref}
          style={{
            width: '512px',
            height: '512px',
            backgroundColor: '#123',
          }}
        ></div>
        <div
          ref={element3Ref}
          style={{
            width: '512px',
            height: '512px',
            backgroundColor: '#123',
          }}
        ></div>
        <div
          ref={element4Ref}
          style={{
            width: '512px',
            height: '512px',
            backgroundColor: '#123',
          }}
        ></div>
      </div>
    </div>
  );
}

export default FineTest;
