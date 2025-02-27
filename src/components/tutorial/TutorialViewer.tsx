import { useEffect, useRef } from "react"
import { RenderingEngine, Enums, type Types, volumeLoader, cornerstoneStreamingImageVolumeLoader, imageLoader } from "@cornerstonejs/core"
import { init as csRenderInit } from "@cornerstonejs/core"
import { init as csToolsInit } from "@cornerstonejs/tools"
import cornerstoneDICOMImageLoader, { init as dicomImageLoaderInit } from "@cornerstonejs/dicom-image-loader"
import { convertMultiframeImageIds, prefetchMetadataInformation } from "../../utils/prefetchMetadataInformation"


volumeLoader.registerUnknownVolumeLoader(
  cornerstoneStreamingImageVolumeLoader
)

function TutorialViewer() {
  const elementRef = useRef<HTMLDivElement>(null)
  const running = useRef(false)
  const fileDataRef = useRef({ imageIdList: [] })
  const viewportRef = useRef(null)
  
  const loadAndViewImage = async function (imageId) {
    await prefetchMetadataInformation([imageId]);
    const stack = convertMultiframeImageIds([imageId]);
    
    // 確保渲染引擎和視口已經創建
    if (viewportRef.current) {
      // 使用正確的視口API
      viewportRef.current.setStack(stack, 0).then(() => {
        viewportRef.current.render();
      });
    } else {
      console.warn('視口尚未初始化');
    }
  }
  const handleSingleFileUpload = async (event: React.ChangeEvent<HTMLInputElement> | Event) => {
    const files = Array.from((event.target as HTMLInputElement).files || []);
    if (files.length === 0) {
      console.warn('沒有選擇文件');
      return;
    }
    const file = files[0];
    const imageId = await cornerstoneDICOMImageLoader.wadouri.fileManager.add(file)
    loadAndViewImage(imageId)
    await imageLoader.loadAndCacheImage(imageId);
    fileDataRef.current.imageIdList.push(imageId)
  }

  useEffect(() => {
    const setup = async () => {
      if (running.current) {
        return
      }
      running.current = true

      await csRenderInit()
      await csToolsInit()
      dicomImageLoaderInit({ maxWebWorkers: 1 })

      // 即使沒有文件也初始化渲染引擎
      const renderingEngineId = "myRenderingEngine"
      const renderingEngine = new RenderingEngine(renderingEngineId)
      const viewportId = "CT"

      const viewportInput = {
        viewportId,
        type: Enums.ViewportType.STACK, // 修改為STACK類型
        element: elementRef.current,
      }

      renderingEngine.enableElement(viewportInput)

      // 獲取並保存視口引用
      const viewport = renderingEngine.getViewport(viewportId)
      viewportRef.current = viewport

      // 如果已有圖像，則加載
      if (fileDataRef.current.imageIdList.length > 0) {
        loadAndViewImage(fileDataRef.current.imageIdList[0]);
      }
    }

    setup()
  }, [elementRef, running])

  return (
    <>
      <input
        type="file"
        accept=".dcm"
        onChange={handleSingleFileUpload}
      />
      <div
        ref={elementRef}
        style={{
          width: "512px",
          height: "512px",
          backgroundColor: "#000",
        }}
      ></div>
    </>
  )
}

export default TutorialViewer
