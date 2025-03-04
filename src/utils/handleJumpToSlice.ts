import { utilities } from "@cornerstonejs/core";
import { type FileDataRefType } from "../components/volume/types"

/**
 * 跳轉到指定的切片索引
 * @param ref - 包含渲染引擎和視口ID的引用對象
 * @param targetIndex - 目標切片索引
 */
const handleJumpToSlice = (
    ref: React.MutableRefObject<FileDataRefType>,
    targetIndex: number
) => {
    const { renderingEngine, viewportIds } = ref.current;
    
    // 獲取Axial視圖 (索引0)
    const viewport = renderingEngine.getViewport(viewportIds[0]);
    
    // 使用 utilities.jumpToSlice 跳轉到指定切片
    utilities.jumpToSlice(viewport.element, {
        imageIndex: targetIndex
    });
    
    // 可選：記錄跳轉信息
    const currentIndex = viewport.getCurrentImageIdIndex();
    console.log({ previous: currentIndex, target: targetIndex });
};

export { handleJumpToSlice };